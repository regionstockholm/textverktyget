/**
 * File Upload Routes
 * Handles document upload and text extraction
 */

import express, { Request, Response } from "express";
import multer, { type FileFilterCallback } from "multer";
import { promises as fs } from "fs";
import { extractTextFromDocument } from "../services/document/document-processor.js";
import {
  UPLOAD_CONFIG,
  generateSecureFilename,
  ensureUploadDir,
} from "../services/upload/file-storage-service.js";
import { validateFile } from "../services/upload/file-validation-service.js";
import { sendError, sendSuccess } from "../utils/api/api-responses.js";
import { rateLimiters } from "../utils/api/rate-limits.js";
import { config } from "../config/app-config.js";
import { logger } from "../utils/logger.js";
import configService from "../services/config/config-service.js";
import { readRuntimeInteger } from "../utils/runtime-number.js";

const router = express.Router();
const DEFAULT_UPLOAD_MAX_FILE_SIZE_MB = config.security.maxFileSizeMB;

function getRequestMaxUploadSizeMb(req: Request): number {
  const candidate = (req as Request & { uploadMaxFileSizeMB?: unknown })
    .uploadMaxFileSizeMB;
  return readRuntimeInteger(
    candidate,
    DEFAULT_UPLOAD_MAX_FILE_SIZE_MB,
    1,
    100,
    "round",
  );
}

async function resolveUploadMaxFileSizeMB(): Promise<number> {
  try {
    const runtimeSettings = await configService.getRuntimeSettings();
    const uploadSettings = runtimeSettings.upload;
    if (
      uploadSettings &&
      typeof uploadSettings === "object" &&
      !Array.isArray(uploadSettings)
    ) {
      return readRuntimeInteger(
        (uploadSettings as Record<string, unknown>).maxFileSizeMB,
        DEFAULT_UPLOAD_MAX_FILE_SIZE_MB,
        1,
        100,
        "round",
      );
    }
  } catch {
    // Ignore runtime settings fetch failures and use default
  }

  return DEFAULT_UPLOAD_MAX_FILE_SIZE_MB;
}

// Ensure upload directory exists
ensureUploadDir().catch((error) => {
  logger.error("upload.init.failed", {
    processStatus: "failed",
    meta: { error: error instanceof Error ? error.message : "Unknown error" },
  });
});

/**
 * Multer configuration for file uploads
 */
const storage = multer.diskStorage({
  destination: (
    _req: Request,
    _file: Express.Multer.File,
    cb: (error: Error | null, destination: string) => void,
  ) => {
    cb(null, UPLOAD_CONFIG.UPLOAD_DIR);
  },
  filename: (
    _req: Request,
    file: Express.Multer.File,
    cb: (error: Error | null, filename: string) => void,
  ) => {
    const secureFilename = generateSecureFilename(file.originalname);
    cb(null, secureFilename);
  },
});

function createUploadMiddleware(maxFileSizeMB: number) {
  return multer({
    storage,
    limits: {
      fileSize: maxFileSizeMB * 1024 * 1024,
      files: config.security.maxFilesPerUpload,
    },
    fileFilter: (
      _req: Request,
      file: Express.Multer.File,
      cb: FileFilterCallback,
    ) => {
      const validation = validateFile(file);
      if (!validation.isValid) {
        cb(new Error(validation.errors?.[0] || "Invalid file"));
        return;
      }
      cb(null, true);
    },
  }).single("document");
}

async function applyDynamicUploadLimit(
  req: Request,
  res: Response,
  next: express.NextFunction,
): Promise<void> {
  const maxFileSizeMB = await resolveUploadMaxFileSizeMB();
  (req as Request & { uploadMaxFileSizeMB?: number }).uploadMaxFileSizeMB =
    maxFileSizeMB;

  const middleware = createUploadMiddleware(maxFileSizeMB);
  middleware(req, res, next);
}

/**
 * POST /upload/document
 * Upload and extract text from document files (multipart/form-data)
 * Files are immediately deleted after processing
 */
router.post(
  "/document",
  rateLimiters.fileUpload,
  applyDynamicUploadLimit,
  async (req: Request, res: Response): Promise<void> => {
    const startTime = Date.now();
    let filePath: string | undefined;

    try {
      if (!req.file) {
        sendError(res, 400, "No file uploaded");
        return;
      }

      const uploadedFile = req.file;
      filePath = uploadedFile.path;
      logger.info("upload.process.started", {
        processStatus: "running",
        meta: { filename: uploadedFile.originalname, size: uploadedFile.size },
      });

      // Extract text from the uploaded document
      const fileBuffer = await fs.readFile(uploadedFile.path);
      const extractedText = await extractTextFromDocument(
        fileBuffer,
        uploadedFile.originalname,
      );

      if (!extractedText || extractedText.trim().length === 0) {
        sendError(
          res,
          422,
          "No text content could be extracted from the document",
        );
        return;
      }

      const processingTime = Date.now() - startTime;
      logger.info("upload.process.completed", {
        processStatus: "completed",
        meta: { filename: uploadedFile.originalname, processingTime },
      });

      sendSuccess(res, {
        filename: uploadedFile.originalname,
        extractedText,
        textLength: extractedText.length,
        processingTime,
      });
    } catch (error) {
      logger.error("upload.process.failed", {
        processStatus: "failed",
        meta: { error: error instanceof Error ? error.message : "Unknown error" },
      });

      if (error instanceof Error) {
        if (error.message.includes("File too large")) {
          sendError(res, 413, "File size exceeds maximum limit");
        } else if (error.message.includes("Invalid file")) {
          sendError(res, 415, "Unsupported file type");
        } else {
          sendError(
            res,
            500,
            "Document processing failed",
            undefined,
          );
        }
      } else {
        sendError(res, 500, "Unknown error occurred");
      }
    } finally {
      // Always clean up the uploaded file, even if processing failed
      if (filePath) {
        try {
          await fs.unlink(filePath);
          logger.debug("upload.temp.cleaned", {
            processStatus: "completed",
            meta: { filePath },
          });
        } catch (cleanupError) {
          logger.warn("upload.temp.cleanup_failed", {
            processStatus: "running",
            meta: {
              filePath,
              error:
                cleanupError instanceof Error
                  ? cleanupError.message
                  : "Unknown error",
            },
          });
        }
      }
    }
  },
);

/**
 * POST /upload/process-document
 * Process document from base64 encoded data (JSON payload)
 */
router.post(
  "/process-document",
  rateLimiters.fileUpload,
  async (req: Request, res: Response): Promise<void> => {
    const startTime = Date.now();
    logger.info("upload.process.started", {
      processStatus: "running",
      meta: { route: "/upload/process-document" },
    });

    try {
      const { fileData, fileName } = req.body;

      if (!fileData || !fileName) {
        logger.warn("upload.process.invalid_request", {
          processStatus: "failed",
          meta: { hasFileData: !!fileData, hasFileName: !!fileName },
        });
        sendError(res, 400, "Missing fileData or fileName");
        return;
      }

      // Validate base64 format before decoding
      // Base64 regex: allows alphanumeric, +, /, = (padding) and whitespace
      const base64Regex = /^[A-Za-z0-9+/\s]*={0,2}$/;
      if (!base64Regex.test(fileData)) {
        logger.warn("upload.process.invalid_base64", {
          processStatus: "failed",
          meta: { fileName },
        });
        sendError(res, 400, "Invalid base64 data format");
        return;
      }

      // Decode base64 to buffer
      let fileBuffer: Buffer;
      try {
        fileBuffer = Buffer.from(fileData, "base64");

        // Verify the decoded data is valid (not empty and reasonable size)
        if (fileBuffer.length === 0) {
          throw new Error("Decoded buffer is empty");
        }
      } catch (decodeError) {
        logger.warn("upload.process.decode_failed", {
          processStatus: "failed",
          meta: {
            fileName,
            error:
              decodeError instanceof Error ? decodeError.message : "Unknown error",
          },
        });
        sendError(res, 400, "Failed to decode base64 data");
        return;
      }

      // Validate file size
      const maxFileSizeMB = await resolveUploadMaxFileSizeMB();
      const maxFileSize = maxFileSizeMB * 1024 * 1024;
      if (fileBuffer.length > maxFileSize) {
        logger.warn("upload.process.file_too_large", {
          processStatus: "failed",
          meta: { fileName, size: fileBuffer.length, maxFileSize },
        });
        sendError(
          res,
          413,
          `File too large. Maximum size is ${maxFileSizeMB}MB`,
        );
        return;
      }

      // Extract text from the document buffer
      const extractedText = await extractTextFromDocument(fileBuffer, fileName);

      if (!extractedText || extractedText.trim().length === 0) {
        logger.warn("upload.process.empty_text", {
          processStatus: "failed",
          meta: { fileName },
        });
        sendError(
          res,
          422,
          "No text content could be extracted from the document",
        );
        return;
      }

      const processingTime = Date.now() - startTime;

      // Return response in format expected by client
      const responseData = {
        text: extractedText,
        textLength: extractedText.length,
        originalLength: fileBuffer.length,
        processingTime,
      };

      logger.info("upload.process.completed", {
        processStatus: "completed",
        meta: { fileName, textLength: responseData.textLength, processingTime },
      });

      sendSuccess(res, responseData);
    } catch (error) {
      logger.error("upload.process.failed", {
        processStatus: "failed",
        meta: { error: error instanceof Error ? error.message : "Unknown error" },
      });

      if (error instanceof Error) {
        if (error.message.includes("File too large")) {
          sendError(res, 413, "File size exceeds maximum limit");
        } else if (
          error.message.includes("Invalid file") ||
          error.message.includes("Unsupported file type")
        ) {
          sendError(res, 415, "Unsupported file type");
        } else {
          sendError(
            res,
            500,
            "Document processing failed",
            undefined,
          );
        }
      } else {
        sendError(res, 500, "Unknown error occurred");
      }
    }
  },
);

/**
 * Error handler for multer file upload errors
 */
router.use((error: any, req: Request, res: Response, _next: any) => {
  if (error instanceof multer.MulterError) {
    if (error.code === "LIMIT_FILE_SIZE") {
      const maxFileSizeMB = getRequestMaxUploadSizeMb(req);
      sendError(
        res,
        413,
        `File too large. Maximum size is ${maxFileSizeMB}MB`,
      );
    } else if (error.code === "LIMIT_FILE_COUNT") {
      sendError(
        res,
        400,
        `Too many files. Maximum ${config.security.maxFilesPerUpload} file(s) allowed per request`,
      );
    } else {
      sendError(res, 400, `Upload error: ${error.message}`);
    }
  } else if (error) {
    sendError(res, 400, error.message || "Upload failed");
  } else {
    _next();
  }
});

export default router;

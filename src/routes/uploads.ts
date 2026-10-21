/**
 * File Upload Routes
 * Handles document upload and text extraction
 */

import express from "express";
import type { Request, Response } from "express";
import { extractTextFromDocument } from "../services/document/document-processor.js";
import { sendError, sendSuccess } from "../utils/api/api-responses.js";
import { rateLimiters } from "../utils/api/rate-limits.js";
import { config } from "../config/app-config.js";
import { logger } from "../utils/logger.js";
import configService from "../services/config/config-service.js";
import { readRuntimeInteger } from "../utils/runtime-number.js";
import { getFileExtension } from "../utils/file/file-type-policy.js";

const router = express.Router();
const DEFAULT_UPLOAD_MAX_FILE_SIZE_MB = config.security.maxFileSizeMB;
const BASE64_DATA_REGEX = /^[A-Za-z0-9+/\s]*={0,2}$/;

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

/**
 * POST /upload/process-document
 * Process document from base64 encoded data (JSON payload)
 */
router.post(
  "/process-document",
  rateLimiters.fileUpload,
  async (req, res, next) => {
    try {
      const maxFileSizeMB = await resolveUploadMaxFileSizeMB();
      res.locals.uploadMaxFileSizeMB = maxFileSizeMB;
      express.json({ limit: uploadJsonByteLimit(maxFileSizeMB) })(req, res, error => {
        if (!error) { next(); return; }
        sendError(res, error.type === "entity.too.large" ? 413 : 400, "Invalid or oversized document upload");
      });
    } catch { sendError(res, 503, "Upload settings unavailable"); }
  },
  async (req: Request, res: Response): Promise<void> => {
    const startTime = Date.now();
    logger.info("upload.process.started", {
      processStatus: "running",
      meta: { route: "/upload/process-document" },
    });

    try {
      const { fileData, fileName } = req.body ?? {};

      if (typeof fileData !== "string" || !fileData || typeof fileName !== "string" || !fileName || fileName.length > 1024) {
        logger.warn("upload.process.invalid_request", {
          processStatus: "failed",
          meta: { hasFileData: !!fileData, hasFileName: !!fileName },
        });
        sendError(res, 400, "Missing fileData or fileName");
        return;
      }

      if (!BASE64_DATA_REGEX.test(fileData)) {
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
              decodeError instanceof Error
                ? decodeError.message
                : "Unknown error",
          },
        });
        sendError(res, 400, "Failed to decode base64 data");
        return;
      }

      // Validate file size
      const maxFileSizeMB = res.locals.uploadMaxFileSizeMB as number;
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
        extractionWarnings: getFileExtension(fileName) === "txt" ? [] : ["Endast maskinläsbar dokumenttext har extraherats. Text i bilder, skannade sidor, inbäddningar och vissa dokumentdelar kan saknas. Kontrollera hela underlaget; bildtext behöver OCR före bearbetning."],
      };

      logger.info("upload.process.completed", {
        processStatus: "completed",
        meta: { fileName, textLength: responseData.textLength, processingTime },
      });

      sendSuccess(res, responseData);
    } catch (error) {
      logger.error("upload.process.failed", {
        processStatus: "failed",
        meta: {
          error: error instanceof Error ? error.message : "Unknown error",
        },
      });

      if (error instanceof Error) {
        if (error.message.includes("Document processing busy")) {
          res.setHeader("Retry-After", "5");
          sendError(res, 503, "Document processing busy. Try again shortly.");
        } else if (error.message.includes("File too large")) {
          sendError(res, 413, "File size exceeds maximum limit");
        } else if (
          error.message.includes("Invalid file") ||
          error.message.includes("Unsupported file type")
        ) {
          sendError(res, 415, "Unsupported file type");
        } else {
          sendError(res, 422, "Dokumentet kunde inte läsas fullständigt. Kontrollera format, teckenkodning och om dokumentet kräver OCR.");
        }
      } else {
        sendError(res, 500, "Unknown error occurred");
      }
    }
  },
);

export function uploadJsonByteLimit(maxFileSizeMB: number): number {
  return 4 * Math.ceil(maxFileSizeMB * 1024 * 1024 / 3) + 64 * 1024;
}

router.get("/config", rateLimiters.standard, async (_req, res) => {
  res.setHeader("Cache-Control", "no-store");
  try { sendSuccess(res, { maxFileSizeMB: await resolveUploadMaxFileSizeMB() }); }
  catch { sendError(res, 503, "Upload settings unavailable"); }
});

export default router;

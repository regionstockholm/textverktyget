export type SupportedFileExtension =
  | "doc"
  | "docx"
  | "xls"
  | "xlsx"
  | "ppt"
  | "pptx"
  | "pdf"
  | "txt"
  | "rtf";

type SupportedFileType = {
  extension: SupportedFileExtension;
  mimeTypes: readonly string[];
};

const SUPPORTED_FILE_TYPES: readonly SupportedFileType[] = [
  { extension: "doc", mimeTypes: ["application/msword"] },
  {
    extension: "docx",
    mimeTypes: [
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ],
  },
  { extension: "xls", mimeTypes: ["application/vnd.ms-excel"] },
  {
    extension: "xlsx",
    mimeTypes: [
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ],
  },
  { extension: "ppt", mimeTypes: ["application/vnd.ms-powerpoint"] },
  {
    extension: "pptx",
    mimeTypes: [
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    ],
  },
  { extension: "pdf", mimeTypes: ["application/pdf"] },
  { extension: "txt", mimeTypes: ["text/plain"] },
  { extension: "rtf", mimeTypes: ["application/rtf", "text/rtf"] },
];

export const SUPPORTED_FORMATS: Record<SupportedFileExtension, string> =
  Object.fromEntries(
    SUPPORTED_FILE_TYPES.map((type) => [type.extension, type.mimeTypes[0]]),
  ) as Record<SupportedFileExtension, string>;

export function getSupportedExtensions(): string[] {
  return SUPPORTED_FILE_TYPES.map((type) => `.${type.extension}`);
}

export function getAllowedMimeTypes(): string[] {
  return [...new Set(SUPPORTED_FILE_TYPES.flatMap((type) => type.mimeTypes))];
}

export function getFileExtension(filename: string): string {
  return filename.split(".").pop()?.toLowerCase() || "";
}

export function isSupportedExtension(extension: string): boolean {
  const normalized = extension.startsWith(".")
    ? extension.slice(1).toLowerCase()
    : extension.toLowerCase();

  return SUPPORTED_FILE_TYPES.some((type) => type.extension === normalized);
}

export function isMimeTypeAllowed(mimetype: string): boolean {
  const normalized = mimetype.toLowerCase();
  return getAllowedMimeTypes().some(
    (allowed) => normalized === allowed || normalized.includes(allowed),
  );
}

export function isSupportedFileType(filename: string, mimetype: string): boolean {
  const extension = getFileExtension(filename);
  const policy = SUPPORTED_FILE_TYPES.find((type) => type.extension === extension);
  if (!policy) {
    return false;
  }

  const normalizedMimeType = mimetype.toLowerCase();
  return policy.mimeTypes.some(
    (allowed) =>
      normalizedMimeType === allowed || normalizedMimeType.includes(allowed),
  );
}

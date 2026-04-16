import crypto from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;

function getMasterKey(): Buffer {
  const masterKey = process.env.CONFIG_MASTER_KEY || "";
  if (!masterKey) {
    throw new Error("CONFIG_MASTER_KEY is required for secret encryption");
  }

  return crypto.createHash("sha256").update(masterKey, "utf8").digest();
}

export function encryptSecretValue(plaintext: string): string {
  if (typeof plaintext !== "string" || plaintext.length === 0) {
    throw new Error("Secret value must be a non-empty string");
  }

  const key = getMasterKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  return [
    iv.toString("base64"),
    tag.toString("base64"),
    encrypted.toString("base64"),
  ].join(":");
}

export function decryptSecretValue(cipherText: string): string | null {
  if (typeof cipherText !== "string" || cipherText.length === 0) {
    return null;
  }

  const parts = cipherText.split(":");
  if (parts.length !== 3) {
    return null;
  }

  const [ivPart, tagPart, dataPart] = parts;
  if (!ivPart || !tagPart || !dataPart) {
    return null;
  }

  const key = getMasterKey();
  const iv = Buffer.from(ivPart, "base64");
  const tag = Buffer.from(tagPart, "base64");
  const encrypted = Buffer.from(dataPart, "base64");

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);

  const decrypted = Buffer.concat([
    decipher.update(encrypted),
    decipher.final(),
  ]);

  return decrypted.toString("utf8");
}

export function maskSecretValue(value: string): string {
  if (!value) {
    return "****";
  }

  const trimmed = value.trim();
  if (trimmed.length <= 4) {
    return "****";
  }

  return `****${trimmed.slice(-4)}`;
}

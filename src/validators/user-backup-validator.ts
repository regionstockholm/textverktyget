// Backup format and validation shared with the browser panel; keep this module free of server dependencies.
export const MAX_BACKUP_BYTES = 1024 * 1024;
export const MAX_BACKUP_USERS = 5000;

export type UserBackup = {
  format: "textverktyg-user-backup";
  version: 1;
  exportedAt: string;
  users: { username: string; passwordHash: string }[];
};

export class InvalidUserBackupError extends Error {}

function invalid(): never {
  throw new InvalidUserBackupError("Invalid user backup: check format, version, usernames and bcrypt hashes (cost 12). Maximum 5,000 users and 1 MiB.");
}

function exactKeys(value: unknown, keys: string[]): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value)
    && Object.keys(value).length === keys.length
    && keys.every(key => Object.hasOwn(value, key));
}

export function validateUserBackup(value: unknown): UserBackup {
  if (!exactKeys(value, ["format", "version", "exportedAt", "users"])) invalid();
  if (value.format !== "textverktyg-user-backup" || value.version !== 1
    || typeof value.exportedAt !== "string"
    || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value.exportedAt)
    || !Number.isFinite(Date.parse(value.exportedAt))
    || new Date(value.exportedAt).toISOString() !== value.exportedAt
    || !Array.isArray(value.users) || value.users.length > MAX_BACKUP_USERS) invalid();
  const names = new Set<string>();
  const users = value.users.map((user: unknown) => {
    if (!exactKeys(user, ["username", "passwordHash"])) invalid();
    if (typeof user.username !== "string" || !user.username.length || user.username.length > 100
      || user.username.trim() !== user.username || names.has(user.username)
      || typeof user.passwordHash !== "string"
      // Only accept the bcrypt cost used by this application, preventing expensive login hashes.
      || !/^\$2[ab]\$12\$[./A-Za-z0-9]{53}$/.test(user.passwordHash)) invalid();
    names.add(user.username);
    return { username: user.username, passwordHash: user.passwordHash };
  });
  const backup: UserBackup = { format: "textverktyg-user-backup", version: 1, exportedAt: value.exportedAt, users };
  if (new TextEncoder().encode(JSON.stringify(backup, null, 2)).byteLength > MAX_BACKUP_BYTES) invalid();
  return backup;
}

export function parseUserBackup(text: string): UserBackup {
  if (new TextEncoder().encode(text).byteLength > MAX_BACKUP_BYTES) invalid();
  let value: unknown;
  try { value = JSON.parse(text); } catch { invalid(); }
  return validateUserBackup(value);
}

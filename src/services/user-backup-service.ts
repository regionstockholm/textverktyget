import { getPrismaClient } from "../config/database/prisma-client.js";
import { validateUserBackup, type UserBackup } from "../validators/user-backup-validator.js";

export class UserBackupConflictError extends Error {
  constructor() { super("Restore requires an empty user table. No users were changed."); }
}

export async function exportUserBackup(prisma = getPrismaClient()): Promise<UserBackup> {
  const users = await prisma.user.findMany({
    select: { username: true, passwordHash: true },
    orderBy: { username: "asc" },
  });
  return validateUserBackup({ format: "textverktyg-user-backup", version: 1, exportedAt: new Date().toISOString(), users });
}

export async function restoreUserBackup(value: unknown, prisma = getPrismaClient()): Promise<number> {
  const backup = validateUserBackup(value);
  try {
    return await prisma.$transaction(async tx => {
      // Serialize restores with ordinary account creation/deletion, not just other restores.
      await tx.$executeRaw`LOCK TABLE users IN EXCLUSIVE MODE`;
      if (await tx.user.count() !== 0) throw new UserBackupConflictError();
      // Never allow old sessions to inherit an account if database IDs were reused.
      await tx.userSession.deleteMany();
      if (backup.users.length) await tx.user.createMany({ data: backup.users });
      return backup.users.length;
    }, { maxWait: 5000, timeout: 15000 });
  } catch (error) {
    if (["P2002", "P2034"].includes((error as { code?: string })?.code ?? "")) throw new UserBackupConflictError();
    throw error;
  }
}

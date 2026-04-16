import type { TestContext } from "node:test";
import { getPrismaClient } from "../../config/database/prisma-client.js";

export async function ensureDatabaseAvailable(t: TestContext): Promise<boolean> {
  if (!process.env.DATABASE_URL) {
    t.skip("DATABASE_URL is not configured");
    return false;
  }

  try {
    const prisma = getPrismaClient();
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch (error) {
    t.skip("Database not reachable");
    return false;
  }
}

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../generated/prisma/client.js";
import {
  getConfiguredDatabaseUrl,
  getPostgresSslConfig,
  UNCONFIGURED_DATABASE_URL,
} from "./postgres-connection-options.js";

let prismaClient: PrismaClient | null = null;

export function getPrismaClient(): PrismaClient {
  if (!prismaClient) {
    const databaseUrl = getConfiguredDatabaseUrl();
    const adapter = new PrismaPg({
      connectionString: databaseUrl || UNCONFIGURED_DATABASE_URL,
      ssl: databaseUrl ? getPostgresSslConfig(databaseUrl) : undefined,
      connectionTimeoutMillis: 5_000,
      idleTimeoutMillis: 300_000,
    });

    prismaClient = new PrismaClient({ adapter });
  }

  return prismaClient;
}

export async function disconnectPrismaClient(): Promise<void> {
  if (prismaClient) {
    await prismaClient.$disconnect();
    prismaClient = null;
  }
}

import { getPrismaClient } from "../../config/database/prisma-client.js";

export type OrdlistaEntry = {
  id: number;
  fromWord: string;
  toWord: string;
  createdAt: Date;
  updatedAt: Date;
  updatedBy: string | null;
};

export type CreateOrdlistaEntryInput = {
  fromWord: string;
  toWord: string;
  updatedBy?: string | null;
};

export async function listOrdlistaEntries(): Promise<OrdlistaEntry[]> {
  const prisma = getPrismaClient();
  return prisma.ordlistaEntry.findMany({ orderBy: { fromWord: "asc" } });
}

export async function createOrdlistaEntry(
  input: CreateOrdlistaEntryInput,
): Promise<OrdlistaEntry> {
  const prisma = getPrismaClient();
  return prisma.ordlistaEntry.create({
    data: {
      fromWord: input.fromWord,
      toWord: input.toWord,
      updatedBy: input.updatedBy ?? null,
    },
  });
}

export async function deleteOrdlistaEntry(id: number): Promise<void> {
  const prisma = getPrismaClient();
  await prisma.ordlistaEntry.delete({ where: { id } });
}

export async function clearOrdlistaEntries(): Promise<number> {
  const prisma = getPrismaClient();
  const result = await prisma.ordlistaEntry.deleteMany();
  return result.count;
}

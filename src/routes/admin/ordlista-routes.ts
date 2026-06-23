import type { Request, Response, Router } from "express";
import type { Prisma, PrismaClient } from "../../generated/prisma/client.js";
import { sendError, sendSuccess } from "../../utils/api/api-responses.js";

type AdminOrdlistaRouteDependencies = {
  prisma: PrismaClient;
  getActor: (req: Request) => string;
  logAudit: (
    client: PrismaClient,
    action: string,
    actor: string,
    entity: string,
    entityId: string | null,
    diff?: Prisma.InputJsonValue,
  ) => Promise<void>;
};

type OrdlistaEntry = {
  id: number;
  fromWord: string;
  toWord: string;
  updatedAt: Date;
  updatedBy: string | null;
};

function toOrdlistaResponse(entry: OrdlistaEntry) {
  return {
    id: entry.id,
    fromWord: entry.fromWord,
    toWord: entry.toWord,
    updatedAt: entry.updatedAt,
    updatedBy: entry.updatedBy,
  };
}

function readRequiredString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : null;
}

function readPositiveId(value: string | string[] | undefined): number | null {
  const rawValue = Array.isArray(value) ? value[0] : value;
  const id = rawValue ? Number.parseInt(rawValue, 10) : NaN;
  return Number.isInteger(id) && id > 0 ? id : null;
}

export function registerAdminOrdlistaRoutes(
  router: Router,
  { prisma, getActor, logAudit }: AdminOrdlistaRouteDependencies,
): void {
  router.get("/ordlista", async (_req: Request, res: Response): Promise<void> => {
    try {
      res.set("Cache-Control", "no-store");
      const entries = await prisma.ordlistaEntry.findMany({
        orderBy: { fromWord: "asc" },
      });

      sendSuccess(res, entries.map(toOrdlistaResponse));
    } catch (error) {
      sendError(res, 500, "Failed to load ordlista");
    }
  });

  router.post("/ordlista", async (req: Request, res: Response): Promise<void> => {
    const fromWord = readRequiredString(req.body?.fromWord);
    if (!fromWord) {
      sendError(res, 400, "Invalid fromWord");
      return;
    }

    const toWord = readRequiredString(req.body?.toWord);
    if (!toWord) {
      sendError(res, 400, "Invalid toWord");
      return;
    }

    try {
      const actor = getActor(req);
      const entry = await prisma.ordlistaEntry.upsert({
        where: { fromWord },
        create: {
          fromWord,
          toWord,
          updatedBy: actor,
        },
        update: {
          toWord,
          updatedBy: actor,
        },
      });

      await logAudit(
        prisma,
        "ordlista.upsert",
        actor,
        "ordlista_entries",
        String(entry.id),
        {
          fromWord: entry.fromWord,
          toWord: entry.toWord,
        },
      );

      sendSuccess(res, toOrdlistaResponse(entry));
    } catch (error) {
      sendError(res, 500, "Failed to save ordlista entry");
    }
  });

  router.delete(
    "/ordlista/:id",
    async (req: Request, res: Response): Promise<void> => {
      const id = readPositiveId(req.params.id);
      if (!id) {
        sendError(res, 400, "Invalid ordlista id");
        return;
      }

      try {
        const actor = getActor(req);
        const existing = await prisma.ordlistaEntry.findUnique({
          where: { id },
        });
        if (!existing) {
          sendSuccess(res, { id, deleted: false });
          return;
        }

        await prisma.ordlistaEntry.delete({ where: { id } });

        await logAudit(
          prisma,
          "ordlista.delete",
          actor,
          "ordlista_entries",
          String(existing.id),
          {
            fromWord: existing.fromWord,
            toWord: existing.toWord,
          },
        );

        sendSuccess(res, {
          id: existing.id,
          fromWord: existing.fromWord,
          toWord: existing.toWord,
          deleted: true,
        });
      } catch (error) {
        sendError(res, 500, "Failed to delete ordlista entry");
      }
    },
  );

  router.delete(
    "/ordlista",
    async (req: Request, res: Response): Promise<void> => {
      try {
        const actor = getActor(req);
        const result = await prisma.ordlistaEntry.deleteMany();

        await logAudit(
          prisma,
          "ordlista.clear",
          actor,
          "ordlista_entries",
          null,
          {
            count: result.count,
          },
        );

        sendSuccess(res, { deletedCount: result.count });
      } catch (error) {
        sendError(res, 500, "Failed to clear ordlista");
      }
    },
  );
}

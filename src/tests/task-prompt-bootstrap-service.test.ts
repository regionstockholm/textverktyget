import test from "node:test";
import assert from "node:assert/strict";
import { getPrismaClient } from "../config/database/prisma-client.js";
import { ensureDatabaseAvailable } from "./helpers/database-availability.js";
import { ensureTaskPromptDefaults } from "../services/tasks/task-prompt-bootstrap-service.js";

const hasDatabase = Boolean(process.env.DATABASE_URL);
const prisma = getPrismaClient();

test(
  "ensureTaskPromptDefaults creates missing task prompts",
  { skip: !hasDatabase },
  async (t) => {
    if (!(await ensureDatabaseAvailable(t))) {
      return;
    }

    const now = Date.now();
    const taskKey = `bootstrap-task-${now}`;
    const promptName = `task:${taskKey}`;

    try {
      await prisma.taskDefinition.create({
        data: {
          key: taskKey,
          label: `Bootstrap Task ${now}`,
          description: "Task used for prompt bootstrap test",
          enabled: true,
          sortOrder: 999000,
          outputMode: "bullets",
          bulletCount: 4,
          maxChars: null,
          targetAudienceEnabled: true,
          rewritePlanEnabled: true,
        },
      });

      await prisma.promptTemplate.deleteMany({ where: { name: promptName } });

      await ensureTaskPromptDefaults("test-bootstrap");

      const activePrompt = await prisma.promptTemplate.findFirst({
        where: { name: promptName, isActive: true },
        orderBy: { version: "desc" },
      });

      assert.ok(activePrompt);
      assert.ok((activePrompt?.content || "").trim().length > 0);

      const countBefore = await prisma.promptTemplate.count({
        where: { name: promptName },
      });
      await ensureTaskPromptDefaults("test-bootstrap");
      const countAfter = await prisma.promptTemplate.count({
        where: { name: promptName },
      });

      assert.equal(countAfter, countBefore);
    } finally {
      await prisma.promptTemplate.deleteMany({ where: { name: promptName } });
      await prisma.taskDefinition.deleteMany({ where: { key: taskKey } });
    }
  },
);

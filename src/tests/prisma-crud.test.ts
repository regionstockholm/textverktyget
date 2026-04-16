import test from "node:test";
import assert from "node:assert/strict";
import { getPrismaClient } from "../config/database/prisma-client.js";
import { ensureDatabaseAvailable } from "./helpers/database-availability.js";

const hasDatabase = Boolean(process.env.DATABASE_URL);
const prisma = getPrismaClient();

test("prisma CRUD works", { skip: !hasDatabase }, async (t) => {
  if (!(await ensureDatabaseAvailable(t))) {
    return;
  }

  const promptName = "test_prompt";
  const providerName = "test-provider";
  const secretName = "TEST_SECRET";
  const globalKey = "global";

  try {
    const prompt = await prisma.promptTemplate.create({
      data: {
        name: promptName,
        content: "PROMPT_CONTENT",
        version: 1,
        isActive: false,
      },
    });

    const fetchedPrompt = await prisma.promptTemplate.findFirst({
      where: { name: promptName, version: 1 },
    });
    assert.equal(fetchedPrompt?.content, "PROMPT_CONTENT");

    const updatedPrompt = await prisma.promptTemplate.update({
      where: { id: prompt.id },
      data: { content: "PROMPT_UPDATED" },
    });
    assert.equal(updatedPrompt.content, "PROMPT_UPDATED");

    await prisma.promptTemplate.delete({ where: { id: prompt.id } });

    const provider = await prisma.providerConfig.create({
      data: {
        provider: providerName,
        model: "models/test",
        temperature: 0.5,
        maxOutputTokens: 1000,
      },
    });
    assert.equal(provider.provider, providerName);

    await prisma.providerConfig.update({
      where: { provider: providerName },
      data: { temperature: 0.2 },
    });

    const secret = await prisma.secret.create({
      data: {
        name: secretName,
        cipherText: "ciphertext",
      },
    });
    assert.equal(secret.name, secretName);

    const audit = await prisma.auditLog.create({
      data: {
        action: "test",
        actor: "test",
        entity: "test",
        entityId: "1",
        diff: { ok: true },
      },
    });
    assert.ok(audit.id > 0);

    const globalConfig = await prisma.globalConfig.upsert({
      where: { configKey: globalKey },
      create: {
        configKey: globalKey,
        provider: "gemini",
        retryCount: 2,
      },
      update: {
        provider: "gemini",
        retryCount: 2,
      },
    });
    assert.equal(globalConfig.configKey, globalKey);

    const updatedGlobal = await prisma.globalConfig.update({
      where: { configKey: globalKey },
      data: { retryCount: 3 },
    });
    assert.equal(updatedGlobal.retryCount, 3);

    const defaultTasks = await prisma.taskDefinition.findMany({
      orderBy: { sortOrder: "asc" },
    });
    assert.ok(defaultTasks.length >= 9);
    const taskKeys = new Set(defaultTasks.map((task) => task.key));
    assert.equal(taskKeys.has("summary:3"), true);
    assert.equal(taskKeys.has("politicalDocuments"), true);

  } finally {
    await prisma.promptTemplate.deleteMany({ where: { name: promptName } });
    await prisma.providerConfig.deleteMany({
      where: { provider: providerName },
    });
    await prisma.secret.deleteMany({ where: { name: secretName } });
    await prisma.auditLog.deleteMany({ where: { action: "test", actor: "test" } });
    await prisma.globalConfig.deleteMany({ where: { configKey: globalKey } });
  }
});

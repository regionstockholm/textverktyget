import test from "node:test";
import assert from "node:assert/strict";
import configService from "../services/config/config-service.js";
import { getPrismaClient } from "../config/database/prisma-client.js";
import { AI_PROVIDERS, type AIProvider } from "../config/ai/ai-config.js";
import { ensureDatabaseAvailable } from "./helpers/database-availability.js";

const hasDatabase = Boolean(process.env.DATABASE_URL);
const prisma = getPrismaClient();
const TEST_ACTOR = "test-admin";
const GLOBAL_KEY = "global";
const AUDIENCE_NAME = "Patienter";
const TASK_PROMPT_NAME = "task:summary:ingress";
const EXPECTED_PROVIDER =
  (process.env.AI_PROVIDER as AIProvider) || AI_PROVIDERS.GEMINI_2_5_FLASH;

async function restorePrompt(
  name: string,
  previousActiveId: number | null,
): Promise<void> {
  await prisma.promptTemplate.deleteMany({
    where: { name, updatedBy: TEST_ACTOR },
  });

  if (previousActiveId) {
    await prisma.promptTemplate.updateMany({
      where: { name },
      data: { isActive: false },
    });

    await prisma.promptTemplate.update({
      where: { id: previousActiveId },
      data: { isActive: true },
    });
  }
}

test("config service refresh picks up DB changes", { skip: !hasDatabase }, async (t) => {
  if (!(await ensureDatabaseAvailable(t))) {
    return;
  }

  const previousActive = await prisma.promptTemplate.findFirst({
    where: { name: "role", isActive: true },
  });
  const latestPrompt = await prisma.promptTemplate.findFirst({
    where: { name: "role" },
    orderBy: { version: "desc" },
  });
  const baseVersion = latestPrompt?.version || 0;
  const previousAudienceActive = await prisma.promptTemplate.findFirst({
    where: { name: `targetAudience:${AUDIENCE_NAME}`, isActive: true },
  });
  const latestAudiencePrompt = await prisma.promptTemplate.findFirst({
    where: { name: `targetAudience:${AUDIENCE_NAME}` },
    orderBy: { version: "desc" },
  });
  const audienceBaseVersion = latestAudiencePrompt?.version || 0;
  const previousTaskActive = await prisma.promptTemplate.findFirst({
    where: { name: TASK_PROMPT_NAME, isActive: true },
  });
  const latestTaskPrompt = await prisma.promptTemplate.findFirst({
    where: { name: TASK_PROMPT_NAME },
    orderBy: { version: "desc" },
  });
  const taskBaseVersion = latestTaskPrompt?.version || 0;
  const existingProvider = await prisma.providerConfig.findUnique({
    where: { provider: "gemini" },
  });
  const existingGlobal = await prisma.globalConfig.findUnique({
    where: { configKey: GLOBAL_KEY },
  });

  try {
    await prisma.promptTemplate.updateMany({
      where: { name: "role", isActive: true },
      data: { isActive: false },
    });

    await prisma.promptTemplate.create({
      data: {
        name: "role",
        content: "CONFIG_PROMPT_A",
        version: baseVersion + 1,
        isActive: true,
        updatedBy: TEST_ACTOR,
      },
    });

    configService.refresh();
    const promptA = await configService.getPrompt("role");
    assert.equal(promptA, "CONFIG_PROMPT_A");

    await prisma.promptTemplate.updateMany({
      where: { name: "role", isActive: true },
      data: { isActive: false },
    });

    await prisma.promptTemplate.create({
      data: {
        name: "role",
        content: "CONFIG_PROMPT_B",
        version: baseVersion + 2,
        isActive: true,
        updatedBy: TEST_ACTOR,
      },
    });

    configService.refresh();
    const promptB = await configService.getPrompt("role");
    assert.equal(promptB, "CONFIG_PROMPT_B");

    await prisma.providerConfig.upsert({
      where: { provider: "gemini" },
      create: {
        provider: "gemini",
        model: "models/gemini-1.5-pro",
        temperature: 0.4,
        maxOutputTokens: 4321,
      },
      update: {
        model: "models/gemini-1.5-pro",
        temperature: 0.4,
        maxOutputTokens: 4321,
      },
    });

    configService.refresh();
    const providerConfig = await configService.getProviderConfig("gemini");
    assert.equal(providerConfig.temperature, 0.4);
    assert.equal(providerConfig.maxOutputTokens, 4321);

    await prisma.globalConfig.upsert({
      where: { configKey: GLOBAL_KEY },
      create: {
        configKey: GLOBAL_KEY,
        provider: EXPECTED_PROVIDER,
        retryCount: 4,
        updatedBy: TEST_ACTOR,
      },
      update: {
        provider: EXPECTED_PROVIDER,
        retryCount: 4,
        updatedBy: TEST_ACTOR,
      },
    });

    await prisma.promptTemplate.updateMany({
      where: { name: `targetAudience:${AUDIENCE_NAME}`, isActive: true },
      data: { isActive: false },
    });

    await prisma.promptTemplate.create({
      data: {
        name: `targetAudience:${AUDIENCE_NAME}`,
        content: "TARGET_AUDIENCE_OVERRIDE",
        version: audienceBaseVersion + 1,
        isActive: true,
        updatedBy: TEST_ACTOR,
      },
    });

    await prisma.promptTemplate.updateMany({
      where: { name: TASK_PROMPT_NAME, isActive: true },
      data: { isActive: false },
    });

    await prisma.promptTemplate.create({
      data: {
        name: TASK_PROMPT_NAME,
        content: "TASK_PROMPT_OVERRIDE",
        version: taskBaseVersion + 1,
        isActive: true,
        updatedBy: TEST_ACTOR,
      },
    });

    configService.refresh();
    const globalConfig = await configService.getGlobalConfig();
    assert.equal(globalConfig.provider, EXPECTED_PROVIDER);
    assert.equal(globalConfig.retryCount, 4);
    assert.equal(typeof globalConfig.runtimeSettings, "object");

    const activeProvider = await configService.getActiveProvider();
    assert.equal(activeProvider, EXPECTED_PROVIDER);

    const retryCount = await configService.getRetryCount();
    assert.equal(retryCount, 4);

    const audiencePrompt = await configService.getPrompt("targetAudience", {
      targetAudience: AUDIENCE_NAME,
    });
    assert.equal(audiencePrompt, "TARGET_AUDIENCE_OVERRIDE");

    const taskPrompt = await configService.getPrompt("task", {
      taskKey: "summary:ingress",
    });
    assert.equal(taskPrompt, "TASK_PROMPT_OVERRIDE");

    const senderIntentPrompt = await configService.getPrompt("senderIntent");
    assert.equal(typeof senderIntentPrompt, "string");
    assert.ok(senderIntentPrompt.length > 0);

    const allPrompts = await configService.getAllPrompts();
    assert.equal(typeof allPrompts.senderIntent, "string");
    assert.equal(typeof allPrompts.wordListUsage, "string");
    assert.equal(typeof allPrompts.rewriteFallback, "string");
  } finally {
    await restorePrompt("role", previousActive?.id ?? null);
    await restorePrompt(
      `targetAudience:${AUDIENCE_NAME}`,
      previousAudienceActive?.id ?? null,
    );
    await restorePrompt(TASK_PROMPT_NAME, previousTaskActive?.id ?? null);
    if (existingProvider) {
      await prisma.providerConfig.update({
        where: { provider: "gemini" },
        data: {
          model: existingProvider.model,
          temperature: existingProvider.temperature,
          maxOutputTokens: existingProvider.maxOutputTokens,
        },
      });
    } else {
      await prisma.providerConfig.deleteMany({ where: { provider: "gemini" } });
    }

    if (existingGlobal) {
      await prisma.globalConfig.update({
        where: { configKey: GLOBAL_KEY },
        data: {
          provider: existingGlobal.provider,
          retryCount: existingGlobal.retryCount,
          updatedBy: existingGlobal.updatedBy,
        },
      });
    } else {
      await prisma.globalConfig.deleteMany({ where: { configKey: GLOBAL_KEY } });
    }

    configService.refresh();
  }
});

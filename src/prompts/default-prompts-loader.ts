import { getDefaultConfig } from "../config/default-config-loader.js";
import { buildUniqueTaskKeysFromLabels } from "../services/tasks/task-catalog-service.js";

type PromptMap = Record<string, string>;

interface TargetAudienceDefaults {
  known: PromptMap;
  fallbackTemplate: string;
}

type TaskDefaults = PromptMap;

export interface DefaultPrompts {
  role: string;
  importantRules: string;
  senderIntent: string;
  rewritePlan: string;
  qualityEvaluation: string;
  wordListUsage: string;
  rewriteFallback: string;
  targetAudience: TargetAudienceDefaults;
  task: TaskDefaults;
}
let cachedPrompts: DefaultPrompts | null = null;

function buildDefaultPrompts(): DefaultPrompts {
  const config = getDefaultConfig();
  const promptMap = new Map<string, string>();

  for (const prompt of config.settings.systemPrompts) {
    promptMap.set(prompt.name, prompt.content);
  }

  const requiredPrompt = (name: string): string => {
    const content = promptMap.get(name);
    if (!content || content.length === 0) {
      throw new Error(
        `Missing or invalid '${name}' in default config prompts.`,
      );
    }
    return content;
  };

  const targetAudienceKnown: PromptMap = {};
  const taskPrompts: PromptMap = {};

  for (const audience of config.settings.targetAudiences) {
    targetAudienceKnown[audience.label] = audience.prompt.content;
  }

  const generatedTaskKeys = buildUniqueTaskKeysFromLabels(
    config.settings.tasks.map((task) => task.label),
  );

  config.settings.tasks.forEach((task, index) => {
    const generatedTaskKey = generatedTaskKeys[index];
    if (!generatedTaskKey) {
      return;
    }
    taskPrompts[generatedTaskKey] = task.prompt.content;
  });

  if (Object.keys(taskPrompts).length === 0) {
    throw new Error("Missing task prompts in default config.");
  }

  const targetAudienceFallback =
    promptMap.get("targetAudience") ||
    Object.values(targetAudienceKnown)[0];
  if (!targetAudienceFallback || targetAudienceFallback.length === 0) {
    throw new Error(
      "Missing target audience fallback prompt in default config prompts.",
    );
  }

  return {
    role: requiredPrompt("role"),
    importantRules: requiredPrompt("importantRules"),
    senderIntent: requiredPrompt("senderIntent"),
    rewritePlan: requiredPrompt("rewritePlan"),
    qualityEvaluation: requiredPrompt("qualityEvaluation"),
    wordListUsage: requiredPrompt("wordListUsage"),
    rewriteFallback: requiredPrompt("rewriteFallback"),
    targetAudience: {
      known: targetAudienceKnown,
      fallbackTemplate: targetAudienceFallback,
    },
    task: taskPrompts,
  };
}

export function getDefaultPrompts(): DefaultPrompts {
  if (cachedPrompts) {
    return cachedPrompts;
  }

  cachedPrompts = buildDefaultPrompts();
  return cachedPrompts;
}

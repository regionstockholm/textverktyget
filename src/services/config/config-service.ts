import { getPrismaClient } from "../../config/database/prisma-client.js";
import { AI_PROVIDERS, type AIProvider } from "../../config/ai/ai-config.js";
import { getDefaultConfig } from "../../config/default-config-loader.js";
import { getRolePrompt } from "../../prompts/role-prompt.js";
import { getImportantRulesPrompt } from "../../prompts/important-rules-prompt.js";
import { getSenderIntentPrompt } from "../../prompts/sender-intent-prompt.js";
import { getTargetAudiencePrompt } from "../../prompts/target-audience-prompt.js";
import { getTaskPrompt } from "../../prompts/task-prompt.js";
import { getRewritePlanPrompt } from "../../prompts/rewrite-plan-prompt.js";
import { getTextQualityPrompt } from "../../prompts/quality-evaluation-prompt.js";
import { getWordListUsagePrompt } from "../../prompts/word-list-usage-prompt.js";
import { getRewriteFallbackPrompt } from "../../prompts/rewrite-fallback-prompt.js";
import { buildUniqueTaskKeysFromLabels } from "../tasks/task-catalog-service.js";
import {
  decryptSecretValue,
  maskSecretValue,
} from "../../utils/crypto/encryption.js";

export type PromptName =
  | "role"
  | "importantRules"
  | "senderIntent"
  | "targetAudience"
  | "task"
  | "rewritePlan"
  | "qualityEvaluation"
  | "wordListUsage"
  | "rewriteFallback";

export type ProviderName = "gemini";

export interface GeminiProviderConfig {
  model: string;
  temperature: number;
  maxOutputTokens: number;
  useWebSearch: boolean;
  useThinking: boolean;
  updatedAt?: Date;
}

export interface PromptParams {
  targetAudience?: string;
  taskPromptMode?: "rewritePlanDraft";
  taskKey?: string;
}

export interface PromptSummary {
  name: string;
  activeVersion: number;
  updatedAt: Date;
}

export interface PromptVersionSummary {
  version: number;
  updatedAt: Date;
  isActive: boolean;
}

export interface MaskedSecret {
  name: string;
  masked: string;
}

export interface GlobalConfig {
  provider: AIProvider;
  retryCount: number;
  rewritePlanTasks: RewritePlanTaskSettings;
  runtimeSettings: RuntimeSettings;
  updatedAt?: Date;
  updatedBy?: string | null;
}

export type RewritePlanTaskSettings = Record<string, boolean>;
export type RuntimeSettings = Record<string, unknown>;

const DEFAULT_CACHE_TTL_MS = 45000;
const GLOBAL_CONFIG_KEY = "global";
const TASK_HEADING = "UPPGIFT:";
const TARGET_AUDIENCE_HEADING = "MÅLGRUPP:";

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function getDefaultRewritePlanTasks(): RewritePlanTaskSettings {
  return {};
}

function getDefaultRewritePlanTasksFromConfig(): RewritePlanTaskSettings {
  const defaultConfig = getDefaultConfig();
  const sortedTasks = [...defaultConfig.settings.tasks].sort(
    (a, b) => a.sortOrder - b.sortOrder,
  );
  const generatedTaskKeys = buildUniqueTaskKeysFromLabels(
    sortedTasks.map((task) => task.label),
  );

  const settings: RewritePlanTaskSettings = {};
  sortedTasks.forEach((task, index) => {
    const key = generatedTaskKeys[index];
    if (key) {
      settings[key] = task.rewritePlanEnabled;
    }
  });

  return settings;
}

function getDefaultRuntimeSettings(): RuntimeSettings {
  return {};
}

function getDefaultTargetAudienceLabel(): string {
  const defaultConfig = getDefaultConfig();
  return defaultConfig.settings.targetAudiences[0]?.label ?? "Allman malgrupp";
}

function resolveRewritePlanTasks(value: unknown): RewritePlanTaskSettings {
  const result = getDefaultRewritePlanTasks();
  if (!isRecord(value)) {
    return result;
  }

  for (const [key, candidate] of Object.entries(value)) {
    if (typeof candidate === "boolean") {
      result[key] = candidate;
    }
  }

  return result;
}

function resolveRuntimeSettings(value: unknown): RuntimeSettings {
  const result = getDefaultRuntimeSettings();
  if (!isRecord(value)) {
    return result;
  }

  for (const [key, candidate] of Object.entries(value)) {
    result[key] = candidate;
  }

  return result;
}

function withHeading(content: string, heading: string): string {
  const trimmedStart = content.trimStart();
  const headingWithNewline = `${heading}\n`;

  const body = trimmedStart.startsWith(headingWithNewline)
    ? trimmedStart.slice(headingWithNewline.length).trimStart()
    : trimmedStart === heading
      ? ""
      : content.trim();

  if (body.length === 0) {
    return heading;
  }

  return `${heading}\n${body}`;
}

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

export class ConfigService {
  private readonly cacheTtlMs: number;
  private promptCache: CacheEntry<Map<string, string>> | null = null;
  private providerCache: CacheEntry<GeminiProviderConfig> | null = null;
  private secretsCache: CacheEntry<Map<string, string>> | null = null;
  private globalConfigCache: CacheEntry<GlobalConfig> | null = null;

  constructor(cacheTtlMs: number = DEFAULT_CACHE_TTL_MS) {
    this.cacheTtlMs = cacheTtlMs;
  }

  refresh(): void {
    this.promptCache = null;
    this.providerCache = null;
    this.secretsCache = null;
    this.globalConfigCache = null;
  }

  getDefaultTargetAudienceLabel(): string {
    return getDefaultTargetAudienceLabel();
  }

  private isCacheValid<T>(entry: CacheEntry<T> | null): entry is CacheEntry<T> {
    return Boolean(entry && entry.expiresAt > Date.now());
  }

  private async loadActivePrompts(): Promise<Map<string, string>> {
    if (this.isCacheValid(this.promptCache)) {
      return this.promptCache.value;
    }

    const prisma = getPrismaClient();
    const activePrompts = await prisma.promptTemplate.findMany({
      where: { isActive: true },
    });

    const promptMap = new Map<string, string>();
    for (const prompt of activePrompts) {
      promptMap.set(prompt.name, prompt.content);
    }

    this.promptCache = {
      value: promptMap,
      expiresAt: Date.now() + this.cacheTtlMs,
    };

    return promptMap;
  }

  async getPrompt(
    name: PromptName,
    params: PromptParams = {},
  ): Promise<string> {
    const overrides = await this.loadActivePrompts();

    switch (name) {
      case "role":
        return overrides.get("role") || getRolePrompt;
      case "importantRules":
        return overrides.get("importantRules") || getImportantRulesPrompt;
      case "senderIntent":
        return overrides.get("senderIntent") || getSenderIntentPrompt;
      case "targetAudience":
        const audience =
          params.targetAudience || getDefaultTargetAudienceLabel();
        const audienceKey = `targetAudience:${audience}`;
        const prompt =
          overrides.get(audienceKey) ||
          overrides.get("targetAudience") ||
          getTargetAudiencePrompt(audience);
        return withHeading(prompt, TARGET_AUDIENCE_HEADING);
      case "task":
        if (params.taskPromptMode === "rewritePlanDraft") {
          const rewritePlan =
            overrides.get("rewritePlan") || getRewritePlanPrompt;
          return withHeading(rewritePlan, TASK_HEADING);
        }
        {
          const resolvedTaskKey =
            typeof params.taskKey === "string" &&
            params.taskKey.trim().length > 0
              ? params.taskKey.trim()
              : undefined;

          if (resolvedTaskKey) {
            const taskOverride = overrides.get(`task:${resolvedTaskKey}`);
            if (taskOverride) {
              return withHeading(taskOverride, TASK_HEADING);
            }
          }

          const genericOverride = overrides.get("task");
          if (genericOverride) {
            return withHeading(genericOverride, TASK_HEADING);
          }

          return withHeading(getTaskPrompt(resolvedTaskKey), TASK_HEADING);
        }
      case "rewritePlan":
        return overrides.get("rewritePlan") || getRewritePlanPrompt;
      case "qualityEvaluation":
        return overrides.get("qualityEvaluation") || getTextQualityPrompt;
      case "wordListUsage":
        return overrides.get("wordListUsage") || getWordListUsagePrompt;
      case "rewriteFallback":
        return overrides.get("rewriteFallback") || getRewriteFallbackPrompt;
      default:
        return "";
    }
  }

  async getAllPrompts(): Promise<Record<PromptName, string>> {
    const overrides = await this.loadActivePrompts();

    return {
      role: overrides.get("role") || getRolePrompt,
      importantRules:
        overrides.get("importantRules") || getImportantRulesPrompt,
      senderIntent: overrides.get("senderIntent") || getSenderIntentPrompt,
      targetAudience: withHeading(
        overrides.get("targetAudience") ||
          getTargetAudiencePrompt(getDefaultTargetAudienceLabel()),
        TARGET_AUDIENCE_HEADING,
      ),
      task: withHeading(overrides.get("task") || getTaskPrompt(), TASK_HEADING),
      rewritePlan: overrides.get("rewritePlan") || getRewritePlanPrompt,
      qualityEvaluation:
        overrides.get("qualityEvaluation") || getTextQualityPrompt,
      wordListUsage: overrides.get("wordListUsage") || getWordListUsagePrompt,
      rewriteFallback:
        overrides.get("rewriteFallback") || getRewriteFallbackPrompt,
    };
  }

  private normalizeProvider(provider: string | null | undefined): AIProvider {
    if (
      provider &&
      Object.values(AI_PROVIDERS).includes(provider as AIProvider)
    ) {
      return provider as AIProvider;
    }

    const configuredProvider = getDefaultConfig().settings.global.provider;
    if (
      configuredProvider &&
      Object.values(AI_PROVIDERS).includes(configuredProvider as AIProvider)
    ) {
      return configuredProvider as AIProvider;
    }

    return AI_PROVIDERS.GEMINI_2_5_FLASH;
  }

  private async loadGlobalConfig(): Promise<GlobalConfig> {
    if (this.isCacheValid(this.globalConfigCache)) {
      return this.globalConfigCache.value;
    }

    const prisma = getPrismaClient();
    type StoredGlobalConfig = {
      provider: string;
      retryCount: number;
      rewritePlanTasks?: unknown;
      runtimeSettings?: unknown;
      updatedAt: Date;
      updatedBy: string | null;
    };

    const storedConfig = (await prisma.globalConfig.findUnique({
      where: { configKey: GLOBAL_CONFIG_KEY },
    })) as StoredGlobalConfig | null;

    const defaultConfig = getDefaultConfig();
    const defaultProvider = this.normalizeProvider(
      defaultConfig.settings.global.provider,
    );
    const defaultRetryCount =
      Number.isInteger(defaultConfig.settings.global.retryCount) &&
      defaultConfig.settings.global.retryCount >= 1
        ? defaultConfig.settings.global.retryCount
        : 5;
    const defaultRewritePlanTasks = getDefaultRewritePlanTasksFromConfig();
    const defaultRuntimeSettings = resolveRuntimeSettings(
      defaultConfig.settings.global.runtimeSettings,
    );

    const config: GlobalConfig = storedConfig
      ? {
          provider: this.normalizeProvider(storedConfig.provider),
          retryCount:
            storedConfig.retryCount >= 1
              ? storedConfig.retryCount
              : defaultRetryCount,
          rewritePlanTasks: resolveRewritePlanTasks(
            storedConfig.rewritePlanTasks,
          ),
          runtimeSettings: resolveRuntimeSettings(storedConfig.runtimeSettings),
          updatedAt: storedConfig.updatedAt,
          updatedBy: storedConfig.updatedBy,
        }
      : {
          provider: defaultProvider,
          retryCount: defaultRetryCount,
          rewritePlanTasks: defaultRewritePlanTasks,
          runtimeSettings: defaultRuntimeSettings,
        };

    this.globalConfigCache = {
      value: config,
      expiresAt: Date.now() + this.cacheTtlMs,
    };

    return config;
  }

  async getGlobalConfig(): Promise<GlobalConfig> {
    return this.loadGlobalConfig();
  }

  async getRewritePlanTasks(): Promise<RewritePlanTaskSettings> {
    const globalConfig = await this.loadGlobalConfig();
    return globalConfig.rewritePlanTasks;
  }

  async getRuntimeSettings(): Promise<RuntimeSettings> {
    const globalConfig = await this.loadGlobalConfig();
    return globalConfig.runtimeSettings;
  }

  async getRewritePlanTaskSetting(taskKey: string): Promise<boolean> {
    const globalConfig = await this.loadGlobalConfig();
    return globalConfig.rewritePlanTasks[taskKey] ?? true;
  }

  async getActiveProvider(): Promise<AIProvider> {
    const globalConfig = await this.loadGlobalConfig();
    return globalConfig.provider;
  }

  async getRetryCount(): Promise<number> {
    const globalConfig = await this.loadGlobalConfig();
    return globalConfig.retryCount;
  }

  async getProviderConfig(
    provider: ProviderName = "gemini",
  ): Promise<GeminiProviderConfig> {
    if (this.isCacheValid(this.providerCache)) {
      return this.providerCache.value;
    }

    const prisma = getPrismaClient();
    type StoredProviderConfig = {
      model: string;
      temperature: number;
      maxOutputTokens: number;
      useWebSearch?: boolean;
      useThinking?: boolean;
      updatedAt: Date;
    };
    const storedConfig = (await prisma.providerConfig.findUnique({
      where: { provider },
    })) as StoredProviderConfig | null;

    const defaultGeminiConfig = getDefaultConfig().settings.providers.gemini;
    const defaultUseWebSearch = Boolean(defaultGeminiConfig.useWebSearch);
    const defaultUseThinking = Boolean(defaultGeminiConfig.useThinking);

    const mergedConfig: GeminiProviderConfig = storedConfig
      ? {
          model: storedConfig.model,
          temperature: storedConfig.temperature,
          maxOutputTokens: storedConfig.maxOutputTokens,
          useWebSearch: storedConfig.useWebSearch ?? defaultUseWebSearch,
          useThinking: storedConfig.useThinking ?? defaultUseThinking,
          updatedAt: storedConfig.updatedAt,
        }
      : {
          model: defaultGeminiConfig.model,
          temperature: defaultGeminiConfig.temperature,
          maxOutputTokens: defaultGeminiConfig.maxOutputTokens,
          useWebSearch: defaultUseWebSearch,
          useThinking: defaultUseThinking,
        };

    this.providerCache = {
      value: mergedConfig,
      expiresAt: Date.now() + this.cacheTtlMs,
    };

    return mergedConfig;
  }

  private async loadSecrets(): Promise<Map<string, string>> {
    if (this.isCacheValid(this.secretsCache)) {
      return this.secretsCache.value;
    }

    const prisma = getPrismaClient();
    const secrets = await prisma.secret.findMany();
    const secretMap = new Map<string, string>();

    for (const secret of secrets) {
      secretMap.set(secret.name, secret.cipherText);
    }

    this.secretsCache = {
      value: secretMap,
      expiresAt: Date.now() + this.cacheTtlMs,
    };

    return secretMap;
  }

  async getSecret(name: string): Promise<string | null> {
    const secretMap = await this.loadSecrets();
    const cipherText = secretMap.get(name);
    if (!cipherText) {
      return null;
    }

    try {
      return decryptSecretValue(cipherText);
    } catch (error) {
      return null;
    }
  }

  async listMaskedSecrets(): Promise<MaskedSecret[]> {
    const secretMap = await this.loadSecrets();
    const masked: MaskedSecret[] = [];

    for (const [name, cipherText] of secretMap.entries()) {
      let value: string | null = null;
      try {
        value = decryptSecretValue(cipherText);
      } catch (error) {
        value = null;
      }

      masked.push({
        name,
        masked: value ? maskSecretValue(value) : "****",
      });
    }

    return masked;
  }
}

const configService = new ConfigService();

export default configService;

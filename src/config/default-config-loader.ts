import { readFileSync } from "node:fs";
import { isAbsolute, join } from "node:path";

export interface DefaultConfigSystemPrompt {
  name: string;
  content: string;
}

export interface DefaultConfigTargetAudienceCategory {
  name: string;
  sortOrder: number;
}

export interface DefaultConfigTargetAudience {
  label: string;
  category: string;
  sortOrder: number;
  prompt: {
    content: string;
  };
}

export interface DefaultConfigTask {
  label: string;
  description: string | null;
  enabled: boolean;
  sortOrder: number;
  targetAudienceEnabled: boolean;
  rewritePlanEnabled: boolean;
  prompt: {
    content: string;
  };
}

export interface DefaultConfigPayload {
  schemaVersion: 4;
  app: string;
  exportedAt: string;
  settings: {
    global: {
      provider: string;
      retryCount: number;
      runtimeSettings?: Record<string, unknown>;
    };
    providers: {
      gemini: {
        model: string;
        temperature: number;
        maxOutputTokens: number;
        useWebSearch: boolean;
        useThinking: boolean;
      };
    };
    systemPrompts: DefaultConfigSystemPrompt[];
    targetAudienceCategories: DefaultConfigTargetAudienceCategory[];
    targetAudiences: DefaultConfigTargetAudience[];
    tasks: DefaultConfigTask[];
    ordlista: Array<{ fromWord: string; toWord: string }>;
  };
}

const DEFAULT_CONFIG_ENV_KEY = "DEFAULT_CONFIG_JSON_PATH";
const DEFAULT_CONFIG_RELATIVE_PATH = "config/default-config.json";
const CANONICAL_SCHEMA_VERSION = 4;

let cachedPath: string | null = null;
let cachedConfig: DefaultConfigPayload | null = null;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function normalizeNonEmptyString(
  value: unknown,
  fieldName: string,
  path: string,
): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${fieldName} must be a non-empty string in ${path}`);
  }

  return value.trim();
}

function normalizePositiveInteger(
  value: unknown,
  fieldName: string,
  path: string,
): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value <= 0) {
    throw new Error(`${fieldName} must be a positive integer in ${path}`);
  }

  return value;
}

function resolveDefaultConfigPath(): string {
  const configuredPath = process.env[DEFAULT_CONFIG_ENV_KEY]?.trim();
  if (configuredPath) {
    return isAbsolute(configuredPath)
      ? configuredPath
      : join(process.cwd(), configuredPath);
  }

  return join(process.cwd(), DEFAULT_CONFIG_RELATIVE_PATH);
}

function parseDefaultConfig(content: string, path: string): DefaultConfigPayload {
  const parsed = JSON.parse(content) as Record<string, unknown>;
  if (!isRecord(parsed)) {
    throw new Error(`Invalid default config JSON shape in ${path}`);
  }

  if (parsed.schemaVersion !== CANONICAL_SCHEMA_VERSION) {
    throw new Error(
      `schemaVersion must be ${CANONICAL_SCHEMA_VERSION} in ${path}`,
    );
  }

  const app = normalizeNonEmptyString(parsed.app, "app", path);
  const exportedAt =
    typeof parsed.exportedAt === "string" && parsed.exportedAt.trim().length > 0
      ? parsed.exportedAt
      : new Date().toISOString();

  const settings = parsed.settings;
  if (!isRecord(settings)) {
    throw new Error(`Missing or invalid 'settings' in ${path}`);
  }

  const global = settings.global;
  if (!isRecord(global)) {
    throw new Error(`Missing or invalid 'settings.global' in ${path}`);
  }

  const provider = normalizeNonEmptyString(
    global.provider,
    "settings.global.provider",
    path,
  );
  const retryCount = global.retryCount;
  if (typeof retryCount !== "number" || !Number.isInteger(retryCount)) {
    throw new Error(`settings.global.retryCount must be integer in ${path}`);
  }

  const providers = settings.providers;
  if (!isRecord(providers)) {
    throw new Error(`Missing or invalid 'settings.providers' in ${path}`);
  }
  const gemini = providers.gemini;
  if (!isRecord(gemini)) {
    throw new Error(`Missing or invalid 'settings.providers.gemini' in ${path}`);
  }

  const systemPromptsValue = settings.systemPrompts;
  if (!Array.isArray(systemPromptsValue)) {
    throw new Error(`Missing or invalid 'settings.systemPrompts' in ${path}`);
  }
  const seenSystemPromptNames = new Set<string>();
  const systemPrompts: DefaultConfigSystemPrompt[] = systemPromptsValue.map(
    (entry, index) => {
      if (!isRecord(entry)) {
        throw new Error(`settings.systemPrompts[${index}] must be object in ${path}`);
      }
      const name = normalizeNonEmptyString(
        entry.name,
        `settings.systemPrompts[${index}].name`,
        path,
      );
      if (seenSystemPromptNames.has(name)) {
        throw new Error(
          `settings.systemPrompts[${index}].name is duplicated in ${path}`,
        );
      }
      seenSystemPromptNames.add(name);

      const contentValue = entry.content;
      if (typeof contentValue !== "string" || contentValue.length === 0) {
        throw new Error(
          `settings.systemPrompts[${index}].content must be a string in ${path}`,
        );
      }

      return {
        name,
        content: contentValue,
      };
    },
  );

  const categoriesValue = settings.targetAudienceCategories;
  if (!Array.isArray(categoriesValue)) {
    throw new Error(
      `Missing or invalid 'settings.targetAudienceCategories' in ${path}`,
    );
  }
  const seenCategoryNames = new Set<string>();
  const seenCategorySortOrders = new Set<number>();
  const targetAudienceCategories: DefaultConfigTargetAudienceCategory[] =
    categoriesValue.map((entry, index) => {
      if (!isRecord(entry)) {
        throw new Error(
          `settings.targetAudienceCategories[${index}] must be object in ${path}`,
        );
      }

      const name = normalizeNonEmptyString(
        entry.name,
        `settings.targetAudienceCategories[${index}].name`,
        path,
      );
      if (seenCategoryNames.has(name)) {
        throw new Error(
          `settings.targetAudienceCategories[${index}].name is duplicated in ${path}`,
        );
      }
      seenCategoryNames.add(name);

      const sortOrder = normalizePositiveInteger(
        entry.sortOrder,
        `settings.targetAudienceCategories[${index}].sortOrder`,
        path,
      );
      if (seenCategorySortOrders.has(sortOrder)) {
        throw new Error(
          `settings.targetAudienceCategories[${index}].sortOrder is duplicated in ${path}`,
        );
      }
      seenCategorySortOrders.add(sortOrder);

      return {
        name,
        sortOrder,
      };
    });

  const targetAudiencesValue = settings.targetAudiences;
  if (!Array.isArray(targetAudiencesValue)) {
    throw new Error(`Missing or invalid 'settings.targetAudiences' in ${path}`);
  }

  const seenAudienceLabels = new Set<string>();
  const categoryAudienceSortOrders = new Map<string, Set<number>>();
  const targetAudiences: DefaultConfigTargetAudience[] = targetAudiencesValue.map(
    (entry, index) => {
      if (!isRecord(entry)) {
        throw new Error(`settings.targetAudiences[${index}] must be object in ${path}`);
      }

      const label = normalizeNonEmptyString(
        entry.label,
        `settings.targetAudiences[${index}].label`,
        path,
      );
      if (seenAudienceLabels.has(label)) {
        throw new Error(
          `settings.targetAudiences[${index}].label is duplicated in ${path}`,
        );
      }
      seenAudienceLabels.add(label);

      const category = normalizeNonEmptyString(
        entry.category,
        `settings.targetAudiences[${index}].category`,
        path,
      );
      if (!seenCategoryNames.has(category)) {
        throw new Error(
          `settings.targetAudiences[${index}].category references unknown category '${category}' in ${path}`,
        );
      }

      const sortOrder = normalizePositiveInteger(
        entry.sortOrder,
        `settings.targetAudiences[${index}].sortOrder`,
        path,
      );
      const categorySortOrders =
        categoryAudienceSortOrders.get(category) || new Set<number>();
      if (categorySortOrders.has(sortOrder)) {
        throw new Error(
          `settings.targetAudiences[${index}].sortOrder is duplicated in category '${category}' in ${path}`,
        );
      }
      categorySortOrders.add(sortOrder);
      categoryAudienceSortOrders.set(category, categorySortOrders);

      const promptValue = entry.prompt;
      if (!isRecord(promptValue)) {
        throw new Error(
          `settings.targetAudiences[${index}].prompt must be object in ${path}`,
        );
      }
      const promptContent = promptValue.content;
      if (typeof promptContent !== "string" || promptContent.length === 0) {
        throw new Error(
          `settings.targetAudiences[${index}].prompt.content must be string in ${path}`,
        );
      }

      return {
        label,
        category,
        sortOrder,
        prompt: {
          content: promptContent,
        },
      };
    },
  );

  const tasksValue = settings.tasks;
  if (!Array.isArray(tasksValue)) {
    throw new Error(`Missing or invalid 'settings.tasks' in ${path}`);
  }

  const seenTaskLabels = new Set<string>();
  const seenTaskSortOrders = new Set<number>();
  const tasks: DefaultConfigTask[] = tasksValue.map((entry, index) => {
    if (!isRecord(entry)) {
      throw new Error(`settings.tasks[${index}] must be object in ${path}`);
    }

    const label = normalizeNonEmptyString(
      entry.label,
      `settings.tasks[${index}].label`,
      path,
    );
    if (seenTaskLabels.has(label)) {
      throw new Error(`settings.tasks[${index}].label is duplicated in ${path}`);
    }
    seenTaskLabels.add(label);

    const sortOrder = normalizePositiveInteger(
      entry.sortOrder,
      `settings.tasks[${index}].sortOrder`,
      path,
    );
    if (seenTaskSortOrders.has(sortOrder)) {
      throw new Error(`settings.tasks[${index}].sortOrder is duplicated in ${path}`);
    }
    seenTaskSortOrders.add(sortOrder);

    if (typeof entry.enabled !== "boolean") {
      throw new Error(`settings.tasks[${index}].enabled must be boolean in ${path}`);
    }
    if (typeof entry.targetAudienceEnabled !== "boolean") {
      throw new Error(
        `settings.tasks[${index}].targetAudienceEnabled must be boolean in ${path}`,
      );
    }
    if (typeof entry.rewritePlanEnabled !== "boolean") {
      throw new Error(
        `settings.tasks[${index}].rewritePlanEnabled must be boolean in ${path}`,
      );
    }

    const promptValue = entry.prompt;
    if (!isRecord(promptValue)) {
      throw new Error(`settings.tasks[${index}].prompt must be object in ${path}`);
    }
    const promptContent = promptValue.content;
    if (typeof promptContent !== "string" || promptContent.length === 0) {
      throw new Error(
        `settings.tasks[${index}].prompt.content must be string in ${path}`,
      );
    }

    const descriptionValue = entry.description;
    const description =
      typeof descriptionValue === "string" && descriptionValue.trim().length > 0
        ? descriptionValue.trim()
        : null;

    return {
      label,
      description,
      enabled: entry.enabled,
      sortOrder,
      targetAudienceEnabled: entry.targetAudienceEnabled,
      rewritePlanEnabled: entry.rewritePlanEnabled,
      prompt: {
        content: promptContent,
      },
    };
  });

  if (tasks.length === 0) {
    throw new Error(`settings.tasks must include at least one task in ${path}`);
  }

  const ordlistaValue = settings.ordlista;
  if (!Array.isArray(ordlistaValue)) {
    throw new Error(`Missing or invalid 'settings.ordlista' in ${path}`);
  }
  const ordlista = ordlistaValue.map((entry, index) => {
    if (!isRecord(entry)) {
      throw new Error(`settings.ordlista[${index}] must be object in ${path}`);
    }

    const fromWord = normalizeNonEmptyString(
      entry.fromWord,
      `settings.ordlista[${index}].fromWord`,
      path,
    );
    const toWord = normalizeNonEmptyString(
      entry.toWord,
      `settings.ordlista[${index}].toWord`,
      path,
    );
    return { fromWord, toWord };
  });

  const runtimeSettings = isRecord(global.runtimeSettings)
    ? (global.runtimeSettings as Record<string, unknown>)
    : undefined;

  return {
    schemaVersion: CANONICAL_SCHEMA_VERSION,
    app,
    exportedAt,
    settings: {
      global: {
        provider,
        retryCount,
        runtimeSettings,
      },
      providers: {
        gemini: {
          model: normalizeNonEmptyString(
            gemini.model,
            "settings.providers.gemini.model",
            path,
          ),
          temperature:
            typeof gemini.temperature === "number" ? gemini.temperature : 0.7,
          maxOutputTokens:
            typeof gemini.maxOutputTokens === "number" &&
            Number.isInteger(gemini.maxOutputTokens) &&
            gemini.maxOutputTokens > 0
              ? gemini.maxOutputTokens
              : 65536,
          useWebSearch: Boolean(gemini.useWebSearch),
          useThinking:
            gemini.useThinking === undefined ? true : Boolean(gemini.useThinking),
        },
      },
      systemPrompts,
      targetAudienceCategories,
      targetAudiences,
      tasks,
      ordlista,
    },
  };
}

export function getDefaultConfig(): DefaultConfigPayload {
  const path = resolveDefaultConfigPath();
  if (cachedConfig && cachedPath === path) {
    return cachedConfig;
  }

  try {
    const content = readFileSync(path, "utf8");
    cachedConfig = parseDefaultConfig(content, path);
    cachedPath = path;
    return cachedConfig;
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown default config loading error";
    throw new Error(`Failed to load default config from '${path}': ${message}`);
  }
}

export function clearDefaultConfigCache(): void {
  cachedPath = null;
  cachedConfig = null;
}

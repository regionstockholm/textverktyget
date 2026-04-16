import { AI_PROVIDERS, type AIProvider } from "../../config/ai/ai-config.js";
import {
  GEMINI_MODEL_WHITELIST,
  normalizeGeminiModel,
} from "../../config/ai/model-whitelist.js";

export const BACKUP_SCHEMA_VERSION = 4 as const;
export const BACKUP_APP_ID = "textverktyg" as const;

export type BackupSystemPrompt = {
  name: string;
  content: string;
};

export type BackupTargetAudienceCategory = {
  name: string;
  sortOrder: number;
};

export type BackupTargetAudience = {
  label: string;
  category: string;
  sortOrder: number;
  prompt: {
    content: string;
  };
};

export type BackupTaskDefinition = {
  label: string;
  description?: string | null;
  enabled: boolean;
  sortOrder: number;
  targetAudienceEnabled: boolean;
  rewritePlanEnabled: boolean;
  prompt: {
    content: string;
  };
};

export type BackupOrdlistaEntry = {
  fromWord: string;
  toWord: string;
};

export type BackupPayload = {
  schemaVersion: typeof BACKUP_SCHEMA_VERSION;
  app: typeof BACKUP_APP_ID;
  exportedAt: string;
  settings: {
    global: {
      provider: AIProvider;
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
    systemPrompts: BackupSystemPrompt[];
    targetAudienceCategories: BackupTargetAudienceCategory[];
    targetAudiences: BackupTargetAudience[];
    tasks: BackupTaskDefinition[];
    ordlista: BackupOrdlistaEntry[];
  };
};

export type BackupValidationResult =
  | { ok: true; payload: BackupPayload }
  | { ok: false; errors: string[] };

const REQUIRED_SYSTEM_PROMPTS = new Set<string>([
  "role",
  "importantRules",
  "senderIntent",
  "rewritePlan",
  "qualityEvaluation",
  "wordListUsage",
  "rewriteFallback",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value > 0;
}

function isValidDateString(value: unknown): boolean {
  return typeof value === "string" && Number.isFinite(Date.parse(value));
}

function validateSystemPrompts(value: unknown, errors: string[]): void {
  if (!Array.isArray(value)) {
    errors.push("settings.systemPrompts must be an array.");
    return;
  }

  const seen = new Set<string>();
  const presentRequired = new Set<string>();
  value.forEach((entry, index) => {
    if (!isRecord(entry)) {
      errors.push(`settings.systemPrompts[${index}] must be an object.`);
      return;
    }
    if (!isNonEmptyString(entry.name)) {
      errors.push(`settings.systemPrompts[${index}].name must be a string.`);
      return;
    }
    if (!isNonEmptyString(entry.content)) {
      errors.push(`settings.systemPrompts[${index}].content must be a string.`);
    }
    if (seen.has(entry.name)) {
      errors.push(`settings.systemPrompts[${index}].name is duplicated.`);
    }
    seen.add(entry.name);
    if (REQUIRED_SYSTEM_PROMPTS.has(entry.name)) {
      presentRequired.add(entry.name);
    }
  });

  for (const requiredName of REQUIRED_SYSTEM_PROMPTS) {
    if (!presentRequired.has(requiredName)) {
      errors.push(`settings.systemPrompts must include '${requiredName}'.`);
    }
  }
}

function validateTargetAudienceCategories(value: unknown, errors: string[]): Set<string> {
  const names = new Set<string>();
  if (!Array.isArray(value)) {
    errors.push("settings.targetAudienceCategories must be an array.");
    return names;
  }

  const sortOrders = new Set<number>();
  value.forEach((entry, index) => {
    if (!isRecord(entry)) {
      errors.push(`settings.targetAudienceCategories[${index}] must be an object.`);
      return;
    }
    if (!isNonEmptyString(entry.name)) {
      errors.push(`settings.targetAudienceCategories[${index}].name must be a string.`);
      return;
    }
    if (!isPositiveInteger(entry.sortOrder)) {
      errors.push(
        `settings.targetAudienceCategories[${index}].sortOrder must be a positive integer.`,
      );
      return;
    }
    if (names.has(entry.name)) {
      errors.push(`settings.targetAudienceCategories[${index}].name is duplicated.`);
    }
    if (sortOrders.has(entry.sortOrder)) {
      errors.push(
        `settings.targetAudienceCategories[${index}].sortOrder is duplicated.`,
      );
    }
    names.add(entry.name);
    sortOrders.add(entry.sortOrder);
  });

  return names;
}

function validateTargetAudiences(
  value: unknown,
  categoryNames: Set<string>,
  errors: string[],
): void {
  if (!Array.isArray(value)) {
    errors.push("settings.targetAudiences must be an array.");
    return;
  }

  const labels = new Set<string>();
  const categorySortOrders = new Map<string, Set<number>>();

  value.forEach((entry, index) => {
    if (!isRecord(entry)) {
      errors.push(`settings.targetAudiences[${index}] must be an object.`);
      return;
    }

    if (!isNonEmptyString(entry.label)) {
      errors.push(`settings.targetAudiences[${index}].label must be a string.`);
      return;
    }
    if (labels.has(entry.label)) {
      errors.push(`settings.targetAudiences[${index}].label is duplicated.`);
    }
    labels.add(entry.label);

    if (!isNonEmptyString(entry.category)) {
      errors.push(`settings.targetAudiences[${index}].category must be a string.`);
      return;
    }
    if (!categoryNames.has(entry.category)) {
      errors.push(
        `settings.targetAudiences[${index}].category references unknown category '${entry.category}'.`,
      );
    }

    if (!isPositiveInteger(entry.sortOrder)) {
      errors.push(
        `settings.targetAudiences[${index}].sortOrder must be a positive integer.`,
      );
    } else {
      const perCategory = categorySortOrders.get(entry.category) || new Set<number>();
      if (perCategory.has(entry.sortOrder)) {
        errors.push(
          `settings.targetAudiences[${index}].sortOrder is duplicated in category '${entry.category}'.`,
        );
      }
      perCategory.add(entry.sortOrder);
      categorySortOrders.set(entry.category, perCategory);
    }

    if (!isRecord(entry.prompt)) {
      errors.push(`settings.targetAudiences[${index}].prompt must be an object.`);
      return;
    }
    if (!isNonEmptyString(entry.prompt.content)) {
      errors.push(`settings.targetAudiences[${index}].prompt.content must be a string.`);
    }
  });
}

function validateTasks(value: unknown, errors: string[]): void {
  if (!Array.isArray(value)) {
    errors.push("settings.tasks must be an array.");
    return;
  }
  if (value.length === 0) {
    errors.push("settings.tasks must include at least one task.");
    return;
  }

  const labels = new Set<string>();
  const sortOrders = new Set<number>();
  value.forEach((entry, index) => {
    if (!isRecord(entry)) {
      errors.push(`settings.tasks[${index}] must be an object.`);
      return;
    }

    if (!isNonEmptyString(entry.label)) {
      errors.push(`settings.tasks[${index}].label must be a string.`);
      return;
    }
    if (labels.has(entry.label)) {
      errors.push(`settings.tasks[${index}].label is duplicated.`);
    }
    labels.add(entry.label);

    if (entry.description !== undefined && entry.description !== null && typeof entry.description !== "string") {
      errors.push(`settings.tasks[${index}].description must be a string or null.`);
    }
    if (typeof entry.enabled !== "boolean") {
      errors.push(`settings.tasks[${index}].enabled must be boolean.`);
    }
    if (!isPositiveInteger(entry.sortOrder)) {
      errors.push(`settings.tasks[${index}].sortOrder must be a positive integer.`);
    } else if (sortOrders.has(entry.sortOrder)) {
      errors.push(`settings.tasks[${index}].sortOrder is duplicated.`);
    } else {
      sortOrders.add(entry.sortOrder);
    }
    if (typeof entry.targetAudienceEnabled !== "boolean") {
      errors.push(`settings.tasks[${index}].targetAudienceEnabled must be boolean.`);
    }
    if (typeof entry.rewritePlanEnabled !== "boolean") {
      errors.push(`settings.tasks[${index}].rewritePlanEnabled must be boolean.`);
    }

    if (!isRecord(entry.prompt)) {
      errors.push(`settings.tasks[${index}].prompt must be an object.`);
      return;
    }
    if (!isNonEmptyString(entry.prompt.content)) {
      errors.push(`settings.tasks[${index}].prompt.content must be a string.`);
    }
  });
}

function validateOrdlista(value: unknown, errors: string[]): void {
  if (!Array.isArray(value)) {
    errors.push("settings.ordlista must be an array.");
    return;
  }

  const seenFromWord = new Set<string>();
  value.forEach((entry, index) => {
    if (!isRecord(entry)) {
      errors.push(`settings.ordlista[${index}] must be an object.`);
      return;
    }
    if (!isNonEmptyString(entry.fromWord)) {
      errors.push(`settings.ordlista[${index}].fromWord must be a string.`);
      return;
    }
    if (!isNonEmptyString(entry.toWord)) {
      errors.push(`settings.ordlista[${index}].toWord must be a string.`);
      return;
    }
    if (seenFromWord.has(entry.fromWord)) {
      errors.push(`settings.ordlista[${index}].fromWord is duplicated.`);
    }
    seenFromWord.add(entry.fromWord);
  });
}

export function validateBackupPayload(value: unknown): BackupValidationResult {
  const errors: string[] = [];

  if (!isRecord(value)) {
    return { ok: false, errors: ["Payload must be an object."] };
  }

  if (value.schemaVersion !== BACKUP_SCHEMA_VERSION) {
    errors.push(`schemaVersion must be ${BACKUP_SCHEMA_VERSION}.`);
  }
  if (value.app !== BACKUP_APP_ID) {
    errors.push("app must be textverktyg.");
  }
  if (!isValidDateString(value.exportedAt)) {
    errors.push("exportedAt must be an ISO date string.");
  }

  const settings = value.settings;
  if (!isRecord(settings)) {
    errors.push("settings must be an object.");
    return { ok: false, errors };
  }

  const global = settings.global;
  if (!isRecord(global)) {
    errors.push("settings.global must be an object.");
  } else {
    if (!isNonEmptyString(global.provider)) {
      errors.push("settings.global.provider must be a string.");
    } else if (!Object.values(AI_PROVIDERS).includes(global.provider as AIProvider)) {
      errors.push("settings.global.provider must be a supported provider.");
    }

    if (!isPositiveInteger(global.retryCount) || global.retryCount > 10) {
      errors.push("settings.global.retryCount must be between 1 and 10.");
    }

    if (global.runtimeSettings !== undefined && !isRecord(global.runtimeSettings)) {
      errors.push("settings.global.runtimeSettings must be an object.");
    }
  }

  const providers = settings.providers;
  if (!isRecord(providers)) {
    errors.push("settings.providers must be an object.");
  } else {
    const gemini = providers.gemini;
    if (!isRecord(gemini)) {
      errors.push("settings.providers.gemini must be an object.");
    } else {
      if (!isNonEmptyString(gemini.model)) {
        errors.push("settings.providers.gemini.model must be a string.");
      } else if (!GEMINI_MODEL_WHITELIST.has(normalizeGeminiModel(gemini.model))) {
        errors.push("settings.providers.gemini.model must be whitelisted.");
      }
      if (
        typeof gemini.temperature !== "number" ||
        !Number.isFinite(gemini.temperature) ||
        gemini.temperature < 0 ||
        gemini.temperature > 1
      ) {
        errors.push("settings.providers.gemini.temperature must be 0-1.");
      }
      if (!isPositiveInteger(gemini.maxOutputTokens)) {
        errors.push("settings.providers.gemini.maxOutputTokens must be > 0.");
      }
      if (typeof gemini.useWebSearch !== "boolean") {
        errors.push("settings.providers.gemini.useWebSearch must be boolean.");
      }
      if (typeof gemini.useThinking !== "boolean") {
        errors.push("settings.providers.gemini.useThinking must be boolean.");
      }
    }
  }

  validateSystemPrompts(settings.systemPrompts, errors);
  const categoryNames = validateTargetAudienceCategories(
    settings.targetAudienceCategories,
    errors,
  );
  validateTargetAudiences(settings.targetAudiences, categoryNames, errors);
  validateTasks(settings.tasks, errors);
  validateOrdlista(settings.ordlista, errors);

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  return { ok: true, payload: value as BackupPayload };
}

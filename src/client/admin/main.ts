import { readRuntimeInteger } from "../../utils/runtime-number.js";

type ApiResponse<T> = {
  data?: T;
  message?: string;
  error?: string;
  validationErrors?: string[];
};

type GlobalConfig = {
  provider?: string;
  retryCount?: number;
  rewritePlanTasks?: RewritePlanTaskSettings;
  runtimeSettings?: RuntimeSettings;
};

type RewritePlanTaskSettings = Record<string, boolean>;
type RuntimeSettings = Record<string, unknown>;

type GeminiConfig = {
  model?: string;
  temperature?: number;
  qualityTemperature?: number;
  maxOutputTokens?: number;
  useWebSearch?: boolean;
  useThinking?: boolean;
};

type AdminConfigResponse = {
  prompts?: Record<string, string>;
  global?: GlobalConfig;
  providers?: {
    gemini?: GeminiConfig;
  };
};

type TaskPromptSaveResponse = {
  taskKey?: string;
  prompt?: {
    name?: string;
    content?: string;
  };
  rewritePlanTasks?: RewritePlanTaskSettings;
};

type TaskDefinition = {
  id: number;
  key: string;
  label: string;
  description?: string | null;
  enabled: boolean;
  sortOrder: number;
  targetAudienceEnabled?: boolean;
  rewritePlanEnabled?: boolean;
};

type OrdlistaEntry = {
  id: number;
  fromWord: string;
  toWord: string;
  updatedAt?: string;
  updatedBy?: string | null;
};

type TargetAudienceCategory = {
  name: string;
  sortOrder: number;
};

type TargetAudienceCatalogItem = {
  label: string;
  category: string;
  sortOrder: number;
};

type TargetAudienceCatalog = {
  categories: TargetAudienceCategory[];
  audiences: TargetAudienceCatalogItem[];
};

const STORAGE_KEY = "adminApiKey";
const TARGET_AUDIENCE_PREFIX = "targetAudience:";
const TASK_PROMPT_PREFIX = "task:";
const DEFAULT_GEMINI_MAX_OUTPUT_TOKENS = 65536;
const DEFAULT_GEMINI_QE_TEMPERATURE = 0.3;
const DEFAULT_RUNTIME_PROVIDER_RPM_GEMINI = 10;
const DEFAULT_RUNTIME_PROVIDER_RPM_OPENAI = 1000;
const DEFAULT_RUNTIME_GLOBAL_WINDOW_MS = 15 * 60 * 1000;
const DEFAULT_RUNTIME_GLOBAL_MAX = 100;
const DEFAULT_RUNTIME_API_WINDOW_MS = 60 * 1000;
const DEFAULT_RUNTIME_API_STANDARD = 30;
const DEFAULT_RUNTIME_API_QUALITY = 10;
const DEFAULT_RUNTIME_API_SUMMARIZE = 10;
const DEFAULT_RUNTIME_API_UPLOAD = 5;
const DEFAULT_RUNTIME_UPLOAD_MAX_SIZE_MB = 50;
const DEFAULT_RUNTIME_QUEUE_CONCURRENT = 8;
const DEFAULT_RUNTIME_QUEUE_SIZE = 200;
const DEFAULT_RUNTIME_QUEUE_WAIT_MS = 45000;
const DEFAULT_RUNTIME_QUEUE_RETRY_AFTER = 15;
const DEFAULT_RUNTIME_STAGE_ANALYSIS = 32;
const DEFAULT_RUNTIME_STAGE_REWRITE = 8;
const DEFAULT_RUNTIME_STAGE_CRITIC = 16;
const DEFAULT_RUNTIME_RETRY_PROVIDER_MAX = 5;
const DEFAULT_RUNTIME_RETRY_QUALITY_MAX = 5;
const DEFAULT_RUNTIME_REPAIR_BUDGET = 1;
const DEFAULT_RUNTIME_REPAIR_MIN_SUBSCORE = 8;
const DEFAULT_RUNTIME_AUTO_ENABLED = false;
const DEFAULT_RUNTIME_AUTO_MODE = "auto";
const DEFAULT_RUNTIME_AUTO_MANUAL_PROFILE = "quality";
const DEFAULT_RUNTIME_AUTO_DRY_RUN = false;
const DEFAULT_RUNTIME_AUTO_EVALUATE_SECONDS = 15;
const DEFAULT_RUNTIME_AUTO_WINDOW_SECONDS = 60;
const DEFAULT_RUNTIME_AUTO_MIN_DWELL_SECONDS = 300;
const DEFAULT_RUNTIME_AUTO_COOLDOWN_SECONDS = 120;
const DEFAULT_RUNTIME_AUTO_MIN_SAMPLES = 20;
const DEFAULT_RUNTIME_AUTO_ESCALATE_CONSECUTIVE = 2;
const DEFAULT_RUNTIME_AUTO_RELAX_CONSECUTIVE = 8;
const EASY_TO_READ_TASK_ALIASES = new Set([
  "easytoread",
  "easy-to-read",
  "lattlast",
  "lattlast-svenska",
]);

const GENERIC_FALLBACK_CATEGORY_NAME = "Default";

const EMPTY_TARGET_AUDIENCE_CATALOG: TargetAudienceCatalog = {
  categories: [],
  audiences: [],
};

function getDefaultRewritePlanTasks(): RewritePlanTaskSettings {
  return {};
}

function resolveRewritePlanTasks(value: unknown): RewritePlanTaskSettings {
  const result: RewritePlanTaskSettings = getDefaultRewritePlanTasks();
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return result;
  }

  const input = value as Record<string, unknown>;
  Object.entries(input).forEach(([key, candidate]) => {
    if (typeof candidate === "boolean") {
      result[key] = candidate;
    }
  });

  return result;
}

function resolveRuntimeSettings(value: unknown): RuntimeSettings {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return value as RuntimeSettings;
}

function readRuntimeQualityTemperature(
  runtimeSettings: RuntimeSettings,
): number {
  const qualitySettings = runtimeSettings.quality;
  if (
    qualitySettings &&
    typeof qualitySettings === "object" &&
    !Array.isArray(qualitySettings)
  ) {
    const candidate = (qualitySettings as Record<string, unknown>).temperature;
    if (typeof candidate === "number" && Number.isFinite(candidate)) {
      return Math.min(1, Math.max(0, candidate));
    }
  }

  return DEFAULT_GEMINI_QE_TEMPERATURE;
}

function readRuntimeBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function parseIntegerField(
  input: HTMLInputElement,
  label: string,
  min: number,
  max: number,
): number {
  const raw = input.value.trim();
  const value = Number.parseInt(raw, 10);
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new Error(`${label} måste vara ett heltal mellan ${min} och ${max}.`);
  }

  return value;
}

function cloneRuntimeSettings(settings: RuntimeSettings): RuntimeSettings {
  return JSON.parse(JSON.stringify(settings || {})) as RuntimeSettings;
}

function normalizeTaskIdentity(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function getRuntimeObject(
  parent: RuntimeSettings,
  key: string,
): Record<string, unknown> {
  const existing = parent[key];
  if (existing && typeof existing === "object" && !Array.isArray(existing)) {
    return existing as Record<string, unknown>;
  }

  const next: Record<string, unknown> = {};
  parent[key] = next;
  return next;
}

type DomRefs = {
  tokenInput: HTMLInputElement;
  statusEl: HTMLElement;
  hintEl: HTMLElement;
  checkButton: HTMLButtonElement;
  saveGlobalButton: HTMLButtonElement;
  saveGeminiButton: HTMLButtonElement;
  ordlistaFrom: HTMLInputElement;
  ordlistaTo: HTMLInputElement;
  ordlistaSaveButton: HTMLButtonElement;
  ordlistaClearButton: HTMLButtonElement;
  ordlistaList: HTMLElement;
  ordlistaEmpty: HTMLElement;
  taskPromptSelect: HTMLSelectElement;
  taskPromptLabel: HTMLElement;
  taskPromptContent: HTMLTextAreaElement;
  taskPromptSaveButton: HTMLButtonElement;
  taskDefLabel: HTMLInputElement;
  taskDefDescription: HTMLInputElement;
  taskDefEnabled: HTMLInputElement;
  taskDefTargetAudienceEnabled: HTMLInputElement;
  taskDefRewritePlanEnabled: HTMLInputElement;
  taskDefCreateButton: HTMLButtonElement;
  taskDefDeleteButton: HTMLButtonElement;
  taskDefMoveUpButton: HTMLButtonElement;
  taskDefMoveDownButton: HTMLButtonElement;
  easyReadTaskEnabled: HTMLInputElement;
  easyReadWorkflowEnabled: HTMLInputElement;
  easyReadWorkflowUseRewriteDraft: HTMLInputElement;
  saveEasyReadSettingsButton: HTMLButtonElement;
  easyReadPromptTask: HTMLTextAreaElement;
  easyReadPromptImportantRules: HTMLTextAreaElement;
  easyReadPromptRole: HTMLTextAreaElement;
  easyReadPromptSenderIntent: HTMLTextAreaElement;
  easyReadPromptRewritePlan: HTMLTextAreaElement;
  easyReadPromptQualityEvaluation: HTMLTextAreaElement;
  easyReadPromptWordListUsage: HTMLTextAreaElement;
  easyReadPromptRewriteFallback: HTMLTextAreaElement;
  easyReadPromptTargetAudienceFallback: HTMLTextAreaElement;
  easyReadTargetAudienceSelect: HTMLSelectElement;
  easyReadTargetAudienceGroup: HTMLElement;
  easyReadTargetAudiencePromptLabel: HTMLElement;
  easyReadTargetAudiencePrompt: HTMLTextAreaElement;
  easyReadTargetAudienceSaveButton: HTMLButtonElement;
  targetAudienceSelect: HTMLSelectElement;
  targetAudienceGroup: HTMLElement;
  targetAudienceCategorySelect: HTMLSelectElement;
  targetAudienceCategoryNameInput: HTMLInputElement;
  targetAudienceCategoryCreateButton: HTMLButtonElement;
  targetAudienceCategorySaveButton: HTMLButtonElement;
  targetAudienceCategoryDeleteButton: HTMLButtonElement;
  targetAudienceCategoryMoveUpButton: HTMLButtonElement;
  targetAudienceCategoryMoveDownButton: HTMLButtonElement;
  targetAudienceCategoryForItemSelect: HTMLSelectElement;
  targetAudienceLabelInput: HTMLInputElement;
  targetAudienceCreateButton: HTMLButtonElement;
  targetAudienceDeleteButton: HTMLButtonElement;
  targetAudienceMoveUpButton: HTMLButtonElement;
  targetAudienceMoveDownButton: HTMLButtonElement;
  targetAudiencePromptLabel: HTMLElement;
  targetAudiencePrompt: HTMLTextAreaElement;
  targetAudienceSaveButton: HTMLButtonElement;
  globalProvider: HTMLSelectElement;
  globalRetry: HTMLInputElement;
  globalRetryCurrent: HTMLElement;
  globalRetrySelected: HTMLElement;
  globalQualityAttempts: HTMLInputElement;
  globalQualityAttemptsCurrent: HTMLElement;
  globalQualityAttemptsSelected: HTMLElement;
  globalRepairBudget: HTMLInputElement;
  globalRepairBudgetCurrent: HTMLElement;
  globalRepairBudgetSelected: HTMLElement;
  runtimeProviderRpmGemini: HTMLInputElement;
  runtimeProviderRpmOpenai: HTMLInputElement;
  runtimeGlobalWindowMs: HTMLInputElement;
  runtimeGlobalMax: HTMLInputElement;
  runtimeApiWindowMs: HTMLInputElement;
  runtimeApiStandard: HTMLInputElement;
  runtimeApiQuality: HTMLInputElement;
  runtimeApiSummarize: HTMLInputElement;
  runtimeApiUpload: HTMLInputElement;
  runtimeQueueConcurrent: HTMLInputElement;
  runtimeQueueSize: HTMLInputElement;
  runtimeQueueWaitMs: HTMLInputElement;
  runtimeQueueRetryAfter: HTMLInputElement;
  runtimeUploadMaxSizeMb: HTMLInputElement;
  runtimeUploadMaxSizeMbSelected: HTMLElement;
  runtimeUploadMaxSizeMbCurrent: HTMLElement;
  runtimeStageAnalysis: HTMLInputElement;
  runtimeStageRewrite: HTMLInputElement;
  runtimeStageCritic: HTMLInputElement;
  runtimeRetryProviderMax: HTMLInputElement;
  runtimeRepairMinSubscore: HTMLInputElement;
  runtimeRepairMinSubscoreSelected: HTMLElement;
  runtimeRepairMinSubscoreCurrent: HTMLElement;
  runtimeAutoEnabled: HTMLInputElement;
  runtimeAutoMode: HTMLSelectElement;
  runtimeAutoManualProfile: HTMLSelectElement;
  runtimeAutoDryRun: HTMLInputElement;
  runtimeAutoEvaluateSeconds: HTMLInputElement;
  runtimeAutoWindowSeconds: HTMLInputElement;
  runtimeAutoMinDwellSeconds: HTMLInputElement;
  runtimeAutoCooldownSeconds: HTMLInputElement;
  runtimeAutoMinSamples: HTMLInputElement;
  runtimeAutoEscalateConsecutive: HTMLInputElement;
  runtimeAutoRelaxConsecutive: HTMLInputElement;
  runtimeSettingsJson: HTMLTextAreaElement;
  saveRuntimeSettingsFieldsButton: HTMLButtonElement;
  saveRuntimeSettingsButton: HTMLButtonElement;
  geminiModel: HTMLInputElement;
  geminiTemp: HTMLInputElement;
  geminiTempSelected: HTMLElement;
  geminiTempValue: HTMLElement;
  geminiQeTemp: HTMLInputElement;
  geminiQeTempSelected: HTMLElement;
  geminiQeTempValue: HTMLElement;
  geminiMax: HTMLInputElement;
  geminiUseSearch: HTMLInputElement;
  geminiUseThinking: HTMLInputElement;
  backupDownloadButton: HTMLButtonElement;
  backupUploadInput: HTMLInputElement;
  backupImportButton: HTMLButtonElement;
  viewInputs: NodeListOf<HTMLInputElement>;
  views: NodeListOf<HTMLElement>;
};

function getRequiredElement<T extends HTMLElement>(
  id: string,
  root: Document = document,
): T | null {
  const element = root.getElementById(id);
  if (!element) {
    return null;
  }
  return element as T;
}

function initRefs(): DomRefs | null {
  const tokenInput = getRequiredElement<HTMLInputElement>("admin-token");
  const statusEl = getRequiredElement<HTMLElement>("admin-status");
  const hintEl = getRequiredElement<HTMLElement>("admin-hint");
  const checkButton = getRequiredElement<HTMLButtonElement>("check-config");
  const saveGlobalButton = getRequiredElement<HTMLButtonElement>("save-global");
  const saveGeminiButton = getRequiredElement<HTMLButtonElement>("save-gemini");
  const ordlistaFrom = getRequiredElement<HTMLInputElement>("ordlista-from");
  const ordlistaTo = getRequiredElement<HTMLInputElement>("ordlista-to");
  const ordlistaSaveButton =
    getRequiredElement<HTMLButtonElement>("ordlista-save");
  const ordlistaClearButton =
    getRequiredElement<HTMLButtonElement>("ordlista-clear");
  const ordlistaList = getRequiredElement<HTMLElement>("ordlista-list");
  const ordlistaEmpty = getRequiredElement<HTMLElement>("ordlista-empty");
  const taskPromptSelect =
    getRequiredElement<HTMLSelectElement>("task-prompt-select");
  const taskPromptLabel = getRequiredElement<HTMLElement>("task-prompt-label");
  const taskPromptContent = getRequiredElement<HTMLTextAreaElement>(
    "task-prompt-content",
  );
  const taskPromptSaveButton =
    getRequiredElement<HTMLButtonElement>("save-task-prompt");
  const taskDefLabel = getRequiredElement<HTMLInputElement>("task-def-label");
  const taskDefDescription = getRequiredElement<HTMLInputElement>(
    "task-def-description",
  );
  const taskDefEnabled =
    getRequiredElement<HTMLInputElement>("task-def-enabled");
  const taskDefTargetAudienceEnabled = getRequiredElement<HTMLInputElement>(
    "task-def-target-audience-enabled",
  );
  const taskDefRewritePlanEnabled = getRequiredElement<HTMLInputElement>(
    "task-def-rewrite-plan-enabled",
  );
  const taskDefCreateButton =
    getRequiredElement<HTMLButtonElement>("task-def-create");
  const taskDefDeleteButton =
    getRequiredElement<HTMLButtonElement>("task-def-delete");
  const taskDefMoveUpButton =
    getRequiredElement<HTMLButtonElement>("task-def-move-up");
  const taskDefMoveDownButton =
    getRequiredElement<HTMLButtonElement>("task-def-move-down");
  const easyReadTaskEnabled = getRequiredElement<HTMLInputElement>(
    "easy-read-task-enabled",
  );
  const easyReadWorkflowEnabled = getRequiredElement<HTMLInputElement>(
    "easy-read-workflow-enabled",
  );
  const easyReadWorkflowUseRewriteDraft = getRequiredElement<HTMLInputElement>(
    "easy-read-workflow-use-rewrite-draft",
  );
  const saveEasyReadSettingsButton = getRequiredElement<HTMLButtonElement>(
    "save-easy-read-settings",
  );
  const easyReadPromptTask = getRequiredElement<HTMLTextAreaElement>(
    "easy-read-prompt-task",
  );
  const easyReadPromptImportantRules = getRequiredElement<HTMLTextAreaElement>(
    "easy-read-prompt-importantRules",
  );
  const easyReadPromptRole = getRequiredElement<HTMLTextAreaElement>(
    "easy-read-prompt-role",
  );
  const easyReadPromptSenderIntent = getRequiredElement<HTMLTextAreaElement>(
    "easy-read-prompt-senderIntent",
  );
  const easyReadPromptRewritePlan = getRequiredElement<HTMLTextAreaElement>(
    "easy-read-prompt-rewritePlan",
  );
  const easyReadPromptQualityEvaluation =
    getRequiredElement<HTMLTextAreaElement>(
      "easy-read-prompt-qualityEvaluation",
    );
  const easyReadPromptWordListUsage = getRequiredElement<HTMLTextAreaElement>(
    "easy-read-prompt-wordListUsage",
  );
  const easyReadPromptRewriteFallback = getRequiredElement<HTMLTextAreaElement>(
    "easy-read-prompt-rewriteFallback",
  );
  const easyReadPromptTargetAudienceFallback =
    getRequiredElement<HTMLTextAreaElement>(
      "easy-read-prompt-targetAudience-fallback",
    );
  const easyReadTargetAudienceSelect = getRequiredElement<HTMLSelectElement>(
    "easy-read-target-audience-select",
  );
  const easyReadTargetAudienceGroup = getRequiredElement<HTMLElement>(
    "easy-read-target-audience-group",
  );
  const easyReadTargetAudiencePromptLabel = getRequiredElement<HTMLElement>(
    "easy-read-target-audience-prompt-label",
  );
  const easyReadTargetAudiencePrompt = getRequiredElement<HTMLTextAreaElement>(
    "easy-read-target-audience-prompt",
  );
  const easyReadTargetAudienceSaveButton =
    getRequiredElement<HTMLButtonElement>("save-easy-read-target-audience");
  const targetAudienceSelect = getRequiredElement<HTMLSelectElement>(
    "target-audience-select",
  );
  const targetAudienceGroup = getRequiredElement<HTMLElement>(
    "target-audience-group",
  );
  const targetAudienceCategorySelect = getRequiredElement<HTMLSelectElement>(
    "target-audience-category-select",
  );
  const targetAudienceCategoryNameInput = getRequiredElement<HTMLInputElement>(
    "target-audience-category-name",
  );
  const targetAudienceCategoryCreateButton =
    getRequiredElement<HTMLButtonElement>("target-audience-category-create");
  const targetAudienceCategorySaveButton =
    getRequiredElement<HTMLButtonElement>("target-audience-category-save");
  const targetAudienceCategoryDeleteButton =
    getRequiredElement<HTMLButtonElement>("target-audience-category-delete");
  const targetAudienceCategoryMoveUpButton =
    getRequiredElement<HTMLButtonElement>("target-audience-category-up");
  const targetAudienceCategoryMoveDownButton =
    getRequiredElement<HTMLButtonElement>("target-audience-category-down");
  const targetAudienceCategoryForItemSelect =
    getRequiredElement<HTMLSelectElement>("target-audience-category-for-item");
  const targetAudienceLabelInput = getRequiredElement<HTMLInputElement>(
    "target-audience-label-input",
  );
  const targetAudienceCreateButton = getRequiredElement<HTMLButtonElement>(
    "target-audience-create",
  );
  const targetAudienceDeleteButton = getRequiredElement<HTMLButtonElement>(
    "target-audience-delete",
  );
  const targetAudienceMoveUpButton =
    getRequiredElement<HTMLButtonElement>("target-audience-up");
  const targetAudienceMoveDownButton = getRequiredElement<HTMLButtonElement>(
    "target-audience-down",
  );
  const targetAudiencePromptLabel = getRequiredElement<HTMLElement>(
    "target-audience-prompt-label",
  );
  const targetAudiencePrompt = getRequiredElement<HTMLTextAreaElement>(
    "target-audience-prompt",
  );
  const targetAudienceSaveButton = getRequiredElement<HTMLButtonElement>(
    "save-target-audience",
  );
  const globalProvider =
    getRequiredElement<HTMLSelectElement>("global-provider");
  const globalRetry = getRequiredElement<HTMLInputElement>("global-retry");
  const globalRetryCurrent = getRequiredElement<HTMLElement>(
    "global-retry-current",
  );
  const globalRetrySelected = getRequiredElement<HTMLElement>(
    "global-retry-selected",
  );
  const globalQualityAttempts = getRequiredElement<HTMLInputElement>(
    "global-quality-attempts",
  );
  const globalQualityAttemptsCurrent = getRequiredElement<HTMLElement>(
    "global-quality-attempts-current",
  );
  const globalQualityAttemptsSelected = getRequiredElement<HTMLElement>(
    "global-quality-attempts-selected",
  );
  const globalRepairBudget = getRequiredElement<HTMLInputElement>(
    "global-repair-budget",
  );
  const globalRepairBudgetCurrent = getRequiredElement<HTMLElement>(
    "global-repair-budget-current",
  );
  const globalRepairBudgetSelected = getRequiredElement<HTMLElement>(
    "global-repair-budget-selected",
  );
  const runtimeProviderRpmGemini = getRequiredElement<HTMLInputElement>(
    "runtime-provider-rpm-gemini",
  );
  const runtimeProviderRpmOpenai = getRequiredElement<HTMLInputElement>(
    "runtime-provider-rpm-openai",
  );
  const runtimeGlobalWindowMs = getRequiredElement<HTMLInputElement>(
    "runtime-global-window-ms",
  );
  const runtimeGlobalMax =
    getRequiredElement<HTMLInputElement>("runtime-global-max");
  const runtimeApiWindowMs = getRequiredElement<HTMLInputElement>(
    "runtime-api-window-ms",
  );
  const runtimeApiStandard = getRequiredElement<HTMLInputElement>(
    "runtime-api-standard",
  );
  const runtimeApiQuality = getRequiredElement<HTMLInputElement>(
    "runtime-api-quality",
  );
  const runtimeApiSummarize = getRequiredElement<HTMLInputElement>(
    "runtime-api-summarize",
  );
  const runtimeApiUpload =
    getRequiredElement<HTMLInputElement>("runtime-api-upload");
  const runtimeQueueConcurrent = getRequiredElement<HTMLInputElement>(
    "runtime-queue-concurrent",
  );
  const runtimeQueueSize =
    getRequiredElement<HTMLInputElement>("runtime-queue-size");
  const runtimeQueueWaitMs = getRequiredElement<HTMLInputElement>(
    "runtime-queue-wait-ms",
  );
  const runtimeQueueRetryAfter = getRequiredElement<HTMLInputElement>(
    "runtime-queue-retry-after",
  );
  const runtimeUploadMaxSizeMb = getRequiredElement<HTMLInputElement>(
    "runtime-upload-max-size-mb",
  );
  const runtimeUploadMaxSizeMbSelected = getRequiredElement<HTMLElement>(
    "runtime-upload-max-size-mb-selected",
  );
  const runtimeUploadMaxSizeMbCurrent = getRequiredElement<HTMLElement>(
    "runtime-upload-max-size-mb-current",
  );
  const runtimeStageAnalysis = getRequiredElement<HTMLInputElement>(
    "runtime-stage-analysis",
  );
  const runtimeStageRewrite = getRequiredElement<HTMLInputElement>(
    "runtime-stage-rewrite",
  );
  const runtimeStageCritic = getRequiredElement<HTMLInputElement>(
    "runtime-stage-critic",
  );
  const runtimeRetryProviderMax = getRequiredElement<HTMLInputElement>(
    "runtime-retry-provider-max",
  );
  const runtimeRepairMinSubscore = getRequiredElement<HTMLInputElement>(
    "runtime-repair-min-subscore",
  );
  const runtimeRepairMinSubscoreSelected = getRequiredElement<HTMLElement>(
    "runtime-repair-min-subscore-selected",
  );
  const runtimeRepairMinSubscoreCurrent = getRequiredElement<HTMLElement>(
    "runtime-repair-min-subscore-current",
  );
  const runtimeAutoEnabled = getRequiredElement<HTMLInputElement>(
    "runtime-auto-enabled",
  );
  const runtimeAutoMode =
    getRequiredElement<HTMLSelectElement>("runtime-auto-mode");
  const runtimeAutoManualProfile = getRequiredElement<HTMLSelectElement>(
    "runtime-auto-manual-profile",
  );
  const runtimeAutoDryRun = getRequiredElement<HTMLInputElement>(
    "runtime-auto-dry-run",
  );
  const runtimeAutoEvaluateSeconds = getRequiredElement<HTMLInputElement>(
    "runtime-auto-evaluate-seconds",
  );
  const runtimeAutoWindowSeconds = getRequiredElement<HTMLInputElement>(
    "runtime-auto-window-seconds",
  );
  const runtimeAutoMinDwellSeconds = getRequiredElement<HTMLInputElement>(
    "runtime-auto-min-dwell-seconds",
  );
  const runtimeAutoCooldownSeconds = getRequiredElement<HTMLInputElement>(
    "runtime-auto-cooldown-seconds",
  );
  const runtimeAutoMinSamples = getRequiredElement<HTMLInputElement>(
    "runtime-auto-min-samples",
  );
  const runtimeAutoEscalateConsecutive = getRequiredElement<HTMLInputElement>(
    "runtime-auto-escalate-consecutive",
  );
  const runtimeAutoRelaxConsecutive = getRequiredElement<HTMLInputElement>(
    "runtime-auto-relax-consecutive",
  );
  const runtimeSettingsJson = getRequiredElement<HTMLTextAreaElement>(
    "runtime-settings-json",
  );
  const saveRuntimeSettingsFieldsButton = getRequiredElement<HTMLButtonElement>(
    "save-runtime-settings-fields",
  );
  const saveRuntimeSettingsButton = getRequiredElement<HTMLButtonElement>(
    "save-runtime-settings",
  );
  const geminiModel = getRequiredElement<HTMLInputElement>("gemini-model");
  const geminiTemp = getRequiredElement<HTMLInputElement>("gemini-temp");
  const geminiTempSelected = getRequiredElement<HTMLElement>(
    "gemini-temp-selected",
  );
  const geminiTempValue = getRequiredElement<HTMLElement>("gemini-temp-value");
  const geminiQeTemp = getRequiredElement<HTMLInputElement>("gemini-qe-temp");
  const geminiQeTempSelected = getRequiredElement<HTMLElement>(
    "gemini-qe-temp-selected",
  );
  const geminiQeTempValue = getRequiredElement<HTMLElement>(
    "gemini-qe-temp-value",
  );
  const geminiMax = getRequiredElement<HTMLInputElement>("gemini-max");
  const geminiUseSearch =
    getRequiredElement<HTMLInputElement>("gemini-use-search");
  const geminiUseThinking = getRequiredElement<HTMLInputElement>(
    "gemini-use-thinking",
  );
  const backupDownloadButton =
    getRequiredElement<HTMLButtonElement>("backup-download");
  const backupUploadInput =
    getRequiredElement<HTMLInputElement>("backup-upload");
  const backupImportButton =
    getRequiredElement<HTMLButtonElement>("backup-import");
  const viewInputs = document.querySelectorAll<HTMLInputElement>(
    'input[type="radio"][data-view-target]',
  );
  const views = document.querySelectorAll<HTMLElement>("[data-view]");

  if (
    !tokenInput ||
    !statusEl ||
    !hintEl ||
    !checkButton ||
    !saveGlobalButton ||
    !saveGeminiButton ||
    !ordlistaFrom ||
    !ordlistaTo ||
    !ordlistaSaveButton ||
    !ordlistaClearButton ||
    !ordlistaList ||
    !ordlistaEmpty ||
    !taskPromptSelect ||
    !taskPromptLabel ||
    !taskPromptContent ||
    !taskPromptSaveButton ||
    !taskDefLabel ||
    !taskDefDescription ||
    !taskDefEnabled ||
    !taskDefTargetAudienceEnabled ||
    !taskDefRewritePlanEnabled ||
    !taskDefCreateButton ||
    !taskDefDeleteButton ||
    !taskDefMoveUpButton ||
    !taskDefMoveDownButton ||
    !easyReadTaskEnabled ||
    !easyReadWorkflowEnabled ||
    !easyReadWorkflowUseRewriteDraft ||
    !saveEasyReadSettingsButton ||
    !easyReadPromptTask ||
    !easyReadPromptImportantRules ||
    !easyReadPromptRole ||
    !easyReadPromptSenderIntent ||
    !easyReadPromptRewritePlan ||
    !easyReadPromptQualityEvaluation ||
    !easyReadPromptWordListUsage ||
    !easyReadPromptRewriteFallback ||
    !easyReadPromptTargetAudienceFallback ||
    !easyReadTargetAudienceSelect ||
    !easyReadTargetAudienceGroup ||
    !easyReadTargetAudiencePromptLabel ||
    !easyReadTargetAudiencePrompt ||
    !easyReadTargetAudienceSaveButton ||
    !targetAudienceSelect ||
    !targetAudienceGroup ||
    !targetAudienceCategorySelect ||
    !targetAudienceCategoryNameInput ||
    !targetAudienceCategoryCreateButton ||
    !targetAudienceCategorySaveButton ||
    !targetAudienceCategoryDeleteButton ||
    !targetAudienceCategoryMoveUpButton ||
    !targetAudienceCategoryMoveDownButton ||
    !targetAudienceCategoryForItemSelect ||
    !targetAudienceLabelInput ||
    !targetAudienceCreateButton ||
    !targetAudienceDeleteButton ||
    !targetAudienceMoveUpButton ||
    !targetAudienceMoveDownButton ||
    !targetAudiencePromptLabel ||
    !targetAudiencePrompt ||
    !targetAudienceSaveButton ||
    !globalProvider ||
    !globalRetry ||
    !globalRetryCurrent ||
    !globalRetrySelected ||
    !globalQualityAttempts ||
    !globalQualityAttemptsCurrent ||
    !globalQualityAttemptsSelected ||
    !globalRepairBudget ||
    !globalRepairBudgetCurrent ||
    !globalRepairBudgetSelected ||
    !runtimeProviderRpmGemini ||
    !runtimeProviderRpmOpenai ||
    !runtimeGlobalWindowMs ||
    !runtimeGlobalMax ||
    !runtimeApiWindowMs ||
    !runtimeApiStandard ||
    !runtimeApiQuality ||
    !runtimeApiSummarize ||
    !runtimeApiUpload ||
    !runtimeQueueConcurrent ||
    !runtimeQueueSize ||
    !runtimeQueueWaitMs ||
    !runtimeQueueRetryAfter ||
    !runtimeUploadMaxSizeMb ||
    !runtimeUploadMaxSizeMbSelected ||
    !runtimeUploadMaxSizeMbCurrent ||
    !runtimeStageAnalysis ||
    !runtimeStageRewrite ||
    !runtimeStageCritic ||
    !runtimeRetryProviderMax ||
    !runtimeRepairMinSubscore ||
    !runtimeRepairMinSubscoreSelected ||
    !runtimeRepairMinSubscoreCurrent ||
    !runtimeAutoEnabled ||
    !runtimeAutoMode ||
    !runtimeAutoManualProfile ||
    !runtimeAutoDryRun ||
    !runtimeAutoEvaluateSeconds ||
    !runtimeAutoWindowSeconds ||
    !runtimeAutoMinDwellSeconds ||
    !runtimeAutoCooldownSeconds ||
    !runtimeAutoMinSamples ||
    !runtimeAutoEscalateConsecutive ||
    !runtimeAutoRelaxConsecutive ||
    !runtimeSettingsJson ||
    !saveRuntimeSettingsFieldsButton ||
    !saveRuntimeSettingsButton ||
    !geminiModel ||
    !geminiTemp ||
    !geminiTempSelected ||
    !geminiTempValue ||
    !geminiQeTemp ||
    !geminiQeTempSelected ||
    !geminiQeTempValue ||
    !geminiMax ||
    !geminiUseSearch ||
    !geminiUseThinking ||
    !backupDownloadButton ||
    !backupUploadInput ||
    !backupImportButton
  ) {
    return null;
  }

  return {
    tokenInput,
    statusEl,
    hintEl,
    checkButton,
    saveGlobalButton,
    saveGeminiButton,
    ordlistaFrom,
    ordlistaTo,
    ordlistaSaveButton,
    ordlistaClearButton,
    ordlistaList,
    ordlistaEmpty,
    taskPromptSelect,
    taskPromptLabel,
    taskPromptContent,
    taskPromptSaveButton,
    taskDefLabel,
    taskDefDescription,
    taskDefEnabled,
    taskDefTargetAudienceEnabled,
    taskDefRewritePlanEnabled,
    taskDefCreateButton,
    taskDefDeleteButton,
    taskDefMoveUpButton,
    taskDefMoveDownButton,
    easyReadTaskEnabled,
    easyReadWorkflowEnabled,
    easyReadWorkflowUseRewriteDraft,
    saveEasyReadSettingsButton,
    easyReadPromptTask,
    easyReadPromptImportantRules,
    easyReadPromptRole,
    easyReadPromptSenderIntent,
    easyReadPromptRewritePlan,
    easyReadPromptQualityEvaluation,
    easyReadPromptWordListUsage,
    easyReadPromptRewriteFallback,
    easyReadPromptTargetAudienceFallback,
    easyReadTargetAudienceSelect,
    easyReadTargetAudienceGroup,
    easyReadTargetAudiencePromptLabel,
    easyReadTargetAudiencePrompt,
    easyReadTargetAudienceSaveButton,
    targetAudienceSelect,
    targetAudienceGroup,
    targetAudienceCategorySelect,
    targetAudienceCategoryNameInput,
    targetAudienceCategoryCreateButton,
    targetAudienceCategorySaveButton,
    targetAudienceCategoryDeleteButton,
    targetAudienceCategoryMoveUpButton,
    targetAudienceCategoryMoveDownButton,
    targetAudienceCategoryForItemSelect,
    targetAudienceLabelInput,
    targetAudienceCreateButton,
    targetAudienceDeleteButton,
    targetAudienceMoveUpButton,
    targetAudienceMoveDownButton,
    targetAudiencePromptLabel,
    targetAudiencePrompt,
    targetAudienceSaveButton,
    globalProvider,
    globalRetry,
    globalRetryCurrent,
    globalRetrySelected,
    globalQualityAttempts,
    globalQualityAttemptsCurrent,
    globalQualityAttemptsSelected,
    globalRepairBudget,
    globalRepairBudgetCurrent,
    globalRepairBudgetSelected,
    runtimeProviderRpmGemini,
    runtimeProviderRpmOpenai,
    runtimeGlobalWindowMs,
    runtimeGlobalMax,
    runtimeApiWindowMs,
    runtimeApiStandard,
    runtimeApiQuality,
    runtimeApiSummarize,
    runtimeApiUpload,
    runtimeQueueConcurrent,
    runtimeQueueSize,
    runtimeQueueWaitMs,
    runtimeQueueRetryAfter,
    runtimeUploadMaxSizeMb,
    runtimeUploadMaxSizeMbSelected,
    runtimeUploadMaxSizeMbCurrent,
    runtimeStageAnalysis,
    runtimeStageRewrite,
    runtimeStageCritic,
    runtimeRetryProviderMax,
    runtimeRepairMinSubscore,
    runtimeRepairMinSubscoreSelected,
    runtimeRepairMinSubscoreCurrent,
    runtimeAutoEnabled,
    runtimeAutoMode,
    runtimeAutoManualProfile,
    runtimeAutoDryRun,
    runtimeAutoEvaluateSeconds,
    runtimeAutoWindowSeconds,
    runtimeAutoMinDwellSeconds,
    runtimeAutoCooldownSeconds,
    runtimeAutoMinSamples,
    runtimeAutoEscalateConsecutive,
    runtimeAutoRelaxConsecutive,
    runtimeSettingsJson,
    saveRuntimeSettingsFieldsButton,
    saveRuntimeSettingsButton,
    geminiModel,
    geminiTemp,
    geminiTempSelected,
    geminiTempValue,
    geminiQeTemp,
    geminiQeTempSelected,
    geminiQeTempValue,
    geminiMax,
    geminiUseSearch,
    geminiUseThinking,
    backupDownloadButton,
    backupUploadInput,
    backupImportButton,
    viewInputs,
    views,
  };
}

function initAdminUI(): void {
  const refs = initRefs();
  if (!refs) {
    return;
  }

  const state = {
    hintTimeout: 0 as unknown as number,
    lastTargetAudience: "",
    lastEasyToReadTargetAudience: "",
    lastTaskPrompt: "",
    rewritePlanTasks: getDefaultRewritePlanTasks(),
    runtimeSettings: {} as RuntimeSettings,
    taskDefinitions: [] as TaskDefinition[],
    targetAudienceCatalog: {
      categories: [...EMPTY_TARGET_AUDIENCE_CATALOG.categories],
      audiences: [...EMPTY_TARGET_AUDIENCE_CATALOG.audiences],
    } as TargetAudienceCatalog,
  };

  const buttonHintTimeouts = new WeakMap<HTMLElement, number>();

  const setStatus = (message: string): void => {
    refs.statusEl.textContent = `Status: ${message}`;
  };

  const showHint = (
    message: string,
    type: "success" | "error" | "info" = "info",
  ): void => {
    refs.hintEl.textContent = message;
    refs.hintEl.dataset.state = type;
    if (state.hintTimeout) {
      window.clearTimeout(state.hintTimeout);
    }
    state.hintTimeout = window.setTimeout(() => {
      refs.hintEl.textContent = "";
      refs.hintEl.dataset.state = "";
    }, 3500);
  };

  const ensureButtonHint = (button: HTMLElement): HTMLElement | null => {
    let wrapper = button.parentElement;
    if (!wrapper) {
      return null;
    }
    if (!wrapper.classList.contains("admin-save-wrap")) {
      const wrap = document.createElement("span");
      wrap.className = "admin-save-wrap";
      wrapper.insertBefore(wrap, button);
      wrap.appendChild(button);
      wrapper = wrap;
    }

    let hint = wrapper.querySelector<HTMLElement>(".admin-save-hint");
    if (!hint) {
      hint = document.createElement("span");
      hint.className = "admin-save-hint";
      hint.setAttribute("role", "status");
      hint.setAttribute("aria-live", "polite");
      wrapper.appendChild(hint);
    }

    return hint;
  };

  const showButtonHint = (
    button: HTMLElement | null,
    message: string,
    type: "success" | "error" | "info" = "info",
  ): void => {
    if (!button) {
      return;
    }

    const hint = ensureButtonHint(button);
    if (!hint) {
      return;
    }

    hint.textContent = message;
    hint.dataset.state = type;

    const existingTimeout = buttonHintTimeouts.get(hint);
    if (existingTimeout) {
      window.clearTimeout(existingTimeout);
    }
    const timeoutId = window.setTimeout(() => {
      hint.textContent = "";
      hint.dataset.state = "";
    }, 3500);
    buttonHintTimeouts.set(hint, timeoutId);
  };

  const getToken = (): string => refs.tokenInput.value.trim();

  const requestBackupPayload = async (): Promise<unknown> => {
    const token = getToken();
    if (!token) {
      throw new Error("Ingen admin-nyckel angiven.");
    }

    const response = await fetch("/admin/backup", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        "X-Admin-Actor": "admin-ui",
      },
      cache: "no-store",
    });

    const payload = (await response.json().catch(() => null)) as
      | { error?: string; message?: string }
      | unknown
      | null;
    if (!response.ok) {
      const errorMessage =
        typeof payload === "object" && payload !== null
          ? (payload as { error?: string; message?: string }).error ||
            (payload as { error?: string; message?: string }).message
          : undefined;
      throw new Error(errorMessage || `Fel (${response.status})`);
    }

    return payload ?? {};
  };

  const postBackupPayload = async (
    payload: unknown,
  ): Promise<{ imported?: { prompts?: number; ordlista?: number } }> => {
    const token = getToken();
    if (!token) {
      throw new Error("Ingen admin-nyckel angiven.");
    }

    const response = await fetch("/admin/backup", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "X-Admin-Actor": "admin-ui",
      },
      body: JSON.stringify(payload),
      cache: "no-store",
    });

    const result = (await response.json().catch(() => null)) as
      | { data?: { imported?: { prompts?: number; ordlista?: number } } }
      | { error?: string; message?: string; validationErrors?: string[] }
      | null;

    if (!response.ok) {
      const errorPayload = result as {
        error?: string;
        message?: string;
        validationErrors?: string[];
      } | null;
      let message =
        errorPayload?.error ||
        errorPayload?.message ||
        `Fel (${response.status})`;
      if (errorPayload?.validationErrors?.length) {
        message = `${message}: ${errorPayload.validationErrors[0]}`;
      }
      throw new Error(message);
    }

    const successPayload = result as {
      data?: { imported?: { prompts?: number; ordlista?: number } };
    } | null;
    return successPayload?.data ?? {};
  };

  const apiRequest = async <T>(
    method: string,
    path: string,
    body?: Record<string, unknown>,
  ): Promise<T> => {
    const token = getToken();
    if (!token) {
      throw new Error("Ingen admin-nyckel angiven.");
    }

    const headers: Record<string, string> = {
      Authorization: `Bearer ${token}`,
      "X-Admin-Actor": "admin-ui",
    };

    if (body !== undefined) {
      headers["Content-Type"] = "application/json";
    }

    const response = await fetch(path, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      cache: "no-store",
    });

    const payload = (await response
      .json()
      .catch(() => null)) as ApiResponse<T> | null;
    if (!response.ok) {
      let message =
        payload?.message || payload?.error || `Fel (${response.status})`;
      if (payload?.validationErrors?.length) {
        message = `${message}: ${payload.validationErrors[0]}`;
      }
      throw new Error(message);
    }

    return (payload?.data as T) ?? ({} as T);
  };

  const setPromptField = (name: string, value?: string): void => {
    const field = document.getElementById(
      `prompt-${name}`,
    ) as HTMLTextAreaElement | null;
    if (field) {
      field.value = value || "";
    }
  };

  const setRetryCurrentLabel = (
    value: string | number | null | undefined,
  ): void => {
    const displayValue =
      value === null || value === undefined || String(value).trim() === ""
        ? "-"
        : String(value);
    refs.globalRetryCurrent.textContent = `Nuvarande: ${displayValue}`;
  };

  const setRetrySelectedLabel = (
    value: string | number | null | undefined,
  ): void => {
    const displayValue =
      value === null || value === undefined || String(value).trim() === ""
        ? "-"
        : String(value);
    refs.globalRetrySelected.textContent = `Vald: ${displayValue}`;
  };

  const setGlobalQualityAttemptsCurrentLabel = (
    value: string | number | null | undefined,
  ): void => {
    const displayValue =
      value === null || value === undefined || String(value).trim() === ""
        ? "-"
        : String(value);
    refs.globalQualityAttemptsCurrent.textContent = `Nuvarande: ${displayValue}`;
  };

  const setGlobalQualityAttemptsSelectedLabel = (
    value: string | number | null | undefined,
  ): void => {
    const displayValue =
      value === null || value === undefined || String(value).trim() === ""
        ? "-"
        : String(value);
    refs.globalQualityAttemptsSelected.textContent = `Vald: ${displayValue}`;
  };

  const setGlobalRepairBudgetCurrentLabel = (
    value: string | number | null | undefined,
  ): void => {
    const displayValue =
      value === null || value === undefined || String(value).trim() === ""
        ? "-"
        : String(value);
    refs.globalRepairBudgetCurrent.textContent = `Nuvarande: ${displayValue}`;
  };

  const setGlobalRepairBudgetSelectedLabel = (
    value: string | number | null | undefined,
  ): void => {
    const displayValue =
      value === null || value === undefined || String(value).trim() === ""
        ? "-"
        : String(value);
    refs.globalRepairBudgetSelected.textContent = `Vald: ${displayValue}`;
  };

  const setRuntimeRepairMinSubscoreCurrent = (
    value: string | number | null | undefined,
  ): void => {
    const parsed = Number(value);
    const safeValue = Number.isFinite(parsed)
      ? parsed
      : DEFAULT_RUNTIME_REPAIR_MIN_SUBSCORE;
    const clamped = Math.min(10, Math.max(1, Math.round(safeValue)));
    refs.runtimeRepairMinSubscore.value = String(clamped);
    refs.runtimeRepairMinSubscoreCurrent.textContent = `Nuvarande: ${clamped}`;
  };

  const setRuntimeRepairMinSubscoreSelected = (
    value: string | number | null | undefined,
  ): void => {
    const parsed = Number(value);
    const safeValue = Number.isFinite(parsed)
      ? parsed
      : DEFAULT_RUNTIME_REPAIR_MIN_SUBSCORE;
    const clamped = Math.min(10, Math.max(1, Math.round(safeValue)));
    refs.runtimeRepairMinSubscoreSelected.textContent = `Vald: ${clamped}`;
  };

  const setRuntimeUploadMaxSizeCurrent = (
    value: string | number | null | undefined,
  ): void => {
    const parsed = Number(value);
    const safeValue = Number.isFinite(parsed)
      ? parsed
      : DEFAULT_RUNTIME_UPLOAD_MAX_SIZE_MB;
    const clamped = Math.min(100, Math.max(1, Math.round(safeValue)));
    refs.runtimeUploadMaxSizeMb.value = String(clamped);
    refs.runtimeUploadMaxSizeMbCurrent.textContent = `Nuvarande: ${clamped} MB`;
  };

  const setRuntimeUploadMaxSizeSelected = (
    value: string | number | null | undefined,
  ): void => {
    const parsed = Number(value);
    const safeValue = Number.isFinite(parsed)
      ? parsed
      : DEFAULT_RUNTIME_UPLOAD_MAX_SIZE_MB;
    const clamped = Math.min(100, Math.max(1, Math.round(safeValue)));
    refs.runtimeUploadMaxSizeMbSelected.textContent = `Vald: ${clamped} MB`;
  };

  const setRuntimeSettingsFields = (runtimeSettings: RuntimeSettings): void => {
    const providerRpm =
      runtimeSettings.providerRpm &&
      typeof runtimeSettings.providerRpm === "object" &&
      !Array.isArray(runtimeSettings.providerRpm)
        ? (runtimeSettings.providerRpm as Record<string, unknown>)
        : {};
    const globalRateLimit =
      runtimeSettings.globalRateLimit &&
      typeof runtimeSettings.globalRateLimit === "object" &&
      !Array.isArray(runtimeSettings.globalRateLimit)
        ? (runtimeSettings.globalRateLimit as Record<string, unknown>)
        : {};
    const apiRateLimit =
      runtimeSettings.apiRateLimit &&
      typeof runtimeSettings.apiRateLimit === "object" &&
      !Array.isArray(runtimeSettings.apiRateLimit)
        ? (runtimeSettings.apiRateLimit as Record<string, unknown>)
        : {};
    const summarizeQueue =
      runtimeSettings.summarizeQueue &&
      typeof runtimeSettings.summarizeQueue === "object" &&
      !Array.isArray(runtimeSettings.summarizeQueue)
        ? (runtimeSettings.summarizeQueue as Record<string, unknown>)
        : {};
    const uploadSettings =
      runtimeSettings.upload &&
      typeof runtimeSettings.upload === "object" &&
      !Array.isArray(runtimeSettings.upload)
        ? (runtimeSettings.upload as Record<string, unknown>)
        : {};
    const stageConcurrency =
      runtimeSettings.stageConcurrency &&
      typeof runtimeSettings.stageConcurrency === "object" &&
      !Array.isArray(runtimeSettings.stageConcurrency)
        ? (runtimeSettings.stageConcurrency as Record<string, unknown>)
        : {};
    const retrySettings =
      runtimeSettings.retry &&
      typeof runtimeSettings.retry === "object" &&
      !Array.isArray(runtimeSettings.retry)
        ? (runtimeSettings.retry as Record<string, unknown>)
        : {};
    const repairSettings =
      runtimeSettings.repair &&
      typeof runtimeSettings.repair === "object" &&
      !Array.isArray(runtimeSettings.repair)
        ? (runtimeSettings.repair as Record<string, unknown>)
        : {};
    const autoProfile =
      runtimeSettings.autoProfile &&
      typeof runtimeSettings.autoProfile === "object" &&
      !Array.isArray(runtimeSettings.autoProfile)
        ? (runtimeSettings.autoProfile as Record<string, unknown>)
        : {};
    const autoWindows =
      autoProfile.windows &&
      typeof autoProfile.windows === "object" &&
      !Array.isArray(autoProfile.windows)
        ? (autoProfile.windows as Record<string, unknown>)
        : {};
    const easyToReadWorkflow =
      runtimeSettings.easyToReadWorkflow &&
      typeof runtimeSettings.easyToReadWorkflow === "object" &&
      !Array.isArray(runtimeSettings.easyToReadWorkflow)
        ? (runtimeSettings.easyToReadWorkflow as Record<string, unknown>)
        : {};

    refs.runtimeProviderRpmGemini.value = String(
      readRuntimeInteger(
        providerRpm.gemini,
        DEFAULT_RUNTIME_PROVIDER_RPM_GEMINI,
        1,
        10000,
      ),
    );
    refs.runtimeProviderRpmOpenai.value = String(
      readRuntimeInteger(
        providerRpm.openai,
        DEFAULT_RUNTIME_PROVIDER_RPM_OPENAI,
        1,
        10000,
      ),
    );

    refs.runtimeGlobalWindowMs.value = String(
      readRuntimeInteger(
        globalRateLimit.windowMs,
        DEFAULT_RUNTIME_GLOBAL_WINDOW_MS,
        1000,
        60 * 60 * 1000,
      ),
    );
    refs.runtimeGlobalMax.value = String(
      readRuntimeInteger(
        globalRateLimit.max,
        DEFAULT_RUNTIME_GLOBAL_MAX,
        1,
        1000,
      ),
    );

    refs.runtimeApiWindowMs.value = String(
      readRuntimeInteger(
        apiRateLimit.windowMs,
        DEFAULT_RUNTIME_API_WINDOW_MS,
        1000,
        60 * 60 * 1000,
      ),
    );
    refs.runtimeApiStandard.value = String(
      readRuntimeInteger(
        apiRateLimit.standard,
        DEFAULT_RUNTIME_API_STANDARD,
        1,
        10000,
      ),
    );
    refs.runtimeApiQuality.value = String(
      readRuntimeInteger(
        apiRateLimit.quality,
        DEFAULT_RUNTIME_API_QUALITY,
        1,
        10000,
      ),
    );
    refs.runtimeApiSummarize.value = String(
      readRuntimeInteger(
        apiRateLimit.summarize,
        DEFAULT_RUNTIME_API_SUMMARIZE,
        1,
        10000,
      ),
    );
    refs.runtimeApiUpload.value = String(
      readRuntimeInteger(
        apiRateLimit.fileUpload,
        DEFAULT_RUNTIME_API_UPLOAD,
        1,
        10000,
      ),
    );

    refs.runtimeQueueConcurrent.value = String(
      readRuntimeInteger(
        summarizeQueue.maxConcurrentJobs,
        DEFAULT_RUNTIME_QUEUE_CONCURRENT,
        1,
        200,
      ),
    );
    refs.runtimeQueueSize.value = String(
      readRuntimeInteger(
        summarizeQueue.maxQueueSize,
        DEFAULT_RUNTIME_QUEUE_SIZE,
        1,
        5000,
      ),
    );
    refs.runtimeQueueWaitMs.value = String(
      readRuntimeInteger(
        summarizeQueue.maxWaitMs,
        DEFAULT_RUNTIME_QUEUE_WAIT_MS,
        1000,
        300000,
      ),
    );
    refs.runtimeQueueRetryAfter.value = String(
      readRuntimeInteger(
        summarizeQueue.retryAfterSeconds,
        DEFAULT_RUNTIME_QUEUE_RETRY_AFTER,
        1,
        300,
      ),
    );
    const uploadMaxSize = readRuntimeInteger(
      uploadSettings.maxFileSizeMB,
      DEFAULT_RUNTIME_UPLOAD_MAX_SIZE_MB,
      1,
      100,
    );
    setRuntimeUploadMaxSizeCurrent(uploadMaxSize);
    setRuntimeUploadMaxSizeSelected(uploadMaxSize);

    refs.runtimeStageAnalysis.value = String(
      readRuntimeInteger(
        stageConcurrency.analysis,
        DEFAULT_RUNTIME_STAGE_ANALYSIS,
        1,
        200,
      ),
    );
    refs.runtimeStageRewrite.value = String(
      readRuntimeInteger(
        stageConcurrency.rewrite,
        DEFAULT_RUNTIME_STAGE_REWRITE,
        1,
        200,
      ),
    );
    refs.runtimeStageCritic.value = String(
      readRuntimeInteger(
        stageConcurrency.critic,
        DEFAULT_RUNTIME_STAGE_CRITIC,
        1,
        200,
      ),
    );

    refs.runtimeRetryProviderMax.value = String(
      readRuntimeInteger(
        retrySettings.providerMaxRetries,
        DEFAULT_RUNTIME_RETRY_PROVIDER_MAX,
        0,
        20,
      ),
    );
    const retryFallbackFromGlobal = Number.parseInt(refs.globalRetry.value, 10);
    const qualityMaxAttempts = readRuntimeInteger(
      retrySettings.qualityMaxAttempts,
      Number.isInteger(retryFallbackFromGlobal) && retryFallbackFromGlobal >= 1
        ? retryFallbackFromGlobal
        : DEFAULT_RUNTIME_RETRY_QUALITY_MAX,
      1,
      10,
    );
    refs.globalQualityAttempts.value = String(qualityMaxAttempts);
    setGlobalQualityAttemptsCurrentLabel(qualityMaxAttempts);
    setGlobalQualityAttemptsSelectedLabel(qualityMaxAttempts);

    const repairBudget = readRuntimeInteger(
      repairSettings.budget,
      DEFAULT_RUNTIME_REPAIR_BUDGET,
      1,
      10,
    );
    refs.globalRepairBudget.value = String(repairBudget);
    setGlobalRepairBudgetCurrentLabel(repairBudget);
    setGlobalRepairBudgetSelectedLabel(repairBudget);

    const minSubscore = readRuntimeInteger(
      repairSettings.minSubscore,
      DEFAULT_RUNTIME_REPAIR_MIN_SUBSCORE,
      1,
      10,
    );
    setRuntimeRepairMinSubscoreCurrent(minSubscore);
    setRuntimeRepairMinSubscoreSelected(minSubscore);

    refs.runtimeAutoEnabled.checked =
      typeof autoProfile.enabled === "boolean"
        ? autoProfile.enabled
        : DEFAULT_RUNTIME_AUTO_ENABLED;
    refs.runtimeAutoMode.value =
      autoProfile.mode === "manual" || autoProfile.mode === "auto"
        ? autoProfile.mode
        : DEFAULT_RUNTIME_AUTO_MODE;
    refs.runtimeAutoManualProfile.value =
      autoProfile.manualProfile === "quality" ||
      autoProfile.manualProfile === "balanced" ||
      autoProfile.manualProfile === "stress"
        ? autoProfile.manualProfile
        : DEFAULT_RUNTIME_AUTO_MANUAL_PROFILE;
    refs.runtimeAutoDryRun.checked =
      typeof autoProfile.dryRun === "boolean"
        ? autoProfile.dryRun
        : DEFAULT_RUNTIME_AUTO_DRY_RUN;
    refs.runtimeAutoEvaluateSeconds.value = String(
      readRuntimeInteger(
        autoProfile.evaluateEverySeconds,
        DEFAULT_RUNTIME_AUTO_EVALUATE_SECONDS,
        5,
        300,
      ),
    );
    refs.runtimeAutoWindowSeconds.value = String(
      readRuntimeInteger(
        autoProfile.windowSeconds,
        DEFAULT_RUNTIME_AUTO_WINDOW_SECONDS,
        10,
        900,
      ),
    );
    refs.runtimeAutoMinDwellSeconds.value = String(
      readRuntimeInteger(
        autoProfile.minDwellSeconds,
        DEFAULT_RUNTIME_AUTO_MIN_DWELL_SECONDS,
        0,
        3600,
      ),
    );
    refs.runtimeAutoCooldownSeconds.value = String(
      readRuntimeInteger(
        autoProfile.cooldownSeconds,
        DEFAULT_RUNTIME_AUTO_COOLDOWN_SECONDS,
        0,
        3600,
      ),
    );
    refs.runtimeAutoMinSamples.value = String(
      readRuntimeInteger(
        autoWindows.minSamples,
        DEFAULT_RUNTIME_AUTO_MIN_SAMPLES,
        1,
        5000,
      ),
    );
    refs.runtimeAutoEscalateConsecutive.value = String(
      readRuntimeInteger(
        autoWindows.escalateConsecutive,
        DEFAULT_RUNTIME_AUTO_ESCALATE_CONSECUTIVE,
        1,
        20,
      ),
    );
    refs.runtimeAutoRelaxConsecutive.value = String(
      readRuntimeInteger(
        autoWindows.relaxConsecutive,
        DEFAULT_RUNTIME_AUTO_RELAX_CONSECUTIVE,
        1,
        50,
      ),
    );

    refs.easyReadWorkflowEnabled.checked = readRuntimeBoolean(
      easyToReadWorkflow.enabled,
      false,
    );
    refs.easyReadWorkflowUseRewriteDraft.checked = readRuntimeBoolean(
      easyToReadWorkflow.useRewriteDraft,
      false,
    );
  };

  const buildRuntimeSettingsFromFields = (): RuntimeSettings => {
    const next = cloneRuntimeSettings(state.runtimeSettings);

    const providerRpm = getRuntimeObject(next, "providerRpm");
    providerRpm.gemini = parseIntegerField(
      refs.runtimeProviderRpmGemini,
      "Gemini RPM",
      1,
      10000,
    );
    providerRpm.openai = parseIntegerField(
      refs.runtimeProviderRpmOpenai,
      "OpenAI RPM",
      1,
      10000,
    );

    const globalRateLimit = getRuntimeObject(next, "globalRateLimit");
    globalRateLimit.windowMs = parseIntegerField(
      refs.runtimeGlobalWindowMs,
      "Global window",
      1000,
      60 * 60 * 1000,
    );
    globalRateLimit.max = parseIntegerField(
      refs.runtimeGlobalMax,
      "Global max",
      1,
      1000,
    );

    const apiRateLimit = getRuntimeObject(next, "apiRateLimit");
    apiRateLimit.windowMs = parseIntegerField(
      refs.runtimeApiWindowMs,
      "Route window",
      1000,
      60 * 60 * 1000,
    );
    apiRateLimit.standard = parseIntegerField(
      refs.runtimeApiStandard,
      "Route standard",
      1,
      10000,
    );
    apiRateLimit.quality = parseIntegerField(
      refs.runtimeApiQuality,
      "Route quality",
      1,
      10000,
    );
    apiRateLimit.summarize = parseIntegerField(
      refs.runtimeApiSummarize,
      "Route summarize",
      1,
      10000,
    );
    apiRateLimit.fileUpload = parseIntegerField(
      refs.runtimeApiUpload,
      "Route upload",
      1,
      10000,
    );

    const summarizeQueue = getRuntimeObject(next, "summarizeQueue");
    summarizeQueue.maxConcurrentJobs = parseIntegerField(
      refs.runtimeQueueConcurrent,
      "Queue max concurrent",
      1,
      200,
    );
    summarizeQueue.maxQueueSize = parseIntegerField(
      refs.runtimeQueueSize,
      "Queue max size",
      1,
      5000,
    );
    summarizeQueue.maxWaitMs = parseIntegerField(
      refs.runtimeQueueWaitMs,
      "Queue max wait",
      1000,
      300000,
    );
    summarizeQueue.retryAfterSeconds = parseIntegerField(
      refs.runtimeQueueRetryAfter,
      "Queue Retry-After",
      1,
      300,
    );

    const upload = getRuntimeObject(next, "upload");
    upload.maxFileSizeMB = parseIntegerField(
      refs.runtimeUploadMaxSizeMb,
      "Upload max size",
      1,
      100,
    );

    const stageConcurrency = getRuntimeObject(next, "stageConcurrency");
    stageConcurrency.analysis = parseIntegerField(
      refs.runtimeStageAnalysis,
      "Stage analysis",
      1,
      200,
    );
    stageConcurrency.rewrite = parseIntegerField(
      refs.runtimeStageRewrite,
      "Stage rewrite",
      1,
      200,
    );
    stageConcurrency.critic = parseIntegerField(
      refs.runtimeStageCritic,
      "Stage critic",
      1,
      200,
    );

    const retry = getRuntimeObject(next, "retry");
    retry.providerMaxRetries = parseIntegerField(
      refs.runtimeRetryProviderMax,
      "Provider max retries",
      0,
      20,
    );
    retry.qualityMaxAttempts = parseIntegerField(
      refs.globalQualityAttempts,
      "Quality max attempts",
      1,
      10,
    );

    const repair = getRuntimeObject(next, "repair");
    repair.budget = parseIntegerField(
      refs.globalRepairBudget,
      "Repair budget",
      1,
      10,
    );
    repair.minSubscore = parseIntegerField(
      refs.runtimeRepairMinSubscore,
      "Quality min subscore",
      1,
      10,
    );

    const autoProfile = getRuntimeObject(next, "autoProfile");
    autoProfile.enabled = refs.runtimeAutoEnabled.checked;
    autoProfile.mode =
      refs.runtimeAutoMode.value === "manual" ? "manual" : "auto";
    autoProfile.manualProfile =
      refs.runtimeAutoManualProfile.value === "balanced" ||
      refs.runtimeAutoManualProfile.value === "stress"
        ? refs.runtimeAutoManualProfile.value
        : "quality";
    autoProfile.dryRun = refs.runtimeAutoDryRun.checked;
    autoProfile.evaluateEverySeconds = parseIntegerField(
      refs.runtimeAutoEvaluateSeconds,
      "Auto evaluate interval",
      5,
      300,
    );
    autoProfile.windowSeconds = parseIntegerField(
      refs.runtimeAutoWindowSeconds,
      "Auto metrics window",
      10,
      900,
    );
    autoProfile.minDwellSeconds = parseIntegerField(
      refs.runtimeAutoMinDwellSeconds,
      "Auto min dwell",
      0,
      3600,
    );
    autoProfile.cooldownSeconds = parseIntegerField(
      refs.runtimeAutoCooldownSeconds,
      "Auto cooldown",
      0,
      3600,
    );

    const autoWindows =
      autoProfile.windows &&
      typeof autoProfile.windows === "object" &&
      !Array.isArray(autoProfile.windows)
        ? (autoProfile.windows as Record<string, unknown>)
        : {};
    autoWindows.minSamples = parseIntegerField(
      refs.runtimeAutoMinSamples,
      "Auto min samples",
      1,
      5000,
    );
    autoWindows.escalateConsecutive = parseIntegerField(
      refs.runtimeAutoEscalateConsecutive,
      "Auto escalate consecutive",
      1,
      20,
    );
    autoWindows.relaxConsecutive = parseIntegerField(
      refs.runtimeAutoRelaxConsecutive,
      "Auto relax consecutive",
      1,
      50,
    );
    autoProfile.windows = autoWindows;

    return next;
  };

  const setRuntimeSettingsEditor = (value: unknown): void => {
    const runtimeSettings = resolveRuntimeSettings(value);
    state.runtimeSettings = runtimeSettings;
    setRuntimeSettingsFields(runtimeSettings);
    refs.runtimeSettingsJson.value = JSON.stringify(runtimeSettings, null, 2);
    const qualityTemperature = readRuntimeQualityTemperature(runtimeSettings);
    setGeminiQeTemperature(qualityTemperature);
    setGeminiQeTemperatureSelected(qualityTemperature);
  };

  const setGeminiTemperature = (
    value: string | number | null | undefined,
  ): void => {
    const parsed = Number(value);
    const safeValue = Number.isFinite(parsed) ? parsed : 0.7;
    const clamped = Math.min(1, Math.max(0, safeValue));
    const formatted = clamped.toFixed(1);
    refs.geminiTemp.value = formatted;
    refs.geminiTempValue.textContent = `Nuvarande: ${formatted}`;
  };

  const setGeminiTemperatureSelected = (
    value: string | number | null | undefined,
  ): void => {
    const parsed = Number(value);
    const safeValue = Number.isFinite(parsed) ? parsed : 0.7;
    const clamped = Math.min(1, Math.max(0, safeValue));
    refs.geminiTempSelected.textContent = `Vald: ${clamped.toFixed(1)}`;
  };

  const setGeminiQeTemperature = (
    value: string | number | null | undefined,
  ): void => {
    const parsed = Number(value);
    const safeValue = Number.isFinite(parsed)
      ? parsed
      : DEFAULT_GEMINI_QE_TEMPERATURE;
    const clamped = Math.min(1, Math.max(0, safeValue));
    const formatted = clamped.toFixed(1);
    refs.geminiQeTemp.value = formatted;
    refs.geminiQeTempValue.textContent = `Nuvarande: ${formatted}`;
  };

  const setGeminiQeTemperatureSelected = (
    value: string | number | null | undefined,
  ): void => {
    const parsed = Number(value);
    const safeValue = Number.isFinite(parsed)
      ? parsed
      : DEFAULT_GEMINI_QE_TEMPERATURE;
    const clamped = Math.min(1, Math.max(0, safeValue));
    refs.geminiQeTempSelected.textContent = `Vald: ${clamped.toFixed(1)}`;
  };

  const loadConfig = async (): Promise<void> => {
    try {
      setStatus("Hämtar konfiguration...");
      const data = await apiRequest<AdminConfigResponse>(
        "GET",
        "/admin/config",
      );
      state.lastTargetAudience = "";
      state.lastEasyToReadTargetAudience = "";
      state.lastTaskPrompt = "";

      if (data?.prompts) {
        Object.entries(data.prompts).forEach(([name, value]) => {
          setPromptField(name, value);
        });
      }

      if (data?.providers?.gemini) {
        refs.geminiModel.value = data.providers.gemini.model || "";
        setGeminiTemperature(data.providers.gemini.temperature ?? 0.7);
        const maxTokens =
          data.providers.gemini.maxOutputTokens ??
          DEFAULT_GEMINI_MAX_OUTPUT_TOKENS;
        refs.geminiMax.value = String(maxTokens);
        setGeminiTemperatureSelected(data.providers.gemini.temperature ?? 0.7);
        refs.geminiUseSearch.checked = Boolean(
          data.providers.gemini.useWebSearch,
        );
        refs.geminiUseThinking.checked =
          data.providers.gemini.useThinking !== undefined
            ? Boolean(data.providers.gemini.useThinking)
            : true;
      } else {
        setGeminiTemperature(0.7);
        setGeminiTemperatureSelected(0.7);
        refs.geminiMax.value = String(DEFAULT_GEMINI_MAX_OUTPUT_TOKENS);
        refs.geminiUseSearch.checked = false;
        refs.geminiUseThinking.checked = true;
      }

      if (data?.global) {
        refs.globalProvider.value = data.global.provider || "gemini-2.5-flash";
        const retryCount =
          typeof data.global.retryCount === "number" &&
          data.global.retryCount >= 1
            ? data.global.retryCount
            : 5;
        refs.globalRetry.value = String(retryCount);
        setRetryCurrentLabel(retryCount);
        setRetrySelectedLabel(retryCount);
        state.rewritePlanTasks = resolveRewritePlanTasks(
          data.global.rewritePlanTasks,
        );
        setRuntimeSettingsEditor(data.global.runtimeSettings);
      } else {
        refs.globalRetry.value = "5";
        setRetryCurrentLabel(5);
        setRetrySelectedLabel(5);
        state.rewritePlanTasks = getDefaultRewritePlanTasks();
        setRuntimeSettingsEditor({});
      }

      await loadTargetAudienceCatalog();
      await loadTaskCatalog();
      setStatus("Konfiguration hämtad.");
    } catch (error) {
      setStatus(
        error instanceof Error
          ? error.message
          : "Kunde inte hämta konfiguration.",
      );
    }
  };

  const formatBackupFilename = (): string => {
    const date = new Date();
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, "0");
    const dd = String(date.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}-textverktyg.json`;
  };

  const downloadBackup = async (): Promise<void> => {
    try {
      setStatus("Hämtar backup...");
      const payload = await requestBackupPayload();
      const blob = new Blob([JSON.stringify(payload, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = formatBackupFilename();
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      setStatus("Backup hämtad.");
      showButtonHint(refs.backupDownloadButton, "Hämtad.", "success");
    } catch (error) {
      setStatus(
        error instanceof Error ? error.message : "Kunde inte hämta backup.",
      );
      showButtonHint(refs.backupDownloadButton, "Fel.", "error");
    }
  };

  const readBackupFile = async (): Promise<unknown> => {
    const file = refs.backupUploadInput.files?.[0];
    if (!file) {
      throw new Error("Välj en JSON-fil.");
    }

    const text = await file.text();
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch (error) {
      throw new Error("Kunde inte läsa JSON-filen.");
    }

    if (!parsed || typeof parsed !== "object") {
      throw new Error("Backup-filen saknar korrekt struktur.");
    }

    const record = parsed as Record<string, unknown>;
    if (
      record.schemaVersion === undefined ||
      record.app === undefined ||
      record.settings === undefined
    ) {
      throw new Error("Backup-filen saknar obligatoriska fält.");
    }

    return parsed;
  };

  const importBackup = async (): Promise<void> => {
    try {
      setStatus("Importerar backup...");
      const payload = await readBackupFile();
      const result = await postBackupPayload(payload);
      const promptCount = result.imported?.prompts ?? 0;
      const ordlistaCount = result.imported?.ordlista ?? 0;
      refs.backupUploadInput.value = "";
      setStatus("Backup importerad.");
      showHint("Import klar.", "success");
      showButtonHint(refs.backupImportButton, "Import klar.", "success");
      if (promptCount > 0 || ordlistaCount > 0) {
        loadConfig();
        loadOrdlista();
      }
    } catch (error) {
      setStatus(
        error instanceof Error ? error.message : "Kunde inte importera backup.",
      );
      showButtonHint(refs.backupImportButton, "Fel.", "error");
    }
  };

  const savePrompt = async (
    name: string,
    button?: HTMLButtonElement,
  ): Promise<void> => {
    const field = document.getElementById(
      `prompt-${name}`,
    ) as HTMLTextAreaElement | null;
    if (!field) {
      return;
    }
    try {
      setStatus(`Sparar prompt: ${name}...`);
      await apiRequest("PUT", `/admin/prompts/${encodeURIComponent(name)}`, {
        content: field.value || "",
      });
      setStatus(`Prompt sparad: ${name}`);
      showHint("Sparat.", "success");
      showButtonHint(button ?? null, "Sparat.", "success");
    } catch (error) {
      setStatus(
        error instanceof Error ? error.message : "Kunde inte spara prompt.",
      );
      showButtonHint(button ?? null, "Fel.", "error");
    }
  };

  const targetAudienceIndex = new Map<
    string,
    { label: string; group: string }
  >();

  const sortTargetAudienceCategories = (
    categories: TargetAudienceCategory[],
  ): TargetAudienceCategory[] =>
    [...categories].sort(
      (a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, "sv"),
    );

  const sortTargetAudienceItems = (
    audiences: TargetAudienceCatalogItem[],
  ): TargetAudienceCatalogItem[] =>
    [...audiences].sort(
      (a, b) =>
        a.category.localeCompare(b.category, "sv") ||
        a.sortOrder - b.sortOrder ||
        a.label.localeCompare(b.label, "sv"),
    );

  const normalizeTargetAudienceCatalog = (
    value: unknown,
  ): TargetAudienceCatalog => {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return {
        categories: [...EMPTY_TARGET_AUDIENCE_CATALOG.categories],
        audiences: [...EMPTY_TARGET_AUDIENCE_CATALOG.audiences],
      };
    }

    const record = value as Record<string, unknown>;
    const categoriesInput = Array.isArray(record.categories)
      ? record.categories
      : [];
    const audiencesInput = Array.isArray(record.audiences)
      ? record.audiences
      : [];

    const seenCategoryNames = new Set<string>();
    const categories = categoriesInput
      .map((entry) => {
        if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
          return null;
        }
        const item = entry as Record<string, unknown>;
        const name =
          typeof item.name === "string" && item.name.trim().length > 0
            ? item.name.trim()
            : null;
        const sortOrder =
          typeof item.sortOrder === "number" &&
          Number.isInteger(item.sortOrder) &&
          item.sortOrder > 0
            ? item.sortOrder
            : null;
        if (!name || !sortOrder || seenCategoryNames.has(name)) {
          return null;
        }
        seenCategoryNames.add(name);
        return { name, sortOrder };
      })
      .filter((entry): entry is TargetAudienceCategory => entry !== null);

    const seenAudienceLabels = new Set<string>();
    const audiences = audiencesInput
      .map((entry) => {
        if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
          return null;
        }
        const item = entry as Record<string, unknown>;
        const label =
          typeof item.label === "string" && item.label.trim().length > 0
            ? item.label.trim()
            : null;
        const category =
          typeof item.category === "string" && item.category.trim().length > 0
            ? item.category.trim()
            : null;
        const sortOrder =
          typeof item.sortOrder === "number" &&
          Number.isInteger(item.sortOrder) &&
          item.sortOrder > 0
            ? item.sortOrder
            : null;
        if (
          !label ||
          !category ||
          !sortOrder ||
          seenAudienceLabels.has(label)
        ) {
          return null;
        }
        seenAudienceLabels.add(label);
        return {
          label,
          category,
          sortOrder,
        };
      })
      .filter((entry): entry is TargetAudienceCatalogItem => entry !== null);

    if (categories.length === 0 && audiences.length > 0) {
      const uniqueAudienceCategories = Array.from(
        new Set(audiences.map((audience) => audience.category)),
      );
      uniqueAudienceCategories.forEach((name, index) => {
        categories.push({ name, sortOrder: (index + 1) * 10 });
        seenCategoryNames.add(name);
      });
    }

    if (categories.length === 0) {
      return {
        categories: [],
        audiences: [],
      };
    }

    const fallbackCategoryName = categories[0]?.name ?? GENERIC_FALLBACK_CATEGORY_NAME;
    const normalizedAudiences = audiences.map((audience) => ({
      ...audience,
      category: seenCategoryNames.has(audience.category)
        ? audience.category
        : fallbackCategoryName,
    }));

    return {
      categories: sortTargetAudienceCategories(categories),
      audiences: sortTargetAudienceItems(normalizedAudiences),
    };
  };

  const fillTargetAudienceCategorySelects = (): void => {
    const sortedCategories = sortTargetAudienceCategories(
      state.targetAudienceCatalog.categories,
    );
    const categorySelects = [
      refs.targetAudienceCategorySelect,
      refs.targetAudienceCategoryForItemSelect,
    ];

    categorySelects.forEach((select) => {
      const previous = select.value;
      select.innerHTML = "";
      sortedCategories.forEach((category) => {
        const option = document.createElement("option");
        option.value = category.name;
        option.textContent = category.name;
        select.appendChild(option);
      });

      if (previous) {
        const existing = Array.from(select.options).find(
          (option) => option.value === previous,
        );
        if (existing) {
          select.value = previous;
          return;
        }
      }

      if (select.options.length > 0) {
        const firstOption = select.options.item(0);
        if (firstOption) {
          select.value = firstOption.value;
        }
      }
    });
  };

  const fillTargetAudienceSelect = (select: HTMLSelectElement): void => {
    const previous = select.value;
    select.innerHTML = "";
    targetAudienceIndex.clear();

    const sortedCategories = sortTargetAudienceCategories(
      state.targetAudienceCatalog.categories,
    );

    sortedCategories.forEach((category) => {
      const categoryAudiences = sortTargetAudienceItems(
        state.targetAudienceCatalog.audiences.filter(
          (audience) => audience.category === category.name,
        ),
      );
      if (categoryAudiences.length === 0) {
        return;
      }

      const optgroup = document.createElement("optgroup");
      optgroup.label = category.name;

      categoryAudiences.forEach((item) => {
        const option = document.createElement("option");
        option.value = item.label;
        option.textContent = item.label;
        optgroup.appendChild(option);

        targetAudienceIndex.set(item.label, {
          label: item.label,
          group: category.name,
        });
      });

      select.appendChild(optgroup);
    });

    if (previous) {
      const existing = Array.from(select.options).find(
        (option) => option.value === previous,
      );
      if (existing) {
        select.value = previous;
        return;
      }
    }

    if (select.options.length > 0) {
      const firstOption = select.options.item(0);
      if (firstOption) {
        select.value = firstOption.value;
      }
    }
  };

  const refreshTargetAudienceCatalogUi = (): void => {
    fillTargetAudienceSelect(refs.targetAudienceSelect);
    fillTargetAudienceSelect(refs.easyReadTargetAudienceSelect);
    fillTargetAudienceCategorySelects();
    updateTargetAudienceLabels();
    updateEasyToReadTargetAudienceLabels();
  };

  const loadTargetAudienceCatalog = async (): Promise<void> => {
    const catalog = await apiRequest<TargetAudienceCatalog>(
      "GET",
      "/admin/target-audience-catalog",
    );
    state.targetAudienceCatalog = normalizeTargetAudienceCatalog(catalog);
    refreshTargetAudienceCatalogUi();
  };

  const saveTargetAudienceCatalog = async (
    catalog: TargetAudienceCatalog,
  ): Promise<void> => {
    const saved = await apiRequest<TargetAudienceCatalog>(
      "PUT",
      "/admin/target-audience-catalog",
      {
        categories: catalog.categories,
        audiences: catalog.audiences,
      },
    );
    state.targetAudienceCatalog = normalizeTargetAudienceCatalog(saved);
    refreshTargetAudienceCatalogUi();
  };

  const isEasyToReadTask = (task: TaskDefinition): boolean => {
    const keyIdentity = normalizeTaskIdentity(task.key);
    const labelIdentity = normalizeTaskIdentity(task.label);
    return (
      EASY_TO_READ_TASK_ALIASES.has(keyIdentity) ||
      EASY_TO_READ_TASK_ALIASES.has(labelIdentity)
    );
  };

  const getEasyToReadTaskDefinition = (): TaskDefinition | undefined =>
    state.taskDefinitions.find((task) => isEasyToReadTask(task));

  const getEasyToReadPromptFields = (): Array<{
    promptName: string;
    field: HTMLTextAreaElement;
  }> => {
    const fields: Array<{ promptName: string; field: HTMLTextAreaElement }> = [
      {
        promptName: "importantRules",
        field: refs.easyReadPromptImportantRules,
      },
      { promptName: "role", field: refs.easyReadPromptRole },
      { promptName: "senderIntent", field: refs.easyReadPromptSenderIntent },
      { promptName: "rewritePlan", field: refs.easyReadPromptRewritePlan },
      {
        promptName: "qualityEvaluation",
        field: refs.easyReadPromptQualityEvaluation,
      },
      {
        promptName: "wordListUsage",
        field: refs.easyReadPromptWordListUsage,
      },
      {
        promptName: "rewriteFallback",
        field: refs.easyReadPromptRewriteFallback,
      },
      {
        promptName: "targetAudience",
        field: refs.easyReadPromptTargetAudienceFallback,
      },
    ];

    const easyTask = getEasyToReadTaskDefinition();
    if (easyTask) {
      fields.unshift({
        promptName: `task:${easyTask.key}`,
        field: refs.easyReadPromptTask,
      });
    }

    return fields;
  };

  const syncEasyToReadTaskControls = (): void => {
    const easyTask = getEasyToReadTaskDefinition();
    const exists = Boolean(easyTask);
    refs.easyReadTaskEnabled.disabled = !exists;
    refs.saveEasyReadSettingsButton.disabled = !exists;
    refs.easyReadTaskEnabled.checked = exists
      ? Boolean(easyTask?.enabled)
      : false;
  };

  const updateTargetAudienceLabels = (): void => {
    const audienceValue = refs.targetAudienceSelect.value;
    const meta = targetAudienceIndex.get(audienceValue);
    if (meta) {
      refs.targetAudienceGroup.textContent = `Kategori: ${meta.group}`;
      refs.targetAudiencePromptLabel.textContent = `Prompt för ${meta.label}`;
      refs.targetAudienceCategoryForItemSelect.value = meta.group;
      refs.targetAudienceLabelInput.value = meta.label;
    } else {
      refs.targetAudienceGroup.textContent = "";
      refs.targetAudiencePromptLabel.textContent = "Prompt för vald målgrupp";
      refs.targetAudienceLabelInput.value = "";
    }

    refs.targetAudienceCategoryNameInput.value =
      refs.targetAudienceCategorySelect.value;
  };

  const updateEasyToReadTargetAudienceLabels = (): void => {
    const audienceValue = refs.easyReadTargetAudienceSelect.value;
    const meta = targetAudienceIndex.get(audienceValue);
    if (meta) {
      refs.easyReadTargetAudienceGroup.textContent = `Kategori: ${meta.group}`;
      refs.easyReadTargetAudiencePromptLabel.textContent = `Prompt för ${meta.label}`;
    } else {
      refs.easyReadTargetAudienceGroup.textContent = "";
      refs.easyReadTargetAudiencePromptLabel.textContent =
        "Prompt för vald målgrupp";
    }
  };

  const initTargetAudienceSelect = (): void => {
    refreshTargetAudienceCatalogUi();
  };

  const readPromptContent = async (promptName: string): Promise<string> => {
    const data = await apiRequest<{ content?: string }>(
      "GET",
      `/admin/prompts/${encodeURIComponent(promptName)}`,
    );
    return data?.content || "";
  };

  const loadEasyToReadPrompts = async (): Promise<void> => {
    const easyToReadPromptFields = getEasyToReadPromptFields();
    const loadedPrompts = await Promise.all(
      easyToReadPromptFields.map(async ({ promptName }) => ({
        promptName,
        content: await readPromptContent(promptName),
      })),
    );

    loadedPrompts.forEach((loaded) => {
      const target = easyToReadPromptFields.find(
        (entry) => entry.promptName === loaded.promptName,
      );
      if (target) {
        target.field.value = loaded.content;
      }
    });
  };

  const loadTargetAudiencePrompt = async (): Promise<void> => {
    const audienceValue = refs.targetAudienceSelect.value;
    if (!audienceValue) {
      return;
    }

    updateTargetAudienceLabels();
    if (state.lastTargetAudience === audienceValue) {
      return;
    }

    try {
      setStatus("Hämtar målgrupp...");
      const promptName = `${TARGET_AUDIENCE_PREFIX}${audienceValue}`;
      const data = await apiRequest<{ content?: string }>(
        "GET",
        `/admin/prompts/${encodeURIComponent(promptName)}`,
      );
      refs.targetAudiencePrompt.value = data?.content || "";
      state.lastTargetAudience = audienceValue;
      setStatus("Målgrupp hämtad.");
    } catch (error) {
      state.lastTargetAudience = "";
      setStatus(
        error instanceof Error ? error.message : "Kunde inte hämta målgrupp.",
      );
    }
  };

  const saveTargetAudiencePrompt = async (): Promise<void> => {
    const audienceValue = refs.targetAudienceSelect.value;
    if (!audienceValue) {
      return;
    }

    const meta = targetAudienceIndex.get(audienceValue);
    const label = meta?.label || audienceValue;
    const nextCategory = refs.targetAudienceCategoryForItemSelect.value;

    try {
      setStatus(`Sparar målgrupp: ${label}...`);
      const promptName = `${TARGET_AUDIENCE_PREFIX}${audienceValue}`;
      await apiRequest(
        "PUT",
        `/admin/prompts/${encodeURIComponent(promptName)}`,
        {
          content: refs.targetAudiencePrompt.value || "",
        },
      );

      const selectedAudience = state.targetAudienceCatalog.audiences.find(
        (audience) => audience.label === audienceValue,
      );
      if (
        selectedAudience &&
        nextCategory &&
        selectedAudience.category !== nextCategory
      ) {
        const nextCatalog = normalizeTargetAudienceOrdering({
          categories: [...state.targetAudienceCatalog.categories],
          audiences: state.targetAudienceCatalog.audiences.map((audience) =>
            audience.label === audienceValue
              ? { ...audience, category: nextCategory }
              : audience,
          ),
        });
        await saveTargetAudienceCatalog(nextCatalog);
        refs.targetAudienceSelect.value = audienceValue;
        refs.easyReadTargetAudienceSelect.value = audienceValue;
        refs.targetAudienceCategoryForItemSelect.value = nextCategory;
        updateTargetAudienceLabels();
      }

      setStatus(`Målgrupp sparad: ${label}`);
      showHint("Sparat.", "success");
      showButtonHint(refs.targetAudienceSaveButton, "Sparat.", "success");
    } catch (error) {
      setStatus(
        error instanceof Error ? error.message : "Kunde inte spara målgrupp.",
      );
      showButtonHint(refs.targetAudienceSaveButton, "Fel.", "error");
    }
  };

  const normalizeTargetAudienceOrdering = (
    catalog: TargetAudienceCatalog,
  ): TargetAudienceCatalog => {
    const sortedCategories = sortTargetAudienceCategories(
      catalog.categories,
    ).map((category, index) => ({
      ...category,
      sortOrder: (index + 1) * 10,
    }));

    const sortedAudiences: TargetAudienceCatalogItem[] = [];
    sortedCategories.forEach((category) => {
      const byCategory = sortTargetAudienceItems(
        catalog.audiences.filter(
          (audience) => audience.category === category.name,
        ),
      ).map((audience, index) => ({
        ...audience,
        sortOrder: (index + 1) * 10,
      }));
      sortedAudiences.push(...byCategory);
    });

    return {
      categories: sortedCategories,
      audiences: sortedAudiences,
    };
  };

  const createTargetAudienceCategory = async (): Promise<void> => {
    const name = refs.targetAudienceCategoryNameInput.value.trim();
    if (!name) {
      setStatus("Kategorinamn krävs.");
      return;
    }
    if (
      state.targetAudienceCatalog.categories.some(
        (category) => category.name === name,
      )
    ) {
      setStatus("Kategorin finns redan.");
      return;
    }

    try {
      const next = normalizeTargetAudienceOrdering({
        categories: [
          ...state.targetAudienceCatalog.categories,
          { name, sortOrder: 9999 },
        ],
        audiences: [...state.targetAudienceCatalog.audiences],
      });
      await saveTargetAudienceCatalog(next);
      refs.targetAudienceCategorySelect.value = name;
      refs.targetAudienceCategoryForItemSelect.value = name;
      setStatus(`Kategori skapad: ${name}`);
      showHint("Kategori skapad.", "success");
      showButtonHint(
        refs.targetAudienceCategoryCreateButton,
        "Skapad.",
        "success",
      );
    } catch (error) {
      setStatus(
        error instanceof Error ? error.message : "Kunde inte skapa kategori.",
      );
      showButtonHint(refs.targetAudienceCategoryCreateButton, "Fel.", "error");
    }
  };

  const renameTargetAudienceCategory = async (): Promise<void> => {
    const selectedName = refs.targetAudienceCategorySelect.value;
    const nextName = refs.targetAudienceCategoryNameInput.value.trim();
    if (!selectedName) {
      setStatus("Välj kategori.");
      return;
    }
    if (!nextName) {
      setStatus("Nytt kategorinamn krävs.");
      return;
    }
    if (
      nextName !== selectedName &&
      state.targetAudienceCatalog.categories.some(
        (category) => category.name === nextName,
      )
    ) {
      setStatus("Det finns redan en kategori med det namnet.");
      return;
    }

    try {
      const next = normalizeTargetAudienceOrdering({
        categories: state.targetAudienceCatalog.categories.map((category) =>
          category.name === selectedName
            ? { ...category, name: nextName }
            : category,
        ),
        audiences: state.targetAudienceCatalog.audiences.map((audience) =>
          audience.category === selectedName
            ? { ...audience, category: nextName }
            : audience,
        ),
      });
      await saveTargetAudienceCatalog(next);
      refs.targetAudienceCategorySelect.value = nextName;
      refs.targetAudienceCategoryForItemSelect.value = nextName;
      updateTargetAudienceLabels();
      setStatus(`Kategori uppdaterad: ${nextName}`);
      showHint("Kategori sparad.", "success");
      showButtonHint(
        refs.targetAudienceCategorySaveButton,
        "Sparat.",
        "success",
      );
    } catch (error) {
      setStatus(
        error instanceof Error ? error.message : "Kunde inte spara kategori.",
      );
      showButtonHint(refs.targetAudienceCategorySaveButton, "Fel.", "error");
    }
  };

  const deleteTargetAudienceCategory = async (): Promise<void> => {
    const selectedName = refs.targetAudienceCategorySelect.value;
    if (!selectedName) {
      setStatus("Välj kategori.");
      return;
    }

    const remainingCategories = state.targetAudienceCatalog.categories.filter(
      (category) => category.name !== selectedName,
    );
    if (remainingCategories.length === 0) {
      setStatus("Det måste finnas minst en kategori.");
      return;
    }

    const fallbackCategoryName = sortTargetAudienceCategories(remainingCategories)[0]
      ?.name;
    if (!fallbackCategoryName) {
      setStatus("Kunde inte välja ersättningskategori.");
      return;
    }

    const confirmed = window.confirm(
      `Ta bort kategorin \"${selectedName}\"? Målgrupper flyttas till ${fallbackCategoryName}.`,
    );
    if (!confirmed) {
      return;
    }

    try {
      const next = normalizeTargetAudienceOrdering({
        categories: remainingCategories,
        audiences: state.targetAudienceCatalog.audiences.map((audience) =>
          audience.category === selectedName
            ? { ...audience, category: fallbackCategoryName }
            : audience,
        ),
      });
      await saveTargetAudienceCatalog(next);
      refs.targetAudienceCategorySelect.value = fallbackCategoryName;
      refs.targetAudienceCategoryForItemSelect.value = fallbackCategoryName;
      updateTargetAudienceLabels();
      setStatus(`Kategori borttagen: ${selectedName}`);
      showHint("Kategori borttagen.", "success");
      showButtonHint(
        refs.targetAudienceCategoryDeleteButton,
        "Borttagen.",
        "success",
      );
    } catch (error) {
      setStatus(
        error instanceof Error ? error.message : "Kunde inte ta bort kategori.",
      );
      showButtonHint(refs.targetAudienceCategoryDeleteButton, "Fel.", "error");
    }
  };

  const moveTargetAudienceCategory = async (
    direction: "up" | "down",
  ): Promise<void> => {
    const selectedName = refs.targetAudienceCategorySelect.value;
    if (!selectedName) {
      return;
    }

    const sorted = sortTargetAudienceCategories(
      state.targetAudienceCatalog.categories,
    );
    const index = sorted.findIndex(
      (category) => category.name === selectedName,
    );
    if (index < 0) {
      return;
    }
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= sorted.length) {
      return;
    }

    const reordered = [...sorted];
    const [moved] = reordered.splice(index, 1);
    if (!moved) {
      return;
    }
    reordered.splice(targetIndex, 0, moved);

    try {
      await saveTargetAudienceCatalog(
        normalizeTargetAudienceOrdering({
          categories: reordered,
          audiences: [...state.targetAudienceCatalog.audiences],
        }),
      );
      refs.targetAudienceCategorySelect.value = selectedName;
      refs.targetAudienceCategoryForItemSelect.value = selectedName;
      showButtonHint(
        direction === "up"
          ? refs.targetAudienceCategoryMoveUpButton
          : refs.targetAudienceCategoryMoveDownButton,
        "Flyttad.",
        "success",
      );
    } catch (error) {
      setStatus(
        error instanceof Error ? error.message : "Kunde inte flytta kategori.",
      );
    }
  };

  const createTargetAudience = async (): Promise<void> => {
    const label = refs.targetAudienceLabelInput.value.trim();
    const category = refs.targetAudienceCategoryForItemSelect.value;
    if (!label) {
      setStatus("Målgruppsnamn krävs.");
      return;
    }
    if (!category) {
      setStatus("Kategori krävs.");
      return;
    }
    if (
      state.targetAudienceCatalog.audiences.some(
        (audience) => audience.label === label,
      )
    ) {
      setStatus("Målgruppen finns redan.");
      return;
    }

    try {
      const existingPrompt = refs.targetAudiencePrompt.value.trim();
      const promptContent =
        existingPrompt.length > 0
          ? existingPrompt
          : `MÅLGRUPP: ${label}\n\nAnpassning:\n- Anpassa språk, ton och detaljnivå till målgruppen.`;
      await apiRequest(
        "PUT",
        `/admin/prompts/${encodeURIComponent(`${TARGET_AUDIENCE_PREFIX}${label}`)}`,
        {
          content: promptContent,
        },
      );

      const next = normalizeTargetAudienceOrdering({
        categories: [...state.targetAudienceCatalog.categories],
        audiences: [
          ...state.targetAudienceCatalog.audiences,
          { label, category, sortOrder: 9999 },
        ],
      });
      await saveTargetAudienceCatalog(next);
      refs.targetAudienceSelect.value = label;
      refs.easyReadTargetAudienceSelect.value = label;
      refs.targetAudienceCategoryForItemSelect.value = category;
      state.lastTargetAudience = "";
      await loadTargetAudiencePrompt();
      setStatus(`Målgrupp skapad: ${label}`);
      showHint("Målgrupp skapad.", "success");
      showButtonHint(refs.targetAudienceCreateButton, "Skapad.", "success");
    } catch (error) {
      setStatus(
        error instanceof Error ? error.message : "Kunde inte skapa målgrupp.",
      );
      showButtonHint(refs.targetAudienceCreateButton, "Fel.", "error");
    }
  };

  const deleteTargetAudience = async (): Promise<void> => {
    const selectedLabel = refs.targetAudienceSelect.value;
    if (!selectedLabel) {
      return;
    }

    const confirmed = window.confirm(
      `Ta bort målgruppen \"${selectedLabel}\" från katalogen?`,
    );
    if (!confirmed) {
      return;
    }

    try {
      const next = normalizeTargetAudienceOrdering({
        categories: [...state.targetAudienceCatalog.categories],
        audiences: state.targetAudienceCatalog.audiences.filter(
          (audience) => audience.label !== selectedLabel,
        ),
      });
      await saveTargetAudienceCatalog(next);
      state.lastTargetAudience = "";
      state.lastEasyToReadTargetAudience = "";

      const firstAudienceLabel =
        sortTargetAudienceItems(state.targetAudienceCatalog.audiences)[0]?.label ??
        "";
      if (firstAudienceLabel) {
        refs.targetAudienceSelect.value = firstAudienceLabel;
        refs.easyReadTargetAudienceSelect.value = firstAudienceLabel;
        await loadTargetAudiencePrompt();
      } else {
        refs.targetAudiencePrompt.value = "";
        refs.easyReadTargetAudiencePrompt.value = "";
        updateTargetAudienceLabels();
        updateEasyToReadTargetAudienceLabels();
      }

      setStatus(`Målgrupp borttagen: ${selectedLabel}`);
      showHint("Målgrupp borttagen.", "success");
      showButtonHint(refs.targetAudienceDeleteButton, "Borttagen.", "success");
    } catch (error) {
      setStatus(
        error instanceof Error ? error.message : "Kunde inte ta bort målgrupp.",
      );
      showButtonHint(refs.targetAudienceDeleteButton, "Fel.", "error");
    }
  };

  const moveTargetAudience = async (
    direction: "up" | "down",
  ): Promise<void> => {
    const selectedLabel = refs.targetAudienceSelect.value;
    if (!selectedLabel) {
      return;
    }

    const selected = state.targetAudienceCatalog.audiences.find(
      (audience) => audience.label === selectedLabel,
    );
    if (!selected) {
      return;
    }

    const sameCategory = sortTargetAudienceItems(
      state.targetAudienceCatalog.audiences.filter(
        (audience) => audience.category === selected.category,
      ),
    );
    const index = sameCategory.findIndex(
      (audience) => audience.label === selectedLabel,
    );
    if (index < 0) {
      return;
    }
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= sameCategory.length) {
      return;
    }

    const reordered = [...sameCategory];
    const [moved] = reordered.splice(index, 1);
    if (!moved) {
      return;
    }
    reordered.splice(targetIndex, 0, moved);

    const untouched = state.targetAudienceCatalog.audiences.filter(
      (audience) => audience.category !== selected.category,
    );

    try {
      await saveTargetAudienceCatalog(
        normalizeTargetAudienceOrdering({
          categories: [...state.targetAudienceCatalog.categories],
          audiences: [...untouched, ...reordered],
        }),
      );
      refs.targetAudienceSelect.value = selectedLabel;
      refs.easyReadTargetAudienceSelect.value = selectedLabel;
      showButtonHint(
        direction === "up"
          ? refs.targetAudienceMoveUpButton
          : refs.targetAudienceMoveDownButton,
        "Flyttad.",
        "success",
      );
    } catch (error) {
      setStatus(
        error instanceof Error ? error.message : "Kunde inte flytta målgrupp.",
      );
    }
  };

  const loadEasyToReadTargetAudiencePrompt = async (): Promise<void> => {
    const audienceValue = refs.easyReadTargetAudienceSelect.value;
    if (!audienceValue) {
      return;
    }

    updateEasyToReadTargetAudienceLabels();
    if (state.lastEasyToReadTargetAudience === audienceValue) {
      return;
    }

    try {
      const promptName = `${TARGET_AUDIENCE_PREFIX}${audienceValue}`;
      const content = await readPromptContent(promptName);
      refs.easyReadTargetAudiencePrompt.value = content;
      state.lastEasyToReadTargetAudience = audienceValue;
    } catch (error) {
      state.lastEasyToReadTargetAudience = "";
      setStatus(
        error instanceof Error
          ? error.message
          : "Kunde inte hämta lättläst målgruppsprompt.",
      );
    }
  };

  const saveEasyToReadTargetAudiencePrompt = async (): Promise<void> => {
    const audienceValue = refs.easyReadTargetAudienceSelect.value;
    if (!audienceValue) {
      return;
    }

    const meta = targetAudienceIndex.get(audienceValue);
    const label = meta?.label || audienceValue;
    try {
      setStatus(`Sparar lättläst målgrupp: ${label}...`);
      const promptName = `${TARGET_AUDIENCE_PREFIX}${audienceValue}`;
      await apiRequest(
        "PUT",
        `/admin/prompts/${encodeURIComponent(promptName)}`,
        {
          content: refs.easyReadTargetAudiencePrompt.value || "",
        },
      );
      state.lastEasyToReadTargetAudience = "";
      await loadEasyToReadTargetAudiencePrompt();
      setStatus(`Lättläst målgrupp sparad: ${label}`);
      showHint("Sparat.", "success");
      showButtonHint(
        refs.easyReadTargetAudienceSaveButton,
        "Sparat.",
        "success",
      );
    } catch (error) {
      setStatus(
        error instanceof Error
          ? error.message
          : "Kunde inte spara lättläst målgrupp.",
      );
      showButtonHint(refs.easyReadTargetAudienceSaveButton, "Fel.", "error");
    }
  };

  const saveEasyToReadPrompt = async (
    promptName: string,
    field: HTMLTextAreaElement,
    button?: HTMLButtonElement,
  ): Promise<void> => {
    const content = field.value.trim();
    if (!content) {
      setStatus("Prompten kan inte vara tom.");
      showButtonHint(button ?? null, "Fel.", "error");
      return;
    }

    try {
      setStatus(`Sparar lättläst-prompt: ${promptName}...`);
      await apiRequest(
        "PUT",
        `/admin/prompts/${encodeURIComponent(promptName)}`,
        {
          content: field.value || "",
        },
      );
      setStatus(`Lättläst-prompt sparad: ${promptName}`);
      showHint("Sparat.", "success");
      showButtonHint(button ?? null, "Sparat.", "success");
    } catch (error) {
      setStatus(
        error instanceof Error ? error.message : "Kunde inte spara prompt.",
      );
      showButtonHint(button ?? null, "Fel.", "error");
    }
  };

  const loadEasyToReadPanel = async (): Promise<void> => {
    try {
      setStatus("Hämtar lättläst-inställningar...");
      syncEasyToReadTaskControls();
      await loadEasyToReadPrompts();
      state.lastEasyToReadTargetAudience = "";
      await loadEasyToReadTargetAudiencePrompt();
      setStatus("Lättläst-inställningar hämtade.");
    } catch (error) {
      setStatus(
        error instanceof Error
          ? error.message
          : "Kunde inte hämta lättläst-inställningar.",
      );
    }
  };

  const saveEasyToReadSettings = async (): Promise<void> => {
    const easyTask = getEasyToReadTaskDefinition();
    if (!easyTask) {
      setStatus("Kunde inte hitta en lättläst-uppgift i task-katalogen.");
      showButtonHint(refs.saveEasyReadSettingsButton, "Fel.", "error");
      return;
    }

    try {
      setStatus("Sparar lättläst-inställningar...");
      await updateTaskDefinition(easyTask.key, {
        enabled: refs.easyReadTaskEnabled.checked,
      });

      const nextRuntimeSettings = cloneRuntimeSettings(state.runtimeSettings);
      const easyToReadWorkflow = getRuntimeObject(
        nextRuntimeSettings,
        "easyToReadWorkflow",
      );
      easyToReadWorkflow.enabled = refs.easyReadWorkflowEnabled.checked;
      easyToReadWorkflow.useRewriteDraft =
        refs.easyReadWorkflowUseRewriteDraft.checked;

      const runtimeData = await apiRequest<{
        runtimeSettings?: RuntimeSettings;
      }>("PUT", "/admin/runtime-settings", {
        runtimeSettings: nextRuntimeSettings,
      });

      setRuntimeSettingsEditor(
        runtimeData?.runtimeSettings ?? nextRuntimeSettings,
      );
      await loadTaskCatalog(easyTask.key);
      syncEasyToReadTaskControls();
      setStatus("Lättläst-inställningar sparade.");
      showHint("Sparat.", "success");
      showButtonHint(refs.saveEasyReadSettingsButton, "Sparat.", "success");
    } catch (error) {
      setStatus(
        error instanceof Error
          ? error.message
          : "Kunde inte spara lättläst-inställningar.",
      );
      showButtonHint(refs.saveEasyReadSettingsButton, "Fel.", "error");
    }
  };

  const taskPromptIndex = new Map<
    string,
    { label: string; promptName: string }
  >();

  const listTaskDefinitions = async (): Promise<TaskDefinition[]> =>
    apiRequest<TaskDefinition[]>("GET", "/admin/tasks");

  const createTaskDefinition = async (
    payload: Record<string, unknown>,
  ): Promise<TaskDefinition> =>
    apiRequest<TaskDefinition>("POST", "/admin/tasks", payload);

  const updateTaskDefinition = async (
    taskKey: string,
    payload: Record<string, unknown>,
  ): Promise<TaskDefinition> =>
    apiRequest<TaskDefinition>(
      "PUT",
      `/admin/tasks/${encodeURIComponent(taskKey)}`,
      payload,
    );

  const removeTaskDefinition = async (taskKey: string): Promise<void> => {
    await apiRequest("DELETE", `/admin/tasks/${encodeURIComponent(taskKey)}`);
  };

  const reorderTaskDefinitions = async (
    taskKeys: string[],
  ): Promise<TaskDefinition[]> =>
    apiRequest<TaskDefinition[]>("PUT", "/admin/tasks/reorder", {
      taskKeys,
    });

  const getSortedTaskDefinitions = (): TaskDefinition[] =>
    [...state.taskDefinitions].sort((a, b) => a.sortOrder - b.sortOrder);

  const getSelectedTaskDefinition = (): TaskDefinition | undefined => {
    const key = refs.taskPromptSelect.value;
    return state.taskDefinitions.find((task) => task.key === key);
  };

  const updateTaskPromptLabel = (): void => {
    const key = refs.taskPromptSelect.value;
    const meta = taskPromptIndex.get(key);
    if (meta) {
      refs.taskPromptLabel.textContent = `Prompt för ${meta.label}`;
    } else {
      refs.taskPromptLabel.textContent = "Prompt för vald uppgift";
    }
  };

  const syncTaskRewritePlanEnabled = (): void => {
    const key = refs.taskPromptSelect.value;
    const selectedTask = getSelectedTaskDefinition();
    const fallback = selectedTask?.rewritePlanEnabled ?? true;
    refs.taskDefRewritePlanEnabled.checked =
      state.rewritePlanTasks[key] ?? fallback;
  };

  const syncTaskDefinitionForm = (): void => {
    const task = getSelectedTaskDefinition();
    if (!task) {
      refs.taskDefLabel.value = "";
      refs.taskDefDescription.value = "";
      refs.taskDefEnabled.checked = true;
      refs.taskDefTargetAudienceEnabled.checked = true;
      refs.taskDefRewritePlanEnabled.checked = true;
      refs.taskDefDeleteButton.disabled = true;
      refs.taskDefMoveUpButton.disabled = true;
      refs.taskDefMoveDownButton.disabled = true;
      return;
    }

    refs.taskDefLabel.value = task.label;
    refs.taskDefDescription.value = task.description || "";
    refs.taskDefEnabled.checked = Boolean(task.enabled);
    refs.taskDefTargetAudienceEnabled.checked =
      task.targetAudienceEnabled !== false;
    refs.taskDefRewritePlanEnabled.checked = task.rewritePlanEnabled !== false;
    refs.taskDefDeleteButton.disabled = false;

    const sorted = getSortedTaskDefinitions();
    const index = sorted.findIndex((entry) => entry.key === task.key);
    refs.taskDefMoveUpButton.disabled = index <= 0;
    refs.taskDefMoveDownButton.disabled =
      index < 0 || index >= sorted.length - 1;
  };

  const initTaskPromptSelect = (preferredKey?: string): void => {
    refs.taskPromptSelect.innerHTML = "";
    taskPromptIndex.clear();

    const sorted = getSortedTaskDefinitions();
    if (sorted.length === 0) {
      const emptyOption = document.createElement("option");
      emptyOption.value = "";
      emptyOption.textContent = "Inga uppgifter tillgängliga";
      refs.taskPromptSelect.appendChild(emptyOption);
      refs.taskPromptSelect.value = "";
      refs.taskPromptContent.value = "";
      refs.taskPromptSaveButton.disabled = true;
      syncTaskDefinitionForm();
      return;
    }

    sorted.forEach((task) => {
      const option = document.createElement("option");
      option.value = task.key;
      option.textContent = task.label;
      refs.taskPromptSelect.appendChild(option);
      taskPromptIndex.set(task.key, {
        label: task.label,
        promptName: `${TASK_PROMPT_PREFIX}${task.key}`,
      });
    });

    const selectedKey =
      preferredKey && sorted.some((task) => task.key === preferredKey)
        ? preferredKey
        : sorted[0]?.key;
    refs.taskPromptSelect.value = selectedKey || "";
    refs.taskPromptSaveButton.disabled = false;
    updateTaskPromptLabel();
    syncTaskRewritePlanEnabled();
    syncTaskDefinitionForm();
  };

  const loadTaskCatalog = async (preferredKey?: string): Promise<void> => {
    const currentKey = preferredKey || refs.taskPromptSelect.value;
    try {
      const tasks = await listTaskDefinitions();
      state.taskDefinitions = Array.isArray(tasks) ? tasks : [];
      initTaskPromptSelect(currentKey);
      if (state.taskDefinitions.length > 0) {
        state.lastTaskPrompt = "";
        await loadTaskPrompt();
      }
      syncEasyToReadTaskControls();
    } catch (error) {
      state.taskDefinitions = [];
      initTaskPromptSelect();
      syncEasyToReadTaskControls();
      throw error;
    }
  };

  const loadTaskPrompt = async (): Promise<void> => {
    const key = refs.taskPromptSelect.value;
    if (!key) {
      return;
    }

    const meta = taskPromptIndex.get(key);
    const promptName = meta?.promptName ?? `${TASK_PROMPT_PREFIX}${key}`;
    updateTaskPromptLabel();
    if (state.lastTaskPrompt === promptName) {
      return;
    }

    try {
      setStatus("Hämtar uppgift...");
      const data = await apiRequest<{ content?: string }>(
        "GET",
        `/admin/prompts/${encodeURIComponent(promptName)}`,
      );
      refs.taskPromptContent.value = data?.content || "";
      state.lastTaskPrompt = promptName;
      setStatus("Uppgift hämtad.");
    } catch (error) {
      state.lastTaskPrompt = "";
      setStatus(
        error instanceof Error ? error.message : "Kunde inte hämta uppgift.",
      );
    }
  };

  const saveTaskPrompt = async (): Promise<void> => {
    const key = refs.taskPromptSelect.value;
    if (!key) {
      return;
    }
    const selected = getSelectedTaskDefinition();
    if (!selected) {
      setStatus("Välj en uppgift att spara.");
      return;
    }

    const meta = taskPromptIndex.get(key);
    const promptName = meta?.promptName ?? `${TASK_PROMPT_PREFIX}${key}`;
    const label = meta?.label || selected.label || key;
    const content = refs.taskPromptContent.value.trim();
    const rewritePlanEnabled = refs.taskDefRewritePlanEnabled.checked;
    if (!content) {
      setStatus("Prompten kan inte vara tom.");
      showButtonHint(refs.taskPromptSaveButton, "Fel.", "error");
      return;
    }

    try {
      setStatus(`Sparar uppgift: ${label}...`);

      const metadataPayload = getTaskDefinitionPayload();
      await updateTaskDefinition(selected.key, metadataPayload);

      const data = await apiRequest<TaskPromptSaveResponse>(
        "PUT",
        `/admin/task-prompts/${encodeURIComponent(key)}`,
        {
          content,
          rewritePlanEnabled,
        },
      );

      state.rewritePlanTasks = resolveRewritePlanTasks(data?.rewritePlanTasks);
      refs.taskPromptContent.value = data?.prompt?.content || content;
      state.lastTaskPrompt = "";
      await loadTaskCatalog(selected.key);
      syncTaskRewritePlanEnabled();
      setStatus(`Uppgift sparad: ${label}`);
      showHint("Sparat.", "success");
      showButtonHint(refs.taskPromptSaveButton, "Sparat.", "success");
      state.lastTaskPrompt = promptName;
    } catch (error) {
      setStatus(
        error instanceof Error ? error.message : "Kunde inte spara uppgift.",
      );
      showButtonHint(refs.taskPromptSaveButton, "Fel.", "error");
      syncTaskRewritePlanEnabled();
    }
  };

  const getTaskDefinitionPayload = (): Record<string, unknown> => {
    const label = refs.taskDefLabel.value.trim();
    const description = refs.taskDefDescription.value.trim();

    if (!label) {
      throw new Error("Task label saknas.");
    }

    const payload: Record<string, unknown> = {
      label,
      description: description || null,
      enabled: refs.taskDefEnabled.checked,
      targetAudienceEnabled: refs.taskDefTargetAudienceEnabled.checked,
      rewritePlanEnabled: refs.taskDefRewritePlanEnabled.checked,
    };

    return payload;
  };

  const createTask = async (): Promise<void> => {
    try {
      const payload: Record<string, unknown> = {
        label: "Ny uppgift",
        description: null,
        enabled: true,
        targetAudienceEnabled: true,
        rewritePlanEnabled: true,
        promptContent: "",
      };
      const label = String(payload.label || "Ny uppgift");
      setStatus(`Skapar uppgift: ${label}...`);
      const created = await createTaskDefinition(payload);
      await loadTaskCatalog(created.key);
      setStatus(`Uppgift skapad: ${created.label}`);
      showHint("Uppgift skapad.", "success");
      showButtonHint(refs.taskDefCreateButton, "Skapad.", "success");
    } catch (error) {
      setStatus(
        error instanceof Error ? error.message : "Kunde inte skapa uppgift.",
      );
      showButtonHint(refs.taskDefCreateButton, "Fel.", "error");
    }
  };

  const deleteTask = async (): Promise<void> => {
    const selected = getSelectedTaskDefinition();
    if (!selected) {
      setStatus("Välj en uppgift att ta bort.");
      return;
    }

    const confirmed = window.confirm(
      `Vill du ta bort uppgiften \"${selected.label}\"?`,
    );
    if (!confirmed) {
      return;
    }

    try {
      setStatus(`Tar bort uppgift: ${selected.label}...`);
      await removeTaskDefinition(selected.key);
      await loadTaskCatalog();
      setStatus(`Uppgift borttagen: ${selected.label}`);
      showHint("Uppgift borttagen.", "success");
      showButtonHint(refs.taskDefDeleteButton, "Borttagen.", "success");
    } catch (error) {
      setStatus(
        error instanceof Error ? error.message : "Kunde inte ta bort uppgift.",
      );
      showButtonHint(refs.taskDefDeleteButton, "Fel.", "error");
    }
  };

  const moveTask = async (direction: "up" | "down"): Promise<void> => {
    const selected = getSelectedTaskDefinition();
    if (!selected) {
      setStatus("Välj en uppgift att flytta.");
      return;
    }

    const sorted = getSortedTaskDefinitions();
    const index = sorted.findIndex((task) => task.key === selected.key);
    if (index < 0) {
      return;
    }
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= sorted.length) {
      return;
    }

    const reordered = [...sorted];
    const temp = reordered[index];
    reordered[index] = reordered[targetIndex] as TaskDefinition;
    reordered[targetIndex] = temp as TaskDefinition;

    try {
      setStatus("Uppdaterar ordning på uppgifter...");
      const updated = await reorderTaskDefinitions(
        reordered.map((task) => task.key),
      );
      state.taskDefinitions = Array.isArray(updated)
        ? updated
        : state.taskDefinitions;
      initTaskPromptSelect(selected.key);
      syncTaskRewritePlanEnabled();
      syncTaskDefinitionForm();
      setStatus("Ordning uppdaterad.");
      showHint("Ordning uppdaterad.", "success");
      showButtonHint(
        direction === "up"
          ? refs.taskDefMoveUpButton
          : refs.taskDefMoveDownButton,
        "Flyttad.",
        "success",
      );
    } catch (error) {
      setStatus(
        error instanceof Error
          ? error.message
          : "Kunde inte uppdatera ordning.",
      );
      showButtonHint(
        direction === "up"
          ? refs.taskDefMoveUpButton
          : refs.taskDefMoveDownButton,
        "Fel.",
        "error",
      );
    }
  };

  const saveGlobalConfig = async (): Promise<void> => {
    let globalSaved = false;
    try {
      setStatus("Sparar global konfiguration...");
      const provider = refs.globalProvider.value;
      const retryRaw = refs.globalRetry.value.trim();
      const retryCount = Number.parseInt(retryRaw, 10);
      if (!Number.isInteger(retryCount) || retryCount < 1 || retryCount > 10) {
        setStatus("Antal retries måste vara mellan 1 och 10.");
        showButtonHint(refs.saveGlobalButton, "Fel.", "error");
        return;
      }

      const qualityAttemptsRaw = refs.globalQualityAttempts.value.trim();
      const qualityMaxAttempts = Number.parseInt(qualityAttemptsRaw, 10);
      if (
        !Number.isInteger(qualityMaxAttempts) ||
        qualityMaxAttempts < 1 ||
        qualityMaxAttempts > 10
      ) {
        setStatus("Kvalitetsvarv måste vara mellan 1 och 10.");
        showButtonHint(refs.saveGlobalButton, "Fel.", "error");
        return;
      }

      const repairBudgetRaw = refs.globalRepairBudget.value.trim();
      const repairBudget = Number.parseInt(repairBudgetRaw, 10);
      if (
        !Number.isInteger(repairBudget) ||
        repairBudget < 1 ||
        repairBudget > 10
      ) {
        setStatus("Polering per varv måste vara mellan 1 och 10.");
        showButtonHint(refs.saveGlobalButton, "Fel.", "error");
        return;
      }

      const data = await apiRequest<GlobalConfig>(
        "PUT",
        "/admin/config/global",
        {
          provider,
          retryCount,
        },
      );
      globalSaved = true;

      const nextRuntimeSettings = cloneRuntimeSettings(state.runtimeSettings);
      const retry = getRuntimeObject(nextRuntimeSettings, "retry");
      retry.qualityMaxAttempts = qualityMaxAttempts;
      const repair = getRuntimeObject(nextRuntimeSettings, "repair");
      repair.budget = repairBudget;

      const runtimeData = await apiRequest<{
        runtimeSettings?: RuntimeSettings;
      }>("PUT", "/admin/runtime-settings", {
        runtimeSettings: nextRuntimeSettings,
      });

      const savedRetry = data?.retryCount ?? retryCount;
      refs.globalRetry.value = String(savedRetry);
      setRetryCurrentLabel(savedRetry);
      setRetrySelectedLabel(savedRetry);
      refs.globalQualityAttempts.value = String(qualityMaxAttempts);
      setGlobalQualityAttemptsCurrentLabel(qualityMaxAttempts);
      setGlobalQualityAttemptsSelectedLabel(qualityMaxAttempts);
      refs.globalRepairBudget.value = String(repairBudget);
      setGlobalRepairBudgetCurrentLabel(repairBudget);
      setGlobalRepairBudgetSelectedLabel(repairBudget);
      setRuntimeSettingsEditor(
        runtimeData?.runtimeSettings ?? nextRuntimeSettings,
      );
      setStatus("Global konfiguration sparad.");
      showHint("Sparat.", "success");
      showButtonHint(refs.saveGlobalButton, "Sparat.", "success");
    } catch (error) {
      if (globalSaved) {
        setStatus(
          "Global konfiguration sparades, men runtime-inställningar för försök kunde inte sparas.",
        );
        showButtonHint(refs.saveGlobalButton, "Delvis sparat.", "error");
        return;
      }
      setStatus(
        error instanceof Error
          ? error.message
          : "Kunde inte spara global konfiguration.",
      );
      showButtonHint(refs.saveGlobalButton, "Fel.", "error");
    }
  };

  const saveRuntimeSettingsFields = async (): Promise<void> => {
    try {
      setStatus("Sparar nyckelinställningar...");

      const runtimeSettings = buildRuntimeSettingsFromFields();
      const data = await apiRequest<{ runtimeSettings?: RuntimeSettings }>(
        "PUT",
        "/admin/runtime-settings",
        { runtimeSettings },
      );

      setRuntimeSettingsEditor(data?.runtimeSettings ?? runtimeSettings);
      setStatus("Nyckelinställningar sparade.");
      showHint("Sparat.", "success");
      showButtonHint(
        refs.saveRuntimeSettingsFieldsButton,
        "Sparat.",
        "success",
      );
    } catch (error) {
      setStatus(
        error instanceof Error
          ? error.message
          : "Kunde inte spara nyckelinställningar.",
      );
      showButtonHint(refs.saveRuntimeSettingsFieldsButton, "Fel.", "error");
    }
  };

  const saveRuntimeSettings = async (): Promise<void> => {
    try {
      setStatus("Sparar runtime-inställningar...");

      const raw = refs.runtimeSettingsJson.value.trim();
      const parsed: unknown = raw.length === 0 ? {} : JSON.parse(raw);
      const runtimeSettings = resolveRuntimeSettings(parsed);

      if (Array.isArray(parsed) || typeof parsed !== "object" || !parsed) {
        setStatus("Runtime-inställningar måste vara ett JSON-objekt.");
        showButtonHint(refs.saveRuntimeSettingsButton, "Fel.", "error");
        return;
      }

      const data = await apiRequest<{ runtimeSettings?: RuntimeSettings }>(
        "PUT",
        "/admin/runtime-settings",
        { runtimeSettings },
      );

      setRuntimeSettingsEditor(data?.runtimeSettings ?? runtimeSettings);
      setStatus("Runtime-inställningar sparade.");
      showHint("Sparat.", "success");
      showButtonHint(refs.saveRuntimeSettingsButton, "Sparat.", "success");
    } catch (error) {
      setStatus(
        error instanceof Error
          ? error.message
          : "Kunde inte spara runtime-inställningar.",
      );
      showButtonHint(refs.saveRuntimeSettingsButton, "Fel.", "error");
    }
  };

  const saveGeminiConfig = async (): Promise<void> => {
    let providerSaved = false;
    try {
      setStatus("Sparar Gemini-konfiguration...");
      const model = refs.geminiModel.value.trim();
      const temperatureRaw = refs.geminiTemp.value.trim();
      const qualityTemperatureRaw = refs.geminiQeTemp.value.trim();
      const maxOutputTokensRaw = refs.geminiMax.value.trim();
      const useWebSearch = refs.geminiUseSearch.checked;
      const useThinking = refs.geminiUseThinking.checked;

      if (!model) {
        setStatus("Fyll i modellnamn.");
        showButtonHint(refs.saveGeminiButton, "Fel.", "error");
        return;
      }

      if (!temperatureRaw) {
        setStatus("Fyll i temperature.");
        showButtonHint(refs.saveGeminiButton, "Fel.", "error");
        return;
      }

      const temperature = Number(temperatureRaw);
      if (!Number.isFinite(temperature) || temperature < 0 || temperature > 1) {
        setStatus("Temperature måste vara mellan 0 och 1.");
        showButtonHint(refs.saveGeminiButton, "Fel.", "error");
        return;
      }

      if (!qualityTemperatureRaw) {
        setStatus("Fyll i QE temperature.");
        showButtonHint(refs.saveGeminiButton, "Fel.", "error");
        return;
      }

      const qualityTemperature = Number(qualityTemperatureRaw);
      if (
        !Number.isFinite(qualityTemperature) ||
        qualityTemperature < 0 ||
        qualityTemperature > 1
      ) {
        setStatus("QE temperature måste vara mellan 0 och 1.");
        showButtonHint(refs.saveGeminiButton, "Fel.", "error");
        return;
      }

      if (!maxOutputTokensRaw) {
        setStatus("Fyll i max output tokens.");
        showButtonHint(refs.saveGeminiButton, "Fel.", "error");
        return;
      }

      const maxOutputTokens = Number.parseInt(maxOutputTokensRaw, 10);
      if (!Number.isInteger(maxOutputTokens) || maxOutputTokens <= 0) {
        setStatus("Max output tokens måste vara ett heltal över 0.");
        showButtonHint(refs.saveGeminiButton, "Fel.", "error");
        return;
      }
      const data = await apiRequest<GeminiConfig>(
        "PUT",
        "/admin/providers/gemini",
        {
          model,
          temperature,
          maxOutputTokens,
          useWebSearch,
          useThinking,
        },
      );
      providerSaved = true;

      const nextRuntimeSettings = cloneRuntimeSettings(state.runtimeSettings);
      const qualitySettings = getRuntimeObject(nextRuntimeSettings, "quality");
      qualitySettings.temperature = qualityTemperature;
      const runtimeData = await apiRequest<{
        runtimeSettings?: RuntimeSettings;
      }>("PUT", "/admin/runtime-settings", {
        runtimeSettings: nextRuntimeSettings,
      });
      setRuntimeSettingsEditor(
        runtimeData?.runtimeSettings ?? nextRuntimeSettings,
      );

      if (data?.temperature !== undefined) {
        setGeminiTemperature(data.temperature);
        setGeminiTemperatureSelected(data.temperature);
      }
      if (data?.maxOutputTokens !== undefined) {
        refs.geminiMax.value = String(data.maxOutputTokens);
      }
      if (data?.model) {
        refs.geminiModel.value = data.model;
      }
      if (typeof data?.useWebSearch === "boolean") {
        refs.geminiUseSearch.checked = data.useWebSearch;
      }
      if (typeof data?.useThinking === "boolean") {
        refs.geminiUseThinking.checked = data.useThinking;
      }
      setStatus("Gemini-konfiguration sparad.");
      showHint("Sparat.", "success");
      showButtonHint(refs.saveGeminiButton, "Sparat.", "success");
    } catch (error) {
      if (providerSaved) {
        setStatus(
          error instanceof Error
            ? `Gemini sparades, men QE temperature misslyckades: ${error.message}`
            : "Gemini sparades, men QE temperature kunde inte sparas.",
        );
      } else {
        setStatus(
          error instanceof Error
            ? error.message
            : "Kunde inte spara Gemini-konfiguration.",
        );
      }
      showButtonHint(refs.saveGeminiButton, "Fel.", "error");
    }
  };

  const saveSecret = async (
    secretName: string,
    inputId: string,
    button?: HTMLButtonElement,
  ): Promise<void> => {
    const input = getRequiredElement<HTMLInputElement>(inputId);
    if (!input) {
      return;
    }
    const value = input.value;
    if (!value) {
      setStatus("Ingen nyckel angiven.");
      showButtonHint(button ?? null, "Fel.", "error");
      return;
    }
    try {
      setStatus(`Sparar ${secretName}...`);
      await apiRequest("PUT", `/admin/secrets/${secretName}`, { value });
      input.value = "";
      setStatus(`${secretName} sparad.`);
      showHint("Nyckel sparad.", "success");
      showButtonHint(button ?? null, "Sparat.", "success");
    } catch (error) {
      setStatus(
        error instanceof Error ? error.message : "Kunde inte spara nyckel.",
      );
      showButtonHint(button ?? null, "Fel.", "error");
    }
  };

  const listOrdlistaEntries = async (): Promise<OrdlistaEntry[]> =>
    apiRequest<OrdlistaEntry[]>("GET", "/admin/ordlista");

  const createOrdlistaEntry = async (
    fromWord: string,
    toWord: string,
  ): Promise<OrdlistaEntry> =>
    apiRequest<OrdlistaEntry>("POST", "/admin/ordlista", { fromWord, toWord });

  const deleteOrdlistaEntry = async (id: number): Promise<void> => {
    await apiRequest("DELETE", `/admin/ordlista/${id}`);
  };

  const clearOrdlistaEntries = async (): Promise<number> => {
    const result = await apiRequest<{ deletedCount?: number }>(
      "DELETE",
      "/admin/ordlista",
    );
    return typeof result?.deletedCount === "number" ? result.deletedCount : 0;
  };

  const renderOrdlista = (entries: OrdlistaEntry[]): void => {
    refs.ordlistaList.innerHTML = "";
    const sorted = [...(entries || [])].sort((a, b) =>
      a.fromWord.localeCompare(b.fromWord, "sv"),
    );

    if (sorted.length === 0) {
      refs.ordlistaEmpty.hidden = false;
      return;
    }

    refs.ordlistaEmpty.hidden = true;
    sorted.forEach((entry) => {
      const row = document.createElement("div");
      row.className = "flex flex-row flex-wrap gap-2 word-list-row";

      const from = document.createElement("span");
      from.className = "text-base flex-even flex-align-content-center";
      from.textContent = entry.fromWord;

      const to = document.createElement("span");
      to.className = "text-base flex-even flex-align-content-center";
      to.textContent = entry.toWord;

      const actions = document.createElement("div");
      actions.className = "flex flex-row flex-even gap-2";

      const remove = document.createElement("button");
      remove.className =
        "flex flex-row flex-justify-content-center flex-align-items-center text-base filled-white outline-blue large-button";
      remove.textContent = "Ta bort";
      remove.addEventListener("click", async () => {
        try {
          setStatus("Tar bort ord...");
          await deleteOrdlistaEntry(entry.id);
          row.remove();
          if (refs.ordlistaList.children.length === 0) {
            refs.ordlistaEmpty.hidden = false;
          }
          setStatus("Ord borttaget.");
          showHint("Borttaget.", "success");
          await loadOrdlista();
        } catch (error) {
          setStatus(
            error instanceof Error ? error.message : "Kunde inte ta bort ord.",
          );
        }
      });

      actions.appendChild(remove);
      row.appendChild(from);
      row.appendChild(to);
      row.appendChild(actions);
      refs.ordlistaList.appendChild(row);
    });
  };

  const loadOrdlista = async (): Promise<void> => {
    try {
      setStatus("Hämtar ordlista...");
      const entries = await listOrdlistaEntries();
      renderOrdlista(entries || []);
      setStatus("Ordlista hämtad.");
    } catch (error) {
      setStatus(
        error instanceof Error ? error.message : "Kunde inte hämta ordlista.",
      );
    }
  };

  const saveOrdlista = async (): Promise<void> => {
    const fromWord = refs.ordlistaFrom.value.trim();
    const toWord = refs.ordlistaTo.value.trim();
    if (!fromWord || !toWord) {
      setStatus("Fyll i båda fälten.");
      showButtonHint(refs.ordlistaSaveButton, "Fel.", "error");
      return;
    }

    try {
      setStatus("Sparar ord...");
      await createOrdlistaEntry(fromWord, toWord);
      refs.ordlistaFrom.value = "";
      refs.ordlistaTo.value = "";
      showHint("Sparat.", "success");
      showButtonHint(refs.ordlistaSaveButton, "Sparat.", "success");
      await loadOrdlista();
    } catch (error) {
      setStatus(
        error instanceof Error ? error.message : "Kunde inte spara ord.",
      );
      showButtonHint(refs.ordlistaSaveButton, "Fel.", "error");
    }
  };

  const clearOrdlista = async (): Promise<void> => {
    const confirmed = window.confirm(
      "Vill du rensa hela ordlistan? Detta kan inte ångras.",
    );
    if (!confirmed) {
      return;
    }
    try {
      setStatus("Rensar ordlista...");
      await clearOrdlistaEntries();
      setStatus("Ordlista rensad.");
      showHint("Rensad.", "success");
      showButtonHint(refs.ordlistaClearButton, "Rensad.", "success");
      await loadOrdlista();
    } catch (error) {
      setStatus(
        error instanceof Error ? error.message : "Kunde inte rensa ordlista.",
      );
      showButtonHint(refs.ordlistaClearButton, "Fel.", "error");
    }
  };

  const loadToken = (): void => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      refs.tokenInput.value = stored;
    }
  };

  const setActiveView = (viewName: string): void => {
    refs.views.forEach((view) => {
      const isActive = view.getAttribute("data-view") === viewName;
      if (isActive) {
        view.removeAttribute("hidden");
      } else {
        view.setAttribute("hidden", "");
      }
    });

    refs.viewInputs.forEach((input) => {
      input.checked = input.dataset.viewTarget === viewName;
    });

    if (viewName === "target-audiences") {
      loadTargetAudiencePrompt();
    }
    if (viewName === "easy-to-read") {
      loadEasyToReadPanel();
    }
    if (viewName === "ordlista") {
      loadOrdlista();
    }
  };

  refs.checkButton.addEventListener("click", () => {
    loadConfig();
  });

  refs.saveGlobalButton.addEventListener("click", () => {
    saveGlobalConfig();
  });

  refs.saveRuntimeSettingsFieldsButton.addEventListener("click", () => {
    saveRuntimeSettingsFields();
  });

  refs.saveRuntimeSettingsButton.addEventListener("click", () => {
    saveRuntimeSettings();
  });

  refs.saveGeminiButton.addEventListener("click", () => {
    saveGeminiConfig();
  });

  refs.geminiTemp.addEventListener("input", () => {
    setGeminiTemperatureSelected(refs.geminiTemp.value);
  });

  refs.geminiQeTemp.addEventListener("input", () => {
    setGeminiQeTemperatureSelected(refs.geminiQeTemp.value);
  });

  refs.globalRetry.addEventListener("input", () => {
    setRetrySelectedLabel(refs.globalRetry.value);
  });

  refs.globalQualityAttempts.addEventListener("input", () => {
    setGlobalQualityAttemptsSelectedLabel(refs.globalQualityAttempts.value);
  });

  refs.globalRepairBudget.addEventListener("input", () => {
    setGlobalRepairBudgetSelectedLabel(refs.globalRepairBudget.value);
  });

  refs.runtimeRepairMinSubscore.addEventListener("input", () => {
    setRuntimeRepairMinSubscoreSelected(refs.runtimeRepairMinSubscore.value);
  });

  refs.runtimeUploadMaxSizeMb.addEventListener("input", () => {
    setRuntimeUploadMaxSizeSelected(refs.runtimeUploadMaxSizeMb.value);
  });

  refs.taskPromptSelect.addEventListener("change", () => {
    state.lastTaskPrompt = "";
    syncTaskRewritePlanEnabled();
    syncTaskDefinitionForm();
    loadTaskPrompt();
  });

  refs.taskDefCreateButton.addEventListener("click", () => {
    createTask();
  });

  refs.taskDefDeleteButton.addEventListener("click", () => {
    deleteTask();
  });

  refs.taskDefMoveUpButton.addEventListener("click", () => {
    moveTask("up");
  });

  refs.taskDefMoveDownButton.addEventListener("click", () => {
    moveTask("down");
  });

  refs.taskPromptSaveButton.addEventListener("click", () => {
    saveTaskPrompt();
  });

  refs.saveEasyReadSettingsButton.addEventListener("click", () => {
    saveEasyToReadSettings();
  });

  refs.easyReadTargetAudienceSelect.addEventListener("change", () => {
    state.lastEasyToReadTargetAudience = "";
    loadEasyToReadTargetAudiencePrompt();
  });

  refs.easyReadTargetAudienceSaveButton.addEventListener("click", () => {
    saveEasyToReadTargetAudiencePrompt();
  });

  refs.targetAudienceSelect.addEventListener("change", () => {
    state.lastTargetAudience = "";
    loadTargetAudiencePrompt();
  });

  refs.targetAudienceSaveButton.addEventListener("click", () => {
    saveTargetAudiencePrompt();
  });

  refs.targetAudienceCategorySelect.addEventListener("change", () => {
    refs.targetAudienceCategoryNameInput.value =
      refs.targetAudienceCategorySelect.value;
  });

  refs.targetAudienceCategoryCreateButton.addEventListener("click", () => {
    createTargetAudienceCategory();
  });

  refs.targetAudienceCategorySaveButton.addEventListener("click", () => {
    renameTargetAudienceCategory();
  });

  refs.targetAudienceCategoryDeleteButton.addEventListener("click", () => {
    deleteTargetAudienceCategory();
  });

  refs.targetAudienceCategoryMoveUpButton.addEventListener("click", () => {
    moveTargetAudienceCategory("up");
  });

  refs.targetAudienceCategoryMoveDownButton.addEventListener("click", () => {
    moveTargetAudienceCategory("down");
  });

  refs.targetAudienceCreateButton.addEventListener("click", () => {
    createTargetAudience();
  });

  refs.targetAudienceDeleteButton.addEventListener("click", () => {
    deleteTargetAudience();
  });

  refs.targetAudienceMoveUpButton.addEventListener("click", () => {
    moveTargetAudience("up");
  });

  refs.targetAudienceMoveDownButton.addEventListener("click", () => {
    moveTargetAudience("down");
  });

  document
    .querySelectorAll<HTMLButtonElement>("[data-prompt-save]")
    .forEach((button) => {
      button.addEventListener("click", () => {
        const promptName = button.dataset.promptSave;
        if (promptName) {
          savePrompt(promptName, button);
        }
      });
    });

  document
    .querySelectorAll<HTMLButtonElement>("[data-easy-read-prompt-save]")
    .forEach((button) => {
      button.addEventListener("click", () => {
        let promptName = button.dataset.easyReadPromptSave;
        const fieldId = button.dataset.easyReadPromptField;
        if (!promptName || !fieldId) {
          return;
        }

        if (promptName === "task:easyToRead") {
          const easyTask = getEasyToReadTaskDefinition();
          if (!easyTask) {
            setStatus("Kunde inte hitta en lättläst-uppgift i task-katalogen.");
            showButtonHint(button, "Fel.", "error");
            return;
          }
          promptName = `task:${easyTask.key}`;
        }

        const field = getRequiredElement<HTMLTextAreaElement>(fieldId);
        if (!field) {
          return;
        }

        saveEasyToReadPrompt(promptName, field, button);
      });
    });

  document
    .querySelectorAll<HTMLButtonElement>("[data-secret-save]")
    .forEach((button) => {
      const secretName = button.dataset.secretSave;
      let inputId = "";
      if (secretName === "GEMINI_API_KEY") inputId = "secret-gemini";
      if (secretName === "GEMINI_QE_API_KEY") inputId = "secret-gemini-qe";
      if (secretName === "OPENAI_API_KEY") inputId = "secret-openai";
      if (secretName === "OPENAI_QE_API_KEY") inputId = "secret-openai-qe";

      button.addEventListener("click", () => {
        if (secretName && inputId) {
          saveSecret(secretName, inputId, button);
        }
      });
    });

  refs.ordlistaSaveButton.addEventListener("click", () => {
    saveOrdlista();
  });

  refs.ordlistaClearButton.addEventListener("click", () => {
    clearOrdlista();
  });

  refs.backupDownloadButton.addEventListener("click", () => {
    downloadBackup();
  });

  refs.backupImportButton.addEventListener("click", () => {
    importBackup();
  });

  refs.viewInputs.forEach((input) => {
    input.addEventListener("change", () => {
      const view = input.dataset.viewTarget;
      if (view && input.checked) {
        setActiveView(view);
      }
    });
  });

  loadToken();
  initTargetAudienceSelect();
  initTaskPromptSelect();
  syncTaskDefinitionForm();
  syncEasyToReadTaskControls();
  if (getToken()) {
    loadConfig();
  }
  setActiveView("prompts");
}

document.addEventListener("DOMContentLoaded", () => {
  initAdminUI();
});

import type {
  RewritePlanTaskSettings,
  TargetAudienceCatalog,
} from "./admin_types.js";

export const TARGET_AUDIENCE_PREFIX = "targetAudience:";
export const TASK_PROMPT_PREFIX = "task:";

export const DEFAULT_GEMINI_MAX_OUTPUT_TOKENS = 65536;
export const DEFAULT_GEMINI_QE_TEMPERATURE = 0.3;

export const DEFAULT_RUNTIME_PROVIDER_RPM_GEMINI = 10;
export const DEFAULT_RUNTIME_PROVIDER_RPM_OPENAI = 1000;
export const DEFAULT_RUNTIME_GLOBAL_WINDOW_MS = 15 * 60 * 1000;
export const DEFAULT_RUNTIME_GLOBAL_MAX = 100;
export const DEFAULT_RUNTIME_API_WINDOW_MS = 60 * 1000;
export const DEFAULT_RUNTIME_API_STANDARD = 30;
export const DEFAULT_RUNTIME_API_QUALITY = 10;
export const DEFAULT_RUNTIME_API_SUMMARIZE = 10;
export const DEFAULT_RUNTIME_API_UPLOAD = 5;
export const DEFAULT_RUNTIME_UPLOAD_MAX_SIZE_MB = 50;
export const DEFAULT_RUNTIME_QUEUE_CONCURRENT = 8;
export const DEFAULT_RUNTIME_QUEUE_SIZE = 200;
export const DEFAULT_RUNTIME_QUEUE_WAIT_MS = 45000;
export const DEFAULT_RUNTIME_QUEUE_RETRY_AFTER = 15;
export const DEFAULT_RUNTIME_STAGE_ANALYSIS = 32;
export const DEFAULT_RUNTIME_STAGE_REWRITE = 8;
export const DEFAULT_RUNTIME_STAGE_CRITIC = 16;
export const DEFAULT_RUNTIME_RETRY_PROVIDER_MAX = 5;
export const DEFAULT_RUNTIME_RETRY_QUALITY_MAX = 5;
export const DEFAULT_RUNTIME_REPAIR_BUDGET = 1;
export const DEFAULT_RUNTIME_REPAIR_MIN_SUBSCORE = 8;
export const DEFAULT_RUNTIME_AUTO_ENABLED = false;
export const DEFAULT_RUNTIME_AUTO_MODE = "auto";
export const DEFAULT_RUNTIME_AUTO_MANUAL_PROFILE = "quality";
export const DEFAULT_RUNTIME_AUTO_DRY_RUN = false;
export const DEFAULT_RUNTIME_AUTO_EVALUATE_SECONDS = 15;
export const DEFAULT_RUNTIME_AUTO_WINDOW_SECONDS = 60;
export const DEFAULT_RUNTIME_AUTO_MIN_DWELL_SECONDS = 300;
export const DEFAULT_RUNTIME_AUTO_COOLDOWN_SECONDS = 120;
export const DEFAULT_RUNTIME_AUTO_MIN_SAMPLES = 20;
export const DEFAULT_RUNTIME_AUTO_ESCALATE_CONSECUTIVE = 2;
export const DEFAULT_RUNTIME_AUTO_RELAX_CONSECUTIVE = 8;

export const EASY_TO_READ_TASK_ALIASES = new Set([
  "easytoread",
  "easy-to-read",
]);

export const EMPTY_TARGET_AUDIENCE_CATALOG: TargetAudienceCatalog = {
  categories: [],
  audiences: [],
};

export function getDefaultRewritePlanTasks(): RewritePlanTaskSettings {
  return {};
}

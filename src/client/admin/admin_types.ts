export type RewritePlanTaskSettings = Record<string, boolean>;
export type RuntimeSettings = Record<string, unknown>;

export type GlobalConfig = {
  provider?: string;
  retryCount?: number;
  rewritePlanTasks?: RewritePlanTaskSettings;
  runtimeSettings?: RuntimeSettings;
};

export type GeminiConfig = {
  model?: string;
  temperature?: number;
  qualityTemperature?: number;
  maxOutputTokens?: number;
  useWebSearch?: boolean;
  useThinking?: boolean;
};

export type AdminConfigResponse = {
  prompts?: Record<string, string>;
  global?: GlobalConfig;
  providers?: {
    gemini?: GeminiConfig;
  };
};

export type TaskPromptSaveResponse = {
  taskKey?: string;
  prompt?: {
    name?: string;
    content?: string;
  };
  rewritePlanTasks?: RewritePlanTaskSettings;
};

export type TaskDefinition = {
  id: number;
  key: string;
  label: string;
  description?: string | null;
  enabled: boolean;
  sortOrder: number;
  targetAudienceEnabled?: boolean;
  rewritePlanEnabled?: boolean;
};

export type TargetAudienceCategory = {
  name: string;
  sortOrder: number;
};

export type TargetAudienceCatalogItem = {
  label: string;
  category: string;
  sortOrder: number;
};

export type TargetAudienceCatalog = {
  categories: TargetAudienceCategory[];
  audiences: TargetAudienceCatalogItem[];
};

export type AdminApiRequest = <T>(
  method: string,
  path: string,
  body?: Record<string, unknown>,
) => Promise<T>;

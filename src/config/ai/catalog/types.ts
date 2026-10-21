export const PROVIDER_IDS = ["gemini", "openai", "anthropic", "mistral", "xai", "deepseek", "cohere", "ai21", "groq", "together", "fireworks", "cerebras", "huggingface", "openrouter", "azure", "bedrock", "vertex", "local"] as const;
export type ProviderId = typeof PROVIDER_IDS[number];
export type ModelStatus = "active" | "preview" | "deprecated" | "retired" | "draft";
export type NoReasoning = { mode: "none" };
export type BudgetReasoning = { mode: "gemini-budget"; enabledBudget: number; disabledBudget: number; canDisable: boolean };
export type EffortReasoning = { mode: "effort"; enabledEffort: string; disabledEffort: string; canDisable: boolean };
export type AnthropicReasoning = { mode: "anthropic-budget"; minimumBudget: number; defaultBudget: number; canDisable: true };
export type LevelReasoning = { mode: "gemini-level"; enabledLevel: "minimal" | "low" | "medium" | "high"; disabledLevel: "minimal" | "low" | "medium" | "high"; canDisable: boolean };
export type AdaptiveReasoning = { mode: "anthropic-adaptive"; enabledEffort: string; canDisable: boolean };
export type CohereReasoning = { mode: "cohere-thinking"; canDisable: boolean };
export type ReasoningPolicy = NoReasoning | BudgetReasoning | EffortReasoning | AnthropicReasoning | LevelReasoning | AdaptiveReasoning | CohereReasoning
  | { mode: "always-on" }
  | { mode: "thinking-toggle" }
  | { mode: "openrouter"; canDisable: boolean; enabledEffort?: string }
  | { mode: "qwen-template" } | NovaReasoning;
export type NovaReasoning = { mode: "nova-reasoning"; enabledEffort: "low" | "medium"; canDisable: true };

export interface ModelInput<P extends ProviderId = ProviderId, R extends ReasoningPolicy = ReasoningPolicy> {
  provider: P;
  id: string;
  apiModelId?: string;
  displayName: string;
  aliases?: readonly string[];
  limits: { contextWindow: number; maxOutputTokens: number; maxInputTokens?: number; verification: "verified" | "conservative" | "deployment-dependent" };
  reasoning: R;
  temperature: "supported" | "unsupported" | "without-reasoning";
  structuredOutput: "prompt" | "json-object" | "json-schema";
  webSearch?: boolean;
  nativeCapabilities?: { reasoning?: boolean; webSearch?: boolean; structuredOutput?: boolean };
  outputTokenParameter?: "max_tokens" | "max_completion_tokens";
  deploymentRequired?: boolean;
  apiStyle?: "chat" | "responses" | "azure-v1-chat" | "vertex-anthropic" | "vertex-openai" | "bedrock-invoke" | "bedrock-mantle";
  readiness?: { adapter: "supported" | "pending"; live: "untested" | "passed"; specifications: "verified" | "conservative" | "pending" };
  status: ModelStatus;
  metadata: { reviewedAt: string; revision: number; sources: readonly string[]; notes: string; retirementDate?: string; generatedBy?: "catalog-maintenance"; sourceHash?: string };
  defaults?: { temperature?: number; outputFraction?: number };
}

export type ModelDefinition<P extends ProviderId = ProviderId, R extends ReasoningPolicy = ReasoningPolicy> = ModelInput<P, R> & {
  apiModelId: string;
  aliases: readonly string[];
  webSearch: boolean;
  outputTokenParameter: "max_tokens" | "max_completion_tokens";
  deploymentRequired: boolean;
  apiStyle: "chat" | "responses" | "azure-v1-chat" | "vertex-anthropic" | "vertex-openai" | "bedrock-invoke" | "bedrock-mantle";
  defaults: { temperature: number; outputFraction: number };
};

export interface ProviderInfo<P extends ProviderId = ProviderId> {
  id: P;
  label: string;
  key: string;
  endpoint: string;
  defaultModelId: string | null;
}
export interface ProviderDefinition<P extends ProviderId = ProviderId> extends ProviderInfo<P> {
  models: readonly ModelDefinition<P>[];
}

export interface LlmSettings {
  model: string;
  modelProfile?: string | null;
  temperature: number;
  maxOutputTokens: number;
  useWebSearch: boolean;
  useThinking: boolean;
  contextWindow?: number;
  taskModel?: string | null;
  backgroundModel?: string | null;
}

export interface ModelCapabilities {
  contextWindow: number;
  maxOutputTokens: number;
  temperature: boolean;
  reasoning: boolean;
  reasoningAlwaysOn: boolean;
  webSearch: boolean;
  structuredOutput: boolean;
}

export interface AdminModel extends ModelCapabilities {
  credentialsConfigured: boolean;
  temperaturePolicy: ModelDefinition["temperature"];
  id: string;
  apiModelId: string;
  displayName: string;
  aliases: readonly string[];
  status: ModelStatus;
  deploymentRequired: boolean;
  verification: ModelDefinition["limits"]["verification"];
  metadata: ModelDefinition["metadata"];
  readiness: NonNullable<ModelDefinition["readiness"]>;
  defaults: LlmSettings;
}

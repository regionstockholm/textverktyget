import { PROVIDER_IDS, type ModelDefinition, type ModelInput, type ProviderDefinition, type ProviderId, type ReasoningPolicy } from "./types.js";

export function defineModel<P extends ProviderId, R extends ReasoningPolicy>(input: ModelInput<P, R>): ModelDefinition<P, R> {
  return { ...input, apiModelId: input.apiModelId ?? input.id, aliases: input.aliases ?? [],
    webSearch: input.webSearch ?? false, outputTokenParameter: input.outputTokenParameter ?? "max_tokens",
    deploymentRequired: input.deploymentRequired ?? false, apiStyle: input.apiStyle ?? "chat",
    defaults: { temperature: input.defaults?.temperature ?? 0.7, outputFraction: input.defaults?.outputFraction ?? 0.95 } };
}

function record(value: unknown): value is Record<string, any> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}
const validId = (value: unknown) => typeof value === "string" && Boolean(value.trim()) && value.length <= 250 && !/[\x00-\x1f]/.test(value);
const positiveInt = (value: unknown) => typeof value === "number" && Number.isInteger(value) && value > 0 && value <= 100000000;

/** Validate compiled definitions and optional operator-maintained JSON with identical rules. */
export function validateModelDefinition(value: unknown): asserts value is ModelDefinition {
  if (!record(value) || !PROVIDER_IDS.includes(value.provider) || !validId(value.id) || !validId(value.displayName)) throw new Error("Invalid model identity");
  if (!value.deploymentRequired && !validId(value.apiModelId)) throw new Error(`Missing API model ID: ${value.id}`);
  if (typeof value.apiModelId !== "string" || /[\x00-\x1f]/.test(value.apiModelId) || value.apiModelId.length > 250) throw new Error("Invalid API model ID");
  if (!Array.isArray(value.aliases) || !value.aliases.every(validId)) throw new Error("Invalid model aliases");
  if (!["active", "preview", "deprecated", "retired", "draft"].includes(value.status)) throw new Error("Invalid model status");
  const limits = value.limits;
  if (!record(limits) || !positiveInt(limits.contextWindow) || limits.contextWindow < 512 || !positiveInt(limits.maxOutputTokens) || !["verified", "conservative", "deployment-dependent"].includes(limits.verification)) throw new Error(`Invalid model limits: ${value.id}`);
  if (limits.maxInputTokens !== undefined && !positiveInt(limits.maxInputTokens)) throw new Error("Invalid input limit");
  if (!["supported", "unsupported", "without-reasoning"].includes(value.temperature) || !["prompt", "json-object", "json-schema"].includes(value.structuredOutput) || typeof value.webSearch !== "boolean") throw new Error("Invalid model capabilities");
  if (value.webSearch && value.provider !== "gemini" && value.provider !== "vertex") throw new Error("Web search is not implemented by this provider adapter");
  if (value.provider === "bedrock" && value.structuredOutput !== "prompt") throw new Error("Bedrock uses prompt-based structured output in this adapter");
  if (!["max_tokens", "max_completion_tokens"].includes(value.outputTokenParameter) || typeof value.deploymentRequired !== "boolean") throw new Error("Invalid request policy");
  const reasoning = value.reasoning;
  if (!record(reasoning) || !["none", "gemini-budget", "gemini-level", "effort", "anthropic-budget", "anthropic-adaptive", "cohere-thinking", "nova-reasoning", "always-on", "thinking-toggle", "openrouter", "qwen-template"].includes(reasoning.mode)) throw new Error("Invalid reasoning policy");
  const compatibleModes: Record<ProviderId, readonly string[]> = {
    gemini: ["none", "gemini-budget", "gemini-level"], vertex: ["none", "gemini-budget", "gemini-level", "anthropic-budget", "anthropic-adaptive", "effort"],
    openai: ["none", "effort"], azure: ["none", "effort"], anthropic: ["none", "anthropic-budget", "anthropic-adaptive"],
    mistral: ["none", "effort"], xai: ["none", "always-on", "effort"], deepseek: ["none", "always-on", "thinking-toggle"],
    cohere: ["none", "cohere-thinking"], ai21: ["none"], bedrock: ["none", "anthropic-budget", "anthropic-adaptive", "nova-reasoning", "effort", "always-on"], groq: ["none", "effort"], together: ["none", "effort"],
    fireworks: ["none", "effort", "always-on"], cerebras: ["none", "effort"], huggingface: ["none", "effort", "always-on"],
    openrouter: ["none", "openrouter"], local: ["none", "always-on", "effort", "qwen-template"],
  };
  if (!compatibleModes[value.provider as ProviderId].includes(reasoning.mode)) throw new Error("Reasoning policy is not supported by this provider adapter");
  if (["gemini-budget", "gemini-level", "effort", "anthropic-budget", "anthropic-adaptive", "cohere-thinking", "openrouter"].includes(reasoning.mode) && typeof reasoning.canDisable !== "boolean") throw new Error("Missing reasoning disable policy");
  if (reasoning.mode === "gemini-level" && ![reasoning.enabledLevel, reasoning.disabledLevel].every(level => ["minimal", "low", "medium", "high"].includes(level))) throw new Error("Invalid thinking level");
  if (reasoning.mode === "anthropic-adaptive" && !validId(reasoning.enabledEffort)) throw new Error("Invalid adaptive effort");
  if (reasoning.mode === "nova-reasoning" && (!["low", "medium"].includes(reasoning.enabledEffort) || reasoning.canDisable !== true)) throw new Error("Invalid Nova reasoning policy");
  if (reasoning.mode === "gemini-budget" && (!Number.isInteger(reasoning.enabledBudget) || reasoning.enabledBudget < -1 || !Number.isInteger(reasoning.disabledBudget) || reasoning.disabledBudget < 0)) throw new Error("Invalid thinking budget");
  if (reasoning.mode === "effort" && (!validId(reasoning.enabledEffort) || !validId(reasoning.disabledEffort))) throw new Error("Invalid reasoning effort");
  if (reasoning.mode === "anthropic-budget" && (!positiveInt(reasoning.minimumBudget) || reasoning.minimumBudget < 1024 || !positiveInt(reasoning.defaultBudget) || reasoning.defaultBudget < reasoning.minimumBudget || reasoning.minimumBudget >= limits.maxOutputTokens)) throw new Error("Invalid Anthropic thinking budget");
  const metadata = value.metadata;
  if (!record(metadata) || !/^\d{4}-\d{2}-\d{2}$/.test(metadata.reviewedAt) || !Number.isFinite(Date.parse(metadata.reviewedAt)) || !positiveInt(metadata.revision) || typeof metadata.notes !== "string" || !Array.isArray(metadata.sources) || !metadata.sources.length || !metadata.sources.every((url: unknown) => typeof url === "string" && /^https:\/\//.test(url))) throw new Error(`Missing research metadata: ${value.id}`);
  if (!record(value.defaults) || typeof value.defaults.temperature !== "number" || !Number.isFinite(value.defaults.temperature) || value.defaults.temperature < 0 || value.defaults.temperature > 1 || typeof value.defaults.outputFraction !== "number" || !Number.isFinite(value.defaults.outputFraction) || value.defaults.outputFraction <= 0 || value.defaults.outputFraction > 1) throw new Error("Invalid model defaults");
  if (!["chat", "responses", "azure-v1-chat", "vertex-anthropic", "vertex-openai", "bedrock-invoke", "bedrock-mantle"].includes(value.apiStyle)) throw new Error("Invalid API style");
  if (value.apiStyle === "azure-v1-chat" && value.provider !== "azure") throw new Error("Azure v1 API style requires Azure provider");
  if (value.apiStyle === "vertex-anthropic" && value.provider !== "vertex") throw new Error("Vertex API style requires Vertex provider");
  if (value.apiStyle === "vertex-openai" && value.provider !== "vertex") throw new Error("Vertex API style requires Vertex provider");
  if (value.apiStyle === "bedrock-invoke" && value.provider !== "bedrock") throw new Error("Bedrock API style requires Bedrock provider");
  if (value.apiStyle === "bedrock-mantle" && value.provider !== "bedrock") throw new Error("Bedrock API style requires Bedrock provider");
  if (value.apiStyle === "responses" && !["openai", "azure", "fireworks", "xai", "deepseek", "openrouter", "local"].includes(value.provider)) throw new Error("Responses API is not supported by this provider adapter");
  if (value.readiness !== undefined && (!record(value.readiness) || !["supported", "pending"].includes(value.readiness.adapter) || !["untested", "passed"].includes(value.readiness.live) || !["verified", "conservative", "pending"].includes(value.readiness.specifications))) throw new Error("Invalid readiness metadata");
}

export function validateCatalog(providers: readonly ProviderDefinition[]): void {
  const ids = new Set<string>();
  for (const provider of providers) {
    if (ids.has(provider.id)) throw new Error(`Duplicate provider: ${provider.id}`);
    ids.add(provider.id);
    const names = new Map<string, string>();
    for (const model of provider.models) {
      validateModelDefinition(model);
      if (model.provider !== provider.id) throw new Error(`Model belongs to a different provider: ${model.id}`);
      for (const name of new Set([model.id, ...model.aliases].filter(Boolean))) {
        if (names.has(name)) throw new Error(`Duplicate model ID or alias: ${provider.id}/${name}`);
        names.set(name, model.id);
      }
    }
    if (provider.defaultModelId && !provider.models.some(model => model.id === provider.defaultModelId && model.status !== "retired" && model.status !== "draft")) throw new Error(`Invalid default model: ${provider.id}`);
  }
}

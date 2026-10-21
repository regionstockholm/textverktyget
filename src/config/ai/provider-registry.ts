/** Credentials remain environment-only; the local catalog owns all model metadata. */
import { catalog, findModelDefinition, requireModelDefinition } from "./catalog/index.js";
import { capabilitiesForModel, defaultsForModel } from "./catalog/defaults.js";
import type { ProviderId, LlmSettings, ModelCapabilities } from "./catalog/types.js";
export type { ProviderId, LlmSettings, ModelCapabilities } from "./catalog/types.js";
export const PROVIDERS = Object.fromEntries(catalog.providers.map(provider => [provider.id, {
  ...provider, models: provider.models.filter(model => model.status !== "retired" && model.status !== "draft").map(model => model.id),
}])) as Record<ProviderId, { id: ProviderId; label: string; key: string; endpoint: string; defaultModelId: string | null; models: string[] }>;
export function normalizeProviderId(value: string): ProviderId {
  const id = value === "gemini-2.5-flash" ? "gemini" : value;
  if (!Object.hasOwn(PROVIDERS, id)) throw new Error("Unsupported AI provider");
  return id as ProviderId;
}

export function hasEnvironmentValue(value: string | undefined): boolean {
  const text = value?.trim() || "";
  return Boolean(text && !/^\[.*\]$/.test(text) && !/^(your[_-]|replace[_-]|changeme|placeholder)/i.test(text));
}

export function providerAvailability(id: ProviderId, env: NodeJS.ProcessEnv = process.env) {
  const definition = PROVIDERS[id];
  let required: string[] = definition.key ? [definition.key] : [];
  if (id === "local") required = ["LOCAL_LLM_BASE_URL"];
  if (id === "azure") required.push("AZURE_OPENAI_ENDPOINT", "AZURE_OPENAI_DEPLOYMENT");
  if (id === "vertex") {
    required = ["GOOGLE_CLOUD_PROJECT", "GOOGLE_CLOUD_LOCATION"];
    if (!hasEnvironmentValue(env.GOOGLE_APPLICATION_CREDENTIALS) && env.GOOGLE_CLOUD_USE_ADC !== "true") required.push("GOOGLE_APPLICATION_CREDENTIALS or GOOGLE_CLOUD_USE_ADC=true");
  }
  if (id === "bedrock") {
    required = ["AWS_REGION"];
    const identity = hasEnvironmentValue(env.AWS_BEARER_TOKEN_BEDROCK) || (hasEnvironmentValue(env.AWS_ACCESS_KEY_ID) && hasEnvironmentValue(env.AWS_SECRET_ACCESS_KEY)) || hasEnvironmentValue(env.AWS_PROFILE) || hasEnvironmentValue(env.AWS_CONTAINER_CREDENTIALS_RELATIVE_URI) || hasEnvironmentValue(env.AWS_CONTAINER_CREDENTIALS_FULL_URI) || (hasEnvironmentValue(env.AWS_ROLE_ARN) && hasEnvironmentValue(env.AWS_WEB_IDENTITY_TOKEN_FILE)) || env.AWS_USE_DEFAULT_CREDENTIAL_CHAIN === "true";
    if (!identity) required.push("AWS credentials or AWS_USE_DEFAULT_CREDENTIAL_CHAIN=true");
  }
  const missingConfiguration = required.filter(key => !hasEnvironmentValue(env[key]));
  for (const key of id === "local" ? ["LOCAL_LLM_BASE_URL"] : id === "azure" ? ["AZURE_OPENAI_ENDPOINT"] : []) {
    if (!hasEnvironmentValue(env[key])) continue;
    try {
      const url = new URL(env[key]!);
      if (!["http:", "https:"].includes(url.protocol) || url.username || url.password || url.search || url.hash) throw new Error();
    } catch { missingConfiguration.push(`${key} (invalid URL)`); }
  }
  return { provider: id, label: definition.label, configured: missingConfiguration.length === 0, missingConfiguration };
}

export function assertProviderConfigured(id: ProviderId): void {
  const status = providerAvailability(id);
  if (!status.configured) throw new Error(`${status.label}: configure ${status.missingConfiguration.join(", ")} in the server environment.`);
}

export function modelCapabilities(provider: ProviderId, model: string, profile?: string | null): ModelCapabilities {
  const definition = findModelDefinition(provider, model, profile);
  // Only used to display legacy/unregistered saved settings. Generation/save require a definition.
  return definition ? capabilitiesForModel(definition) : { contextWindow: 8192, maxOutputTokens: 4096, temperature: false, reasoning: false, reasoningAlwaysOn: false, webSearch: false, structuredOutput: false };
}

export function defaultProviderSettings(id: ProviderId): LlmSettings {
  const profile = PROVIDERS[id].defaultModelId;
  if (!profile) throw new Error(`No default model defined for ${id}`);
  const settings = defaultsForModel(requireModelDefinition(id, profile));
  if (id === "azure") settings.model = process.env.AZURE_OPENAI_DEPLOYMENT || "";
  return settings;
}

/** Keep a small margin below the model's output ceiling and reserve input space. */
export function defaultModelSettings(provider: ProviderId, model: string, profile?: string | null): LlmSettings {
  return defaultsForModel(requireModelDefinition(provider, model, profile));
}

export function validateLlmSettings(id: ProviderId, input: unknown, options: { allowInactive?: boolean } = {}): LlmSettings {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("Invalid model settings");
  const data = input as Record<string, unknown>;
  if (typeof data.model !== "string" || !data.model.trim() || data.model.length > 250 || /[\x00-\x1f]/.test(data.model)) throw new Error("A valid model ID is required");
  const model = data.model.trim().replace(/^models\//, "");
  if (data.modelProfile !== undefined && data.modelProfile !== null && typeof data.modelProfile !== "string") throw new Error("Invalid model profile");
  const definition = options.allowInactive ? findModelDefinition(id, model, data.modelProfile as string | undefined) : requireModelDefinition(id, model, data.modelProfile as string | undefined);
  if (!definition) throw new Error(`Model ${id}/${model} has no local definition. Register its model profile before restoring settings.`);
  if (!options.allowInactive && definition.apiStyle === "bedrock-mantle" && !hasEnvironmentValue(process.env.AWS_BEARER_TOKEN_BEDROCK)) throw new Error("This model requires AWS_BEARER_TOKEN_BEDROCK in the server environment");
  if (!definition.deploymentRequired && model !== definition.apiModelId && !definition.aliases.includes(model) && model !== definition.id) throw new Error("Model ID does not match the selected profile");
  const caps = capabilitiesForModel(definition);
  if (typeof data.temperature !== "number" || !Number.isFinite(data.temperature) || data.temperature < 0 || data.temperature > 1) throw new Error("Temperature must be between 0 and 1");
  const contextWindow = data.contextWindow ?? caps.contextWindow;
  if (typeof contextWindow !== "number" || !Number.isInteger(contextWindow) || contextWindow < 512 || contextWindow > 100000000) throw new Error("Context window must be between 512 and 100000000 tokens");
  if (!options.allowInactive && definition.limits.verification === "verified" && contextWindow > definition.limits.contextWindow) throw new Error("Context window exceeds this model's local definition");
  if (typeof data.maxOutputTokens !== "number" || !Number.isInteger(data.maxOutputTokens) || data.maxOutputTokens < 1 || data.maxOutputTokens >= contextWindow || (!options.allowInactive && data.maxOutputTokens > caps.maxOutputTokens)) throw new Error(`Maximum output must be below the context window and at most ${caps.maxOutputTokens} tokens`);
  if (typeof data.useThinking !== "boolean" || typeof data.useWebSearch !== "boolean") throw new Error("Invalid capability settings");
  if (!options.allowInactive) {
    if (data.useWebSearch && !caps.webSearch) throw new Error("This model does not support web search through this adapter");
    if (data.useThinking && !caps.reasoning) throw new Error("This model does not support configurable reasoning through this adapter");
    if (!data.useThinking && caps.reasoningAlwaysOn) throw new Error("Reasoning is always enabled for this model");
    if (definition.reasoning.mode === "anthropic-budget" && data.useThinking && data.maxOutputTokens <= definition.reasoning.minimumBudget) throw new Error(`Anthropic thinking requires more than ${definition.reasoning.minimumBudget} output tokens`);
  }
  for (const key of ["taskModel", "backgroundModel"] as const) {
    if (data[key] != null && (typeof data[key] !== "string" || (data[key] as string).length > 250 || /[\x00-\x1f]/.test(data[key] as string))) throw new Error(`Invalid ${key}`);
    if (typeof data[key] === "string" && data[key].trim() && !options.allowInactive) requireModelDefinition(id, data[key].trim());
  }
  return { model: !definition.deploymentRequired && model === definition.id ? definition.apiModelId : model, modelProfile: definition.id, temperature: data.temperature, maxOutputTokens: data.maxOutputTokens, contextWindow, useThinking: data.useThinking, useWebSearch: data.useWebSearch, taskModel: (data.taskModel as string)?.trim() || null, backgroundModel: (data.backgroundModel as string)?.trim() || null };
}

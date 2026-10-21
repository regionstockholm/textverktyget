import gemini from "./providers/gemini/index.js";
import openai from "./providers/openai/index.js";
import anthropic from "./providers/anthropic/index.js";
import mistral from "./providers/mistral/index.js";
import xai from "./providers/xai/index.js";
import deepseek from "./providers/deepseek/index.js";
import cohere from "./providers/cohere/index.js";
import ai21 from "./providers/ai21/index.js";
import groq from "./providers/groq/index.js";
import together from "./providers/together/index.js";
import fireworks from "./providers/fireworks/index.js";
import cerebras from "./providers/cerebras/index.js";
import huggingface from "./providers/huggingface/index.js";
import openrouter from "./providers/openrouter/index.js";
import azure from "./providers/azure/index.js";
import bedrock from "./providers/bedrock/index.js";
import vertex from "./providers/vertex/index.js";
import local from "./providers/local/index.js";
import { validateCatalog } from "./validation.js";
import { loadCustomProfiles } from "./custom-profiles.js";
import { capabilitiesForModel, defaultsForModel } from "./defaults.js";
import type { AdminModel, ModelDefinition, ProviderDefinition, ProviderId } from "./types.js";

export const BUILTIN_PROVIDERS: readonly ProviderDefinition[] = [gemini, openai, anthropic, mistral, xai, deepseek, cohere, ai21, groq, together, fireworks, cerebras, huggingface, openrouter, azure, bedrock, vertex, local];

function freeze<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) freeze(child);
    Object.freeze(value);
  }
  return value;
}

export function createCatalog(builtins: readonly ProviderDefinition[], custom: readonly ModelDefinition[] = []) {
  const definitions = builtins.map(provider => ({ ...provider, models: [...provider.models] }));
  const customIds = new Set<string>();
  for (const model of custom) {
    const key = `${model.provider}/${model.id}`;
    if (customIds.has(key)) throw new Error(`Duplicate custom model profile: ${key}`);
    customIds.add(key);
    const provider = definitions.find(item => item.id === model.provider);
    if (!provider) throw new Error(`Unsupported custom provider: ${model.provider}`);
    // Explicit same-ID overrides are permitted; accidental alias collisions are rejected below.
    const index = provider.models.findIndex(item => item.id === model.id);
    if (index >= 0) provider.models[index] = model;
    else provider.models.push(model);
  }
  validateCatalog(definitions);
  freeze(definitions);
  return {
    providers: definitions,
    getProvider(id: ProviderId) {
      const provider = definitions.find(item => item.id === id);
      if (!provider) throw new Error("Unsupported AI provider");
      return provider;
    },
    findModel(provider: ProviderId, apiModelId: string, profile?: string | null): ModelDefinition | undefined {
      const models = definitions.find(item => item.id === provider)?.models || [];
      if (profile) return models.find(item => item.id === profile);
      return models.find(item => item.id === apiModelId || item.apiModelId === apiModelId || item.aliases.includes(apiModelId));
    },
  };
}

export const catalog = createCatalog(BUILTIN_PROVIDERS, process.env.LLM_CATALOG_DIR ? loadCustomProfiles(process.env.LLM_CATALOG_DIR) : []);

export function findModelDefinition(provider: ProviderId, model: string, profile?: string | null) {
  return catalog.findModel(provider, model, profile);
}

export function requireModelDefinition(provider: ProviderId, model: string, profile?: string | null): ModelDefinition {
  const definition = findModelDefinition(provider, model, profile);
  if (!definition) throw new Error(`Model ${provider}/${model || profile || "(missing)"} has no local definition. Register a model file or custom JSON profile and restart the application.`);
  if (definition.status === "retired" || definition.status === "draft") throw new Error(`Model ${definition.displayName} is ${definition.status}; select an available model in admin settings.`);
  if (definition.readiness?.adapter === "pending") throw new Error(`Model ${definition.displayName} is inventoried but needs adapter/specification review before activation.`);
  return definition;
}

export function listAdminModels(provider: ProviderId): AdminModel[] {
  return catalog.getProvider(provider).models.filter(model => model.status !== "draft").map(model => ({
    credentialsConfigured: model.apiStyle !== "bedrock-mantle" || Boolean(process.env.AWS_BEARER_TOKEN_BEDROCK?.trim() && !/^\[.*\]$/.test(process.env.AWS_BEARER_TOKEN_BEDROCK.trim())),
    id: model.id, apiModelId: model.apiModelId, displayName: model.displayName, aliases: model.aliases,
    status: model.status, deploymentRequired: model.deploymentRequired, verification: model.limits.verification,
    temperaturePolicy: model.temperature,
    readiness: model.readiness ?? { adapter: "supported", live: "untested", specifications: model.limits.verification === "verified" ? "verified" : "conservative" },
    metadata: model.metadata, ...capabilitiesForModel(model), defaults: defaultsForModel(model),
  }));
}

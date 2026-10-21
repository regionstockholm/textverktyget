import type { ProviderId } from "../catalog/types.js";

export interface CatalogSource {
  provider: ProviderId;
  catalog: string;
  api?: string;
  apiKey?: string;
  lifecycle?: string;
  mode: "openai-docs" | "anthropic-docs" | "cloud-docs" | "mistral-docs" | "xai-docs" | "deepseek-docs" | "table-docs" | "model-library" | "huggingface" | "openrouter" | "local";
}

/** Only explicit maintenance commands use these URLs. Runtime never imports this module. */
export const CATALOG_SOURCES: readonly CatalogSource[] = [
  { provider: "gemini", catalog: "https://ai.google.dev/gemini-api/docs/models", api: "https://generativelanguage.googleapis.com/v1beta/models", apiKey: "GEMINI_API_KEY", mode: "cloud-docs" },
  { provider: "openai", catalog: "https://developers.openai.com/api/docs/models/all", api: "https://api.openai.com/v1/models", apiKey: "OPENAI_API_KEY", lifecycle: "https://developers.openai.com/api/docs/deprecations", mode: "openai-docs" },
  { provider: "anthropic", catalog: "https://platform.claude.com/docs/en/models/overview", api: "https://api.anthropic.com/v1/models", apiKey: "ANTHROPIC_API_KEY", lifecycle: "https://platform.claude.com/docs/en/about-claude/model-deprecations", mode: "anthropic-docs" },
  { provider: "mistral", catalog: "https://docs.mistral.ai/getting-started/models", api: "https://api.mistral.ai/v1/models", apiKey: "MISTRAL_API_KEY", mode: "mistral-docs" },
  { provider: "xai", catalog: "https://docs.x.ai/developers/models", api: "https://api.x.ai/v1/models", apiKey: "XAI_API_KEY", mode: "xai-docs" },
  { provider: "deepseek", catalog: "https://api-docs.deepseek.com/quick_start/pricing", api: "https://api.deepseek.com/models", apiKey: "DEEPSEEK_API_KEY", lifecycle: "https://api-docs.deepseek.com/updates", mode: "deepseek-docs" },
  { provider: "cohere", catalog: "https://docs.cohere.com/docs/models", mode: "table-docs" },
  { provider: "ai21", catalog: "https://docs.ai21.com/docs/jamba-foundation-models.md", mode: "table-docs" },
  { provider: "groq", catalog: "https://console.groq.com/docs/models", api: "https://api.groq.com/openai/v1/models", apiKey: "GROQ_API_KEY", lifecycle: "https://console.groq.com/docs/deprecations", mode: "table-docs" },
  { provider: "together", catalog: "https://docs.together.ai/docs/serverless/models.md", api: "https://api.together.xyz/v1/models", apiKey: "TOGETHER_API_KEY", mode: "table-docs" },
  { provider: "fireworks", catalog: "https://fireworks.ai/models", api: "https://api.fireworks.ai/inference/v1/models", apiKey: "FIREWORKS_API_KEY", mode: "model-library" },
  { provider: "cerebras", catalog: "https://inference-docs.cerebras.ai/models/overview.md", api: "https://api.cerebras.ai/v1/models", apiKey: "CEREBRAS_API_KEY", lifecycle: "https://inference-docs.cerebras.ai/support/deprecation.md", mode: "table-docs" },
  { provider: "huggingface", catalog: "https://router.huggingface.co/v1/models", mode: "huggingface" },
  { provider: "openrouter", catalog: "https://openrouter.ai/api/v1/models", mode: "openrouter" },
  { provider: "azure", catalog: "https://learn.microsoft.com/en-us/azure/ai-foundry/openai/concepts/models", mode: "table-docs" },
  { provider: "bedrock", catalog: "https://docs.aws.amazon.com/bedrock/latest/userguide/model-cards.md", mode: "cloud-docs" },
  { provider: "vertex", catalog: "https://docs.cloud.google.com/vertex-ai/generative-ai/docs/learn/models", mode: "cloud-docs" },
  { provider: "local", catalog: "https://docs.ollama.com/openai", mode: "local" },
];

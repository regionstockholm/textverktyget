/**
 * AI Provider Configuration Module
 * Defines provider types and configuration settings for different AI services
 * @module config/ai/ai-providers
 */

import { assert } from "../../utils/safety-utils.js";

function readPositiveIntEnv(key: string, fallback: number): number {
  const raw = process.env[key];
  if (!raw || raw.trim().length === 0) {
    return fallback;
  }

  const parsed = Number.parseInt(raw, 10);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return fallback;
  }

  return parsed;
}

// Define the AI provider types as a string literal union type
export type AIProvider = "openai" | "gemini-2.5-flash";

// Define the AI providers object with proper typing
export const AI_PROVIDERS = Object.freeze({
  OPENAI: "openai" as AIProvider,
  GEMINI_2_5_FLASH: "gemini-2.5-flash" as AIProvider,
});

// Define the default AI provider to use across the application
// Change this value to switch between providers
export const DEFAULT_PROVIDER = AI_PROVIDERS.GEMINI_2_5_FLASH;

// Define the interface for AI configuration
export interface AIProviderConfig {
  MODEL: string;
  MAX_INPUT_TOKENS: number;
  MAX_OUTPUT_TOKENS: number;
  MAX_CHUNK_SIZE: number;
  MAX_RETRIES: number;
  RETRY_DELAY: number;
  RPM_LIMIT: number;
  THINKING_BUDGET?: number;
  USE_GOOGLE_SEARCH_GROUNDING?: boolean;
}

// Define the AI configuration with proper typing
// Need more models to pick from, and updates models.
// Also need testing using open source models that run locally.
export const AI_CONFIG: Readonly<Record<AIProvider, AIProviderConfig>> =
  Object.freeze({
    "gemini-2.5-flash": {
      MODEL: "models/gemini-2.5-flash",
      MAX_INPUT_TOKENS: 1048576, // ~1M tokens input limit
      MAX_OUTPUT_TOKENS: 65536, // 65K tokens output limit
      MAX_CHUNK_SIZE: 4194304, // ~1M tokens (4 chars per token)
      MAX_RETRIES: 5,
      RETRY_DELAY: 15000,
      RPM_LIMIT: readPositiveIntEnv("GEMINI_RPM_LIMIT", 10),
      THINKING_BUDGET: -1, // -1 for auto, 0 for none
      USE_GOOGLE_SEARCH_GROUNDING: false, // Set to true to enable grounding with Google Search
    },
    openai: {
      MODEL: "gpt-4o",
      MAX_INPUT_TOKENS: 128000,
      MAX_OUTPUT_TOKENS: 16384,
      MAX_CHUNK_SIZE: 512000, // ~128K tokens (4 chars per token)
      MAX_RETRIES: 5,
      RETRY_DELAY: 15000,
      RPM_LIMIT: readPositiveIntEnv("OPENAI_RPM_LIMIT", 1000),
    },
  });

/**
 * Validates and returns an AI provider configuration
 * @param provider - The AI provider to validate
 * @returns The validated provider configuration
 * @throws Error if the provider is not supported
 */
export function getProviderConfig(provider: AIProvider): AIProviderConfig {
  assert(
    Object.values(AI_PROVIDERS).includes(provider),
    `Unsupported AI provider: ${provider}`,
  );

  return AI_CONFIG[provider];
}

/**
 * Validates AI configuration at runtime
 * @throws Error if any critical configuration is invalid
 */
export function validateAIConfig(): void {
  Object.entries(AI_CONFIG).forEach(([provider, config]) => {
    assert(
      config.MODEL.length > 0,
      `Model name is required for provider ${provider}`,
    );
    assert(
      config.MAX_INPUT_TOKENS > 0,
      `MAX_INPUT_TOKENS must be positive for provider ${provider}`,
    );
    assert(
      config.MAX_OUTPUT_TOKENS > 0,
      `MAX_OUTPUT_TOKENS must be positive for provider ${provider}`,
    );
    assert(
      config.MAX_RETRIES >= 0,
      `MAX_RETRIES cannot be negative for provider ${provider}`,
    );
    assert(
      config.RETRY_DELAY >= 0,
      `RETRY_DELAY cannot be negative for provider ${provider}`,
    );
    assert(
      config.RPM_LIMIT > 0,
      `RPM_LIMIT must be positive for provider ${provider}`,
    );
  });
}

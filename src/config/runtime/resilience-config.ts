import { readBooleanEnv, readIntegerEnv } from "./read-env.js";

export type ProviderCircuitBreakerConfig = {
  failureThreshold: number;
  cooldownMs: number;
};

export type ResilienceConfig = {
  providerFallbackEnabled: boolean;
  providerCircuitBreaker: ProviderCircuitBreakerConfig;
};

export const resilienceConfig: ResilienceConfig = {
  providerFallbackEnabled: readBooleanEnv("PROVIDER_FALLBACK_ENABLED", true),
  providerCircuitBreaker: {
    failureThreshold: readIntegerEnv("PROVIDER_CB_FAILURE_THRESHOLD", 5, 1, 100),
    cooldownMs: readIntegerEnv(
      "PROVIDER_CB_COOLDOWN_MS",
      30000,
      1000,
      10 * 60 * 1000,
    ),
  },
};

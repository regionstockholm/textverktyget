/**
 * Unified Application Configuration
 * Small aggregator for runtime config modules.
 */

import { apiKeys, type ApiKeysConfig } from "./runtime/api-keys-config.js";
import {
  databaseConfig,
  type DatabaseConfig,
} from "./runtime/database-config.js";
import {
  environmentConfig,
  type EnvironmentConfig,
} from "./runtime/environment-config.js";
import { featureConfig, type FeatureConfig } from "./runtime/feature-config.js";
import {
  performanceConfig,
  type PerformanceConfig,
} from "./runtime/performance-config.js";
import {
  qualityControlConfig,
  type QualityControlConfig,
} from "./runtime/quality-config.js";
import {
  resilienceConfig,
  type ResilienceConfig,
} from "./runtime/resilience-config.js";
import {
  securityConfig,
  type SecurityConfig,
} from "./runtime/security-config.js";
import {
  serverPort,
  serverSettings,
  type ServerSettingsConfig,
} from "./runtime/server-config.js";

export type AppConfig = EnvironmentConfig & {
  port: number;
  serverSettings: ServerSettingsConfig;
  apiKeys: ApiKeysConfig;
  database: DatabaseConfig;
  security: SecurityConfig;
  performance: PerformanceConfig;
  features: FeatureConfig;
  qualityControl: QualityControlConfig;
  resilience: ResilienceConfig;
};

export const config: AppConfig = {
  ...environmentConfig,
  port: serverPort,
  serverSettings,
  apiKeys,
  database: databaseConfig,
  security: securityConfig,
  performance: performanceConfig,
  features: featureConfig,
  qualityControl: qualityControlConfig,
  resilience: resilienceConfig,
};

export function validateConfig(): boolean {
  const hasAiService = !!(config.apiKeys.gemini || config.apiKeys.openai);

  if (!hasAiService) {
    console.warn(
      "No AI service configured. Add GEMINI_API_KEY or OPENAI_API_KEY to .env",
    );
  }

  if (!config.database.url) {
    console.warn("No DATABASE_URL configured. Add DATABASE_URL to .env");
  }

  if (!process.env.CONFIG_MASTER_KEY) {
    console.warn(
      "No CONFIG_MASTER_KEY configured. Add CONFIG_MASTER_KEY to .env",
    );
  }

  return true;
}

validateConfig();

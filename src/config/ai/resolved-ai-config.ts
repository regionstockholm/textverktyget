import { AsyncLocalStorage } from "node:async_hooks";
import configService from "../../services/config/config-service.js";
import { assertProviderConfigured, providerAvailability, normalizeProviderId, modelCapabilities, type ProviderId, type LlmSettings } from "./provider-registry.js";
import { requireModelDefinition } from "./catalog/index.js";

export interface ResolvedAiConfig {
  provider: ProviderId;
  settings: LlmSettings;
  qualityTemperature: number;
  retries: number;
  fallbackProvider: ProviderId | null;
  fallbackSettings: LlmSettings | null;
}
const context = new AsyncLocalStorage<{ value?: Promise<ResolvedAiConfig>; canContinue?: () => boolean }>();

export function withAiJob<T>(run: () => T, canContinue?: () => boolean): T {
  return context.run({ canContinue }, run);
}

export function assertAiJobConnected(): void {
  if (context.getStore()?.canContinue?.() === false) throw new Error("Request cancelled by user");
}

export async function loadAiConfig(): Promise<ResolvedAiConfig> {
  const global = await configService.getGlobalConfig();
  const provider = normalizeProviderId(global.provider);
  assertProviderConfigured(provider);
  const settings = await configService.getProviderConfig(provider);
  if (!settings.model) throw new Error("Select an AI model in the admin settings before processing text.");
  requireModelDefinition(provider, settings.model, settings.modelProfile);
  const runtime = global.runtimeSettings;
  const quality = runtime.quality as { temperature?: number } | undefined;
  const retry = runtime.retry as { providerMaxRetries?: number } | undefined;
  const fallback = runtime.aiFallback as { enabled?: boolean; provider?: string } | undefined;
  let fallbackProvider: ProviderId | null = null;
  let fallbackSettings: LlmSettings | null = null;
  if (fallback?.enabled && fallback.provider) {
    fallbackProvider = normalizeProviderId(fallback.provider);
    if (fallbackProvider !== provider && providerAvailability(fallbackProvider).configured) {
      fallbackSettings = await configService.getProviderConfig(fallbackProvider);
      try {
        if (!fallbackSettings.model) throw new Error("Missing fallback model");
        requireModelDefinition(fallbackProvider, fallbackSettings.model, fallbackSettings.modelProfile);
      } catch { fallbackProvider = null; fallbackSettings = null; }
    } else fallbackProvider = null;
  }
  return { provider, settings, qualityTemperature: quality?.temperature ?? 0.3, retries: retry?.providerMaxRetries ?? global.retryCount, fallbackProvider, fallbackSettings };
}

export function resolveAiConfig(): Promise<ResolvedAiConfig> {
  const store = context.getStore();
  if (!store) return loadAiConfig();
  return store.value ??= loadAiConfig();
}

export function modelForCall(settings: LlmSettings, task: boolean): LlmSettings {
  const model = (task ? settings.taskModel : settings.backgroundModel) || settings.model;
  return { ...settings, model, modelProfile: model === settings.model ? settings.modelProfile : null };
}

export function chunkSizeForModel(provider: ProviderId, settings: LlmSettings): number {
  const window = settings.contextWindow ?? modelCapabilities(provider, settings.model, settings.modelProfile).contextWindow;
  // Reserve space for prompt assembly and output; use a conservative character estimate.
  return Math.max(256, Math.floor((window - settings.maxOutputTokens - Math.min(4096, window / 4)) * 2));
}

/** Same conservative input estimate as the transport, including actual prompt size. */
export function availableInputCharacters(provider: ProviderId, settings: LlmSettings): number {
  const definition = requireModelDefinition(provider, settings.model, settings.modelProfile);
  const window = Math.min(settings.contextWindow ?? definition.limits.contextWindow, definition.limits.contextWindow);
  const output = Math.min(settings.maxOutputTokens, definition.limits.maxOutputTokens);
  return Math.max(0, Math.floor(Math.min(window - output, definition.limits.maxInputTokens ?? window) * 2));
}

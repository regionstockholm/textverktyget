import { AI_PROVIDERS, DEFAULT_PROVIDER, type AIProvider } from "./ai-config.js";
import { logger } from "../../utils/logger.js";
import { buildSystemMessage } from "./prompt-assembly.js";
import type { ProcessingOptions, ProcessingResult } from "./ai-service-types.js";
import { resolveAiConfig, modelForCall, assertAiJobConnected } from "./resolved-ai-config.js";
import { generateText, ProviderError } from "./providers/transport.js";
import { modelCapabilities, type ProviderId, type LlmSettings } from "./provider-registry.js";
import { isTaskExecution } from "./reasoning-policy.js";
import { resolveWebSearch } from "./web-search-policy.js";
import { preserveLineSeparatorTrim } from "./text-normalization.js";
import { createRateLimiter } from "../../utils/rate-limiter.js";
import configService from "../../services/config/config-service.js";
import { createCircuitBreaker } from "../../utils/circuit-breaker.js";
import { config } from "../app-config.js";

export function getCurrentProvider(): AIProvider {
  const provider = process.env.AI_PROVIDER as AIProvider || DEFAULT_PROVIDER;
  if (!Object.values(AI_PROVIDERS).includes(provider)) throw new Error("Unsupported AI provider");
  return provider;
}

const limiters = new Map<string, ReturnType<typeof createRateLimiter>>();
const breakers = new Map<string, ReturnType<typeof createCircuitBreaker>>();
async function call(provider: ProviderId, settings: LlmSettings, prompt: string, quality: boolean, retries: number, trace?: { requestId?: string; processId?: string }): Promise<string> {
  const runtime = await configService.getRuntimeSettings();
  const rpm = Math.max(1, Math.min(10000, Number((runtime.providerRpm as Record<string, unknown> | undefined)?.[provider]) || Number(process.env[`${provider.toUpperCase()}_RPM_LIMIT`]) || (provider === "gemini" ? 10 : 60)));
  const scope = `${provider}:${rpm}`;
  if (!limiters.has(scope)) limiters.set(scope, createRateLimiter(rpm, { scope: `provider.${scope}` }));
  const breakerKey = `${provider}:${settings.model}`;
  if (!breakers.has(breakerKey)) breakers.set(breakerKey, createCircuitBreaker(config.resilience.providerCircuitBreaker));
  const breaker = breakers.get(breakerKey)!;
  for (let attempt = 0; ; attempt++) {
    assertAiJobConnected();
    await limiters.get(scope)!.checkLimit();
    assertAiJobConnected();
    if (!breaker.allowRequest()) throw new ProviderError("AI provider temporarily unavailable after repeated failures. Try again shortly.", true);
    try {
      const start = Date.now();
      const response = await generateText(provider, settings, prompt, quality);
      breaker.recordSuccess();
      logger.info("process.ai.responded", { ...trace, processStatus: "running", meta: { provider, model: settings.model, searchRequested: settings.useWebSearch, latencyMs: Date.now() - start } });
      return response;
    } catch (error) {
      if (error instanceof ProviderError && error.retryable) breaker.recordFailure();
      else breaker.recordSuccess();
      if (!(error instanceof ProviderError) || !error.retryable || attempt >= Math.min(20, retries)) throw error;
      await new Promise(resolve => setTimeout(resolve, Math.min(15000, 1000 * 2 ** attempt)));
    }
  }
}

async function execute(prompt: string, options: ProcessingOptions | undefined, quality: boolean, trace?: { requestId?: string; processId?: string }): Promise<string> {
  const snapshot = await resolveAiConfig();
  const task = isTaskExecution(options);
  const select = (provider: ProviderId, source: LlmSettings) => {
    const settings = modelForCall(source, task);
    const caps = modelCapabilities(provider, settings.model, settings.modelProfile);
    if (settings.model !== source.model) {
      settings.contextWindow = caps.contextWindow;
      settings.maxOutputTokens = Math.min(settings.maxOutputTokens, caps.maxOutputTokens);
    }
    if (quality) settings.temperature = snapshot.qualityTemperature;
    if (task && caps.reasoning) settings.useThinking = options?.reasoningEnabled !== false;
    if (caps.reasoningAlwaysOn) settings.useThinking = true;
    settings.useWebSearch = resolveWebSearch(source.useWebSearch, caps.webSearch, options, quality);
    return settings;
  };
  try {
    return await call(snapshot.provider, select(snapshot.provider, snapshot.settings), prompt, quality, snapshot.retries, trace);
  } catch (error) {
    if (!(error instanceof ProviderError) || !error.retryable || !snapshot.fallbackProvider || !snapshot.fallbackSettings) throw error;
    logger.warn("process.ai.provider.fallback", { ...trace, processStatus: "running", meta: { fromProvider: snapshot.provider, toProvider: snapshot.fallbackProvider } });
    return call(snapshot.fallbackProvider, select(snapshot.fallbackProvider, snapshot.fallbackSettings), prompt, quality, snapshot.retries, trace);
  }
}

export async function getSummary(text: string, options: ProcessingOptions): Promise<ProcessingResult> {
  if (!text?.trim() || !options) throw new Error("Text and processing options are required");
  const systemMessage = await buildSystemMessage(options);
  const summary = await execute(`${systemMessage}\n\n${text}`, options, false, options);
  return { summary: preserveLineSeparatorTrim(summary), systemMessage: preserveLineSeparatorTrim(systemMessage) };
}

export async function getQualityScore(evaluationPrompt: string, trace?: { requestId?: string; processId?: string }): Promise<string> {
  if (!evaluationPrompt.trim()) throw new Error("Evaluation prompt is required");
  const response = await execute(evaluationPrompt, undefined, true, trace);
  const valid = (text: string): boolean => {
    try {
      const report = JSON.parse(text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, ""));
      const score = (value: unknown) => typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= 10;
      return score(report.overall) && ["fidelity", "priorityOrder", "plainLanguage", "taskFit", "audienceFit", "intentFit"].every(key => score(report.subscores?.[key])) && Array.isArray(report.failures) && report.failures.every((item: any) => [item.sectionKey, item.dimension, item.reason].every(value => typeof value === "string"));
    } catch { return false; }
  };
  if (valid(response)) return response;
  const repaired = await execute(`Evaluate again and return only a complete JSON report with integer scores 1-10. The previous output was not valid.\n\n${evaluationPrompt}`, undefined, true, trace);
  if (!valid(repaired)) throw new ProviderError("AI model did not return a valid quality report after one repair attempt.");
  return repaired;
}

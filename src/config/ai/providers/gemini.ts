/**
 * Gemini AI Service Module
 * Handles communication with Google's Gemini API for text processing
 */

import {
  GoogleGenerativeAI,
  GenerativeModel,
  GenerateContentResult,
  SchemaType,
  type ResponseSchema,
} from "@google/generative-ai";
import { AI_PROVIDERS, getProviderConfig } from "../ai-config.js";
import { createRateLimiter } from "../../../utils/rate-limiter.js";
import { createCircuitBreaker } from "../../../utils/circuit-breaker.js";
import { assert } from "../../../utils/safety-utils.js";
import { logger } from "../../../utils/logger.js";
import configService from "../../../services/config/config-service.js";
import { listOrdlistaEntries } from "../../../services/ordlista/ordlista-service.js";
import { config as appConfig } from "../../app-config.js";
import type {
  ProcessingOptions,
  ProcessingResult,
  ErrorHandlingResult,
} from "../ai-service-types.js";
import { preserveLineSeparatorTrim } from "../text-normalization.js";

// Extend the GenerateContentResult type to include promptFeedback
interface ExtendedGenerateContentResult extends GenerateContentResult {
  promptFeedback?: {
    blockReason?: string;
  };
}

// Base provider configuration (static limits)
const config = getProviderConfig(AI_PROVIDERS.GEMINI_2_5_FLASH);

// Replace the constants with config values
const MAX_INPUT_TOKENS = config.MAX_INPUT_TOKENS;
const RETRY_DELAY = config.RETRY_DELAY;
const RPM_LIMIT = config.RPM_LIMIT;
const DEFAULT_THINKING_BUDGET = config.THINKING_BUDGET;
const DEFAULT_USE_GOOGLE_SEARCH_GROUNDING = config.USE_GOOGLE_SEARCH_GROUNDING;
const DEFAULT_QUALITY_EVALUATION_TEMPERATURE = 0.3;

const QUALITY_EVALUATION_RESPONSE_SCHEMA: ResponseSchema = {
  type: SchemaType.OBJECT,
  properties: {
    overall: { type: SchemaType.INTEGER },
    subscores: {
      type: SchemaType.OBJECT,
      properties: {
        fidelity: { type: SchemaType.INTEGER },
        priorityOrder: { type: SchemaType.INTEGER },
        plainLanguage: { type: SchemaType.INTEGER },
        taskFit: { type: SchemaType.INTEGER },
        audienceFit: { type: SchemaType.INTEGER },
        intentFit: { type: SchemaType.INTEGER },
      },
      required: [
        "fidelity",
        "priorityOrder",
        "plainLanguage",
        "taskFit",
        "audienceFit",
        "intentFit",
      ],
    },
    failures: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          sectionKey: { type: SchemaType.STRING },
          dimension: { type: SchemaType.STRING },
          reason: { type: SchemaType.STRING },
        },
        required: ["sectionKey", "dimension", "reason"],
      },
    },
  },
  required: ["overall", "subscores", "failures"],
};

function normalizeTemperature(value: unknown, fallback: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return fallback;
  }

  const clamped = Math.min(1, Math.max(0, value));
  return Number(clamped.toFixed(2));
}

async function resolveQualityEvaluationTemperature(): Promise<number> {
  try {
    const runtimeSettings = await configService.getRuntimeSettings();
    const qualitySettings = runtimeSettings.quality as
      | Record<string, unknown>
      | undefined;
    return normalizeTemperature(
      qualitySettings?.temperature,
      DEFAULT_QUALITY_EVALUATION_TEMPERATURE,
    );
  } catch {
    return DEFAULT_QUALITY_EVALUATION_TEMPERATURE;
  }
}

async function resolveGeminiApiKeys(): Promise<{
  primary: string;
  quality: string;
  usesSeparate: boolean;
}> {
  let primary = process.env.GEMINI_API_KEY || "";
  let quality = process.env.GEMINI_QE_API_KEY || primary;

  try {
    const storedPrimary = await configService.getSecret("GEMINI_API_KEY");
    if (storedPrimary) {
      primary = storedPrimary;
    }
  } catch (error) {
    logger.warn("provider.gemini.secret_load_failed", {
      processStatus: "running",
      meta: { secret: "GEMINI_API_KEY" },
    });
  }

  try {
    const storedQuality = await configService.getSecret("GEMINI_QE_API_KEY");
    if (storedQuality) {
      quality = storedQuality;
    }
  } catch (error) {
    logger.warn("provider.gemini.secret_load_failed", {
      processStatus: "running",
      meta: { secret: "GEMINI_QE_API_KEY" },
    });
  }

  return {
    primary,
    quality,
    usesSeparate: Boolean(quality && primary && quality !== primary),
  };
}

const rateLimiterCache = new Map<
  number,
  ReturnType<typeof createRateLimiter>
>();
const providerCircuitBreaker = createCircuitBreaker({
  failureThreshold:
    appConfig.resilience.providerCircuitBreaker.failureThreshold,
  cooldownMs: appConfig.resilience.providerCircuitBreaker.cooldownMs,
});

async function getGeminiClients(): Promise<{
  genAI: GoogleGenerativeAI;
  genAIQualityEval: GoogleGenerativeAI;
  usesSeparateQeKey: boolean;
}> {
  const keys = await resolveGeminiApiKeys();
  return {
    genAI: new GoogleGenerativeAI(keys.primary),
    genAIQualityEval: new GoogleGenerativeAI(keys.quality),
    usesSeparateQeKey: keys.usesSeparate,
  };
}

async function resolveRetryLimit(): Promise<number> {
  try {
    const runtimeSettings = await configService.getRuntimeSettings();
    const runtimeRetry = runtimeSettings.retry as
      | Record<string, unknown>
      | undefined;
    const runtimeProviderMaxRetries = runtimeRetry?.providerMaxRetries;
    if (
      typeof runtimeProviderMaxRetries === "number" &&
      Number.isFinite(runtimeProviderMaxRetries)
    ) {
      const normalized = Math.trunc(runtimeProviderMaxRetries);
      if (normalized >= 0 && normalized <= 20) {
        return normalized;
      }
    }

    const retryCount = await configService.getRetryCount();
    if (Number.isInteger(retryCount) && retryCount >= 0) {
      return retryCount;
    }
  } catch (error) {
    logger.warn("provider.gemini.retry_config_failed", {
      processStatus: "running",
      meta: { reason: error instanceof Error ? error.message : "unknown" },
    });
  }

  return config.MAX_RETRIES;
}

function shouldCountCircuitBreakerFailure(error: Error): boolean {
  const message = error.message.toLowerCase();
  const transientIndicators = [
    "rate limit",
    "quota",
    "timeout",
    "timed out",
    "network",
    "connection",
    "unavailable",
    "overloaded",
    "502",
    "503",
    "504",
    "429",
    "resource exhausted",
  ];

  return transientIndicators.some((indicator) => message.includes(indicator));
}

function getRateLimiter(
  rpmLimit: number,
): ReturnType<typeof createRateLimiter> {
  const existing = rateLimiterCache.get(rpmLimit);
  if (existing) {
    return existing;
  }

  const created = createRateLimiter(rpmLimit, {
    scope: `provider.gemini.rpm.${rpmLimit}`,
  });
  rateLimiterCache.set(rpmLimit, created);
  return created;
}

async function resolveRpmLimit(): Promise<number> {
  const runtimeSettings = await configService.getRuntimeSettings();
  const providerRpm = runtimeSettings.providerRpm as
    | Record<string, unknown>
    | undefined;
  const runtimeGemini = providerRpm?.gemini;
  if (typeof runtimeGemini === "number" && Number.isFinite(runtimeGemini)) {
    const normalized = Math.trunc(runtimeGemini);
    if (normalized >= 1 && normalized <= 10000) {
      return normalized;
    }
  }

  return RPM_LIMIT;
}

function throwIfCircuitOpen(): void {
  if (providerCircuitBreaker.allowRequest()) {
    return;
  }

  const snapshot = providerCircuitBreaker.getSnapshot();
  logger.warn("provider.gemini.circuit_open", {
    processStatus: "running",
    meta: { retryAt: snapshot.retryAt, state: snapshot.state },
  });

  throw new Error(
    "Gemini-providern är tillfälligt upptagen på grund av upprepade fel. Försök igen om en stund.",
  );
}

/**
 * Constructs the system message for Gemini API
 * @param options - Configuration options
 * @returns Formatted system message
 * @private
 */
async function getSystemMessage({
  taskKey,
  taskPromptMode,
  senderIntent,
  senderIntentSummary,
  audiencePriorityMode,
  textType,
  rewriteBlueprint,
  taskShapingMode,
  targetAudience,
  checkboxContent,
  rewritePlanDraft,
  applyTaskPromptInRewriteStage,
}: ProcessingOptions): Promise<string> {
  assert(
    targetAudience !== undefined && targetAudience !== null,
    "Target audience is required",
  );
  assert(
    checkboxContent !== undefined && checkboxContent !== null,
    "Checkbox content is required",
  );

  const rolePrompt = await configService.getPrompt("role");
  const senderIntentPrompt =
    typeof senderIntent === "string" && senderIntent.trim().length > 0
      ? senderIntent
      : await configService.getPrompt("senderIntent");
  const targetPrompt = await configService.getPrompt("targetAudience", {
    targetAudience,
  });
  const rulesPrompt = await configService.getPrompt("importantRules");
  const ordlistaUsagePrompt = await buildOrdlistaUsagePrompt();
  const taskPrompt = await configService.getPrompt("task", {
    taskKey: typeof taskKey === "string" ? taskKey : undefined,
    taskPromptMode,
  });

  let message = rolePrompt;
  message += "\n\n";
  // message += "\n\n";
  if (senderIntentSummary && senderIntentSummary.trim().length > 0) {
    message += `AVSÄNDARENS PRIORITERING: ${senderIntentSummary.trim()}`;
    message += "\n\n";
  }

  if (audiencePriorityMode) {
    if (audiencePriorityMode === "generic") {
      message +=
        "PRIORITERINGSSTRATEGI: Generic audience. Start with core message and most important facts first.";
    } else {
      message +=
        "PRIORITERINGSSTRATEGI: Specific audience. Prioritize what matters most for the named target group first.";
    }
    message += "\n\n";
  }

  if (textType && textType.trim().length > 0) {
    message += `TEXTTYP: ${textType.trim()}`;
    message += "\n\n";
  }

  if (
    taskShapingMode !== "task-shaping" &&
    rewriteBlueprint &&
    rewriteBlueprint.trim().length > 0
  ) {
    message += rewriteBlueprint;
    message += "\n\n";
  }

  message += senderIntentPrompt;
  message += "\n\n";
  message += targetPrompt;
  message += "\n\n";
  message += rulesPrompt;
  if (ordlistaUsagePrompt) {
    message += "\n\n";
    message += ordlistaUsagePrompt;
  }
  message += "\n\n";
  if (
    taskShapingMode !== "task-shaping" &&
    rewritePlanDraft &&
    rewritePlanDraft.trim().length > 0
  ) {
    message += "Omskrivningsutkast att FÖLJA (prioriterad ordning):\n";
    message += rewritePlanDraft.trim();
    message += "\n\n";
  }

  if (taskShapingMode === "rewrite" && !applyTaskPromptInRewriteStage) {
    const rewriteFallbackPrompt =
      await configService.getPrompt("rewriteFallback");
    message += rewriteFallbackPrompt;
  } else {
    message += taskPrompt;
  }

  // Add the text introduction line
  message += "\n\n";
  message +=
    "Ge mig ENDAST den slutgiltiga versionen av den bearbetade texten UTAN dina kommentarer. Här är texten som ska skrivas om:";

  return message;
}

async function buildOrdlistaUsagePrompt(): Promise<string> {
  const entries = await listOrdlistaEntries();
  if (entries.length === 0) {
    return "";
  }

  const listLines = entries
    .filter((entry) => entry.fromWord && entry.toWord)
    .map((entry) => `- från: "${entry.fromWord}" -> till: "${entry.toWord}"`)
    .join("\n");

  if (!listLines) {
    return "";
  }

  const promptTemplate = await configService.getPrompt("wordListUsage");
  if (promptTemplate.includes("{{wordList}}")) {
    return promptTemplate.replace("{{wordList}}", listLines);
  }

  return `${promptTemplate}\n${listLines}`;
}

/**
 * Token estimation (roughly 4 characters per token)
 * @param text - Text to estimate tokens for
 * @returns Estimated token count
 */
const estimateTokens = (text: string): number => {
  assert(typeof text === "string", "Text must be a string");
  return Math.ceil(text.length / 4);
};

/**
 * Validates input text length against token limits
 * @param text - Input text to validate
 * @param systemMessage - System message to include in token count
 * @throws Error if text is too long
 * @private
 */
function validateInputLength(text: string, systemMessage: string): string {
  assert(typeof text === "string", "Text must be a string");
  assert(typeof systemMessage === "string", "System message must be a string");

  const prompt = `${systemMessage}\n\n${text}`;

  // Log text lengths
  console.log(
    `[Gemini] System message length: ${systemMessage.length} characters`,
  );
  console.log(`[Gemini] Input text length: ${text.length} characters`);
  console.log(`[Gemini] Total prompt length: ${prompt.length} characters`);

  // Check for token limits
  const estimatedTokens = estimateTokens(prompt);
  console.log(`[Gemini] Estimated tokens: ${estimatedTokens}`);

  if (estimatedTokens > MAX_INPUT_TOKENS) {
    throw new Error(
      `Input text is too long (estimated ${estimatedTokens} tokens). Maximum allowed is ${MAX_INPUT_TOKENS} tokens.`,
    );
  }

  return prompt;
}

/**
 * Interface for Gemini generation configuration
 */
interface GeminiGenerationConfig {
  temperature: number;
  topK: number;
  topP: number;
  maxOutputTokens: number;
  responseMimeType?: string;
  responseSchema?: ResponseSchema;
  thinkingConfig?: {
    thinkingBudget: number;
  };
}

/**
 * Initializes and configures the Gemini model
 * @returns Configured Gemini model
 * @private
 */
async function initializeModel(): Promise<GenerativeModel> {
  const providerConfig = await configService.getProviderConfig("gemini");
  const { genAI, usesSeparateQeKey } = await getGeminiClients();
  const useThinking =
    providerConfig.useThinking ??
    (DEFAULT_THINKING_BUDGET !== undefined && DEFAULT_THINKING_BUDGET !== 0);
  const useWebSearch =
    providerConfig.useWebSearch ?? Boolean(DEFAULT_USE_GOOGLE_SEARCH_GROUNDING);
  const thinkingBudget = useThinking
    ? (DEFAULT_THINKING_BUDGET ?? -1)
    : undefined;

  logger.debug("provider.gemini.initialized", {
    processStatus: "running",
    meta: {
      qualityKeyMode: usesSeparateQeKey ? "separate" : "same",
      model: providerConfig.model,
      thinkingBudget,
      searchGrounding: useWebSearch,
    },
  });

  const generationConfig: GeminiGenerationConfig = {
    temperature: providerConfig.temperature,
    topK: 40,
    topP: 0.95,
    maxOutputTokens: providerConfig.maxOutputTokens,
  };

  // Add thinking configuration if THINKING_BUDGET is defined
  if (thinkingBudget !== undefined) {
    generationConfig.thinkingConfig = {
      thinkingBudget,
    };
    console.log(
      `[Gemini] Adding thinking budget to model config: ${thinkingBudget}`,
    );
  }

  // Configure model options - let TypeScript infer the type from SDK
  const modelConfig = {
    model: providerConfig.model,
    generationConfig,
  };

  // Add Google Search grounding tool if enabled
  if (useWebSearch) {
    // Using any here as the Tool type from SDK is complex and changes between versions
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (modelConfig as any).tools = [{ googleSearch: {} }];
    console.log(
      `[Gemini] Adding Google Search grounding tool to model configuration`,
    );
  }

  return genAI.getGenerativeModel(modelConfig);
}

/**
 * Initializes and configures the Gemini model for quality evaluation
 * @returns Configured Gemini model for quality evaluation
 * @private
 */
async function initializeQualityEvaluationModel(): Promise<GenerativeModel> {
  const providerConfig = await configService.getProviderConfig("gemini");
  const qualityTemperature = await resolveQualityEvaluationTemperature();
  const { genAIQualityEval } = await getGeminiClients();
  const useThinking =
    providerConfig.useThinking ??
    (DEFAULT_THINKING_BUDGET !== undefined && DEFAULT_THINKING_BUDGET !== 0);
  const thinkingBudget = useThinking
    ? (DEFAULT_THINKING_BUDGET ?? -1)
    : undefined;

  const generationConfig: GeminiGenerationConfig = {
    temperature: qualityTemperature,
    topK: 40,
    topP: 0.95,
    maxOutputTokens: providerConfig.maxOutputTokens,
    responseMimeType: "application/json",
    responseSchema: QUALITY_EVALUATION_RESPONSE_SCHEMA,
  };

  // Add thinking configuration if THINKING_BUDGET is defined
  if (thinkingBudget !== undefined) {
    generationConfig.thinkingConfig = {
      thinkingBudget,
    };
    console.log(
      `[Gemini] Adding thinking budget to quality evaluation model config: ${thinkingBudget}`,
    );
  }

  return genAIQualityEval.getGenerativeModel({
    model: providerConfig.model,
    generationConfig,
  });
}

/**
 * Makes the actual API call to Gemini
 * @param prompt - Full prompt to send to API
 * @returns API response
 * @throws Error if API call fails
 * @private
 */
async function makeApiCall(
  prompt: string,
): Promise<ExtendedGenerateContentResult> {
  assert(typeof prompt === "string", "Prompt must be a string");

  // Initialize model with configuration
  const model = await initializeModel();

  // Generate content with structured format
  const result = (await model.generateContent({
    contents: [{ role: "user", parts: [{ text: prompt }] }],
  })) as ExtendedGenerateContentResult;

  // Check if generation was blocked
  if (result.promptFeedback?.blockReason) {
    throw new Error(
      `Content generation was blocked: ${result.promptFeedback.blockReason}`,
    );
  }

  return result;
}

/**
 * Handles errors from the Gemini API call
 * @param error - The error that occurred
 * @param retryCount - Current retry attempt
 * @returns Error handling result with retry information
 * @private
 */
function handleApiError(
  error: Error,
  retryCount: number,
  maxRetries: number,
): ErrorHandlingResult {
  logger.error("process.failed", {
    processStatus: "failed",
    meta: { reason: "gemini_api_error", error: error.message },
  });

  // Handle specific error cases
  if (error.message.includes("Input text is too long")) {
    return {
      shouldRetry: false,
      error: new Error(
        "Texten är för lång. Försök dela upp den i mindre delar.",
      ),
    };
  }

  if (
    (error.message.includes("Rate limit") ||
      error.message.includes("Resource exhausted")) &&
    retryCount < maxRetries
  ) {
    logger.warn("process.ai.retrying", {
      processStatus: "running",
      meta: { delaySeconds: RETRY_DELAY / 1000 },
    });
    return { shouldRetry: true };
  }

  if (error.message.includes("Invalid API key")) {
    return {
      shouldRetry: false,
      error: new Error(
        "Authentication failed. Please check your API key configuration.",
      ),
    };
  }

  // Handle safety blocks
  if (error.message.includes("blocked")) {
    return {
      shouldRetry: false,
      error: new Error(
        "Innehållet kunde inte genereras på grund av säkerhetsbegränsningar.",
      ),
    };
  }

  if (error.message.includes("request cancelled")) {
    return {
      shouldRetry: false,
      error: new Error("Bearbetningen avbröts."),
    };
  }

  return {
    shouldRetry: false,
    error: new Error(
      "Ett fel uppstod vid bearbetning av din förfrågan. Försök igen senare.",
    ),
  };
}

/**
 * Makes API call to Gemini with retry mechanism
 * @param text - Input text to process
 * @param options - Processing options
 * @param retryCount - Current retry attempt
 * @returns Processed text and system message
 * @throws Error if API call fails
 * @private
 */
async function callGemini(
  text: string,
  options: ProcessingOptions,
  retryCount: number = 0,
  maxRetries?: number,
): Promise<ProcessingResult> {
  try {
    throwIfCircuitOpen();

    // Check rate limit before making the request
    const rpmLimit = await resolveRpmLimit();
    await getRateLimiter(rpmLimit).checkLimit();

    // Generate system message
    const systemMessage = await getSystemMessage(options);

    // Validate input length and get full prompt
    const prompt = validateInputLength(text, systemMessage);

    // Make API call
    const result = await makeApiCall(prompt);
    const response = result.response;

    providerCircuitBreaker.recordSuccess();

    return {
      summary: preserveLineSeparatorTrim(response.text()),
      systemMessage: preserveLineSeparatorTrim(systemMessage),
    };
  } catch (error) {
    if (!(error instanceof Error)) {
      throw new Error(`Unknown error: ${String(error)}`);
    }

    if (shouldCountCircuitBreakerFailure(error)) {
      providerCircuitBreaker.recordFailure();
    }

    const retryLimit =
      typeof maxRetries === "number" ? maxRetries : await resolveRetryLimit();

    const { shouldRetry, error: handledError } = handleApiError(
      error,
      retryCount,
      retryLimit,
    );

    if (shouldRetry) {
      // Wait before retrying
      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY));
      return callGemini(text, options, retryCount + 1, retryLimit);
    }

    if (handledError) {
      throw handledError;
    }

    throw error;
  }
}

/**
 * Gets a summary of the provided text
 * @param text - Text to summarize
 * @param options - Processing options
 * @returns Summary of the text and the system message used
 */
export const getSummary = async (
  text: string,
  options: ProcessingOptions,
): Promise<{ summary: string; systemMessage: string }> => {
  assert(typeof text === "string", "Text must be a string");
  assert(text.trim().length > 0, "Text cannot be empty");
  assert(options !== undefined && options !== null, "Options are required");

  try {
    const startTime = Date.now();

    // Create a copy of options with normalized checkboxContent
    const normalizedOptions = {
      ...options,
      checkboxContent: Array.isArray(options.checkboxContent)
        ? options.checkboxContent.join(" ")
        : options.checkboxContent,
    };

    const result = await callGemini(text, normalizedOptions);
    logger.info("process.ai.responded", {
      requestId: options.requestId,
      processId: options.processId || options.requestId,
      processStatus: "running",
      meta: {
        provider: "gemini",
        latencyMs: Date.now() - startTime,
        status: "success",
      },
    });

    return {
      summary: result.summary,
      systemMessage: result.systemMessage,
    };
  } catch (error) {
    logger.error("process.failed", {
      requestId: options.requestId,
      processId: options.processId || options.requestId,
      processStatus: "failed",
      meta: {
        provider: "gemini",
        reason: "summary_provider_error",
        error: error instanceof Error ? error.message : "Unknown error",
      },
    });
    throw error instanceof Error
      ? error
      : new Error(`Unknown error: ${String(error)}`);
  }
};

/**
 * Makes a quality evaluation API call to Gemini
 * @param prompt - Full quality evaluation prompt to send to API
 * @returns Quality score as a string
 * @throws Error if API call fails
 * @private
 */
async function makeQualityEvaluationCall(prompt: string): Promise<string> {
  assert(typeof prompt === "string", "Prompt must be a string");

  // Initialize quality evaluation model with configuration
  const model = await initializeQualityEvaluationModel();

  // Generate content with structured format
  const result = (await model.generateContent({
    contents: [{ role: "user", parts: [{ text: prompt }] }],
  })) as ExtendedGenerateContentResult;

  // Check if generation was blocked
  if (result.promptFeedback?.blockReason) {
    throw new Error(
      `Content generation was blocked: ${result.promptFeedback.blockReason}`,
    );
  }

  return preserveLineSeparatorTrim(result.response.text());
}

/**
 * Evaluates the quality of processed text using AI
 * @param evaluationPrompt - The complete evaluation prompt with original text, processed text, and prompt
 * @param retryCount - Current retry attempt
 * @returns Promise resolving to the quality score as a string
 * @throws Error if API call fails
 */
async function evaluateQuality(
  evaluationPrompt: string,
  retryCount: number = 0,
  maxRetries?: number,
): Promise<string> {
  try {
    throwIfCircuitOpen();

    // Check rate limit before making the request
    const rpmLimit = await resolveRpmLimit();
    await getRateLimiter(rpmLimit).checkLimit();

    console.log(
      "[Gemini] Using quality evaluation API key for text quality assessment",
    );

    // Validate input length
    if (estimateTokens(evaluationPrompt) > MAX_INPUT_TOKENS) {
      throw new Error(
        `Evaluation prompt is too long. Maximum allowed is ${MAX_INPUT_TOKENS} tokens.`,
      );
    }

    // Make API call
    const result = await makeQualityEvaluationCall(evaluationPrompt);

    console.log(`[Gemini] Quality evaluation result: ${result}`);

    const normalizedResult = preserveLineSeparatorTrim(result);
    if (!normalizedResult) {
      throw new Error("Empty quality evaluation response received");
    }

    providerCircuitBreaker.recordSuccess();

    return normalizedResult;
  } catch (error) {
    if (!(error instanceof Error)) {
      throw new Error(`Unknown error: ${String(error)}`);
    }

    if (shouldCountCircuitBreakerFailure(error)) {
      providerCircuitBreaker.recordFailure();
    }

    const retryLimit =
      typeof maxRetries === "number" ? maxRetries : await resolveRetryLimit();

    const { shouldRetry, error: handledError } = handleApiError(
      error,
      retryCount,
      retryLimit,
    );

    if (shouldRetry) {
      // Wait before retrying
      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY));
      return evaluateQuality(evaluationPrompt, retryCount + 1, retryLimit);
    }

    if (handledError) {
      throw handledError;
    }

    throw error;
  }
}

/**
 * Gets a quality score for processed text
 * @param evaluationPrompt - The complete evaluation prompt with original text, processed text, and prompt
 * @returns Promise resolving to the quality score as a string
 */
export const getQualityScore = async (
  evaluationPrompt: string,
  trace?: { requestId?: string; processId?: string },
): Promise<string> => {
  assert(
    typeof evaluationPrompt === "string",
    "Evaluation prompt must be a string",
  );

  try {
    const startTime = Date.now();
    const score = await evaluateQuality(evaluationPrompt);
    logger.info("process.quality.completed", {
      requestId: trace?.requestId,
      processId: trace?.processId,
      processStatus: "completed",
      meta: {
        provider: "gemini",
        qualityScore: Number(score),
        latencyMs: Date.now() - startTime,
      },
    });
    return score;
  } catch (error) {
    logger.error("process.failed", {
      requestId: trace?.requestId,
      processId: trace?.processId,
      processStatus: "failed",
      meta: {
        provider: "gemini",
        reason: "quality_provider_error",
        error: error instanceof Error ? error.message : "Unknown error",
      },
    });
    throw error;
  }
};

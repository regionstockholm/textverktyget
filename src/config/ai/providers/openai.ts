/**
 * OpenAI Integration Service Module
 * Handles communication with OpenAI API for text processing and summarization
 */

import { AI_PROVIDERS, getProviderConfig } from "../ai-config.js";
import { createRateLimiter } from "../../../utils/rate-limiter.js";
import { createCircuitBreaker } from "../../../utils/circuit-breaker.js";
import { assert } from "../../../utils/safety-utils.js";
import { logger } from "../../../utils/logger.js";
import configService from "../../../services/config/config-service.js";
import { listOrdlistaEntries } from "../../../services/ordlista/ordlista-service.js";
import { config as appConfig } from "../../app-config.js";
import { preserveLineSeparatorTrim } from "../text-normalization.js";

// Base provider configuration (static limits)
const config = getProviderConfig(AI_PROVIDERS.OPENAI);

// Replace the constants with config values
const MODEL = config.MODEL;
const MAX_INPUT_TOKENS = config.MAX_INPUT_TOKENS;
const MAX_OUTPUT_TOKENS = config.MAX_OUTPUT_TOKENS;
const RETRY_DELAY = config.RETRY_DELAY;
const RPM_LIMIT = config.RPM_LIMIT || 3500; // Default if not specified
const RESPONSES_ENDPOINT = "https://api.openai.com/v1/responses";
type OpenAIReasoningEffort = "none" | "low" | "medium" | "high" | "xhigh";
type OpenAITextVerbosity = "low" | "medium" | "high";
type OpenAISecretName = "OPENAI_API_KEY" | "OPENAI_QE_API_KEY";

const DEFAULT_REASONING_EFFORT: OpenAIReasoningEffort = "low";
const DEFAULT_QUALITY_REASONING_EFFORT: OpenAIReasoningEffort = "low";
const DEFAULT_TEXT_VERBOSITY: OpenAITextVerbosity = "medium";

const OPENAI_REASONING_EFFORT = resolveReasoningEffort(
  "OPENAI_REASONING_EFFORT",
  DEFAULT_REASONING_EFFORT,
);
const OPENAI_QUALITY_REASONING_EFFORT = resolveReasoningEffort(
  "OPENAI_QUALITY_REASONING_EFFORT",
  DEFAULT_QUALITY_REASONING_EFFORT,
);
const OPENAI_TEXT_VERBOSITY = resolveTextVerbosity();

function resolveReasoningEffort(
  envKey: string,
  fallback: OpenAIReasoningEffort,
): OpenAIReasoningEffort {
  const raw = process.env[envKey];
  if (!raw || raw.trim().length === 0) {
    return fallback;
  }

  const normalized = raw.trim().toLowerCase();
  if (
    normalized === "none" ||
    normalized === "low" ||
    normalized === "medium" ||
    normalized === "high" ||
    normalized === "xhigh"
  ) {
    return normalized;
  }

  logger.warn("provider.openai.reasoning_effort_invalid", {
    processStatus: "running",
    meta: { envKey, value: raw, fallback },
  });
  return fallback;
}

function resolveTextVerbosity(): OpenAITextVerbosity {
  const raw = process.env.OPENAI_TEXT_VERBOSITY;
  if (!raw || raw.trim().length === 0) {
    return DEFAULT_TEXT_VERBOSITY;
  }

  const normalized = raw.trim().toLowerCase();
  if (
    normalized === "low" ||
    normalized === "medium" ||
    normalized === "high"
  ) {
    return normalized;
  }

  logger.warn("provider.openai.text_verbosity_invalid", {
    processStatus: "running",
    meta: { value: raw, fallback: DEFAULT_TEXT_VERBOSITY },
  });
  return DEFAULT_TEXT_VERBOSITY;
}

function supportsReasoningParameters(): boolean {
  const normalizedModel = MODEL.toLowerCase();
  return (
    normalizedModel.startsWith("gpt-5") ||
    normalizedModel === "o1" ||
    normalizedModel === "o3" ||
    normalizedModel === "o4-mini" ||
    normalizedModel.startsWith("o1-") ||
    normalizedModel.startsWith("o3-") ||
    normalizedModel.startsWith("o4-")
  );
}

function supportsTextVerbosity(): boolean {
  return MODEL.toLowerCase().startsWith("gpt-5");
}

function buildReasoningPayload(
  effort: OpenAIReasoningEffort,
): { effort: OpenAIReasoningEffort } | undefined {
  if (!supportsReasoningParameters()) {
    return undefined;
  }

  return { effort };
}

logger.debug("provider.openai.initialized", {
  processStatus: "running",
  meta: {
    model: MODEL,
    reasoningEffort: OPENAI_REASONING_EFFORT,
    qualityReasoningEffort: OPENAI_QUALITY_REASONING_EFFORT,
  },
});

const rateLimiterCache = new Map<
  number,
  ReturnType<typeof createRateLimiter>
>();
const providerCircuitBreaker = createCircuitBreaker({
  failureThreshold:
    appConfig.resilience.providerCircuitBreaker.failureThreshold,
  cooldownMs: appConfig.resilience.providerCircuitBreaker.cooldownMs,
});

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
    logger.warn("provider.openai.retry_config_failed", {
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
    "api request failed: 5",
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
    scope: `provider.openai.rpm.${rpmLimit}`,
  });
  rateLimiterCache.set(rpmLimit, created);
  return created;
}

async function resolveRpmLimit(): Promise<number> {
  const runtimeSettings = await configService.getRuntimeSettings();
  const providerRpm = runtimeSettings.providerRpm as
    | Record<string, unknown>
    | undefined;
  const runtimeOpenAi = providerRpm?.openai;
  if (typeof runtimeOpenAi === "number" && Number.isFinite(runtimeOpenAi)) {
    const normalized = Math.trunc(runtimeOpenAi);
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
  logger.warn("provider.openai.circuit_open", {
    processStatus: "running",
    meta: { retryAt: snapshot.retryAt, state: snapshot.state },
  });

  throw new Error(
    "OpenAI-providern är tillfälligt upptagen på grund av upprepade fel. Försök igen om en liten stund.",
  );
}

/**
 * Options for text processing
 */
interface ProcessingOptions {
  taskKey?: string;
  taskPromptMode?: "rewritePlanDraft";
  paragraphCount?: number | string;
  senderIntent?: string;
  senderIntentSummary?: string;
  audiencePriorityMode?: "generic" | "specific";
  textType?: string;
  rewriteBlueprint?: string;
  taskShapingMode?: "rewrite" | "task-shaping";
  targetAudience: string;
  checkboxContent: string | string[];
  requestId?: string;
  processId?: string;
  rewritePlanDraft?: string;
  applyTaskPromptInRewriteStage?: boolean;
}

/**
 * Result of text processing
 */
interface ProcessingResult {
  summary: string;
  systemMessage: string;
}

/**
 * Error handling result
 */
interface ErrorHandlingResult {
  shouldRetry: boolean;
  error?: Error;
}

/**
 * OpenAI Responses API response
 */
interface OpenAIResponsesContent {
  type?: string;
  text?: string;
}

interface OpenAIResponsesOutputItem {
  type?: string;
  content?: OpenAIResponsesContent[];
}

interface OpenAIResponsesResponse {
  output_text?: string;
  output?: OpenAIResponsesOutputItem[];
  status?: string;
  incomplete_details?: {
    reason?: string;
  };
  usage?: {
    total_tokens?: number;
    input_tokens?: number;
    output_tokens?: number;
    output_tokens_details?: {
      reasoning_tokens?: number;
    };
  };
}

function extractResponseText(result: OpenAIResponsesResponse): string {
  if (typeof result.output_text === "string" && result.output_text.length > 0) {
    return result.output_text;
  }

  const parts: string[] = [];
  for (const item of result.output ?? []) {
    if (!Array.isArray(item.content)) {
      continue;
    }

    for (const content of item.content) {
      if (
        (content.type === "output_text" || content.type === "text") &&
        typeof content.text === "string"
      ) {
        parts.push(content.text);
      }
    }
  }

  return parts.join("");
}

function assertOpenAIResponseComplete(result: OpenAIResponsesResponse): void {
  if (result.status !== "incomplete") {
    return;
  }

  const reason = result.incomplete_details?.reason || "unknown";
  throw new Error(`OpenAI response was incomplete: ${reason}`);
}

/**
 * Constructs the system message for OpenAI API
 * @param options - Configuration options
 * @returns Formatted system message
 * @private
 */
async function resolveOpenAiApiKey(
  secretName: OpenAISecretName = "OPENAI_API_KEY",
): Promise<string> {
  let apiKey = process.env[secretName] || "";

  try {
    const storedKey = await configService.getSecret(secretName);
    if (storedKey) {
      apiKey = storedKey;
    }
  } catch (error) {
    logger.warn("provider.openai.secret_load_failed", {
      processStatus: "running",
      meta: { secret: secretName },
    });
  }

  if (!apiKey && secretName !== "OPENAI_API_KEY") {
    return resolveOpenAiApiKey("OPENAI_API_KEY");
  }

  return apiKey;
}

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
    `[OpenAI] System message length: ${systemMessage.length} characters`,
  );
  console.log(`[OpenAI] Input text length: ${text.length} characters`);
  console.log(`[OpenAI] Total prompt length: ${prompt.length} characters`);

  // Check for token limits
  const estimatedTokens = estimateTokens(prompt);
  console.log(`[OpenAI] Estimated tokens: ${estimatedTokens}`);

  if (estimatedTokens > MAX_INPUT_TOKENS) {
    throw new Error(
      `Input text is too long (estimated ${estimatedTokens} tokens). Maximum allowed is ${MAX_INPUT_TOKENS} tokens.`,
    );
  }

  return prompt;
}

/**
 * Makes the actual API call to OpenAI
 * @param systemMessage - System message to send
 * @param text - User text to process
 * @returns API response
 * @throws Error if API call fails
 * @private
 */
async function makeApiCall(
  systemMessage: string,
  text: string,
): Promise<OpenAIResponsesResponse> {
  assert(typeof systemMessage === "string", "System message must be a string");
  assert(typeof text === "string", "Text must be a string");

  // Calculate available tokens for the response
  const estimatedPromptTokens = estimateTokens(systemMessage + "\n\n" + text);
  const maxResponseTokens = Math.min(
    MAX_OUTPUT_TOKENS,
    MAX_INPUT_TOKENS - estimatedPromptTokens,
  );

  const apiKey = await resolveOpenAiApiKey();
  const payload: Record<string, unknown> = {
    model: MODEL,
    instructions: systemMessage,
    input: text,
    max_output_tokens: maxResponseTokens,
    store: false,
  };
  const reasoning = buildReasoningPayload(OPENAI_REASONING_EFFORT);
  if (reasoning) {
    payload.reasoning = reasoning;
  }
  if (supportsTextVerbosity()) {
    payload.text = { verbosity: OPENAI_TEXT_VERBOSITY };
  }

  const response = await fetch(RESPONSES_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `API request failed: ${response.status} ${response.statusText}\nError: ${errorText}`,
    );
  }

  const result = (await response.json()) as OpenAIResponsesResponse;
  assertOpenAIResponseComplete(result);
  return result;
}

/**
 * Handles errors from the OpenAI API call
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
    meta: { reason: "openai_api_error", error: error.message },
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
    (error.message.includes("429") ||
      error.message.includes("Rate limit") ||
      error.message.includes("exceeded your current quota")) &&
    retryCount < maxRetries
  ) {
    logger.warn("process.ai.retrying", {
      processStatus: "running",
      meta: { delaySeconds: RETRY_DELAY / 1000 },
    });
    return { shouldRetry: true };
  }

  if (
    error.message.includes("401") ||
    error.message.includes("Invalid API key")
  ) {
    return {
      shouldRetry: false,
      error: new Error(
        "Authentication failed. Please check your API key configuration.",
      ),
    };
  }

  // Handle content policy violations
  if (
    error.message.includes("content policy") ||
    error.message.includes("content filter")
  ) {
    return {
      shouldRetry: false,
      error: new Error(
        "Innehållet kunde inte genereras på grund av säkerhetsbegränsningar.",
      ),
    };
  }

  if (error.message.includes("Request cancelled by user")) {
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
 * Makes API call to OpenAI with retry mechanism
 * @param text - Input text to process
 * @param options - Processing options
 * @param retryCount - Current retry attempt
 * @returns Processed text and system message
 * @throws Error if API call fails
 * @private
 */
async function callOpenAI(
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

    // Validate input length
    validateInputLength(text, systemMessage);

    // Make API call
    const response = await makeApiCall(systemMessage, text);

    // Extract and return the summary
    const summary = extractResponseText(response);

    providerCircuitBreaker.recordSuccess();

    return {
      summary: preserveLineSeparatorTrim(summary),
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
      return callOpenAI(text, options, retryCount + 1, retryLimit);
    }

    throw handledError || error;
  }
}

/**
 * Processes text using OpenAI API
 * @param text - Input text to process
 * @param options - Processing options
 * @returns Processed text
 * @throws Error if processing fails
 */
export const getSummary = async (
  text: string,
  options: ProcessingOptions,
): Promise<ProcessingResult> => {
  assert(typeof text === "string", "Text must be a string");
  assert(text.trim().length > 0, "Text cannot be empty");
  assert(options !== undefined && options !== null, "Options are required");

  try {
    const startTime = Date.now();
    const { summary, systemMessage } = await callOpenAI(text, options);
    logger.info("process.ai.responded", {
      requestId: options.requestId,
      processId: options.processId || options.requestId,
      processStatus: "running",
      meta: {
        provider: "openai",
        status: "success",
        latencyMs: Date.now() - startTime,
      },
    });
    return {
      summary: preserveLineSeparatorTrim(summary),
      systemMessage: preserveLineSeparatorTrim(systemMessage),
    };
  } catch (error) {
    logger.error("process.failed", {
      requestId: options.requestId,
      processId: options.processId || options.requestId,
      processStatus: "failed",
      meta: {
        provider: "openai",
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
 * Makes a quality evaluation API call to OpenAI
 * @param evaluationPrompt - Full quality evaluation prompt to send to API
 * @returns Quality score as a string
 * @throws Error if API call fails
 * @private
 */
async function makeQualityEvaluationCall(
  evaluationPrompt: string,
): Promise<string> {
  assert(
    typeof evaluationPrompt === "string",
    "Evaluation prompt must be a string",
  );

  // Calculate available tokens for the response
  const estimatedPromptTokens = estimateTokens(evaluationPrompt);
  const maxResponseTokens = Math.min(
    MAX_OUTPUT_TOKENS,
    MAX_INPUT_TOKENS - estimatedPromptTokens,
  );

  const apiKey = await resolveOpenAiApiKey("OPENAI_QE_API_KEY");
  const basePayload: Record<string, unknown> = {
    model: MODEL,
    instructions:
      "You are a strict text quality evaluator. Follow the user instruction and return valid JSON only.",
    input: evaluationPrompt,
    max_output_tokens: maxResponseTokens,
    store: false,
  };
  const reasoning = buildReasoningPayload(OPENAI_QUALITY_REASONING_EFFORT);
  if (reasoning) {
    basePayload.reasoning = reasoning;
  }

  const requestWithFormat = async (
    textFormat: Record<string, unknown>,
  ): Promise<Response> => {
    return fetch(RESPONSES_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        ...basePayload,
        text: { format: textFormat },
      }),
    });
  };

  const jsonSchemaFormat = {
    type: "json_schema",
    name: "quality_evaluation",
    strict: true,
    schema: {
      type: "object",
      additionalProperties: false,
      properties: {
        overall: { type: "integer" },
        subscores: {
          type: "object",
          additionalProperties: false,
          properties: {
            fidelity: { type: "integer" },
            priorityOrder: { type: "integer" },
            plainLanguage: { type: "integer" },
            taskFit: { type: "integer" },
            audienceFit: { type: "integer" },
            intentFit: { type: "integer" },
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
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            properties: {
              sectionKey: { type: "string" },
              dimension: { type: "string" },
              reason: { type: "string" },
            },
            required: ["sectionKey", "dimension", "reason"],
          },
        },
      },
      required: ["overall", "subscores", "failures"],
    },
  };

  let response = await requestWithFormat(jsonSchemaFormat);
  if (!response.ok) {
    const errorText = await response.text();
    const lowerError = errorText.toLowerCase();
    const canFallbackToJsonObject =
      response.status === 400 &&
      (lowerError.includes("response_format") ||
        lowerError.includes("json_schema") ||
        lowerError.includes("not supported"));

    if (!canFallbackToJsonObject) {
      throw new Error(
        `API request failed: ${response.status} ${response.statusText}\nError: ${errorText}`,
      );
    }

    logger.warn("provider.openai.quality.schema_format_not_supported", {
      processStatus: "running",
      meta: { status: response.status },
    });

    response = await requestWithFormat({ type: "json_object" });
    if (!response.ok) {
      const fallbackErrorText = await response.text();
      throw new Error(
        `API request failed: ${response.status} ${response.statusText}\nError: ${fallbackErrorText}`,
      );
    }
  }

  const result = (await response.json()) as OpenAIResponsesResponse;
  assertOpenAIResponseComplete(result);
  return extractResponseText(result);
}

/**
 * Evaluates the quality of processed text using OpenAI
 * @param evaluationPrompt - The complete evaluation prompt with original text, processed text, and prompt
 * @param retryCount - Current retry attempt
 * @returns Promise resolving to the quality score as a string
 * @throws Error if API call fails
 * @private
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

    // Validate input length
    if (estimateTokens(evaluationPrompt) > MAX_INPUT_TOKENS) {
      throw new Error(
        `Evaluation prompt is too long. Maximum allowed is ${MAX_INPUT_TOKENS} tokens.`,
      );
    }

    // Make API call
    const result = await makeQualityEvaluationCall(evaluationPrompt);

    console.log(`[OpenAI] Quality evaluation result: ${result}`);

    const normalizedResult = result.trim();
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
        provider: "openai",
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
        provider: "openai",
        reason: "quality_provider_error",
        error: error instanceof Error ? error.message : "Unknown error",
      },
    });
    throw error;
  }
};

/**
 * Summarization Handler Module
 * Handles text summarization requests
 * @module config/ai/summarize-handler
 */

import { assert } from "../../utils/safety-utils.js";
import { logger } from "../../utils/logger.js";
import type { ProcessingOptions } from "./ai-service-types.js";
import { resolveAiConfig, availableInputCharacters, modelForCall } from "./resolved-ai-config.js";
import { buildSystemMessage } from "./prompt-assembly.js";
import type { SummarizationResult } from "./text-processor.js";
import configService from "../../services/config/config-service.js";
import { listOrdlistaEntries } from "../../services/ordlista/ordlista-service.js";
import { applyWordListReplacements } from "../../utils/text/word-list-replacer.js";
import { runWithStageConcurrency } from "../../services/summarize/stage-concurrency.js";
import { getSummary as getProviderSummary } from "./ai-service-factory.js";
import {
  buildRepairPlan,
  renderRepairBlueprint,
} from "../../services/summarize/targeted-repair.js";
import { runTargetedRepairLoop } from "../../services/summarize/repair-loop.js";
import type { QualityReportArtifact } from "../../services/summarize/pipeline-artifacts.js";
import { config } from "../app-config.js";
import {
  setSummarizeProgress,
  type SummarizeStage,
} from "../../services/summarize/progress-tracker.js";
import {
  ensureDimensionFailures,
  evaluateQualityGate,
  type QualityDimension,
  type QualityDimensionThresholds,
} from "../../services/summarize/quality-gate.js";

export function getRewritePlanTaskKey(
  options: ProcessingOptions,
): string | null {
  return typeof options.taskKey === "string" && options.taskKey.trim().length > 0
    ? options.taskKey.trim()
    : null;
}

export function shouldRunRewriteDraft(options: ProcessingOptions): boolean {
  if (options.rewritePlanEnabled === false) {
    return false;
  }

  return getRewritePlanTaskKey(options) !== null;
}

const DEFAULT_MAX_QUALITY_ATTEMPTS = config.qualityControl.maxAttempts;

function readRuntimeNumber(
  value: unknown,
  fallback: number,
  min: number,
  max: number,
): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return fallback;
  }

  const parsed = Math.trunc(value);
  if (parsed < min || parsed > max) {
    return fallback;
  }

  return parsed;
}

function readRuntimeBoolean(value: unknown, fallback: boolean): boolean {
  if (typeof value !== "boolean") {
    return fallback;
  }

  return value;
}

/**
 * Callback function to check if the client is still connected
 * @returns true if client is connected, false if disconnected
 */
export type ClientConnectionChecker = () => boolean;

interface RepairQualityOutcome {
  score: number;
  qualityReport?: QualityReportArtifact;
}

type MutableSummarizationResult = SummarizationResult & {
  compressionRatio?: number;
};

interface QualityRepairLifecycleHooks {
  onDisconnected?: () => void;
  onRepairStarted?: (attempt: number, failureCount: number) => void;
  onRepairEmptyResult?: (attempt: number) => void;
  onRepairCompleted?: (attempt: number, score: number) => void;
}

interface ExecuteQualityRepairFlowInput extends QualityRepairLifecycleHooks {
  combinedResult: MutableSummarizationResult;
  processingOptions: ProcessingOptions;
  targetedRepairEnabled: boolean;
  repairBudget: number;
  repairMinScore: number;
  repairMinSubscore: number;
  qualityDimensionThresholds?: QualityDimensionThresholds;
  repairMaxActions: number;
  evaluateQuality: () => Promise<RepairQualityOutcome>;
  applyRepair: (
    currentSummary: string,
    repairOptions: ProcessingOptions,
    attempt: number,
  ) => Promise<{ summary: string; systemMessage?: string } | null>;
  updateProcessedText: (summary: string) => Promise<void>;
  updateProcessingOptions: (processingOptions: ProcessingOptions) => Promise<void>;
  canContinue?: () => boolean;
}

interface ExecuteQualityRepairFlowResult {
  qualityScore: number;
  qualityReport?: QualityReportArtifact;
  repairAttempts: number;
  qualityPassed: boolean;
  failingDimensions: QualityDimension[];
  qualityGateReason: "pass" | "missing_report" | "overall" | "subscores";
}

export async function executeQualityRepairFlow(
  input: ExecuteQualityRepairFlowInput,
): Promise<ExecuteQualityRepairFlowResult> {
  const normalizeOutcome = (outcome: RepairQualityOutcome): RepairQualityOutcome => {
    if (!outcome.qualityReport) {
      return outcome;
    }

    return {
      ...outcome,
      qualityReport: ensureDimensionFailures(
        outcome.qualityReport,
        input.repairMinSubscore,
        input.qualityDimensionThresholds,
      ),
    };
  };

  const initialOutcome = normalizeOutcome(await input.evaluateQuality());

  const repairLoopResult = await runTargetedRepairLoop({
    initialOutcome,
    config: {
      enabled: input.targetedRepairEnabled,
      budget: input.repairBudget,
      minScore: input.repairMinScore,
      minSubscore: input.repairMinSubscore,
      qualityDimensionThresholds: input.qualityDimensionThresholds,
      requireStructuredReport: true,
      maxActionsPerAttempt: input.repairMaxActions,
    },
    dependencies: {
      buildPlan: buildRepairPlan,
      renderPlan: renderRepairBlueprint,
      onRepairPlan: (repairPlan) => {
        input.processingOptions.repairPlanArtifact = JSON.stringify(repairPlan);
      },
      canContinue: () => {
        const allowed = input.canContinue ? input.canContinue() : true;
        if (!allowed) {
          input.onDisconnected?.();
        }
        return allowed;
      },
      onAttemptStarted: input.onRepairStarted,
      applyRepair: async (repairBlueprint, attempt) => {
        const repairOptions: ProcessingOptions = {
          ...input.processingOptions,
          repairInstructions: repairBlueprint,
        };
        const repaired = await input.applyRepair(
          input.combinedResult.summary,
          repairOptions,
          attempt,
        );

        if (!repaired || repaired.summary.trim().length === 0) {
          input.onRepairEmptyResult?.(attempt);
          return null;
        }

        return repaired;
      },
      onSummaryUpdated: async (repairedResult) => {
        input.combinedResult.summary = repairedResult.summary;
        input.combinedResult.summaryLength = repairedResult.summary.length;
        input.combinedResult.compressionRatio = Math.round(
          (input.combinedResult.summaryLength / input.combinedResult.originalLength) *
            100,
        );
        if (repairedResult.systemMessage) {
          input.combinedResult.systemMessage = repairedResult.systemMessage;
        }

        await input.updateProcessedText(input.combinedResult.summary);
      },
      evaluate: async () => normalizeOutcome(await input.evaluateQuality()),
      onAttemptCompleted: input.onRepairCompleted,
    },
  });

  const qualityScore = repairLoopResult.outcome.score;
  const qualityReport = repairLoopResult.outcome.qualityReport;
  const qualityGate = evaluateQualityGate(
    {
      score: qualityScore,
      qualityReport,
    },
    {
      minOverall: input.repairMinScore,
      minSubscore: input.repairMinSubscore,
      dimensionThresholds: input.qualityDimensionThresholds,
      requireStructuredReport: true,
    },
  );

  if (qualityReport) {
    input.processingOptions.qualityReportArtifact = JSON.stringify(qualityReport);
  }
  input.processingOptions.qualityGateArtifact = JSON.stringify({
    passes: qualityGate.passes,
    reason: qualityGate.reason,
    failingDimensions: qualityGate.failingDimensions,
  });
  await input.updateProcessingOptions(input.processingOptions);

  return {
    qualityScore,
    qualityReport,
    repairAttempts: repairLoopResult.attempts,
    qualityPassed: qualityGate.passes,
    failingDimensions: qualityGate.failingDimensions,
    qualityGateReason: qualityGate.reason,
  };
}

export function shouldRunQualityEvaluation(
  qualityProcess: boolean | undefined,
  runtimeSettings: Record<string, unknown>,
): boolean {
  const runtimeQuality = runtimeSettings.quality as
    | Record<string, unknown>
    | undefined;
  const runtimeQualityEnabled = readRuntimeBoolean(runtimeQuality?.enabled, true);
  return qualityProcess !== false && runtimeQualityEnabled;
}

type SummarizeLogContext = {
  requestId?: string;
  processId?: string;
};

type SummarizeProgressUpdater = (stage: SummarizeStage, message?: string) => void;

function updateResultSummary(
  result: MutableSummarizationResult,
  summary: string,
  systemMessage?: string,
): void {
  result.summary = summary;
  result.summaryLength = summary.length;
  result.compressionRatio = Math.round(
    (result.summaryLength / result.originalLength) * 100,
  );
  if (systemMessage) {
    result.systemMessage = systemMessage;
  }
}

async function maybeGenerateRewritePlanDraft(
  text: string,
  processingOptions: ProcessingOptions,
  runtimeSettings: Record<string, unknown>,
  updateProgress: SummarizeProgressUpdater,
  logContext: SummarizeLogContext,
): Promise<string> {
  const rewritePlanTaskKey = getRewritePlanTaskKey(processingOptions);
  if (rewritePlanTaskKey) {
    processingOptions.rewritePlanEnabled ??=
      await configService.getRewritePlanTaskSetting(rewritePlanTaskKey);

    logger.debug("process.rewrite.draft.setting", {
      ...logContext,
      processStatus: "running",
      meta: {
        taskKey: rewritePlanTaskKey,
        enabled: processingOptions.rewritePlanEnabled,
      },
    });
  } else {
    processingOptions.rewritePlanEnabled = false;
  }

  if (!shouldRunRewriteDraft(processingOptions)) {
    processingOptions.rewritePlanDraft = undefined;
    return "";
  }

  updateProgress("rewrite_draft");
  logger.info("process.rewrite.draft.started", {
    ...logContext,
    processStatus: "running",
    meta: {
      taskKey: rewritePlanTaskKey,
    },
  });
  logger.debug("process.rewrite.draft.enabled", {
    ...logContext,
    processStatus: "running",
  });

  const { generateRewritePlanDraft } = await import("./rewrite-plan-handler.js");
  const maxParts = readRuntimeNumber(
    (runtimeSettings.textProcessing as Record<string, unknown> | undefined)?.maxChunks,
    100, 1, 100,
  );
  const rewritePlanDraft = await runWithStageConcurrency("analysis", runtimeSettings, () =>
    generateRewritePlanDraft(text, processingOptions, maxParts),
  );
  processingOptions.rewritePlanDraft = rewritePlanDraft;
  logger.debug("process.rewrite.draft.generated", {
    ...logContext,
    processStatus: "running",
    meta: { draftLength: rewritePlanDraft.length },
  });

  return rewritePlanDraft;
}

async function runPrimaryRewriteStage(
  text: string,
  processingOptions: ProcessingOptions,
  runtimeSettings: Record<string, unknown>,
  updateProgress: SummarizeProgressUpdater,
  logContext: SummarizeLogContext,
): Promise<MutableSummarizationResult> {
  updateProgress("task_execution");

  const ai = await resolveAiConfig();
  const model = modelForCall(ai.settings, true);
  if (model.model !== ai.settings.model) model.contextWindow = undefined;
  const systemMessage = await buildSystemMessage(processingOptions);
  if (systemMessage.length + 2 + text.length > availableInputCharacters(ai.provider, model)) {
    throw new Error("Hela originaltexten och omskrivningsutkastet ryms inte i uppgiftsmodellens kontext. Välj en modell med större kontext. Texten har inte kapats eller skrivits om delvis.");
  }
  const start = Date.now();
  const result = await runWithStageConcurrency("rewrite", runtimeSettings, () =>
    getProviderSummary(text, { ...processingOptions, aiCallPurpose: "task" }),
  );
  logger.info("process.rewrite.completed", {
    ...logContext,
    processStatus: "running",
    meta: { originalLength: text.length, rewritePlanDraftUsed: Boolean(processingOptions.rewritePlanDraft) },
  });

  return {
    ...result,
    originalLength: text.length,
    summaryLength: result.summary.length,
    processingTime: Date.now() - start,
    compressionRatio: Math.round(result.summary.length / text.length * 100),
  };
}

async function applyOrdlistaReplacementsToResult(
  combinedResult: MutableSummarizationResult,
): Promise<void> {
  const ordlistaEntries = await listOrdlistaEntries();
  if (ordlistaEntries.length === 0) {
    return;
  }

  const replacements = ordlistaEntries.map((entry) => ({
    term: entry.fromWord,
    replacement: entry.toWord,
  }));
  const replacedSummary = applyWordListReplacements(
    combinedResult.summary,
    replacements,
  );

  if (replacedSummary !== combinedResult.summary) {
    updateResultSummary(combinedResult, replacedSummary);
  }
}

function resolveMaxQualityAttempts(
  runtimeSettings: Record<string, unknown>,
  configuredMaxAttempts: number,
): number {
  const runtimeQualityMaxAttempts = readRuntimeNumber(
    (runtimeSettings.retry as Record<string, unknown> | undefined)
      ?.qualityMaxAttempts,
    configuredMaxAttempts,
    1,
    20,
  );

  return Number.isInteger(runtimeQualityMaxAttempts) && runtimeQualityMaxAttempts > 0
    ? runtimeQualityMaxAttempts
    : DEFAULT_MAX_QUALITY_ATTEMPTS;
}

function resolveRepairRuntimeSettings(
  runtimeSettings: Record<string, unknown>,
): {
  targetedRepairEnabled: boolean;
  repairBudget: number;
  repairMaxActions: number;
  repairMinScore: number;
  repairMinSubscore: number;
} {
  const repairSettings = (runtimeSettings.repair as
    | Record<string, unknown>
    | undefined) ?? {
  };
  const targetedRepairEnabled = readRuntimeBoolean(repairSettings.enabled, true);
  const repairBudget = readRuntimeNumber(repairSettings.budget, 1, 0, 10);
  const repairMaxActions = readRuntimeNumber(
    repairSettings.maxActionsPerAttempt,
    3,
    1,
    20,
  );
  const repairMinScore = readRuntimeNumber(repairSettings.minScore, 8, 1, 10);
  const repairMinSubscore = readRuntimeNumber(
    repairSettings.minSubscore,
    repairMinScore,
    1,
    10,
  );

  return {
    targetedRepairEnabled,
    repairBudget,
    repairMaxActions,
    repairMinScore,
    repairMinSubscore,
  };
}

/**
 * Handles summarization requests
 *
 * @param {string} text - Text to summarize
 * @param {ProcessingOptions} options - Summarization options
 * @param {ClientConnectionChecker} isClientConnected - Optional callback to check if client is still connected
 * @returns {Promise<SummarizationResult>} The summarization result
 */
export async function handleSummarization(
  text: string,
  options: ProcessingOptions,
  isClientConnected?: ClientConnectionChecker,
): Promise<SummarizationResult> {
  // Assert preconditions
  assert(text !== undefined && text !== null, "Text is required");
  assert(options !== undefined && options !== null, "Options are required");

  const requestId = options.requestId;
  const processId = options.processId || requestId;
  const logContext = {
    requestId,
    processId,
  };
  const updateProgress = (stage: SummarizeStage): void => {
    if (typeof processId !== "string" || processId.trim().length === 0) {
      return;
    }
    setSummarizeProgress(processId, stage);
  };

  logger.info("process.started", {
    ...logContext,
    processStatus: "running",
    meta: {
      paragraphCount: options.paragraphCount,
      textLength: text.length,
    },
  });

  try {
    const checkConnection = (): void => {
      if (isClientConnected && !isClientConnected()) throw new Error("Request cancelled by user");
    };
    checkConnection();
    const processingOptions: ProcessingOptions = { ...options };
    processingOptions.aiCallPurpose = "background";
    const runtimeSettings = await configService.getRuntimeSettings();
    const senderIntentPrompt = await configService.getPrompt("senderIntent");
    processingOptions.senderIntent = senderIntentPrompt;
    updateProgress("analysis");

    let rewritePlanDraft = "";

    rewritePlanDraft = await maybeGenerateRewritePlanDraft(
      text,
      processingOptions,
      runtimeSettings,
      updateProgress,
      logContext,
    );

    checkConnection();
    const combinedResult = await runPrimaryRewriteStage(
      text,
      processingOptions,
      runtimeSettings,
      updateProgress,
      logContext,
    );
    // Fail closed until the current text has actually passed a complete review.
    combinedResult.qualityStatus = shouldRunQualityEvaluation(options.qualityProcess, runtimeSettings)
      ? "failed" : "disabled";

    // CHECK: Is client still connected after AI processing completes?
    if (isClientConnected && !isClientConnected()) {
      console.log(
        `[Summarize] Client disconnected after AI processing, skipping database and quality evaluation`,
      );
      logger.warn("process.client.disconnected", {
        ...logContext,
        processStatus: "cancelled",
      });
      updateProgress("cancelled");
      // Return early with just the summary - no database operations, no quality checks
      return combinedResult;
    }

    logger.info("process.ai.responded", {
      ...logContext,
      processStatus: "running",
      meta: { summaryLength: combinedResult.summary.length, status: "success" },
    });

    await applyOrdlistaReplacementsToResult(combinedResult);

    // Check if this is a resubmission attempt
    const attemptNumber = options.attemptNumber || 1;
    const configuredMaxAttempts = await configService.getRetryCount();
    const maxQualityAttempts = resolveMaxQualityAttempts(
      runtimeSettings,
      configuredMaxAttempts,
    );

    logger.debug("process.quality.attempt", {
      ...logContext,
      processStatus: "running",
      meta: { attemptNumber },
    });

    // Store text quality data when quality process is enabled by request and runtime settings
    if (shouldRunQualityEvaluation(options.qualityProcess, runtimeSettings)) {
      updateProgress("quality_evaluation");
      const promptUsed = combinedResult.systemMessage || "";
      let recordId = 0;

      // Store the data
      try {
        // Every attempt stores its own complete source/result pair. Never reuse
        // a previous record whose original text or processing status may differ.
        {
          const { storeTextQualityData } = await import(
            "../../services/quality-evaluation-controls.js"
          );
          const qualityDataResult = await storeTextQualityData(
            text,
            combinedResult.summary,
            promptUsed,
            processingOptions, // Store all processing options (taskKey, paragraphCount, targetAudience, etc.)
            rewritePlanDraft,
          );

          // Check if we got a valid record ID
          if (typeof qualityDataResult === "number") {
            recordId = qualityDataResult;
            logger.debug("process.quality.record.stored", {
              ...logContext,
              processStatus: "running",
              meta: { recordId },
            });
          } else {
            logger.error("process.failed", {
              ...logContext,
              processStatus: "failed",
              meta: { reason: "quality_record_store_failed" },
            });
            // Skip the rest of the quality evaluation process
            recordId = 0;
          }
        }

        // Perform concurrent-safe quality evaluation immediately on the server side
        if (recordId > 0) {
          // CHECK: Is client still connected before starting quality evaluation?
          if (isClientConnected && !isClientConnected()) {
            console.log(
              `[Summarize] Client disconnected, skipping quality evaluation for record ${recordId}`,
            );
            logger.warn("process.client.disconnected", {
              ...logContext,
              processStatus: "cancelled",
            });
            updateProgress("cancelled");
            // Clean up the record since we won't be using it
            try {
              const { markRecordAsFailed } = await import(
                "../../services/quality-evaluation-controls.js"
              );
              if (!await markRecordAsFailed(recordId)) throw new Error("Cancelled quality record could not be marked for cleanup");
              logger.debug("process.quality.record.cleanup_deferred", {
                ...logContext,
                processStatus: "cancelled",
                meta: { recordId },
              });
            } catch (cleanupError) {
              logger.warn("process.quality.record.cleanup_failed", {
                ...logContext,
                processStatus: "cancelled",
                meta: {
                  recordId,
                  error:
                    cleanupError instanceof Error
                      ? cleanupError.message
                      : "Unknown error",
                },
              });
            }
            return combinedResult;
          }

          logger.info("process.quality.started", {
            ...logContext,
            processStatus: "running",
            meta: { recordId },
          });

          try {
            // Import status management functions
            const {
              markRecordAsProcessing,
              markRecordAsCompleted,
              markRecordAsFailed,
              deleteRecord,
              evaluateTextQualityDetailed,
              updateProcessedText,
              updateProcessingOptions,
            } = await import("../../services/quality-evaluation-controls.js");

            // Mark record as currently being processed (prevents concurrent deletion)
            const marked = await markRecordAsProcessing(recordId);
            if (!marked) {
              throw new Error("Kvalitetsgranskningen kunde inte startas: lagringsfel.");
            }

            // CHECK: Is client still connected before making expensive AI call?
            if (isClientConnected && !isClientConnected()) {
              console.log(
                `[Summarize] Client disconnected before quality AI call, aborting for record ${recordId}`,
              );
              logger.warn("process.client.disconnected", {
                ...logContext,
                processStatus: "cancelled",
                meta: { recordId },
              });
              updateProgress("cancelled");
              if (!await markRecordAsFailed(recordId)) throw new Error("Cancelled quality record could not be marked for cleanup");
              logger.debug("process.quality.record.cleanup_deferred", {
                ...logContext,
                processStatus: "cancelled",
                meta: { recordId },
              });
              return combinedResult;
            }
            const {
              targetedRepairEnabled,
              repairBudget,
              repairMaxActions,
              repairMinScore,
              repairMinSubscore,
            } = resolveRepairRuntimeSettings(runtimeSettings);

            const {
              qualityScore,
              qualityReport,
              repairAttempts,
              qualityPassed,
              failingDimensions,
              qualityGateReason,
            } =
              await executeQualityRepairFlow({
                combinedResult,
                processingOptions,
                targetedRepairEnabled,
                repairBudget,
                repairMinScore,
                repairMinSubscore,
                repairMaxActions,
                evaluateQuality: async () =>
                  await runWithStageConcurrency(
                    "critic",
                    runtimeSettings,
                    async () =>
                      evaluateTextQualityDetailed(
                        recordId,
                        text,
                        combinedResult.summary,
                        promptUsed,
                        rewritePlanDraft,
                        { requestId, processId },
                        processingOptions.senderIntent,
                        {
                          taskKey:
                            typeof processingOptions.taskKey === "string"
                              ? processingOptions.taskKey
                              : "",
                          targetAudience:
                            typeof processingOptions.targetAudience === "string"
                              ? processingOptions.targetAudience
                              : "",
                        },
                      ),
                  ),
                applyRepair: async (currentSummary, repairOptions) => {
                  const normalizedRepairOptions: ProcessingOptions = {
                    ...repairOptions,
                    aiCallPurpose: "background",
                  };

                  const repaired = await runWithStageConcurrency(
                    "rewrite",
                    runtimeSettings,
                    async () =>
                      getProviderSummary(
                        `ORIGINALTEXT (faktakälla):\n${text}\n\nBEARBETAD TEXT ATT REPARERA:\n${currentSummary}`,
                        normalizedRepairOptions,
                      ),
                  );

                  if (!repaired || typeof repaired.summary !== "string") {
                    return repaired;
                  }

                  return repaired;
                },
                updateProcessedText: async (summary) => {
                  if (!await updateProcessedText(recordId, summary)) {
                    throw new Error("Den reparerade texten kunde inte sparas för granskning.");
                  }
                },
                updateProcessingOptions: async (optionsToPersist) => {
                  if (!await updateProcessingOptions(recordId, optionsToPersist)) {
                    throw new Error("Granskningsunderlaget kunde inte sparas.");
                  }
                },
                canContinue: isClientConnected,
                onDisconnected: () => {
                  logger.warn("process.client.disconnected", {
                    ...logContext,
                    processStatus: "cancelled",
                    meta: { recordId, stage: "repair" },
                  });
                  updateProgress("cancelled");
                },
                onRepairStarted: (attempt, failureCount) => {
                  updateProgress("quality_repair");
                  const remainingBudget = repairBudget - (attempt - 1);
                  logger.info("process.repair.started", {
                    ...logContext,
                    processStatus: "running",
                    meta: {
                      recordId,
                      repairAttempt: attempt,
                      remainingBudget,
                      failureCount,
                    },
                  });
                },
                onRepairEmptyResult: (attempt) => {
                  logger.warn("process.repair.empty_result", {
                    ...logContext,
                    processStatus: "running",
                    meta: { recordId, repairAttempt: attempt },
                  });
                },
                onRepairCompleted: (attempt, score) => {
                  logger.info("process.repair.completed", {
                    ...logContext,
                    processStatus: "running",
                    meta: {
                      recordId,
                      repairAttempt: attempt,
                      qualityScore: score,
                    },
                  });
                },
              });

            logger.info("process.quality.completed", {
              ...logContext,
              processStatus: "completed",
              meta: {
                qualityScore,
                recordId,
                qualityFailures: qualityReport?.failures.length ?? 0,
                qualityPassed,
                qualityGateReason,
                failingDimensions,
              },
            });

            // Add quality evaluation data to the result
            combinedResult.qualityEvaluationId = recordId;
            combinedResult.qualityAttempts = attemptNumber + repairAttempts;
            combinedResult.qualityScore = qualityScore;
            combinedResult.maxQualityAttempts = maxQualityAttempts;

            // Determine if resubmission is needed
            combinedResult.needsResubmission = !qualityPassed;

            // Mark record as completed (allows safe deletion)
            if (!await markRecordAsCompleted(recordId, qualityScore)) {
              throw new Error("Granskningens slutstatus kunde inte sparas.");
            }
            combinedResult.qualityStatus = qualityPassed ? "passed" : "rejected";

            // If quality evaluation is complete and acceptable (or max attempts reached), delete immediately
            if (
              !combinedResult.needsResubmission ||
              attemptNumber >= maxQualityAttempts
            ) {
              try {
                const deleted = await deleteRecord(recordId);
                if (deleted) {
                  logger.debug("process.quality.record.cleaned", {
                    ...logContext,
                    processStatus: "completed",
                    meta: { recordId },
                  });
                } else {
                  logger.debug("process.quality.record.cleanup_deferred", {
                    ...logContext,
                    processStatus: "completed",
                    meta: { recordId },
                  });
                }
              } catch (deleteError) {
                logger.warn("process.quality.record.cleanup_failed", {
                  ...logContext,
                  processStatus: "completed",
                  meta: {
                    recordId,
                    error:
                      deleteError instanceof Error
                        ? deleteError.message
                        : "Unknown error",
                  },
                });
                // Don't throw - this is cleanup, not critical functionality
              }
            }
          } catch (qualityError) {
            logger.error("process.failed", {
              ...logContext,
              processStatus: "failed",
              meta: {
                recordId,
                reason: "quality_evaluation_failed",
                error:
                  qualityError instanceof Error
                    ? qualityError.message
                    : "Unknown error",
              },
            });

            // Mark record as failed for safe cleanup
            try {
              const { markRecordAsFailed } = await import(
                "../../services/quality-evaluation-controls.js"
              );
              await markRecordAsFailed(recordId);
              logger.warn("process.quality.record.marked_failed", {
                ...logContext,
                processStatus: "failed",
                meta: { recordId },
              });
            } catch (markError) {
              logger.warn("process.quality.record.mark_failed_error", {
                ...logContext,
                processStatus: "failed",
                meta: {
                  recordId,
                  error:
                    markError instanceof Error ? markError.message : "Unknown error",
                },
              });
            }

            // Continue with the summary even if quality evaluation fails
            combinedResult.qualityEvaluationId = recordId;
            combinedResult.qualityAttempts = attemptNumber;
            combinedResult.qualityScore = undefined;
            combinedResult.qualityStatus = "failed";
            combinedResult.needsResubmission = false;
            combinedResult.maxQualityAttempts = maxQualityAttempts;
          }
        } else {
          logger.error("process.failed", {
            ...logContext,
            processStatus: "failed",
            meta: { reason: "quality_record_missing" },
          });
        }
      } catch (error) {
        logger.error("process.failed", {
          ...logContext,
          processStatus: "failed",
          meta: {
            reason: "quality_storage_error",
            error: error instanceof Error ? error.message : "Unknown error",
          },
        });
        // Continue with the current result even if quality data storage fails
        combinedResult.qualityStatus = "failed";
        combinedResult.qualityScore = undefined;
        combinedResult.needsResubmission = false;
      }
    } else {
      logger.info("process.quality.skipped", {
        ...logContext,
        processStatus: "completed",
        meta: {
          qualityProcessRequested: options.qualityProcess !== false,
          runtimeQualityEnabled: readRuntimeBoolean(
            (runtimeSettings.quality as Record<string, unknown> | undefined)
              ?.enabled,
            true,
          ),
        },
      });
    }

    updateProgress("finalizing");

    logger.info(combinedResult.qualityStatus === "failed" ? "process.failed" : "process.completed", {
      ...logContext,
      processStatus: combinedResult.qualityStatus === "failed" ? "failed" : "completed",
      meta: {
        summaryLength: combinedResult.summary.length,
        qualityScore: combinedResult.qualityScore,
        qualityStatus: combinedResult.qualityStatus,
      },
    });
    return combinedResult;
  } catch (error: any) {
    updateProgress("failed");
    logger.error("process.failed", {
      requestId,
      processId,
      processStatus: "failed",
      meta: {
        error: error instanceof Error ? error.message : "Unknown error",
      },
    });
    const errorMessage =
      error.message || "An error occurred during summarization";

    // Re-throw error for caller to handle
    throw new Error(errorMessage);
  }
}

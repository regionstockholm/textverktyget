/**
 * Summarization Handler Module
 * Handles text summarization requests
 * @module config/ai/summarize-handler
 */

import { assert } from "../../utils/safety-utils.js";
import { logger } from "../../utils/logger.js";
import type { ProcessingOptions } from "./ai-service-types.js";
import { chunkText } from "./text-chunking.js";
import {
  processChunksSequentially,
  combineResults,
  type SummarizationResult,
} from "./text-processor.js";
import configService from "../../services/config/config-service.js";
import { listOrdlistaEntries } from "../../services/ordlista/ordlista-service.js";
import { applyWordListReplacements } from "../../utils/text/word-list-replacer.js";
import {
  buildAudienceProfile,
  buildSenderIntentProfile,
  buildSalienceMap,
  buildRewriteBlueprint,
  renderRewriteBlueprint,
} from "../../services/summarize/pipeline-analysis.js";
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
import {
  formatEasyToReadLayout,
  type EasyToReadLayoutOptions,
} from "../../services/summarize/easy-to-read-layout.js";

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

const isLocalDev = process.env.LOCAL_DEV === "true";
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

function resolveTaskOutputMode(
  options: ProcessingOptions,
): "rewrite" | "summary" | "bullets" {
  const candidate = options.taskOutputMode;
  if (candidate === "summary" || candidate === "bullets") {
    return candidate;
  }

  return "rewrite";
}

const EASY_TO_READ_TASK_KEY = "easyToRead";

export interface EasyToReadWorkflowConfig {
  enabled: boolean;
  useRewriteDraft: boolean;
}

export interface EasyToReadLayoutConfig {
  enabled: boolean;
  maxLineChars: number;
  maxLinesPerParagraph: number;
}

function readRuntimeSubscoreOverride(value: unknown): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return undefined;
  }

  const rounded = Math.round(value);
  if (rounded < 1 || rounded > 10) {
    return undefined;
  }

  return rounded;
}

export function isEasyToReadTask(options: ProcessingOptions): boolean {
  if (typeof options.taskKey === "string") {
    return options.taskKey.trim() === EASY_TO_READ_TASK_KEY;
  }

  return false;
}

export function resolveEasyToReadWorkflowConfig(
  runtimeSettings: Record<string, unknown>,
): EasyToReadWorkflowConfig {
  const candidate = runtimeSettings.easyToReadWorkflow;
  if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) {
    return {
      enabled: false,
      useRewriteDraft: false,
    };
  }

  const config = candidate as Record<string, unknown>;
  return {
    enabled: readRuntimeBoolean(config.enabled, false),
    useRewriteDraft: readRuntimeBoolean(config.useRewriteDraft, false),
  };
}

export function resolveEasyToReadQualityDimensionThresholds(
  runtimeSettings: Record<string, unknown>,
  options: ProcessingOptions,
): QualityDimensionThresholds | undefined {
  if (!isEasyToReadTask(options)) {
    return undefined;
  }

  const repairSettings = runtimeSettings.repair;
  if (
    !repairSettings ||
    typeof repairSettings !== "object" ||
    Array.isArray(repairSettings)
  ) {
    return undefined;
  }

  const easyToReadSettings = (repairSettings as Record<string, unknown>)
    .easyToRead;
  if (
    !easyToReadSettings ||
    typeof easyToReadSettings !== "object" ||
    Array.isArray(easyToReadSettings)
  ) {
    return undefined;
  }

  const config = easyToReadSettings as Record<string, unknown>;
  const plainLanguageThreshold =
    readRuntimeSubscoreOverride(config.plainLanguageMinSubscore) ??
    readRuntimeSubscoreOverride(config.plainLanguage);
  const taskFitThreshold =
    readRuntimeSubscoreOverride(config.taskFitMinSubscore) ??
    readRuntimeSubscoreOverride(config.taskFit);

  const thresholds: QualityDimensionThresholds = {};
  if (plainLanguageThreshold !== undefined) {
    thresholds.plainLanguage = plainLanguageThreshold;
  }
  if (taskFitThreshold !== undefined) {
    thresholds.taskFit = taskFitThreshold;
  }

  return Object.keys(thresholds).length > 0 ? thresholds : undefined;
}

export function resolveEasyToReadLayoutConfig(
  runtimeSettings: Record<string, unknown>,
  options: ProcessingOptions,
): EasyToReadLayoutConfig {
  if (!isEasyToReadTask(options)) {
    return {
      enabled: false,
      maxLineChars: 48,
      maxLinesPerParagraph: 4,
    };
  }

  const candidate = runtimeSettings.easyToReadLayout;
  if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) {
    return {
      enabled: true,
      maxLineChars: 48,
      maxLinesPerParagraph: 4,
    };
  }

  const config = candidate as Record<string, unknown>;
  return {
    enabled: readRuntimeBoolean(config.enabled, true),
    maxLineChars: readRuntimeNumber(config.maxLineChars, 48, 20, 80),
    maxLinesPerParagraph: readRuntimeNumber(config.maxLinesPerParagraph, 4, 2, 8),
  };
}

function applyEasyToReadLayoutIfNeeded(
  summary: string,
  easyToReadLayout: EasyToReadLayoutConfig,
): string {
  if (!easyToReadLayout.enabled) {
    return summary;
  }

  const layoutOptions: EasyToReadLayoutOptions = {
    enabled: easyToReadLayout.enabled,
    maxLineChars: easyToReadLayout.maxLineChars,
    maxLinesPerParagraph: easyToReadLayout.maxLinesPerParagraph,
  };

  const formatted = formatEasyToReadLayout(summary, layoutOptions);
  return formatted || summary;
}

function logRewritePlanDraftPreview(draft: string): void {
  if (!isLocalDev) {
    return;
  }

  const trimmedDraft = draft.trim();
  if (!trimmedDraft) {
    return;
  }

  const lines = trimmedDraft.split(/\r?\n/);
  const previewLines = lines.slice(0, 100);
  const preview = previewLines.join("\n");
  const truncated = lines.length > previewLines.length ? " (truncated)" : "";

  console.log(`[RewritePlan] Draft preview${truncated}:\n${preview}`);
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
          rewriteBlueprint: `${input.processingOptions.rewriteBlueprint || ""}\n\n${repairBlueprint}`,
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
    const processingOptions: ProcessingOptions = { ...options };
    const runtimeSettings = await configService.getRuntimeSettings();
    const senderIntentPrompt = await configService.getPrompt("senderIntent");
    const taskOutputMode = resolveTaskOutputMode(processingOptions);
    const isRewriteTask = taskOutputMode === "rewrite";
    const easyToReadWorkflow = resolveEasyToReadWorkflowConfig(runtimeSettings);
    const easyToReadLayout = resolveEasyToReadLayoutConfig(
      runtimeSettings,
      processingOptions,
    );
    const isEasyToReadRewriteTask =
      isRewriteTask && isEasyToReadTask(processingOptions);
    const useEasyToReadTwoPassWorkflow =
      isEasyToReadRewriteTask && easyToReadWorkflow.enabled;
    processingOptions.easyToReadWorkflowEnabled = useEasyToReadTwoPassWorkflow;
    processingOptions.easyToReadWorkflowUseRewriteDraft =
      easyToReadWorkflow.useRewriteDraft;
    processingOptions.senderIntent = senderIntentPrompt;

    if (useEasyToReadTwoPassWorkflow) {
      logger.info("process.easy_to_read.workflow.enabled", {
        ...logContext,
        processStatus: "running",
        meta: {
          useRewriteDraft: easyToReadWorkflow.useRewriteDraft,
        },
      });
    }

    if (easyToReadLayout.enabled) {
      logger.info("process.easy_to_read.layout.enabled", {
        ...logContext,
        processStatus: "running",
        meta: {
          maxLineChars: easyToReadLayout.maxLineChars,
          maxLinesPerParagraph: easyToReadLayout.maxLinesPerParagraph,
        },
      });
    }

    const runtimeMaxChunks = readRuntimeNumber(
      (runtimeSettings.textProcessing as Record<string, unknown> | undefined)
        ?.maxChunks,
      10,
      1,
      100,
    );
    processingOptions.maxChunks = runtimeMaxChunks;
    updateProgress("analysis");

    const analysisResult = await runWithStageConcurrency(
      "analysis",
      runtimeSettings,
      async () => {
        const audienceProfile = buildAudienceProfile(
          text,
          processingOptions.targetAudience,
        );
        const senderIntentProfile = buildSenderIntentProfile(senderIntentPrompt);
        const importanceMap = buildSalienceMap(
          text,
          audienceProfile,
          senderIntentProfile,
        );
        const rewriteBlueprint = buildRewriteBlueprint(importanceMap);
        const rewriteBlueprintPrompt = renderRewriteBlueprint(
          rewriteBlueprint,
          importanceMap,
        );

        return {
          audienceProfile,
          senderIntentProfile,
          importanceMap,
          rewriteBlueprint,
          rewriteBlueprintPrompt,
        };
      },
    );

    const {
      audienceProfile,
      senderIntentProfile,
      importanceMap,
      rewriteBlueprint,
      rewriteBlueprintPrompt,
    } = analysisResult;

    processingOptions.audiencePriorityMode = audienceProfile.priorityMode;
    processingOptions.textType = audienceProfile.textType;
    processingOptions.senderIntentSummary = senderIntentProfile.summary;
    processingOptions.rewriteBlueprint = rewriteBlueprintPrompt;
    processingOptions.audienceProfileArtifact = JSON.stringify(audienceProfile);
    processingOptions.senderIntentProfileArtifact = JSON.stringify(
      senderIntentProfile,
    );
    processingOptions.importanceMapArtifact = JSON.stringify(importanceMap);
    processingOptions.rewriteBlueprintArtifact = JSON.stringify(rewriteBlueprint);

    let rewritePlanDraft = "";

    logger.debug("process.sender_intent.loaded", {
      ...logContext,
      processStatus: "running",
      meta: {
        length: senderIntentPrompt.length,
        audiencePriorityMode: audienceProfile.priorityMode,
        textType: audienceProfile.textType,
        rankingPolicy: importanceMap.rankingPolicy,
        salienceItems: importanceMap.items.length,
        maxChunks: runtimeMaxChunks,
      },
    });

    const rewritePlanTaskKey = getRewritePlanTaskKey(processingOptions);
    if (rewritePlanTaskKey) {
      processingOptions.rewritePlanEnabled =
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

    if (useEasyToReadTwoPassWorkflow && !easyToReadWorkflow.useRewriteDraft) {
      processingOptions.rewritePlanEnabled = false;
      logger.info("process.rewrite.draft.skipped", {
        ...logContext,
        processStatus: "running",
        meta: {
          reason: "easy_to_read_workflow_rewrite_draft_disabled",
        },
      });
    }

    if (shouldRunRewriteDraft(processingOptions)) {
      updateProgress("rewrite_draft");
      logger.info("process.rewrite.draft.used", {
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
      const { generateRewritePlanDraft } = await import(
        "./rewrite-plan-handler.js"
      );
      rewritePlanDraft = await generateRewritePlanDraft(text, processingOptions);

      if (rewritePlanDraft) {
        processingOptions.rewritePlanDraft = rewritePlanDraft;
        logRewritePlanDraftPreview(rewritePlanDraft);
        logger.debug("process.rewrite.draft.generated", {
          ...logContext,
          processStatus: "running",
          meta: { draftLength: rewritePlanDraft.length },
        });
      } else {
        logger.warn("process.rewrite.draft.empty", {
          ...logContext,
          processStatus: "running",
        });
      }
    }

    // Split text into chunks for processing
    processingOptions.taskShapingMode = "rewrite";
    processingOptions.applyTaskPromptInRewriteStage =
      isRewriteTask && !useEasyToReadTwoPassWorkflow;
    updateProgress("task_execution");

    const chunks = chunkText(text);
    logger.debug("process.chunks.prepared", {
      ...logContext,
      processStatus: "running",
      meta: { chunkCount: chunks.length },
    });

    // Process chunks sequentially
    const results = await runWithStageConcurrency(
      "rewrite",
      runtimeSettings,
      async () => processChunksSequentially(chunks, processingOptions),
    );
    logger.debug("process.chunks.processed", {
      ...logContext,
      processStatus: "running",
      meta: { processedChunks: results.length },
    });

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
      return combineResults(results);
    }

    // Combine results
    let combinedResult = combineResults(results);
    logger.info("process.ai.responded", {
      ...logContext,
      processStatus: "running",
      meta: { summaryLength: combinedResult.summary.length, status: "success" },
    });

    const ordlistaEntries = await listOrdlistaEntries();
    if (ordlistaEntries.length > 0) {
      const replacements = ordlistaEntries.map((entry) => ({
        term: entry.fromWord,
        replacement: entry.toWord,
      }));
      const replacedSummary = applyWordListReplacements(
        combinedResult.summary,
        replacements,
      );

      if (replacedSummary !== combinedResult.summary) {
        combinedResult.summary = replacedSummary;
        combinedResult.summaryLength = replacedSummary.length;
        combinedResult.compressionRatio = Math.round(
          (replacedSummary.length / combinedResult.originalLength) * 100,
        );
      }
    }

    if (!isRewriteTask || useEasyToReadTwoPassWorkflow) {
      updateProgress("task_shaping");
      const shapingOptions: ProcessingOptions = {
        ...processingOptions,
        taskShapingMode: "task-shaping",
        rewriteBlueprint: undefined,
      };

      logger.info("process.task_shaping.started", {
        ...logContext,
        processStatus: "running",
      });

      const shapedResult = await runWithStageConcurrency(
        "rewrite",
        runtimeSettings,
        async () => getProviderSummary(combinedResult.summary, shapingOptions),
      );

      if (shapedResult.summary && shapedResult.summary.trim().length > 0) {
        combinedResult.summary = shapedResult.summary;
        combinedResult.summaryLength = shapedResult.summary.length;
        combinedResult.compressionRatio = Math.round(
          (combinedResult.summaryLength / combinedResult.originalLength) * 100,
        );
        if (shapedResult.systemMessage) {
          combinedResult.systemMessage = shapedResult.systemMessage;
        }
      }

      logger.info("process.task_shaping.completed", {
        ...logContext,
        processStatus: "running",
        meta: {
          summaryLength: combinedResult.summary.length,
          rewritePlanDraftUsed:
            typeof shapingOptions.rewritePlanDraft === "string" &&
            shapingOptions.rewritePlanDraft.trim().length > 0,
          easyToReadTwoPassWorkflow: useEasyToReadTwoPassWorkflow,
        },
      });
    } else {
      logger.info("process.task_shaping.skipped", {
        ...logContext,
        processStatus: "running",
        meta: {
          reason: "rewrite_task_uses_main_prompt_in_primary_pass",
          easyToReadTwoPassWorkflow: false,
        },
      });
    }

    const formattedEasyToReadSummary = applyEasyToReadLayoutIfNeeded(
      combinedResult.summary,
      easyToReadLayout,
    );
    if (formattedEasyToReadSummary !== combinedResult.summary) {
      combinedResult.summary = formattedEasyToReadSummary;
      combinedResult.summaryLength = formattedEasyToReadSummary.length;
      combinedResult.compressionRatio = Math.round(
        (combinedResult.summaryLength / combinedResult.originalLength) * 100,
      );
      logger.info("process.easy_to_read.layout.applied", {
        ...logContext,
        processStatus: "running",
        meta: {
          summaryLength: combinedResult.summaryLength,
        },
      });
    }

    // Check if this is a resubmission attempt
    const attemptNumber = options.attemptNumber || 1;
    const previousQualityId = options.previousQualityId || 0;
    const configuredMaxAttempts = await configService.getRetryCount();
    const runtimeQualityMaxAttempts = readRuntimeNumber(
      (runtimeSettings.retry as Record<string, unknown> | undefined)
        ?.qualityMaxAttempts,
      configuredMaxAttempts,
      1,
      20,
    );
    const maxQualityAttempts =
      Number.isInteger(runtimeQualityMaxAttempts) && runtimeQualityMaxAttempts > 0
        ? runtimeQualityMaxAttempts
        : DEFAULT_MAX_QUALITY_ATTEMPTS;

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
        // If this is a resubmission, use the previous quality ID
        if (previousQualityId > 0 && attemptNumber > 1) {
          recordId = previousQualityId;
          console.log(
            `[Summarize] Using previous quality ID: ${recordId} for attempt #${attemptNumber}`,
          );
        } else {
          // Store new quality data
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
              const { deleteRecord } = await import(
                "../../services/quality-evaluation-controls.js"
              );
              await deleteRecord(recordId);
              logger.debug("process.quality.record.cleaned", {
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
              deleteRecord,
              evaluateTextQualityDetailed,
              updateProcessedText,
              updateProcessingOptions,
            } = await import("../../services/quality-evaluation-controls.js");

            // Mark record as currently being processed (prevents concurrent deletion)
            const marked = await markRecordAsProcessing(recordId);
            if (!marked) {
              logger.warn("process.quality.mark_processing_failed", {
                ...logContext,
                processStatus: "running",
                meta: { recordId },
              });
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
              await deleteRecord(recordId);
              logger.debug("process.quality.record.cleaned", {
                ...logContext,
                processStatus: "cancelled",
                meta: { recordId },
              });
              return combinedResult;
            }
            const repairSettings = (runtimeSettings.repair as
              | Record<string, unknown>
              | undefined) ?? {
              };
            const targetedRepairEnabled = readRuntimeBoolean(
              repairSettings.enabled,
              true,
            );
            const repairBudget = readRuntimeNumber(
              repairSettings.budget,
              1,
              0,
              10,
            );
            const repairMaxActions = readRuntimeNumber(
              repairSettings.maxActionsPerAttempt,
              3,
              1,
              20,
            );
            const repairMinScore = readRuntimeNumber(
              repairSettings.minScore,
              8,
              1,
              10,
            );
            const repairMinSubscore = readRuntimeNumber(
              repairSettings.minSubscore,
              repairMinScore,
              1,
              10,
            );
            const qualityDimensionThresholds =
              resolveEasyToReadQualityDimensionThresholds(
                runtimeSettings,
                processingOptions,
              );

            if (qualityDimensionThresholds) {
              logger.info("process.easy_to_read.quality_thresholds.active", {
                ...logContext,
                processStatus: "running",
                meta: {
                  thresholds: qualityDimensionThresholds,
                },
              });
            }

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
                qualityDimensionThresholds,
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
                          taskOutputMode,
                        },
                      ),
                  ),
                applyRepair: async (currentSummary, repairOptions) => {
                  const normalizedRepairOptions: ProcessingOptions = {
                    ...repairOptions,
                  };

                  if (easyToReadLayout.enabled) {
                    normalizedRepairOptions.applyTaskPromptInRewriteStage = true;
                  }

                  const repaired = await runWithStageConcurrency(
                    "rewrite",
                    runtimeSettings,
                    async () =>
                      getProviderSummary(currentSummary, normalizedRepairOptions),
                  );

                  if (!repaired || typeof repaired.summary !== "string") {
                    return repaired;
                  }

                  const formattedSummary = applyEasyToReadLayoutIfNeeded(
                    repaired.summary,
                    easyToReadLayout,
                  );

                  return {
                    ...repaired,
                    summary: formattedSummary,
                  };
                },
                updateProcessedText: async (summary) => {
                  await updateProcessedText(recordId, summary);
                },
                updateProcessingOptions: async (optionsToPersist) => {
                  await updateProcessingOptions(recordId, optionsToPersist);
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
            await markRecordAsCompleted(recordId, qualityScore);

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

    logger.info("process.completed", {
      ...logContext,
      processStatus: "completed",
      meta: {
        summaryLength: combinedResult.summary.length,
        qualityScore: combinedResult.qualityScore,
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

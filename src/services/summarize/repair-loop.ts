import type {
  QualityReportArtifact,
  RepairPlanArtifact,
} from "./pipeline-artifacts.js";
import {
  evaluateQualityGate,
  type QualityDimensionThresholds,
} from "./quality-gate.js";

export interface RepairLoopConfig {
  enabled: boolean;
  budget: number;
  minScore: number;
  minSubscore?: number;
  qualityDimensionThresholds?: QualityDimensionThresholds;
  requireStructuredReport?: boolean;
  maxActionsPerAttempt: number;
}

export interface RepairLoopOutcome {
  score: number;
  qualityReport?: QualityReportArtifact;
}

export interface RepairLoopDependencies {
  buildPlan: (
    qualityReport: QualityReportArtifact,
    remainingBudget: number,
    maxActionsPerAttempt: number,
  ) => RepairPlanArtifact;
  renderPlan: (plan: RepairPlanArtifact) => string;
  applyRepair: (
    repairBlueprint: string,
    attempt: number,
  ) => Promise<{ summary: string; systemMessage?: string } | null>;
  onRepairPlan: (plan: RepairPlanArtifact) => void;
  onSummaryUpdated: (result: {
    summary: string;
    systemMessage?: string;
  }) => Promise<void>;
  evaluate: () => Promise<RepairLoopOutcome>;
  canContinue?: () => boolean;
  onAttemptStarted?: (attempt: number, failureCount: number) => void;
  onAttemptCompleted?: (attempt: number, score: number) => void;
}

export interface RunRepairLoopInput {
  initialOutcome: RepairLoopOutcome;
  config: RepairLoopConfig;
  dependencies: RepairLoopDependencies;
}

export interface RunRepairLoopResult {
  outcome: RepairLoopOutcome;
  attempts: number;
}

export async function runTargetedRepairLoop(
  input: RunRepairLoopInput,
): Promise<RunRepairLoopResult> {
  const minSubscore = input.config.minSubscore ?? input.config.minScore;
  const requireStructuredReport = input.config.requireStructuredReport ?? true;

  const shouldAttemptRepair = (outcome: RepairLoopOutcome): boolean => {
    const gate = evaluateQualityGate(outcome, {
      minOverall: input.config.minScore,
      minSubscore,
      dimensionThresholds: input.config.qualityDimensionThresholds,
      requireStructuredReport,
    });
    if (gate.passes) {
      return false;
    }

    if (!outcome.qualityReport) {
      return false;
    }

    return outcome.qualityReport.failures.length > 0;
  };

  let attempts = 0;
  let outcome = input.initialOutcome;

  while (
    input.config.enabled &&
    attempts < input.config.budget &&
    shouldAttemptRepair(outcome)
  ) {
    const qualityReport = outcome.qualityReport;
    if (!qualityReport) {
      break;
    }

    if (input.dependencies.canContinue && !input.dependencies.canContinue()) {
      break;
    }

    const remainingBudget = input.config.budget - attempts;
    const repairPlan = input.dependencies.buildPlan(
      qualityReport,
      remainingBudget,
      input.config.maxActionsPerAttempt,
    );

    input.dependencies.onRepairPlan(repairPlan);

    const repairBlueprint = input.dependencies.renderPlan(repairPlan);
    if (!repairBlueprint) {
      break;
    }

    input.dependencies.onAttemptStarted?.(
      attempts + 1,
      qualityReport.failures.length,
    );

    const repairedResult = await input.dependencies.applyRepair(
      repairBlueprint,
      attempts + 1,
    );
    if (!repairedResult || repairedResult.summary.trim().length === 0) {
      break;
    }

    await input.dependencies.onSummaryUpdated(repairedResult);
    outcome = await input.dependencies.evaluate();
    attempts += 1;

    input.dependencies.onAttemptCompleted?.(attempts, outcome.score);
  }

  return {
    outcome,
    attempts,
  };
}

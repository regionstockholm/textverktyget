import type {
  QualityReportArtifact,
  QualitySubscoresArtifact,
} from "./pipeline-artifacts.js";

export type QualityDimension = keyof QualitySubscoresArtifact;
export type QualityDimensionThresholds = Partial<
  Record<QualityDimension, number>
>;

export interface QualityGateConfig {
  minOverall: number;
  minSubscore: number;
  dimensionThresholds?: QualityDimensionThresholds;
  requireStructuredReport: boolean;
}

export interface QualityGateInput {
  score: number;
  qualityReport?: QualityReportArtifact;
}

export interface QualityGateResult {
  passes: boolean;
  reason: "pass" | "missing_report" | "overall" | "subscores";
  failingDimensions: QualityDimension[];
  hasStructuredReport: boolean;
  overall: number;
}

const QUALITY_DIMENSIONS: QualityDimension[] = [
  "fidelity",
  "priorityOrder",
  "plainLanguage",
  "taskFit",
  "audienceFit",
  "intentFit",
];

export function getFailingSubscoreDimensions(
  report: QualityReportArtifact,
  minSubscore: number,
  dimensionThresholds?: QualityDimensionThresholds,
): QualityDimension[] {
  return QUALITY_DIMENSIONS.filter(
    (dimension) => {
      const thresholdCandidate = dimensionThresholds?.[dimension];
      const threshold =
        typeof thresholdCandidate === "number" &&
        Number.isFinite(thresholdCandidate) &&
        thresholdCandidate >= 1 &&
        thresholdCandidate <= 10
          ? Math.round(thresholdCandidate)
          : minSubscore;
      return report.subscores[dimension] < threshold;
    },
  );
}

export function ensureDimensionFailures(
  report: QualityReportArtifact,
  minSubscore: number,
  dimensionThresholds?: QualityDimensionThresholds,
): QualityReportArtifact {
  const failingDimensions = getFailingSubscoreDimensions(
    report,
    minSubscore,
    dimensionThresholds,
  );
  if (failingDimensions.length === 0) {
    return report;
  }

  const existingFailures = [...report.failures];
  const nextFailures = [...existingFailures];

  for (const dimension of failingDimensions) {
    const alreadyPresent = existingFailures.some(
      (failure) => failure.dimension === dimension,
    );
    if (alreadyPresent) {
      continue;
    }

    const score = report.subscores[dimension];
    const thresholdCandidate = dimensionThresholds?.[dimension];
    const threshold =
      typeof thresholdCandidate === "number" &&
      Number.isFinite(thresholdCandidate) &&
      thresholdCandidate >= 1 &&
      thresholdCandidate <= 10
        ? Math.round(thresholdCandidate)
        : minSubscore;
    nextFailures.push({
      sectionKey: `dimension:${dimension}`,
      dimension,
      reason: `Subscore ${score} underskrider gransvarde ${threshold}. Forbattra denna dimension.`,
    });
  }

  return {
    ...report,
    failures: nextFailures,
  };
}

export function evaluateQualityGate(
  input: QualityGateInput,
  config: QualityGateConfig,
): QualityGateResult {
  const hasStructuredReport = Boolean(input.qualityReport);

  if (config.requireStructuredReport && !hasStructuredReport) {
    return {
      passes: false,
      reason: "missing_report",
      failingDimensions: [],
      hasStructuredReport,
      overall: input.score,
    };
  }

  const overall = hasStructuredReport
    ? Number(input.qualityReport?.overall)
    : input.score;

  if (overall < config.minOverall) {
    return {
      passes: false,
      reason: "overall",
      failingDimensions: [],
      hasStructuredReport,
      overall,
    };
  }

  if (!input.qualityReport) {
    return {
      passes: true,
      reason: "pass",
      failingDimensions: [],
      hasStructuredReport,
      overall,
    };
  }

  const failingDimensions = getFailingSubscoreDimensions(
    input.qualityReport,
    config.minSubscore,
    config.dimensionThresholds,
  );
  if (failingDimensions.length > 0) {
    return {
      passes: false,
      reason: "subscores",
      failingDimensions,
      hasStructuredReport,
      overall,
    };
  }

  return {
    passes: true,
    reason: "pass",
    failingDimensions: [],
    hasStructuredReport,
    overall,
  };
}

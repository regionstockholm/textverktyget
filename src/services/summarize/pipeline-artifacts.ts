export interface QualitySubscoresArtifact {
  fidelity: number;
  priorityOrder: number;
  plainLanguage: number;
  taskFit: number;
  audienceFit: number;
  intentFit: number;
}

export interface QualityFailureArtifact {
  sectionKey: string;
  dimension: keyof QualitySubscoresArtifact;
  reason: string;
}

export interface QualityReportArtifact {
  overall: number;
  subscores: QualitySubscoresArtifact;
  failures: QualityFailureArtifact[];
}

export interface RepairActionArtifact {
  sectionKey: string;
  dimension: keyof QualitySubscoresArtifact;
  instruction: string;
}

export interface RepairPlanArtifact {
  remainingBudget: number;
  actions: RepairActionArtifact[];
}

const DIMENSIONS: readonly string[] = [
  "fidelity", "priorityOrder", "plainLanguage", "taskFit", "audienceFit", "intentFit",
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isSubscore(value: unknown): boolean {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 10;
}

export function validateQualityReportArtifact(value: unknown): value is QualityReportArtifact {
  if (!isRecord(value) || !isSubscore(value.overall) || !isRecord(value.subscores)) return false;
  const subscores = value.subscores;
  return DIMENSIONS.every((key) => isSubscore(subscores[key])) &&
    Array.isArray(value.failures) && value.failures.every((failure: unknown) =>
      isRecord(failure) && isNonEmptyString(failure.sectionKey) &&
      typeof failure.dimension === "string" && DIMENSIONS.includes(failure.dimension) &&
      isNonEmptyString(failure.reason),
    );
}

export function validateRepairPlanArtifact(value: unknown): value is RepairPlanArtifact {
  return isRecord(value) && typeof value.remainingBudget === "number" &&
    Number.isInteger(value.remainingBudget) && value.remainingBudget >= 0 && value.remainingBudget <= 100 &&
    Array.isArray(value.actions) && value.actions.every((action: unknown) =>
      isRecord(action) && isNonEmptyString(action.sectionKey) &&
      typeof action.dimension === "string" && DIMENSIONS.includes(action.dimension) &&
      isNonEmptyString(action.instruction),
    );
}

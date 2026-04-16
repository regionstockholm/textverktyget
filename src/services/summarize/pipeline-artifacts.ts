export type AudiencePriorityMode = "generic" | "specific";
export type RankingPolicy = "core-first" | "audience-first";

export interface AudienceProfileArtifact {
  targetAudience: string;
  priorityMode: AudiencePriorityMode;
  textType: string;
}

export interface SenderIntentProfileArtifact {
  summary: string;
  priorities: string[];
}

export interface ImportanceWeightsArtifact {
  coreImportance: number;
  audienceRelevance: number;
  senderIntentAlignment: number;
  riskIfOmitted: number;
  actionability: number;
}

export interface SourceSpanArtifact {
  start: number;
  end: number;
}

export interface ImportanceItemArtifact {
  id: string;
  sentence: string;
  sourceSpan: SourceSpanArtifact;
  weights: ImportanceWeightsArtifact;
  totalScore: number;
}

export interface ImportanceMapArtifact {
  rankingPolicy: RankingPolicy;
  items: ImportanceItemArtifact[];
}

export interface RewriteBlueprintSectionArtifact {
  key: "core-message" | "impact" | "context";
  title: string;
  objective: string;
  itemIds: string[];
}

export interface RewriteBlueprintArtifact {
  rankingPolicy: RankingPolicy;
  sections: RewriteBlueprintSectionArtifact[];
}

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

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isIntegerInRange(value: unknown, min: number, max: number): boolean {
  return typeof value === "number" && Number.isInteger(value) && value >= min && value <= max;
}

function isSubscoreValue(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 10;
}

export function validateAudienceProfileArtifact(
  value: unknown,
): value is AudienceProfileArtifact {
  if (!isRecord(value)) {
    return false;
  }

  if (!isNonEmptyString(value.targetAudience)) {
    return false;
  }

  if (value.priorityMode !== "generic" && value.priorityMode !== "specific") {
    return false;
  }

  return isNonEmptyString(value.textType);
}

export function validateSenderIntentProfileArtifact(
  value: unknown,
): value is SenderIntentProfileArtifact {
  if (!isRecord(value)) {
    return false;
  }

  if (!isNonEmptyString(value.summary)) {
    return false;
  }

  if (!Array.isArray(value.priorities)) {
    return false;
  }

  return value.priorities.every((item) => isNonEmptyString(item));
}

function validateImportanceWeightsArtifact(
  value: unknown,
): value is ImportanceWeightsArtifact {
  if (!isRecord(value)) {
    return false;
  }

  return (
    isIntegerInRange(value.coreImportance, 0, 10) &&
    isIntegerInRange(value.audienceRelevance, 0, 10) &&
    isIntegerInRange(value.senderIntentAlignment, 0, 10) &&
    isIntegerInRange(value.riskIfOmitted, 0, 10) &&
    isIntegerInRange(value.actionability, 0, 10)
  );
}

function validateSourceSpanArtifact(value: unknown): value is SourceSpanArtifact {
  if (!isRecord(value)) {
    return false;
  }

  if (!isIntegerInRange(value.start, 0, Number.MAX_SAFE_INTEGER)) {
    return false;
  }

  if (!isIntegerInRange(value.end, 0, Number.MAX_SAFE_INTEGER)) {
    return false;
  }

  const start = Number(value.start);
  const end = Number(value.end);
  return end >= start;
}

function validateImportanceItemArtifact(
  value: unknown,
): value is ImportanceItemArtifact {
  if (!isRecord(value)) {
    return false;
  }

  if (!isNonEmptyString(value.id) || !isNonEmptyString(value.sentence)) {
    return false;
  }

  if (!validateSourceSpanArtifact(value.sourceSpan)) {
    return false;
  }

  if (!validateImportanceWeightsArtifact(value.weights)) {
    return false;
  }

  return typeof value.totalScore === "number" && Number.isFinite(value.totalScore);
}

export function validateImportanceMapArtifact(
  value: unknown,
): value is ImportanceMapArtifact {
  if (!isRecord(value)) {
    return false;
  }

  if (
    value.rankingPolicy !== "core-first" &&
    value.rankingPolicy !== "audience-first"
  ) {
    return false;
  }

  if (!Array.isArray(value.items)) {
    return false;
  }

  return value.items.every((item) => validateImportanceItemArtifact(item));
}

function validateBlueprintSectionArtifact(
  value: unknown,
): value is RewriteBlueprintSectionArtifact {
  if (!isRecord(value)) {
    return false;
  }

  if (
    value.key !== "core-message" &&
    value.key !== "impact" &&
    value.key !== "context"
  ) {
    return false;
  }

  if (!isNonEmptyString(value.title) || !isNonEmptyString(value.objective)) {
    return false;
  }

  if (!Array.isArray(value.itemIds)) {
    return false;
  }

  return value.itemIds.every((itemId) => isNonEmptyString(itemId));
}

export function validateRewriteBlueprintArtifact(
  value: unknown,
): value is RewriteBlueprintArtifact {
  if (!isRecord(value)) {
    return false;
  }

  if (
    value.rankingPolicy !== "core-first" &&
    value.rankingPolicy !== "audience-first"
  ) {
    return false;
  }

  if (!Array.isArray(value.sections)) {
    return false;
  }

  return value.sections.every((section) => validateBlueprintSectionArtifact(section));
}

function validateQualitySubscoresArtifact(
  value: unknown,
): value is QualitySubscoresArtifact {
  if (!isRecord(value)) {
    return false;
  }

  return (
    isSubscoreValue(value.fidelity) &&
    isSubscoreValue(value.priorityOrder) &&
    isSubscoreValue(value.plainLanguage) &&
    isSubscoreValue(value.taskFit) &&
    isSubscoreValue(value.audienceFit) &&
    isSubscoreValue(value.intentFit)
  );
}

function validateQualityFailureArtifact(
  value: unknown,
): value is QualityFailureArtifact {
  if (!isRecord(value)) {
    return false;
  }

  const dimensions: Array<keyof QualitySubscoresArtifact> = [
    "fidelity",
    "priorityOrder",
    "plainLanguage",
    "taskFit",
    "audienceFit",
    "intentFit",
  ];

  return (
    isNonEmptyString(value.sectionKey) &&
    isNonEmptyString(value.reason) &&
    dimensions.includes(value.dimension as keyof QualitySubscoresArtifact)
  );
}

export function validateQualityReportArtifact(
  value: unknown,
): value is QualityReportArtifact {
  if (!isRecord(value)) {
    return false;
  }

  if (!isSubscoreValue(value.overall)) {
    return false;
  }

  if (!validateQualitySubscoresArtifact(value.subscores)) {
    return false;
  }

  if (!Array.isArray(value.failures)) {
    return false;
  }

  return value.failures.every((failure) => validateQualityFailureArtifact(failure));
}

function validateRepairActionArtifact(value: unknown): value is RepairActionArtifact {
  if (!isRecord(value)) {
    return false;
  }

  const dimensions: Array<keyof QualitySubscoresArtifact> = [
    "fidelity",
    "priorityOrder",
    "plainLanguage",
    "taskFit",
    "audienceFit",
    "intentFit",
  ];

  return (
    isNonEmptyString(value.sectionKey) &&
    isNonEmptyString(value.instruction) &&
    dimensions.includes(value.dimension as keyof QualitySubscoresArtifact)
  );
}

export function validateRepairPlanArtifact(
  value: unknown,
): value is RepairPlanArtifact {
  if (!isRecord(value)) {
    return false;
  }

  if (!isIntegerInRange(value.remainingBudget, 0, 100)) {
    return false;
  }

  if (!Array.isArray(value.actions)) {
    return false;
  }

  return value.actions.every((action) => validateRepairActionArtifact(action));
}

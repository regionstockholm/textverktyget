import {
  type QualityReportArtifact,
  type RepairPlanArtifact,
  type QualitySubscoresArtifact,
  validateRepairPlanArtifact,
} from "./pipeline-artifacts.js";

const DIMENSION_LABELS: Record<keyof QualitySubscoresArtifact, string> = {
  fidelity: "fidelity",
  priorityOrder: "priority order",
  plainLanguage: "plain language",
  taskFit: "task fit",
  audienceFit: "audience fit",
  intentFit: "intent fit",
};

const DIMENSION_INSTRUCTIONS: Record<keyof QualitySubscoresArtifact, string> = {
  fidelity:
    "Bevara faktainnehåll strikt och lägg inte till nya uppgifter. Kontrollera att viktiga fakta inte tappas.",
  priorityOrder:
    "Placera det viktigaste först. Se till att kärnbudskap och konsekvens kommer före bakgrund.",
  plainLanguage:
    "Använd kortare meningar, enklare ord och tydliga övergångar utan byråkratiskt språk. Om uppgiften är lättläst ska radbrytningar och styckesindelning också bli tydliga.",
  taskFit: "Följ uppgiftens formatkrav exakt, inklusive omfång och struktur.",
  audienceFit:
    "Anpassa formuleringar och fokus till målgruppen utan att förlora saklighet.",
  intentFit:
    "Stark transparens, tydlighet och inkluderande ton enligt avsändarens intention.",
};

function dimensionPriority(dimension: keyof QualitySubscoresArtifact): number {
  switch (dimension) {
    case "fidelity":
      return 0;
    case "priorityOrder":
      return 1;
    case "intentFit":
      return 2;
    case "plainLanguage":
      return 3;
    case "audienceFit":
      return 4;
    case "taskFit":
      return 5;
    default:
      return 10;
  }
}

export function buildRepairPlan(
  qualityReport: QualityReportArtifact,
  remainingBudget: number,
  maxActions: number,
): RepairPlanArtifact {
  const limitedFailures = [...qualityReport.failures]
    .sort(
      (a, b) => dimensionPriority(a.dimension) - dimensionPriority(b.dimension),
    )
    .slice(0, Math.max(0, maxActions));

  const actions = limitedFailures.map((failure) => ({
    sectionKey: failure.sectionKey,
    dimension: failure.dimension,
    instruction: `${DIMENSION_INSTRUCTIONS[failure.dimension]} Fokus: ${failure.reason}`,
  }));

  const repairPlan: RepairPlanArtifact = {
    remainingBudget: Math.max(0, remainingBudget),
    actions,
  };

  if (!validateRepairPlanArtifact(repairPlan)) {
    throw new Error("Invalid repairPlan artifact generated");
  }

  return repairPlan;
}

export function renderRepairBlueprint(repairPlan: RepairPlanArtifact): string {
  if (repairPlan.actions.length === 0) {
    return "";
  }

  const lines = [
    "TARGETED REPAIR PLAN",
    "Gör endast nödvandiga ändringar i angivna sektioner och dimensioner.",
  ];

  repairPlan.actions.forEach((action, index) => {
    lines.push(
      `${index + 1}) [${action.sectionKey}] ${DIMENSION_LABELS[action.dimension]}: ${action.instruction}`,
    );
  });

  lines.push("Behåll övriga delar oförändrade så långt det är möjligt.");
  return lines.join("\n");
}

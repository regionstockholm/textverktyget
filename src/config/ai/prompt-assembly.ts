import configService from "../../services/config/config-service.js";
import { listOrdlistaEntries } from "../../services/ordlista/ordlista-service.js";
import { assert } from "../../utils/safety-utils.js";
import type { ProcessingOptions } from "./ai-service-types.js";

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

export async function buildSystemMessage({
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
    const rewriteFallbackPrompt = await configService.getPrompt("rewriteFallback");
    message += rewriteFallbackPrompt;
  } else {
    message += taskPrompt;
  }

  message += "\n\n";
  message +=
    "Ge mig ENDAST den slutgiltiga versionen av den bearbetade texten UTAN dina kommentarer. Här är texten som ska skrivas om:";

  return message;
}

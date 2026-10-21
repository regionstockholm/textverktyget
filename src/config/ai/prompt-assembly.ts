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
  targetAudience,
  checkboxContent,
  rewritePlanDraft,
  repairInstructions,
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
    !taskPromptMode &&
    rewritePlanDraft &&
    rewritePlanDraft.trim().length > 0
  ) {
    message += "Omskrivningsutkast att FÖLJA (prioriterad ordning):\n";
    message += rewritePlanDraft.trim();
    message += "\n\n";
  }

  message += taskPrompt;

  if (taskPromptMode) {
    const selectedTask = await configService.getPrompt("task", { taskKey });
    message += `\n\nVALD UPPGIFT (kontext för analysen, utför inte sluttexten nu):\n${selectedTask}`;
    message += "\n\nGranska hela underlaget, även slutet. Ursprunglig placering är inte ett mått på vikt. Prioritera efter målgruppens behov och vald uppgift. Behåll ordningen om den redan fungerar; ändra annars dispositionen globalt.";
  } else if (repairInstructions?.trim()) {
    message += `\n\nKVALITETSREPARATION:\n${repairInstructions.trim()}`;
  }

  message += "\n\n";
  message +=
    taskPromptMode
      ? "Returnera endast den begärda interna analysen, inte en sluttext. Här är hela underlaget som ska granskas:"
      : "Ge mig ENDAST den slutgiltiga versionen av den bearbetade texten UTAN dina kommentarer. Följ omskrivningsutkastets disposition när ett utkast finns; uppgiftsprompten styr format och omfång. Här är texten som ska skrivas om:";

  return message;
}

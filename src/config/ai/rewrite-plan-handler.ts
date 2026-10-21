import { assert } from "../../utils/safety-utils.js";
import { getSummary } from "./ai-service-factory.js";
import { buildSystemMessage } from "./prompt-assembly.js";
import { availableInputCharacters, modelForCall, resolveAiConfig } from "./resolved-ai-config.js";
import type { ProcessingOptions } from "./ai-service-types.js";

/** Lossless splitting: every source character belongs to exactly one part. */
export function splitSourceText(text: string, capacity: number): string[] {
  if (capacity < 1) throw new Error("Modellens kontext räcker inte till analysinstruktionerna.");
  const parts: string[] = [];
  let start = 0;
  while (start < text.length) {
    let end = Math.min(start + capacity, text.length);
    if (end < text.length) {
      const boundary = text.lastIndexOf("\n", end - 1);
      if (boundary > start + capacity / 2) end = boundary + 1;
      // Do not split a Unicode surrogate pair.
      if (/[\uD800-\uDBFF]/.test(text[end - 1] || "")) end--;
    }
    if (end <= start) throw new Error("Modellens kontext är för liten för källanalys.");
    parts.push(text.slice(start, end));
    start = end;
  }
  return parts;
}

interface DraftDependencies {
  generate: typeof getSummary;
  capacity: (options: ProcessingOptions) => Promise<number>;
}

async function inputCapacity(options: ProcessingOptions): Promise<number> {
  const ai = await resolveAiConfig();
  const model = modelForCall(ai.settings, false);
  if (model.model !== ai.settings.model) model.contextWindow = undefined;
  const prompt = await buildSystemMessage(options);
  return availableInputCharacters(ai.provider, model) - prompt.length - 2;
}

/** Review every source part, then build one global plan. Never silently skip analysis. */
export async function generateRewritePlanDraft(
  text: string,
  options: ProcessingOptions,
  maxParts = 100,
  dependencies: DraftDependencies = { generate: getSummary, capacity: inputCapacity },
): Promise<string> {
  assert(typeof text === "string" && text.trim().length > 0, "Text cannot be empty");
  const planOptions: ProcessingOptions = {
    ...options,
    taskPromptMode: "rewritePlanDraft",
    aiCallPurpose: "background",
    rewritePlanDraft: undefined,
    repairInstructions: undefined,
  };
  const generate = async (input: string, settings: ProcessingOptions): Promise<string> => {
    const result = await dependencies.generate(input, settings);
    if (!result.summary?.trim()) throw new Error("Källanalysen gav ett tomt svar. Ingen text har skrivits om.");
    return result.summary.trim();
  };
  const planCapacity = await dependencies.capacity(planOptions);
  if (text.length <= planCapacity) return generate(text, planOptions);

  const analysisOptions: ProcessingOptions = { ...planOptions, taskPromptMode: "sourceAnalysis" };
  const capacity = await dependencies.capacity(analysisOptions) - 100;
  const parts = splitSourceText(text, capacity);
  if (parts.length > maxParts) {
    throw new Error(`Hela texten kräver ${parts.length} analysdelar, över gränsen ${maxParts}. Välj en modell med större kontext eller höj gränsen. Inga delar har utelämnats.`);
  }
  let notes: string[] = [];
  for (const [index, part] of parts.entries()) {
    notes.push(`KÄLLDEL ${index + 1}/${parts.length}\n${await generate(part, analysisOptions)}`);
  }

  const introduction = "KÄLLANTECKNINGAR FRÅN HELA ORIGINALTEXTEN\nSkapa en gemensam disposition över samtliga delar. Delnumret anger källan, inte prioritet. Jämför även de sista delarnas budskap med de första.\n\n";
  const mergeCapacity = planCapacity - introduction.length;
  if (mergeCapacity < 1) throw new Error("Modellens kontext räcker inte till en gemensam disposition.");
  for (let level = 0; level < 10; level++) {
    const combined = notes.join("\n\n");
    if (combined.length <= mergeCapacity) return generate(introduction + combined, planOptions);
    // Every note is included in hierarchical synthesis, including the final group.
    const groups = splitSourceText(combined, mergeCapacity);
    const merged: string[] = [];
    for (const group of groups) merged.push(await generate(introduction + group, planOptions));
    if (merged.join("\n\n").length >= combined.length) {
      throw new Error("Källanalysen kan inte sammanställas inom modellens kontext. Välj en modell med större kontext; ingen del har utelämnats.");
    }
    notes = merged;
  }
  throw new Error("Källanalysen kunde inte ge en gemensam disposition för hela texten.");
}

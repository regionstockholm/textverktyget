import type { ReasoningPolicy } from "../catalog/types.js";
type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

export function anthropicThinking(policy: ReasoningPolicy, enabled: boolean, maxTokens: number): Record<string, JsonValue> {
  if (policy.mode === "anthropic-adaptive") {
    const on = enabled || !policy.canDisable;
    return on ? { thinking: { type: "adaptive" }, output_config: { effort: policy.enabledEffort } } : { thinking: { type: "disabled" } };
  }
  if (policy.mode === "anthropic-budget" && enabled) {
    if (maxTokens <= policy.minimumBudget) throw new Error("Output budget is too small for this model's thinking minimum");
    return { thinking: { type: "enabled", budget_tokens: Math.min(policy.defaultBudget, Math.max(policy.minimumBudget, Math.floor(maxTokens / 4)), maxTokens - 1) } };
  }
  return {};
}

export function responsesReasoning(policy: ReasoningPolicy, enabled: boolean): Record<string, unknown> {
  if (policy.mode === "effort") return { reasoning: { effort: enabled || !policy.canDisable ? policy.enabledEffort : policy.disabledEffort } };
  if (policy.mode === "openrouter") return { reasoning: { enabled: enabled || !policy.canDisable, exclude: true } };
  return {};
}

export function readResponseOutput(response: any): string {
  if (typeof response.output_text === "string") return response.output_text;
  return (response.output || []).filter((item: any) => item.type === "message").flatMap((item: any) => item.content || [])
    .filter((part: any) => part.type === "output_text").map((part: any) => part.text || "").join("");
}

export class IncompleteOutputError extends Error {}

export function assertCompleteResponse(response: any): void {
  const reasons = [response.stop_reason, response.stopReason, response.finish_reason,
    response.choices?.[0]?.finish_reason, response.candidates?.[0]?.finishReason];
  const complete = new Set(["stop", "end_turn", "stop_sequence", "complete", "completed"]);
  const hasCompletion = response.status === "completed" || reasons.some(reason => reason != null && complete.has(String(reason).toLowerCase()));
  if (!hasCompletion || (response.status && response.status !== "completed") || response.error ||
      response.promptFeedback?.blockReason ||
      response.choices?.[0]?.message?.refusal ||
      (Array.isArray(response.output) && response.output.some((item: any) => item.type === "message" &&
        (item.status && item.status !== "completed" || item.content?.some((part: any) => part.type === "refusal")))) ||
      reasons.some(reason => reason != null && !complete.has(String(reason).toLowerCase()))) {
    throw new IncompleteOutputError("AI-svaret är avbrutet, blockerat eller ofullständigt. Ingen fullständig bearbetning eller granskning kan bekräftas. Kontrollera modellens kontext- och utdatagränser.");
  }
}

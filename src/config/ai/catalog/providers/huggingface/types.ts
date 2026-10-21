import type { ModelInput, EffortReasoning, NoReasoning } from "../../types.js";
export type HuggingfaceModelInput = ModelInput<"huggingface", EffortReasoning | NoReasoning | { mode: "always-on" }>;

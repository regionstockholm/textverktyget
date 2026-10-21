import type { ModelInput, NoReasoning, EffortReasoning } from "../../types.js";
export type LocalModelInput = ModelInput<"local", NoReasoning | EffortReasoning | { mode: "qwen-template" } | { mode: "always-on" }>;

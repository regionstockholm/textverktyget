import type { ModelInput, NoReasoning } from "../../types.js";
export type DeepseekModelInput = ModelInput<"deepseek", NoReasoning | { mode: "thinking-toggle" } | { mode: "always-on" }>;

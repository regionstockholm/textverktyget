import type { ModelInput, AnthropicReasoning, AdaptiveReasoning, NovaReasoning, EffortReasoning, NoReasoning } from "../../types.js";
export type BedrockModelInput = ModelInput<"bedrock", AnthropicReasoning | AdaptiveReasoning | NovaReasoning | EffortReasoning | NoReasoning | { mode: "always-on" }>;

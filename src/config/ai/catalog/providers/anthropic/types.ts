import type { ModelInput, AnthropicReasoning, AdaptiveReasoning, NoReasoning } from "../../types.js";
export type AnthropicModelInput = ModelInput<"anthropic", AnthropicReasoning | AdaptiveReasoning | NoReasoning>;

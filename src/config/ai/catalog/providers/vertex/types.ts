import type { ModelInput, BudgetReasoning, LevelReasoning, AnthropicReasoning, AdaptiveReasoning, EffortReasoning, NoReasoning } from "../../types.js";
export type VertexModelInput = ModelInput<"vertex", BudgetReasoning | LevelReasoning | AnthropicReasoning | AdaptiveReasoning | EffortReasoning | NoReasoning>;

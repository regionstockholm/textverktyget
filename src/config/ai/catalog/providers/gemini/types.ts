import type { ModelInput, BudgetReasoning, LevelReasoning, NoReasoning } from "../../types.js";
export type GeminiModelInput = ModelInput<"gemini", BudgetReasoning | LevelReasoning | NoReasoning>;

import type { ModelInput, CohereReasoning, NoReasoning } from "../../types.js";
export type CohereModelInput = ModelInput<"cohere", CohereReasoning | NoReasoning>;

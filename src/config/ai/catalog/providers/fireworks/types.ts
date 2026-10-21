import type { ModelInput, NoReasoning, EffortReasoning } from "../../types.js";
export type FireworksModelInput = ModelInput<"fireworks", NoReasoning | EffortReasoning | { mode: "always-on" }>;

import type { ModelInput, EffortReasoning, NoReasoning } from "../../types.js";
export type XaiModelInput = ModelInput<"xai", EffortReasoning | NoReasoning | { mode: "always-on" }>;

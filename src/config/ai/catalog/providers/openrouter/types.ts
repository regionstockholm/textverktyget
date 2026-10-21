import type { ModelInput, NoReasoning } from "../../types.js";
export type OpenrouterModelInput = ModelInput<"openrouter", NoReasoning | { mode: "openrouter"; canDisable: boolean }>;

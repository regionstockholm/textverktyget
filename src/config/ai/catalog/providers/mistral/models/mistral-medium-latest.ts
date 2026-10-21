import { defineModel } from "../../../validation.js";
import type { MistralModelInput } from "../types.js";
export default defineModel({ provider: "mistral", id: "mistral-medium-latest", displayName: "Mistral Medium (latest alias)",
  limits: { contextWindow: 128000, maxOutputTokens: 8192, verification: "conservative" }, reasoning: { mode: "none" },
  nativeCapabilities: { reasoning: true }, temperature: "supported", structuredOutput: "json-schema", status: "deprecated",
  metadata: { reviewedAt: "2026-10-02", revision: 1, sources: ["https://docs.mistral.ai/getting-started/models", "https://docs.mistral.ai/studio/conversations/reasoning.md"], notes: "The current reasoning guide names mistral-medium-3-5 explicitly. Alias target/availability not confirmed; choose the explicit 3.5 profile for documented reasoning behavior. Conservative output ceiling." } } satisfies MistralModelInput);

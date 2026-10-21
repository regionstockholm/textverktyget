import type { ModelInput } from "./types.js";

export const GOOGLE_GROUNDING_SOURCE = "https://github.com/google-gemini/cookbook/blob/main/quickstarts/Grounding.ipynb";
const generateContentSource = "https://github.com/google-gemini/cookbook/blob/archive/generate-content-api/quickstarts/Grounding.ipynb";
const vertexSource = "https://github.com/GoogleCloudPlatform/generative-ai/blob/main/gemini/grounding/intro-grounding-gemini.ipynb";

// Explicitly documented text models; never infer support for image/audio/live variants.
const documentedModels = new Set([
  "gemini-2.5-flash", "gemini-2.5-flash-lite", "gemini-2.5-pro",
  "gemini-3.1-pro-preview", "gemini-3.1-flash-lite", "gemini-3.5-flash", "gemini-3.5-flash-lite", "gemini-3.6-flash",
  "gemini-3.7-flash", "gemini-3.8-flash",
]);

/** Maintained alongside local definitions; API model listings omit tool capabilities. */
export function withGoogleGrounding<T extends ModelInput>(model: T): T {
  const id = (model.apiModelId || model.id).replace(/^models\//, "");
  const documented = model.provider === "gemini" ? documentedModels.has(id) : model.provider === "vertex" && id === "gemini-3.8-flash";
  if (!documented) return model;
  const note = "Google Search grounding is documented separately from the model-list API; the model decides whether to search.";
  return { ...model, webSearch: true, metadata: { ...model.metadata,
    reviewedAt: model.metadata.reviewedAt < "2026-10-05" ? "2026-10-05" : model.metadata.reviewedAt,
    revision: Math.max(2, model.metadata.revision),
    sources: [...new Set([...model.metadata.sources, ...(model.provider === "vertex" ? [vertexSource] : [GOOGLE_GROUNDING_SOURCE, generateContentSource])])],
    notes: model.metadata.notes.includes(note) ? model.metadata.notes : `${model.metadata.notes} ${note}`,
  } };
}

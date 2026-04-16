export const GEMINI_MODEL_WHITELIST = new Set<string>([
  "models/gemini-2.5-flash",
  "models/gemini-1.5-pro",
  "models/gemini-1.5-flash",
  "models/gemini-1.5-flash-8b",
]);

export function normalizeGeminiModel(model: string): string {
  const trimmed = model.trim();
  if (!trimmed) {
    return trimmed;
  }

  if (trimmed.startsWith("models/")) {
    return trimmed;
  }

  return `models/${trimmed}`;
}

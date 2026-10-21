import type { ModelCapabilities, ModelDefinition, LlmSettings } from "./types.js";

export function capabilitiesForModel(model: ModelDefinition): ModelCapabilities {
  const reasoning = model.reasoning.mode !== "none";
  const alwaysOn = model.reasoning.mode === "always-on" || ("canDisable" in model.reasoning && !model.reasoning.canDisable);
  return { contextWindow: model.limits.contextWindow, maxOutputTokens: model.limits.maxOutputTokens,
    temperature: model.temperature === "supported", reasoning, reasoningAlwaysOn: alwaysOn,
    webSearch: model.webSearch, structuredOutput: model.structuredOutput !== "prompt" };
}

export function defaultsForModel(model: ModelDefinition): LlmSettings {
  const window = model.limits.contextWindow;
  const reserve = Math.min(4096, Math.floor(window / 4));
  return { model: model.apiModelId, modelProfile: model.id, temperature: model.defaults.temperature,
    maxOutputTokens: Math.min(Math.floor(model.limits.maxOutputTokens * model.defaults.outputFraction), window - reserve),
    contextWindow: window, useWebSearch: false, useThinking: model.reasoning.mode !== "none" };
}

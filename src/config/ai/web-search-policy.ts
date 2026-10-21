import type { ProcessingOptions } from "./ai-service-types.js";
import { isTaskExecution } from "./reasoning-policy.js";
import { ProviderError } from "./providers/transport.js";

/** Resolve against the selected serving model, also on provider fallback. */
export function resolveWebSearch(providerDefault: boolean, supported: boolean, options?: ProcessingOptions, quality = false): boolean {
  if (quality) return false;
  const mode = isTaskExecution(options) ? options?.webSearchMode ?? "inherit" : "inherit";
  if (mode === "off") return false;
  if (mode === "on" && !supported) {
    throw new ProviderError("Search / grounding is enabled for this task, but the selected model or fallback adapter does not support it. Choose a grounding-capable task model or change the task search setting.");
  }
  return supported && (mode === "on" || providerDefault);
}

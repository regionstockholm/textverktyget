import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { defineModel, validateModelDefinition } from "./validation.js";
import type { ModelDefinition, ModelInput } from "./types.js";

/** JSON is operator-maintained data, never executable code and never fetched remotely. */
export function loadCustomProfiles(directory: string): ModelDefinition[] {
  const models: ModelDefinition[] = [];
  const visit = (path: string, depth: number) => {
    for (const entry of readdirSync(path, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      if (entry.isSymbolicLink()) throw new Error("Catalog profile symlinks are not supported");
      const file = join(path, entry.name);
      if (entry.isDirectory() && depth < 1) visit(file, depth + 1);
      else if (entry.isFile() && entry.name.endsWith(".json")) {
        if (statSync(file).size > 1024 * 1024) throw new Error("Catalog profile exceeds 1 MB");
        try {
          const input = JSON.parse(readFileSync(file, "utf8")) as ModelInput;
          const allowed = new Set(["provider", "id", "apiModelId", "displayName", "aliases", "limits", "reasoning", "temperature", "structuredOutput", "webSearch", "nativeCapabilities", "outputTokenParameter", "deploymentRequired", "apiStyle", "readiness", "status", "metadata", "defaults"]);
          if (!input || typeof input !== "object" || Array.isArray(input) || Object.keys(input).some(key => !allowed.has(key))) throw new Error("Unknown profile field; profiles contain model metadata only, never credentials or endpoints");
          const definition = defineModel(input);
          validateModelDefinition(definition);
          models.push(definition);
        } catch (error) { throw new Error(`Invalid catalog profile ${entry.name}: ${error instanceof Error ? error.message : "invalid JSON"}`); }
      }
    }
  };
  visit(directory, 0);
  return models;
}

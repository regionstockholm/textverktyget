import type { AdminModel } from "../../../config/ai/catalog/types.js";

export interface ModelFilters { query: string; reasoning: boolean; structuredOutput: boolean; previews: boolean; archived: boolean; }

export function filterModels(models: readonly AdminModel[], filters: ModelFilters, selectedId: string): AdminModel[] {
  const words = filters.query.toLocaleLowerCase().trim().split(/\s+/).filter(Boolean);
  return models.filter(model => {
    if (model.id === selectedId) return true;
    if (!filters.archived && (model.status === "retired" || model.status === "deprecated" || model.readiness.adapter === "pending")) return false;
    if (!filters.previews && model.status === "preview") return false;
    if (filters.reasoning && !model.reasoning) return false;
    if (filters.structuredOutput && !model.structuredOutput) return false;
    const text = [model.id, model.apiModelId, model.displayName, ...model.aliases].join(" ").toLocaleLowerCase();
    return words.every(word => text.includes(word));
  }).sort((a, b) => {
    const order = (model: AdminModel) => model.readiness.adapter === "pending" ? 4 : model.status === "active" ? model.deploymentRequired ? 1 : 0 : model.status === "preview" ? 2 : 3;
    return order(a) - order(b) || a.displayName.localeCompare(b.displayName);
  });
}

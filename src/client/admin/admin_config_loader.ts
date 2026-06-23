import {
  getDefaultRewritePlanTasks,
} from "./admin_constants.js";
import type { AdminContext } from "./admin_context.js";
import type { AdminConfigResponse } from "./admin_types.js";
import { resolveRewritePlanTasks } from "./admin_utils.js";
import type { PromptPanel } from "./panels/prompt-panel.js";
import type { RuntimeSettingsPanel } from "./panels/runtime-settings-panel.js";
import type { TargetAudiencePanel } from "./panels/target-audience-panel.js";
import type { TaskPanel } from "./panels/task-panel.js";

type ConfigLoaderDependencies = {
  prompts: PromptPanel;
  runtime: RuntimeSettingsPanel;
  targetAudiences: TargetAudiencePanel;
  tasks: TaskPanel;
};

export type AdminConfigLoader = {
  load(): Promise<void>;
};

export function initAdminConfigLoader(
  context: AdminContext,
  dependencies: ConfigLoaderDependencies,
): AdminConfigLoader {
  const { request, state, feedback } = context;
  const { setStatus } = feedback;

  const load = async (): Promise<void> => {
    try {
      setStatus("Hämtar konfiguration...");
      const data = await request<AdminConfigResponse>("GET", "/admin/config");
      resetLoadState();
      dependencies.prompts.setFields(data?.prompts);
      dependencies.runtime.applyConfig(data?.global, data?.providers?.gemini);
      state.rewritePlanTasks = data?.global
        ? resolveRewritePlanTasks(data.global.rewritePlanTasks)
        : getDefaultRewritePlanTasks();
      await dependencies.targetAudiences.loadCatalog();
      await dependencies.tasks.loadCatalog();
      setStatus("Konfiguration hämtad.");
    } catch (error) {
      setStatus(
        error instanceof Error
          ? error.message
          : "Kunde inte hämta konfiguration.",
      );
    }
  };

  function resetLoadState(): void {
    state.lastTargetAudience = "";
    state.lastEasyToReadTargetAudience = "";
    state.lastTaskPrompt = "";
  }

  return { load };
}

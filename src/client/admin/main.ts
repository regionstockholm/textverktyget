import { createAdminApiClient } from "./admin_api.js";
import { createAdminBackupClient } from "./admin_backup.js";
import { initAdminConfigLoader, type AdminConfigLoader } from "./admin_config_loader.js";
import type { AdminContext } from "./admin_context.js";
import { initRefs } from "./admin_dom.js";
import { createAdminFeedback } from "./admin_feedback.js";
import { createAdminState } from "./admin_state.js";
import { initAdminViewRouter } from "./admin_view_router.js";
import { initBackupPanel } from "./panels/backup-panel.js";
import { initEasyReadPanel, type EasyReadPanel } from "./panels/easy-read-panel.js";
import { initOrdlistaPanel } from "./panels/ordlista-panel.js";
import { initPromptPanel } from "./panels/prompt-panel.js";
import { initRuntimeSettingsPanel } from "./panels/runtime-settings-panel.js";
import { initSecretsPanel } from "./panels/secrets-panel.js";
import { initTargetAudiencePanel } from "./panels/target-audience-panel.js";
import { initTaskPanel } from "./panels/task-panel.js";

function initAdminUI(): void {
  const refs = initRefs();
  if (!refs) {
    return;
  }

  const state = createAdminState();
  const getToken = (): string => refs.tokenInput.value.trim();
  const apiClient = createAdminApiClient(getToken);
  const backupClient = createAdminBackupClient(getToken);
  const feedback = createAdminFeedback(refs.statusEl, refs.hintEl);
  const context: AdminContext = {
    refs,
    request: apiClient.request,
    feedback,
    state,
  };

  const runtime = initRuntimeSettingsPanel(context);
  let easyReadPanel: EasyReadPanel | null = null;
  const tasks = initTaskPanel(context, {
    onCatalogChanged: () => easyReadPanel?.syncTaskControls(),
  });
  const targetAudiences = initTargetAudiencePanel(context);
  easyReadPanel = initEasyReadPanel(context, {
    runtime,
    targetAudiences,
    tasks,
  });
  const prompts = initPromptPanel(context);
  const ordlista = initOrdlistaPanel({
    refs,
    request: apiClient.request,
    feedback,
  });

  let configLoader: AdminConfigLoader | null = null;
  initBackupPanel({
    refs,
    backupClient,
    feedback,
    onImported: () => {
      configLoader?.load();
      ordlista.load();
    },
  });

  configLoader = initAdminConfigLoader(context, {
    prompts,
    runtime,
    targetAudiences,
    tasks,
  });
  refs.checkButton.addEventListener("click", () => {
    configLoader?.load();
  });
  const viewRouter = initAdminViewRouter(refs, {
    onTargetAudiences: () => targetAudiences.loadSelectedPrompt(),
    onEasyRead: () => easyReadPanel?.load(),
    onOrdlista: () => ordlista.load(),
  });

  runtime.init();
  targetAudiences.init();
  tasks.init();
  easyReadPanel.init();
  prompts.init();
  initSecretsPanel(context);
  viewRouter.init();

  loadToken(refs.tokenInput);
  if (getToken()) {
    configLoader.load();
  }
  viewRouter.setActiveView("prompts");
}

function loadToken(tokenInput: HTMLInputElement): void {
  const stored = localStorage.getItem("adminApiKey");
  if (stored) {
    tokenInput.value = stored;
  }
}

document.addEventListener("DOMContentLoaded", () => {
  initAdminUI();
});

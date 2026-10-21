import { createAdminApiClient } from "./admin_api.js";
import { createAdminBackupClient } from "./admin_backup.js";
import { initAdminConfigLoader, type AdminConfigLoader } from "./admin_config_loader.js";
import type { AdminContext } from "./admin_context.js";
import { initRefs } from "./admin_dom.js";
import { createAdminFeedback } from "./admin_feedback.js";
import { createAdminState } from "./admin_state.js";
import { initAdminViewRouter } from "./admin_view_router.js";
import { initBackupPanel } from "./panels/backup-panel.js";
import { initOrdlistaPanel } from "./panels/ordlista-panel.js";
import { initPromptPanel } from "./panels/prompt-panel.js";
import { initRuntimeSettingsPanel } from "./panels/runtime-settings-panel.js";
import { initAiPanel } from "./panels/ai-panel.js";
import { initTargetAudiencePanel } from "./panels/target-audience-panel.js";
import { initTaskPanel } from "./panels/task-panel.js";
import { initUsersPanel } from "./panels/users-panel.js";
import { initUserBackupPanel } from "./panels/user-backup-panel.js";
import { initSubmissionLogPanel } from "./panels/submission-log-panel.js";
import { onDocumentReady } from "./document-ready.js";

function initAdminUI(): void {
  const getToken = (): string => ""; // Browser requests authenticate using the HttpOnly admin cookie.
  const apiClient = createAdminApiClient(getToken);
  let users: ReturnType<typeof initUsersPanel> | null = null;
  // Register this standalone feature before other panels can fail initialization.
  initUserBackupPanel(apiClient, async () => { await users?.load(); });
  const refs = initRefs();
  if (!refs) {
    const status = document.getElementById("admin-status");
    if (status) status.textContent = "Adminpanelen kunde inte startas: HTML och JavaScript stämmer inte överens. Ladda om sidan utan cache.";
    return;
  }

  const state = createAdminState();
  const backupClient = createAdminBackupClient(getToken);
  const feedback = createAdminFeedback(refs.statusEl, refs.hintEl);
  const context: AdminContext = {
    refs,
    request: apiClient.request,
    feedback,
    state,
  };

  const runtime = initRuntimeSettingsPanel(context);
  users = initUsersPanel(context);
  const submissionLog = initSubmissionLogPanel(context);
  const ai = initAiPanel(context);
  const tasks = initTaskPanel(context);
  const targetAudiences = initTargetAudiencePanel(context);
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
    onImported: async () => {
      await Promise.all([configLoader?.load(), ordlista.load()]);
    },
  });

  configLoader = initAdminConfigLoader(context, {
    prompts,
    runtime,
    targetAudiences,
    tasks,
    ai,
  });
  refs.checkButton.addEventListener("click", () => {
    configLoader?.load();
  });
  const viewRouter = initAdminViewRouter(refs, {
    onTargetAudiences: () => targetAudiences.loadSelectedPrompt(),
    onOrdlista: () => ordlista.load(),
    onUsers: () => { void users?.load(); },
    onSubmissionLog: () => { void submissionLog.load(); },
  });

  runtime.init();
  users.init();
  submissionLog.init();
  targetAudiences.init();
  tasks.init();
  prompts.init();
  viewRouter.init();

  try { localStorage.removeItem("adminApiKey"); } catch { /* Storage may be disabled. */ }
  void configLoader.load();
  document.getElementById("admin-logout")?.addEventListener("click", event => {
    const button = event.currentTarget as HTMLButtonElement;
    button.disabled = true;
    void fetch("/admin/logout", { method: "POST", credentials: "same-origin" })
      .then(response => {
        if (!response.ok) throw new Error("Det gick inte att logga ut.");
        window.location.replace("/admin-ui");
      }).catch(error => {
        feedback.setStatus(error instanceof Error ? error.message : "Det gick inte att logga ut.");
        button.disabled = false;
      });
  });
  viewRouter.setActiveView(window.location.hash.slice(1) || "prompts");
}

onDocumentReady(initAdminUI);

import { TARGET_AUDIENCE_PREFIX } from "../admin_constants.js";
import type { AdminContext } from "../admin_context.js";
import { getRequiredElement } from "../admin_dom.js";
import { getRuntimeObject } from "../admin_utils.js";
import type { RuntimeSettingsPanel } from "./runtime-settings-panel.js";
import type { TargetAudiencePanel } from "./target-audience-panel.js";
import type { TaskPanel } from "./task-panel.js";

type EasyReadPanelDependencies = {
  runtime: RuntimeSettingsPanel;
  targetAudiences: TargetAudiencePanel;
  tasks: TaskPanel;
};

export type EasyReadPanel = {
  init(): void;
  load(): Promise<void>;
  syncTaskControls(): void;
};

type PromptField = {
  promptName: string;
  field: HTMLTextAreaElement;
};

export function initEasyReadPanel(
  context: AdminContext,
  dependencies: EasyReadPanelDependencies,
): EasyReadPanel {
  const { refs, request, state, feedback } = context;
  const { runtime, targetAudiences, tasks } = dependencies;
  const { setStatus, showHint, showButtonHint } = feedback;

  const syncTaskControls = (): void => {
    const easyTask = tasks.getEasyToReadTaskDefinition();
    const exists = Boolean(easyTask);
    refs.easyReadTaskEnabled.disabled = !exists;
    refs.saveEasyReadSettingsButton.disabled = !exists;
    refs.easyReadTaskEnabled.checked = exists ? Boolean(easyTask?.enabled) : false;
  };

  const load = async (): Promise<void> => {
    try {
      setStatus("Hämtar lättläst-inställningar...");
      syncTaskControls();
      await loadPrompts();
      state.lastEasyToReadTargetAudience = "";
      await loadTargetAudiencePrompt();
      setStatus("Lättläst-inställningar hämtade.");
    } catch (error) {
      setStatus(
        error instanceof Error
          ? error.message
          : "Kunde inte hämta lättläst-inställningar.",
      );
    }
  };

  const init = (): void => {
    syncTaskControls();
    refs.saveEasyReadSettingsButton.addEventListener("click", () => {
      saveSettings();
    });
    refs.easyReadTargetAudienceSelect.addEventListener("change", () => {
      state.lastEasyToReadTargetAudience = "";
      loadTargetAudiencePrompt();
    });
    refs.easyReadTargetAudienceSaveButton.addEventListener("click", () => {
      saveTargetAudiencePrompt();
    });
    bindPromptSaveButtons();
  };

  async function loadPrompts(): Promise<void> {
    const fields = getPromptFields();
    const loadedPrompts = await Promise.all(
      fields.map(async ({ promptName }) => ({
        promptName,
        content: await readPromptContent(promptName),
      })),
    );

    loadedPrompts.forEach((loaded) => {
      const target = fields.find((entry) => entry.promptName === loaded.promptName);
      if (target) {
        target.field.value = loaded.content;
      }
    });
  }

  function getPromptFields(): PromptField[] {
    const fields = getBasePromptFields();
    const easyTask = tasks.getEasyToReadTaskDefinition();
    if (easyTask) {
      fields.unshift({
        promptName: `task:${easyTask.key}`,
        field: refs.easyReadPromptTask,
      });
    }
    return fields;
  }

  function getBasePromptFields(): PromptField[] {
    return [
      { promptName: "importantRules", field: refs.easyReadPromptImportantRules },
      { promptName: "role", field: refs.easyReadPromptRole },
      { promptName: "senderIntent", field: refs.easyReadPromptSenderIntent },
      { promptName: "rewritePlan", field: refs.easyReadPromptRewritePlan },
      {
        promptName: "qualityEvaluation",
        field: refs.easyReadPromptQualityEvaluation,
      },
      { promptName: "wordListUsage", field: refs.easyReadPromptWordListUsage },
      { promptName: "rewriteFallback", field: refs.easyReadPromptRewriteFallback },
      {
        promptName: "targetAudience",
        field: refs.easyReadPromptTargetAudienceFallback,
      },
    ];
  }

  async function readPromptContent(promptName: string): Promise<string> {
    const data = await request<{ content?: string }>(
      "GET",
      `/admin/prompts/${encodeURIComponent(promptName)}`,
    );
    return data?.content || "";
  }

  async function loadTargetAudiencePrompt(): Promise<void> {
    const audienceValue = refs.easyReadTargetAudienceSelect.value;
    if (!audienceValue) {
      return;
    }

    targetAudiences.updateEasyReadLabels();
    if (state.lastEasyToReadTargetAudience === audienceValue) {
      return;
    }

    try {
      refs.easyReadTargetAudiencePrompt.value = await readPromptContent(
        `${TARGET_AUDIENCE_PREFIX}${audienceValue}`,
      );
      state.lastEasyToReadTargetAudience = audienceValue;
    } catch (error) {
      state.lastEasyToReadTargetAudience = "";
      setStatus(
        error instanceof Error
          ? error.message
          : "Kunde inte hämta lättläst målgruppsprompt.",
      );
    }
  }

  async function saveTargetAudiencePrompt(): Promise<void> {
    const audienceValue = refs.easyReadTargetAudienceSelect.value;
    if (!audienceValue) {
      return;
    }

    const label = targetAudiences.getAudienceMeta(audienceValue)?.label || audienceValue;
    try {
      setStatus(`Sparar lättläst målgrupp: ${label}...`);
      await request("PUT", promptPath(`${TARGET_AUDIENCE_PREFIX}${audienceValue}`), {
        content: refs.easyReadTargetAudiencePrompt.value || "",
      });
      state.lastEasyToReadTargetAudience = "";
      await loadTargetAudiencePrompt();
      setStatus(`Lättläst målgrupp sparad: ${label}`);
      showHint("Sparat.", "success");
      showButtonHint(refs.easyReadTargetAudienceSaveButton, "Sparat.", "success");
    } catch (error) {
      setStatus(
        error instanceof Error
          ? error.message
          : "Kunde inte spara lättläst målgrupp.",
      );
      showButtonHint(refs.easyReadTargetAudienceSaveButton, "Fel.", "error");
    }
  }

  async function savePrompt(
    promptName: string,
    field: HTMLTextAreaElement,
    button?: HTMLButtonElement,
  ): Promise<void> {
    if (!field.value.trim()) {
      setStatus("Prompten kan inte vara tom.");
      showButtonHint(button ?? null, "Fel.", "error");
      return;
    }

    try {
      setStatus(`Sparar lättläst-prompt: ${promptName}...`);
      await request("PUT", promptPath(promptName), { content: field.value || "" });
      setStatus(`Lättläst-prompt sparad: ${promptName}`);
      showHint("Sparat.", "success");
      showButtonHint(button ?? null, "Sparat.", "success");
    } catch (error) {
      setStatus(
        error instanceof Error ? error.message : "Kunde inte spara prompt.",
      );
      showButtonHint(button ?? null, "Fel.", "error");
    }
  }

  async function saveSettings(): Promise<void> {
    const easyTask = tasks.getEasyToReadTaskDefinition();
    if (!easyTask) {
      setStatus("Kunde inte hitta en lättläst-uppgift i task-katalogen.");
      showButtonHint(refs.saveEasyReadSettingsButton, "Fel.", "error");
      return;
    }

    try {
      setStatus("Sparar lättläst-inställningar...");
      await tasks.updateTaskDefinition(easyTask.key, {
        enabled: refs.easyReadTaskEnabled.checked,
      });
      await saveWorkflowSettings();
      await tasks.loadCatalog(easyTask.key);
      syncTaskControls();
      setStatus("Lättläst-inställningar sparade.");
      showHint("Sparat.", "success");
      showButtonHint(refs.saveEasyReadSettingsButton, "Sparat.", "success");
    } catch (error) {
      setStatus(
        error instanceof Error
          ? error.message
          : "Kunde inte spara lättläst-inställningar.",
      );
      showButtonHint(refs.saveEasyReadSettingsButton, "Fel.", "error");
    }
  }

  async function saveWorkflowSettings(): Promise<void> {
    await runtime.updateRuntimeSettings((runtimeSettings) => {
      const workflow = getRuntimeObject(runtimeSettings, "easyToReadWorkflow");
      workflow.enabled = refs.easyReadWorkflowEnabled.checked;
      workflow.useRewriteDraft = refs.easyReadWorkflowUseRewriteDraft.checked;
    });
  }

  function bindPromptSaveButtons(): void {
    document
      .querySelectorAll<HTMLButtonElement>("[data-easy-read-prompt-save]")
      .forEach((button) => {
        button.addEventListener("click", () => handlePromptSaveClick(button));
      });
  }

  function handlePromptSaveClick(button: HTMLButtonElement): void {
    const promptName = resolvePromptName(button);
    const fieldId = button.dataset.easyReadPromptField;
    if (!promptName || !fieldId) {
      return;
    }

    const field = getRequiredElement<HTMLTextAreaElement>(fieldId);
    if (field) {
      savePrompt(promptName, field, button);
    }
  }

  function resolvePromptName(button: HTMLButtonElement): string | null {
    const promptName = button.dataset.easyReadPromptSave;
    if (promptName !== "task:easyToRead") {
      return promptName || null;
    }

    const easyTask = tasks.getEasyToReadTaskDefinition();
    if (!easyTask) {
      setStatus("Kunde inte hitta en lättläst-uppgift i task-katalogen.");
      showButtonHint(button, "Fel.", "error");
      return null;
    }
    return `task:${easyTask.key}`;
  }

  function promptPath(promptName: string): string {
    return `/admin/prompts/${encodeURIComponent(promptName)}`;
  }

  return { init, load, syncTaskControls };
}

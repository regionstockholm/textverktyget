import {
  EASY_TO_READ_TASK_ALIASES,
  TASK_PROMPT_PREFIX,
} from "../admin_constants.js";
import type { AdminContext } from "../admin_context.js";
import type { TaskDefinition, TaskPromptSaveResponse } from "../admin_types.js";
import {
  normalizeTaskIdentity,
  resolveRewritePlanTasks,
} from "../admin_utils.js";

type TaskPanelOptions = {
  onCatalogChanged?(): void;
};

export type TaskPanel = {
  init(): void;
  loadCatalog(preferredKey?: string): Promise<void>;
  getEasyToReadTaskDefinition(): TaskDefinition | undefined;
  updateTaskDefinition(
    taskKey: string,
    payload: Record<string, unknown>,
  ): Promise<TaskDefinition>;
};

export function initTaskPanel(
  context: AdminContext,
  options: TaskPanelOptions = {},
): TaskPanel {
  const { refs, request, state, feedback } = context;
  const { setStatus, showHint, showButtonHint } = feedback;
  const taskPromptIndex = new Map<
    string,
    { label: string; promptName: string }
  >();

  const listTaskDefinitions = async (): Promise<TaskDefinition[]> =>
    request<TaskDefinition[]>("GET", "/admin/tasks");

  const createTaskDefinition = async (
    payload: Record<string, unknown>,
  ): Promise<TaskDefinition> =>
    request<TaskDefinition>("POST", "/admin/tasks", payload);

  const updateTaskDefinition = async (
    taskKey: string,
    payload: Record<string, unknown>,
  ): Promise<TaskDefinition> =>
    request<TaskDefinition>(
      "PUT",
      `/admin/tasks/${encodeURIComponent(taskKey)}`,
      payload,
    );

  const removeTaskDefinition = async (taskKey: string): Promise<void> => {
    await request("DELETE", `/admin/tasks/${encodeURIComponent(taskKey)}`);
  };

  const reorderTaskDefinitions = async (
    taskKeys: string[],
  ): Promise<TaskDefinition[]> =>
    request<TaskDefinition[]>("PUT", "/admin/tasks/reorder", { taskKeys });

  const getSortedTaskDefinitions = (): TaskDefinition[] =>
    [...state.taskDefinitions].sort((a, b) => a.sortOrder - b.sortOrder);

  const getSelectedTaskDefinition = (): TaskDefinition | undefined =>
    state.taskDefinitions.find((task) => task.key === refs.taskPromptSelect.value);

  const getEasyToReadTaskDefinition = (): TaskDefinition | undefined =>
    state.taskDefinitions.find((task) => isEasyToReadTask(task));

  const loadCatalog = async (preferredKey?: string): Promise<void> => {
    const currentKey = preferredKey || refs.taskPromptSelect.value;
    try {
      const tasks = await listTaskDefinitions();
      state.taskDefinitions = Array.isArray(tasks) ? tasks : [];
      initTaskPromptSelect(currentKey);
      if (state.taskDefinitions.length > 0) {
        state.lastTaskPrompt = "";
        await loadTaskPrompt();
      }
      options.onCatalogChanged?.();
    } catch (error) {
      state.taskDefinitions = [];
      initTaskPromptSelect();
      options.onCatalogChanged?.();
      throw error;
    }
  };

  const loadTaskPrompt = async (): Promise<void> => {
    const key = refs.taskPromptSelect.value;
    if (!key) {
      return;
    }

    const promptName = getTaskPromptName(key);
    updateTaskPromptLabel();
    if (state.lastTaskPrompt === promptName) {
      return;
    }

    try {
      setStatus("Hämtar uppgift...");
      const data = await request<{ content?: string }>(
        "GET",
        `/admin/prompts/${encodeURIComponent(promptName)}`,
      );
      refs.taskPromptContent.value = data?.content || "";
      state.lastTaskPrompt = promptName;
      setStatus("Uppgift hämtad.");
    } catch (error) {
      state.lastTaskPrompt = "";
      setStatus(
        error instanceof Error ? error.message : "Kunde inte hämta uppgift.",
      );
    }
  };

  const saveTaskPrompt = async (): Promise<void> => {
    const key = refs.taskPromptSelect.value;
    const selected = getSelectedTaskDefinition();
    if (!key || !selected) {
      setStatus("Välj en uppgift att spara.");
      return;
    }

    const content = refs.taskPromptContent.value.trim();
    if (!content) {
      setStatus("Prompten kan inte vara tom.");
      showButtonHint(refs.taskPromptSaveButton, "Fel.", "error");
      return;
    }

    await saveSelectedTaskPrompt(key, selected, content);
  };

  const createTask = async (): Promise<void> => {
    try {
      const payload = getNewTaskPayload();
      setStatus(`Skapar uppgift: ${payload.label}...`);
      const created = await createTaskDefinition(payload);
      await loadCatalog(created.key);
      setStatus(`Uppgift skapad: ${created.label}`);
      showHint("Uppgift skapad.", "success");
      showButtonHint(refs.taskDefCreateButton, "Skapad.", "success");
    } catch (error) {
      setStatus(
        error instanceof Error ? error.message : "Kunde inte skapa uppgift.",
      );
      showButtonHint(refs.taskDefCreateButton, "Fel.", "error");
    }
  };

  const deleteTask = async (): Promise<void> => {
    const selected = getSelectedTaskDefinition();
    if (!selected) {
      setStatus("Välj en uppgift att ta bort.");
      return;
    }

    if (!window.confirm(`Vill du ta bort uppgiften \"${selected.label}\"?`)) {
      return;
    }

    try {
      setStatus(`Tar bort uppgift: ${selected.label}...`);
      await removeTaskDefinition(selected.key);
      await loadCatalog();
      setStatus(`Uppgift borttagen: ${selected.label}`);
      showHint("Uppgift borttagen.", "success");
      showButtonHint(refs.taskDefDeleteButton, "Borttagen.", "success");
    } catch (error) {
      setStatus(
        error instanceof Error ? error.message : "Kunde inte ta bort uppgift.",
      );
      showButtonHint(refs.taskDefDeleteButton, "Fel.", "error");
    }
  };

  const moveTask = async (direction: "up" | "down"): Promise<void> => {
    const selected = getSelectedTaskDefinition();
    const reordered = selected ? buildTaskReorder(selected, direction) : null;
    if (!selected || !reordered) {
      if (!selected) setStatus("Välj en uppgift att flytta.");
      return;
    }

    try {
      setStatus("Uppdaterar ordning på uppgifter...");
      const updated = await reorderTaskDefinitions(reordered.map((task) => task.key));
      state.taskDefinitions = Array.isArray(updated) ? updated : state.taskDefinitions;
      initTaskPromptSelect(selected.key);
      syncTaskRewritePlanEnabled();
      syncTaskDefinitionForm();
      setStatus("Ordning uppdaterad.");
      showMoveButtonHint(direction, "Flyttad.", "success");
    } catch (error) {
      setStatus(
        error instanceof Error
          ? error.message
          : "Kunde inte uppdatera ordning.",
      );
      showMoveButtonHint(direction, "Fel.", "error");
    }
  };

  const init = (): void => {
    initTaskPromptSelect();
    syncTaskDefinitionForm();

    refs.taskPromptSelect.addEventListener("change", () => {
      state.lastTaskPrompt = "";
      syncTaskRewritePlanEnabled();
      syncTaskDefinitionForm();
      loadTaskPrompt();
    });
    refs.taskDefCreateButton.addEventListener("click", () => {
      createTask();
    });
    refs.taskDefDeleteButton.addEventListener("click", () => {
      deleteTask();
    });
    refs.taskDefMoveUpButton.addEventListener("click", () => {
      moveTask("up");
    });
    refs.taskDefMoveDownButton.addEventListener("click", () => {
      moveTask("down");
    });
    refs.taskPromptSaveButton.addEventListener("click", () => {
      saveTaskPrompt();
    });
  };

  function isEasyToReadTask(task: TaskDefinition): boolean {
    return (
      EASY_TO_READ_TASK_ALIASES.has(normalizeTaskIdentity(task.key)) ||
      EASY_TO_READ_TASK_ALIASES.has(normalizeTaskIdentity(task.label))
    );
  }

  function getTaskPromptName(key: string): string {
    return taskPromptIndex.get(key)?.promptName ?? `${TASK_PROMPT_PREFIX}${key}`;
  }

  function updateTaskPromptLabel(): void {
    const meta = taskPromptIndex.get(refs.taskPromptSelect.value);
    refs.taskPromptLabel.textContent = meta
      ? `Prompt för ${meta.label}`
      : "Prompt för vald uppgift";
  }

  function syncTaskRewritePlanEnabled(): void {
    const key = refs.taskPromptSelect.value;
    const selectedTask = getSelectedTaskDefinition();
    const fallback = selectedTask?.rewritePlanEnabled ?? true;
    refs.taskDefRewritePlanEnabled.checked = state.rewritePlanTasks[key] ?? fallback;
  }

  function syncTaskDefinitionForm(): void {
    const task = getSelectedTaskDefinition();
    if (!task) {
      resetTaskDefinitionForm();
      return;
    }

    refs.taskDefLabel.value = task.label;
    refs.taskDefDescription.value = task.description || "";
    refs.taskDefEnabled.checked = Boolean(task.enabled);
    refs.taskDefTargetAudienceEnabled.checked = task.targetAudienceEnabled !== false;
    refs.taskDefRewritePlanEnabled.checked = task.rewritePlanEnabled !== false;
    refs.taskDefDeleteButton.disabled = false;
    setTaskMoveButtonState(task);
  }

  function resetTaskDefinitionForm(): void {
    refs.taskDefLabel.value = "";
    refs.taskDefDescription.value = "";
    refs.taskDefEnabled.checked = true;
    refs.taskDefTargetAudienceEnabled.checked = true;
    refs.taskDefRewritePlanEnabled.checked = true;
    refs.taskDefDeleteButton.disabled = true;
    refs.taskDefMoveUpButton.disabled = true;
    refs.taskDefMoveDownButton.disabled = true;
  }

  function setTaskMoveButtonState(task: TaskDefinition): void {
    const sorted = getSortedTaskDefinitions();
    const index = sorted.findIndex((entry) => entry.key === task.key);
    refs.taskDefMoveUpButton.disabled = index <= 0;
    refs.taskDefMoveDownButton.disabled = index < 0 || index >= sorted.length - 1;
  }

  function initTaskPromptSelect(preferredKey?: string): void {
    refs.taskPromptSelect.innerHTML = "";
    taskPromptIndex.clear();

    const sorted = getSortedTaskDefinitions();
    if (sorted.length === 0) {
      initEmptyTaskSelect();
      return;
    }

    sorted.forEach((task) => addTaskOption(task));
    refs.taskPromptSelect.value = resolveSelectedTaskKey(sorted, preferredKey);
    refs.taskPromptSaveButton.disabled = false;
    updateTaskPromptLabel();
    syncTaskRewritePlanEnabled();
    syncTaskDefinitionForm();
  }

  function initEmptyTaskSelect(): void {
    const emptyOption = document.createElement("option");
    emptyOption.value = "";
    emptyOption.textContent = "Inga uppgifter tillgängliga";
    refs.taskPromptSelect.appendChild(emptyOption);
    refs.taskPromptSelect.value = "";
    refs.taskPromptContent.value = "";
    refs.taskPromptSaveButton.disabled = true;
    syncTaskDefinitionForm();
  }

  function addTaskOption(task: TaskDefinition): void {
    const option = document.createElement("option");
    option.value = task.key;
    option.textContent = task.label;
    refs.taskPromptSelect.appendChild(option);
    taskPromptIndex.set(task.key, {
      label: task.label,
      promptName: `${TASK_PROMPT_PREFIX}${task.key}`,
    });
  }

  function resolveSelectedTaskKey(
    sorted: TaskDefinition[],
    preferredKey?: string,
  ): string {
    return preferredKey && sorted.some((task) => task.key === preferredKey)
      ? preferredKey
      : sorted[0]?.key || "";
  }

  async function saveSelectedTaskPrompt(
    key: string,
    selected: TaskDefinition,
    content: string,
  ): Promise<void> {
    const promptName = getTaskPromptName(key);
    const label = taskPromptIndex.get(key)?.label || selected.label || key;
    try {
      setStatus(`Sparar uppgift: ${label}...`);
      await updateTaskDefinition(selected.key, getTaskDefinitionPayload());

      const data = await request<TaskPromptSaveResponse>(
        "PUT",
        `/admin/task-prompts/${encodeURIComponent(key)}`,
        { content, rewritePlanEnabled: refs.taskDefRewritePlanEnabled.checked },
      );

      state.rewritePlanTasks = resolveRewritePlanTasks(data?.rewritePlanTasks);
      refs.taskPromptContent.value = data?.prompt?.content || content;
      state.lastTaskPrompt = "";
      await loadCatalog(selected.key);
      syncTaskRewritePlanEnabled();
      state.lastTaskPrompt = promptName;
      setStatus(`Uppgift sparad: ${label}`);
      showHint("Sparat.", "success");
      showButtonHint(refs.taskPromptSaveButton, "Sparat.", "success");
    } catch (error) {
      setStatus(
        error instanceof Error ? error.message : "Kunde inte spara uppgift.",
      );
      showButtonHint(refs.taskPromptSaveButton, "Fel.", "error");
      syncTaskRewritePlanEnabled();
    }
  }

  function getTaskDefinitionPayload(): Record<string, unknown> {
    const label = refs.taskDefLabel.value.trim();
    if (!label) {
      throw new Error("Task label saknas.");
    }

    return {
      label,
      description: refs.taskDefDescription.value.trim() || null,
      enabled: refs.taskDefEnabled.checked,
      targetAudienceEnabled: refs.taskDefTargetAudienceEnabled.checked,
      rewritePlanEnabled: refs.taskDefRewritePlanEnabled.checked,
    };
  }

  function getNewTaskPayload(): Record<string, unknown> & { label: string } {
    return {
      label: "Ny uppgift",
      description: null,
      enabled: true,
      targetAudienceEnabled: true,
      rewritePlanEnabled: true,
      promptContent: "",
    };
  }

  function buildTaskReorder(
    selected: TaskDefinition,
    direction: "up" | "down",
  ): TaskDefinition[] | null {
    const sorted = getSortedTaskDefinitions();
    const index = sorted.findIndex((task) => task.key === selected.key);
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (index < 0 || targetIndex < 0 || targetIndex >= sorted.length) {
      return null;
    }

    const reordered = [...sorted];
    const [moved] = reordered.splice(index, 1);
    if (!moved) {
      return null;
    }
    reordered.splice(targetIndex, 0, moved);
    return reordered;
  }

  function showMoveButtonHint(
    direction: "up" | "down",
    message: string,
    type: "success" | "error",
  ): void {
    showButtonHint(
      direction === "up" ? refs.taskDefMoveUpButton : refs.taskDefMoveDownButton,
      message,
      type,
    );
  }

  return {
    init,
    loadCatalog,
    getEasyToReadTaskDefinition,
    updateTaskDefinition,
  };
}

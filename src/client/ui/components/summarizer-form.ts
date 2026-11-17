import { assert } from "../../safety/assertions.js";
import type { FormValues } from "../../core/summarizer/interfaces.js";
import { getById, query } from "../utils/dom.js";

export type TaskCatalogItem = {
  key: string;
  label: string;
  description: string | null;
  sortOrder: number;
  prompt: string;
  settings: {
    targetAudienceEnabled: boolean;
    rewritePlanEnabled: boolean;
  };
};

const taskPrompts = new Map<string, { original: string; current: string }>();

type TargetAudienceCategoryPayload = {
  name: string;
  sortOrder: number;
  audiences: Array<{
    label: string;
    sortOrder: number;
  }>;
};

export type TaskSubmissionConfig = {
  taskKey: string;
  targetAudienceEnabled: boolean;
};

type SelectedTaskValues = {
  taskKey: string;
  targetAudienceEnabled: boolean;
};

export function deriveTaskSubmissionConfig(
  task: TaskCatalogItem,
): TaskSubmissionConfig {
  return {
    taskKey: task.key,
    targetAudienceEnabled: task.settings.targetAudienceEnabled,
  };
}

function getSelectedTaskInput(): HTMLInputElement | null {
  return query<HTMLInputElement>('input[name="summary-type"]:checked');
}

function updateTaskDependentUi(): void {
  const root = query<HTMLElement>(".blue-bg");
  const selectedTask = getSelectedTaskInput();

  if (!root || !selectedTask) {
    return;
  }

  const targetAudienceEnabled =
    selectedTask.dataset.targetAudienceEnabled !== "false";
  root.classList.toggle("hide-target-audience", !targetAudienceEnabled);
}

function createTaskOption(
  task: TaskCatalogItem,
  checked: boolean,
  editors: HTMLElement,
): HTMLElement {
  const wrapper = document.createElement("div");
  wrapper.className = "task-option";

  const label = document.createElement("label");
  label.className = "first-pick-radio relative";
  label.htmlFor = `task-${task.key.replace(/[^A-Za-z0-9_-]/g, "-")}`;

  const input = document.createElement("input");
  input.type = "radio";
  input.id = label.htmlFor;
  input.name = "summary-type";
  input.value = task.key;
  input.checked = checked;

  const submissionConfig = deriveTaskSubmissionConfig(task);
  input.dataset.taskKey = submissionConfig.taskKey;
  input.dataset.targetAudienceEnabled = String(
    submissionConfig.targetAudienceEnabled,
  );

  const content = document.createElement("div");
  content.className = "flex flex-column gap-0";

  const title = document.createElement("span");
  title.textContent = task.label;
  content.appendChild(title);

  if (task.description) {
    const description = document.createElement("span");
    description.className = "radio-undertext";
    description.textContent = task.description;
    content.appendChild(description);
  }

  label.append(input, content);

  const editor = document.createElement("div");
  editor.className = "task-prompt-editor";
  editor.id = `${input.id}-prompt`;
  editor.hidden = true;

  const heading = document.createElement("h2");
  heading.className = "task-prompt-heading";
  heading.textContent = `Prompt: ${task.label}`;

  const textarea = document.createElement("textarea");
  textarea.value = task.prompt;
  textarea.maxLength = 100000;
  textarea.setAttribute("aria-label", `Prompt för ${task.label}`);
  textarea.addEventListener("input", () => {
    const prompt = taskPrompts.get(task.key);
    if (prompt) prompt.current = textarea.value;
  });

  const reset = document.createElement("button");
  reset.type = "button";
  reset.className = "task-prompt-reset";
  reset.textContent = "Återställ original";
  reset.addEventListener("click", () => {
    textarea.value = task.prompt;
    const prompt = taskPrompts.get(task.key);
    if (prompt) prompt.current = task.prompt;
  });

  const edit = document.createElement("button");
  edit.type = "button";
  edit.className = "task-prompt-toggle";
  edit.title = `Redigera prompt för ${task.label}`;
  edit.setAttribute("aria-label", `Redigera prompt för ${task.label}`);
  edit.setAttribute("aria-controls", editor.id);
  edit.setAttribute("aria-expanded", "false");
  const icon = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  icon.setAttribute("viewBox", "0 0 24 24");
  icon.setAttribute("fill", "none");
  icon.setAttribute("stroke", "currentColor");
  icon.setAttribute("stroke-width", "2");
  icon.setAttribute("stroke-linecap", "round");
  icon.setAttribute("stroke-linejoin", "round");
  icon.setAttribute("aria-hidden", "true");
  const pencil = document.createElementNS("http://www.w3.org/2000/svg", "path");
  pencil.setAttribute("d", "M21.174 6.812a1 1 0 0 0-3.986-3.986L3.842 16.175a2 2 0 0 0-.506.854l-1.307 4.314a.5.5 0 0 0 .622.622l4.314-1.307a2 2 0 0 0 .854-.506z");
  const pencilDetail = document.createElementNS("http://www.w3.org/2000/svg", "path");
  pencilDetail.setAttribute("d", "m15 5 4 4");
  icon.append(pencil, pencilDetail);
  edit.appendChild(icon);
  edit.addEventListener("click", () => {
    const shouldOpen = editor.hidden;
    closeTaskEditors(editors);
    if (shouldOpen) {
      input.checked = true;
      input.dispatchEvent(new Event("change", { bubbles: true }));
      editors.hidden = false;
      editor.hidden = false;
      edit.setAttribute("aria-expanded", "true");
      textarea.focus();
    }
  });

  const close = document.createElement("button");
  close.type = "button";
  close.className = "task-prompt-close";
  close.textContent = "Stäng";
  close.addEventListener("click", () => {
    closeTaskEditors(editors);
    edit.focus();
  });

  const header = document.createElement("div");
  header.className = "task-prompt-header";
  header.append(heading, close);
  editor.append(header, textarea, reset);
  editors.appendChild(editor);
  wrapper.append(label, edit);
  return wrapper;
}

function closeTaskEditors(editors: HTMLElement): void {
  editors.hidden = true;
  editors.querySelectorAll<HTMLElement>(".task-prompt-editor").forEach((editor) => {
    editor.hidden = true;
  });
  document.querySelectorAll<HTMLButtonElement>(".task-prompt-toggle").forEach((button) => {
    button.setAttribute("aria-expanded", "false");
  });
}

function renderTaskOptions(tasks: TaskCatalogItem[]): void {
  const container = getById<HTMLElement>("task-options");
  const editors = getById<HTMLElement>("task-prompt-editors");
  if (!container || !editors) {
    return;
  }

  const previousSelection = getSelectedTaskInput()?.value;
  const sortedTasks = [...tasks].sort((a, b) => a.sortOrder - b.sortOrder);

  container.innerHTML = "";
  editors.innerHTML = "";
  editors.hidden = true;
  taskPrompts.clear();

  sortedTasks.forEach((task, index) => {
    taskPrompts.set(task.key, { original: task.prompt, current: task.prompt });
    const checked = previousSelection
      ? previousSelection === task.key
      : index === 0;
    container.appendChild(createTaskOption(task, checked, editors));
  });

  updateTaskDependentUi();
}

async function fetchTaskCatalog(): Promise<TaskCatalogItem[]> {
  const response = await fetch("/api/tasks", {
    method: "GET",
    headers: { "Content-Type": "application/json" },
  });

  if (!response.ok) {
    throw new Error(`Task catalog fetch failed: ${response.status}`);
  }

  const payload = (await response.json()) as {
    success?: boolean;
    data?: TaskCatalogItem[];
  };

  if (
    !payload.success ||
    !Array.isArray(payload.data) ||
    payload.data.length === 0
  ) {
    throw new Error("Task catalog response missing enabled tasks");
  }

  return payload.data;
}

async function fetchTargetAudienceCatalog(): Promise<
  TargetAudienceCategoryPayload[]
> {
  const response = await fetch("/api/target-audiences", {
    method: "GET",
    headers: { "Content-Type": "application/json" },
  });

  if (!response.ok) {
    throw new Error(`Target audience fetch failed: ${response.status}`);
  }

  const payload = (await response.json()) as {
    success?: boolean;
    data?: {
      categories?: TargetAudienceCategoryPayload[];
    };
  };

  const categories = payload.data?.categories;
  if (
    !payload.success ||
    !Array.isArray(categories) ||
    categories.length === 0
  ) {
    throw new Error("Target audience response missing categories");
  }

  return categories;
}

function renderTargetAudienceOptions(
  categories: TargetAudienceCategoryPayload[],
): void {
  const select = getById<HTMLSelectElement>("target-audience");
  if (!select) {
    return;
  }

  const previousValue = select.value;
  select.innerHTML = "";

  categories.forEach((category) => {
    const optgroup = document.createElement("optgroup");
    optgroup.label = category.name;

    category.audiences.forEach((audience) => {
      const option = document.createElement("option");
      option.value = audience.label;
      option.textContent = audience.label;
      optgroup.appendChild(option);
    });

    select.appendChild(optgroup);
  });

  if (previousValue) {
    const existingOption = Array.from(select.options).find(
      (option) => option.value === previousValue,
    );

    if (existingOption) {
      select.value = previousValue;
      return;
    }
  }

  const firstOption = select.options.item(0);
  if (firstOption) {
    select.value = firstOption.value;
  }
}

function getSelectedTaskValues(): SelectedTaskValues {
  const selectedTask = getSelectedTaskInput();
  assert(selectedTask !== null, "No summary type selected");

  return {
    taskKey: selectedTask.dataset.taskKey || selectedTask.value,
    targetAudienceEnabled:
      selectedTask.dataset.targetAudienceEnabled !== "false",
  };
}

function getTargetAudience(): string {
  const targetAudience = getById<HTMLSelectElement>("target-audience");
  assert(targetAudience !== null, "Target audience element not found");
  return targetAudience.value;
}

export function getSelectedValues(): FormValues {
  const taskValues = getSelectedTaskValues();
  const selectedAudience = getTargetAudience();
  const prompt = taskPrompts.get(taskValues.taskKey);

  return {
    taskKey: taskValues.taskKey,
    taskPrompt: prompt && prompt.current !== prompt.original ? prompt.current : undefined,
    targetAudience: taskValues.targetAudienceEnabled
      ? selectedAudience
      : selectedAudience || "Allman malgrupp",
    checkboxContent: [],
    qualityProcess: true,
  };
}

export async function initializeTargetAudienceCatalog(): Promise<void> {
  try {
    const categories = await fetchTargetAudienceCatalog();
    renderTargetAudienceOptions(categories);
  } catch (error) {
    console.warn("Could not load target audience catalog", error);
  }
}

export async function initializeTaskCatalog(): Promise<void> {
  const container = getById<HTMLElement>("task-options");
  container?.addEventListener("change", () => {
    updateTaskDependentUi();
    const editors = getById<HTMLElement>("task-prompt-editors");
    if (editors) closeTaskEditors(editors);
  });

  try {
    const tasks = await fetchTaskCatalog();
    renderTaskOptions(tasks);
  } catch (error) {
    console.error("Could not load task catalog", error);
  }
}

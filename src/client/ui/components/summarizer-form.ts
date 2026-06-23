import { assert } from "../../safety/assertions.js";
import type { FormValues } from "../../core/summarizer/interfaces.js";
import { getById, query } from "../utils/dom.js";

export type TaskCatalogItem = {
  key: string;
  label: string;
  description: string | null;
  sortOrder: number;
  settings: {
    outputMode: "rewrite" | "summary" | "bullets";
    targetAudienceEnabled: boolean;
    rewritePlanEnabled: boolean;
  };
};

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
): HTMLElement {
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
  return label;
}

function renderTaskOptions(tasks: TaskCatalogItem[]): void {
  const container = getById<HTMLElement>("task-options");
  if (!container) {
    return;
  }

  const previousSelection = getSelectedTaskInput()?.value;
  const sortedTasks = [...tasks].sort((a, b) => a.sortOrder - b.sortOrder);

  container.innerHTML = "";

  sortedTasks.forEach((task, index) => {
    const checked = previousSelection
      ? previousSelection === task.key
      : index === 0;
    container.appendChild(createTaskOption(task, checked));
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

  return {
    taskKey: taskValues.taskKey,
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
  container?.addEventListener("change", updateTaskDependentUi);

  try {
    const tasks = await fetchTaskCatalog();
    renderTaskOptions(tasks);
  } catch (error) {
    console.error("Could not load task catalog", error);
  }
}

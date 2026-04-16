export interface TaskCatalogItem {
  key: string;
  label: string;
  description: string | null;
  sortOrder: number;
  settings: {
    outputMode: "rewrite" | "summary" | "bullets";
    bulletCount: number | null;
    maxChars: number | null;
    targetAudienceEnabled: boolean;
    rewritePlanEnabled: boolean;
  };
}

export interface TaskSubmissionConfig {
  taskKey: string;
  targetAudienceEnabled: boolean;
}

interface TargetAudienceCategoryPayload {
  name: string;
  sortOrder: number;
  audiences: Array<{
    label: string;
    sortOrder: number;
  }>;
}

function getSelectedTaskInput(): HTMLInputElement | null {
  return document.querySelector(
    'input[name="summary-type"]:checked',
  ) as HTMLInputElement | null;
}

export function deriveTaskSubmissionConfig(
  task: TaskCatalogItem,
): TaskSubmissionConfig {
  return {
    taskKey: task.key,
    targetAudienceEnabled: task.settings.targetAudienceEnabled,
  };
}

function updateTaskDependentUi(): void {
  const selectedTask = getSelectedTaskInput();
  const root = document.querySelector(".blue-bg") as HTMLElement | null;
  if (!root || !selectedTask) {
    return;
  }

  const targetAudienceEnabled =
    selectedTask.dataset.targetAudienceEnabled !== "false";
  root.classList.toggle("hide-target-audience", !targetAudienceEnabled);
}

function createTaskOption(task: TaskCatalogItem, checked: boolean): HTMLElement {
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

  label.appendChild(input);
  label.appendChild(content);
  return label;
}

function renderTaskOptions(tasks: TaskCatalogItem[]): void {
  const container = document.getElementById("task-options");
  if (!container) {
    return;
  }

  const existingSelected = getSelectedTaskInput()?.value;
  const sorted = [...tasks].sort((a, b) => a.sortOrder - b.sortOrder);

  container.innerHTML = "";
  sorted.forEach((task, index) => {
    const shouldCheck = existingSelected
      ? existingSelected === task.key
      : index === 0;
    container.appendChild(createTaskOption(task, shouldCheck));
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

  if (!payload.success || !Array.isArray(payload.data) || payload.data.length === 0) {
    throw new Error("Task catalog response missing enabled tasks");
  }

  return payload.data;
}

async function fetchTargetAudienceCatalog(): Promise<TargetAudienceCategoryPayload[]> {
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
  if (!payload.success || !Array.isArray(categories) || categories.length === 0) {
    throw new Error("Target audience response missing categories");
  }

  return categories;
}

function renderTargetAudienceOptions(
  categories: TargetAudienceCategoryPayload[],
): void {
  const select = document.getElementById("target-audience") as
    | HTMLSelectElement
    | null;
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
    const existing = Array.from(select.options).find(
      (option) => option.value === previousValue,
    );
    if (existing) {
      select.value = previousValue;
      return;
    }
  }

  if (select.options.length > 0) {
    const firstOption = select.options.item(0);
    if (firstOption) {
      select.value = firstOption.value;
    }
  }
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
  const container = document.getElementById("task-options");
  if (container) {
    container.addEventListener("change", () => {
      updateTaskDependentUi();
    });
  }

  try {
    const tasks = await fetchTaskCatalog();
    renderTaskOptions(tasks);
  } catch (error) {
    console.error("Could not load task catalog", error);
  }
}

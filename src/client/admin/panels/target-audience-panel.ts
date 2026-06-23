import {
  EMPTY_TARGET_AUDIENCE_CATALOG,
  TARGET_AUDIENCE_PREFIX,
} from "../admin_constants.js";
import type { AdminContext } from "../admin_context.js";
import type {
  TargetAudienceCatalog,
  TargetAudienceCatalogItem,
  TargetAudienceCategory,
} from "../admin_types.js";

export type TargetAudienceMeta = {
  label: string;
  group: string;
};

export type TargetAudiencePanel = {
  init(): void;
  loadCatalog(): Promise<void>;
  loadSelectedPrompt(): Promise<void>;
  updateEasyReadLabels(): void;
  getAudienceMeta(label: string): TargetAudienceMeta | undefined;
};

export function initTargetAudiencePanel(
  context: AdminContext,
): TargetAudiencePanel {
  const { refs, request, state, feedback } = context;
  const { setStatus, showHint, showButtonHint } = feedback;
  const audienceIndex = new Map<string, TargetAudienceMeta>();

  const init = (): void => {
    refreshCatalogUi();
    bindEvents();
  };

  const loadCatalog = async (): Promise<void> => {
    const catalog = await request<TargetAudienceCatalog>(
      "GET",
      "/admin/target-audience-catalog",
    );
    state.targetAudienceCatalog = normalizeCatalog(catalog);
    refreshCatalogUi();
  };

  const loadSelectedPrompt = async (): Promise<void> => {
    const audienceValue = refs.targetAudienceSelect.value;
    if (!audienceValue) {
      return;
    }

    updateTargetAudienceLabels();
    if (state.lastTargetAudience === audienceValue) {
      return;
    }

    try {
      setStatus("Hämtar målgrupp...");
      const data = await request<{ content?: string }>(
        "GET",
        promptPath(audienceValue),
      );
      refs.targetAudiencePrompt.value = data?.content || "";
      state.lastTargetAudience = audienceValue;
      setStatus("Målgrupp hämtad.");
    } catch (error) {
      state.lastTargetAudience = "";
      setStatus(
        error instanceof Error ? error.message : "Kunde inte hämta målgrupp.",
      );
    }
  };

  const updateEasyReadLabels = (): void => {
    const audienceValue = refs.easyReadTargetAudienceSelect.value;
    const meta = audienceIndex.get(audienceValue);
    if (!meta) {
      refs.easyReadTargetAudienceGroup.textContent = "";
      refs.easyReadTargetAudiencePromptLabel.textContent =
        "Prompt för vald målgrupp";
      return;
    }

    refs.easyReadTargetAudienceGroup.textContent = `Kategori: ${meta.group}`;
    refs.easyReadTargetAudiencePromptLabel.textContent = `Prompt för ${meta.label}`;
  };

  const getAudienceMeta = (label: string): TargetAudienceMeta | undefined =>
    audienceIndex.get(label);

  async function saveCatalog(catalog: TargetAudienceCatalog): Promise<void> {
    const saved = await request<TargetAudienceCatalog>(
      "PUT",
      "/admin/target-audience-catalog",
      { categories: catalog.categories, audiences: catalog.audiences },
    );
    state.targetAudienceCatalog = normalizeCatalog(saved);
    refreshCatalogUi();
  }

  function refreshCatalogUi(): void {
    rebuildAudienceIndex();
    fillAudienceSelect(refs.targetAudienceSelect);
    fillAudienceSelect(refs.easyReadTargetAudienceSelect);
    fillCategorySelects();
    updateTargetAudienceLabels();
    updateEasyReadLabels();
  }

  function rebuildAudienceIndex(): void {
    audienceIndex.clear();
    getSortedCategories().forEach((category) => {
      getAudiencesByCategory(category.name).forEach((audience) => {
        audienceIndex.set(audience.label, {
          label: audience.label,
          group: category.name,
        });
      });
    });
  }

  function fillAudienceSelect(select: HTMLSelectElement): void {
    const previous = select.value;
    select.innerHTML = "";
    getSortedCategories().forEach((category) => appendAudienceGroup(select, category));
    restoreSelectValue(select, previous);
  }

  function appendAudienceGroup(
    select: HTMLSelectElement,
    category: TargetAudienceCategory,
  ): void {
    const audiences = getAudiencesByCategory(category.name);
    if (audiences.length === 0) {
      return;
    }

    const optgroup = document.createElement("optgroup");
    optgroup.label = category.name;
    audiences.forEach((audience) => {
      const option = document.createElement("option");
      option.value = audience.label;
      option.textContent = audience.label;
      optgroup.appendChild(option);
    });
    select.appendChild(optgroup);
  }

  function fillCategorySelects(): void {
    const selects = [
      refs.targetAudienceCategorySelect,
      refs.targetAudienceCategoryForItemSelect,
    ];
    selects.forEach((select) => fillCategorySelect(select));
  }

  function fillCategorySelect(select: HTMLSelectElement): void {
    const previous = select.value;
    select.innerHTML = "";
    getSortedCategories().forEach((category) => {
      const option = document.createElement("option");
      option.value = category.name;
      option.textContent = category.name;
      select.appendChild(option);
    });
    restoreSelectValue(select, previous);
  }

  function restoreSelectValue(select: HTMLSelectElement, previous: string): void {
    if (previous && Array.from(select.options).some((option) => option.value === previous)) {
      select.value = previous;
      return;
    }
    select.value = select.options.item(0)?.value ?? "";
  }

  function updateTargetAudienceLabels(): void {
    const audienceValue = refs.targetAudienceSelect.value;
    const meta = audienceIndex.get(audienceValue);
    refs.targetAudienceCategoryNameInput.value = refs.targetAudienceCategorySelect.value;

    if (!meta) {
      refs.targetAudienceGroup.textContent = "";
      refs.targetAudiencePromptLabel.textContent = "Prompt för vald målgrupp";
      refs.targetAudienceLabelInput.value = "";
      return;
    }

    refs.targetAudienceGroup.textContent = `Kategori: ${meta.group}`;
    refs.targetAudiencePromptLabel.textContent = `Prompt för ${meta.label}`;
    refs.targetAudienceCategoryForItemSelect.value = meta.group;
    refs.targetAudienceLabelInput.value = meta.label;
  }

  async function saveSelectedPrompt(): Promise<void> {
    const audienceValue = refs.targetAudienceSelect.value;
    if (!audienceValue) {
      return;
    }

    const label = audienceIndex.get(audienceValue)?.label || audienceValue;
    try {
      setStatus(`Sparar målgrupp: ${label}...`);
      await request("PUT", promptPath(audienceValue), {
        content: refs.targetAudiencePrompt.value || "",
      });
      await saveSelectedAudienceCategory(audienceValue);
      setStatus(`Målgrupp sparad: ${label}`);
      showHint("Sparat.", "success");
      showButtonHint(refs.targetAudienceSaveButton, "Sparat.", "success");
    } catch (error) {
      setStatus(
        error instanceof Error ? error.message : "Kunde inte spara målgrupp.",
      );
      showButtonHint(refs.targetAudienceSaveButton, "Fel.", "error");
    }
  }

  async function saveSelectedAudienceCategory(audienceValue: string): Promise<void> {
    const nextCategory = refs.targetAudienceCategoryForItemSelect.value;
    const selected = state.targetAudienceCatalog.audiences.find(
      (audience) => audience.label === audienceValue,
    );
    if (!selected || !nextCategory || selected.category === nextCategory) {
      return;
    }

    await saveCatalog(
      normalizeOrdering({
        categories: [...state.targetAudienceCatalog.categories],
        audiences: state.targetAudienceCatalog.audiences.map((audience) =>
          audience.label === audienceValue
            ? { ...audience, category: nextCategory }
            : audience,
        ),
      }),
    );
    refs.targetAudienceSelect.value = audienceValue;
    refs.easyReadTargetAudienceSelect.value = audienceValue;
    refs.targetAudienceCategoryForItemSelect.value = nextCategory;
    updateTargetAudienceLabels();
  }

  async function createCategory(): Promise<void> {
    const name = refs.targetAudienceCategoryNameInput.value.trim();
    if (!validateNewCategoryName(name)) {
      return;
    }

    try {
      await saveCatalog(
        normalizeOrdering({
          categories: [...state.targetAudienceCatalog.categories, { name, sortOrder: 9999 }],
          audiences: [...state.targetAudienceCatalog.audiences],
        }),
      );
      refs.targetAudienceCategorySelect.value = name;
      refs.targetAudienceCategoryForItemSelect.value = name;
      setStatus(`Kategori skapad: ${name}`);
      showHint("Kategori skapad.", "success");
      showButtonHint(refs.targetAudienceCategoryCreateButton, "Skapad.", "success");
    } catch (error) {
      setStatus(
        error instanceof Error ? error.message : "Kunde inte skapa kategori.",
      );
      showButtonHint(refs.targetAudienceCategoryCreateButton, "Fel.", "error");
    }
  }

  async function renameCategory(): Promise<void> {
    const selectedName = refs.targetAudienceCategorySelect.value;
    const nextName = refs.targetAudienceCategoryNameInput.value.trim();
    if (!validateCategoryRename(selectedName, nextName)) {
      return;
    }

    try {
      await saveCatalog(
        normalizeOrdering({
          categories: state.targetAudienceCatalog.categories.map((category) =>
            category.name === selectedName ? { ...category, name: nextName } : category,
          ),
          audiences: state.targetAudienceCatalog.audiences.map((audience) =>
            audience.category === selectedName
              ? { ...audience, category: nextName }
              : audience,
          ),
        }),
      );
      refs.targetAudienceCategorySelect.value = nextName;
      refs.targetAudienceCategoryForItemSelect.value = nextName;
      updateTargetAudienceLabels();
      setStatus(`Kategori uppdaterad: ${nextName}`);
      showHint("Kategori sparad.", "success");
      showButtonHint(refs.targetAudienceCategorySaveButton, "Sparat.", "success");
    } catch (error) {
      setStatus(
        error instanceof Error ? error.message : "Kunde inte spara kategori.",
      );
      showButtonHint(refs.targetAudienceCategorySaveButton, "Fel.", "error");
    }
  }

  async function deleteCategory(): Promise<void> {
    const selectedName = refs.targetAudienceCategorySelect.value;
    if (!selectedName) {
      setStatus("Välj kategori.");
      return;
    }

    const fallbackName = getFallbackCategoryName(selectedName);
    if (!fallbackName) {
      return;
    }

    if (!window.confirm(`Ta bort kategorin \"${selectedName}\"? Målgrupper flyttas till ${fallbackName}.`)) {
      return;
    }

    try {
      await saveCatalog(buildCatalogWithoutCategory(selectedName, fallbackName));
      refs.targetAudienceCategorySelect.value = fallbackName;
      refs.targetAudienceCategoryForItemSelect.value = fallbackName;
      updateTargetAudienceLabels();
      setStatus(`Kategori borttagen: ${selectedName}`);
      showHint("Kategori borttagen.", "success");
      showButtonHint(refs.targetAudienceCategoryDeleteButton, "Borttagen.", "success");
    } catch (error) {
      setStatus(
        error instanceof Error ? error.message : "Kunde inte ta bort kategori.",
      );
      showButtonHint(refs.targetAudienceCategoryDeleteButton, "Fel.", "error");
    }
  }

  async function moveCategory(direction: "up" | "down"): Promise<void> {
    const selectedName = refs.targetAudienceCategorySelect.value;
    const reordered = reorderByName(getSortedCategories(), selectedName, direction);
    if (!selectedName || !reordered) {
      return;
    }

    try {
      await saveCatalog(
        normalizeOrdering({
          categories: reordered,
          audiences: [...state.targetAudienceCatalog.audiences],
        }),
      );
      refs.targetAudienceCategorySelect.value = selectedName;
      refs.targetAudienceCategoryForItemSelect.value = selectedName;
      showButtonHint(
        direction === "up"
          ? refs.targetAudienceCategoryMoveUpButton
          : refs.targetAudienceCategoryMoveDownButton,
        "Flyttad.",
        "success",
      );
    } catch (error) {
      setStatus(
        error instanceof Error ? error.message : "Kunde inte flytta kategori.",
      );
    }
  }

  async function createAudience(): Promise<void> {
    const label = refs.targetAudienceLabelInput.value.trim();
    const category = refs.targetAudienceCategoryForItemSelect.value;
    if (!validateNewAudience(label, category)) {
      return;
    }

    try {
      await request("PUT", promptPath(label), { content: getNewAudiencePrompt(label) });
      await saveCatalog(
        normalizeOrdering({
          categories: [...state.targetAudienceCatalog.categories],
          audiences: [
            ...state.targetAudienceCatalog.audiences,
            { label, category, sortOrder: 9999 },
          ],
        }),
      );
      await selectCreatedAudience(label, category);
      setStatus(`Målgrupp skapad: ${label}`);
      showHint("Målgrupp skapad.", "success");
      showButtonHint(refs.targetAudienceCreateButton, "Skapad.", "success");
    } catch (error) {
      setStatus(
        error instanceof Error ? error.message : "Kunde inte skapa målgrupp.",
      );
      showButtonHint(refs.targetAudienceCreateButton, "Fel.", "error");
    }
  }

  async function deleteAudience(): Promise<void> {
    const selectedLabel = refs.targetAudienceSelect.value;
    if (!selectedLabel || !window.confirm(`Ta bort målgruppen \"${selectedLabel}\" från katalogen?`)) {
      return;
    }

    try {
      await saveCatalog(
        normalizeOrdering({
          categories: [...state.targetAudienceCatalog.categories],
          audiences: state.targetAudienceCatalog.audiences.filter(
            (audience) => audience.label !== selectedLabel,
          ),
        }),
      );
      await selectFirstAudienceAfterDelete();
      setStatus(`Målgrupp borttagen: ${selectedLabel}`);
      showHint("Målgrupp borttagen.", "success");
      showButtonHint(refs.targetAudienceDeleteButton, "Borttagen.", "success");
    } catch (error) {
      setStatus(
        error instanceof Error ? error.message : "Kunde inte ta bort målgrupp.",
      );
      showButtonHint(refs.targetAudienceDeleteButton, "Fel.", "error");
    }
  }

  async function moveAudience(direction: "up" | "down"): Promise<void> {
    const selected = getSelectedAudience();
    const reordered = selected ? reorderAudience(selected, direction) : null;
    if (!selected || !reordered) {
      return;
    }

    try {
      await saveCatalog(reordered);
      refs.targetAudienceSelect.value = selected.label;
      refs.easyReadTargetAudienceSelect.value = selected.label;
      showButtonHint(
        direction === "up" ? refs.targetAudienceMoveUpButton : refs.targetAudienceMoveDownButton,
        "Flyttad.",
        "success",
      );
    } catch (error) {
      setStatus(
        error instanceof Error ? error.message : "Kunde inte flytta målgrupp.",
      );
    }
  }

  function bindEvents(): void {
    refs.targetAudienceSelect.addEventListener("change", () => {
      state.lastTargetAudience = "";
      loadSelectedPrompt();
    });
    refs.targetAudienceSaveButton.addEventListener("click", () => {
      saveSelectedPrompt();
    });
    refs.targetAudienceCategorySelect.addEventListener("change", () => {
      refs.targetAudienceCategoryNameInput.value = refs.targetAudienceCategorySelect.value;
    });
    refs.targetAudienceCategoryCreateButton.addEventListener("click", () => createCategory());
    refs.targetAudienceCategorySaveButton.addEventListener("click", () => renameCategory());
    refs.targetAudienceCategoryDeleteButton.addEventListener("click", () => deleteCategory());
    refs.targetAudienceCategoryMoveUpButton.addEventListener("click", () => moveCategory("up"));
    refs.targetAudienceCategoryMoveDownButton.addEventListener("click", () => moveCategory("down"));
    refs.targetAudienceCreateButton.addEventListener("click", () => createAudience());
    refs.targetAudienceDeleteButton.addEventListener("click", () => deleteAudience());
    refs.targetAudienceMoveUpButton.addEventListener("click", () => moveAudience("up"));
    refs.targetAudienceMoveDownButton.addEventListener("click", () => moveAudience("down"));
  }

  function promptPath(label: string): string {
    return `/admin/prompts/${encodeURIComponent(`${TARGET_AUDIENCE_PREFIX}${label}`)}`;
  }

  function getSortedCategories(): TargetAudienceCategory[] {
    return sortCategories(state.targetAudienceCatalog.categories);
  }

  function getAudiencesByCategory(category: string): TargetAudienceCatalogItem[] {
    return sortAudiences(
      state.targetAudienceCatalog.audiences.filter(
        (audience) => audience.category === category,
      ),
    );
  }

  function validateNewCategoryName(name: string): boolean {
    if (!name) {
      setStatus("Kategorinamn krävs.");
      return false;
    }
    if (state.targetAudienceCatalog.categories.some((category) => category.name === name)) {
      setStatus("Kategorin finns redan.");
      return false;
    }
    return true;
  }

  function validateCategoryRename(selectedName: string, nextName: string): boolean {
    if (!selectedName) {
      setStatus("Välj kategori.");
      return false;
    }
    if (!nextName) {
      setStatus("Nytt kategorinamn krävs.");
      return false;
    }
    if (nextName !== selectedName && state.targetAudienceCatalog.categories.some((category) => category.name === nextName)) {
      setStatus("Det finns redan en kategori med det namnet.");
      return false;
    }
    return true;
  }

  function getFallbackCategoryName(selectedName: string): string | null {
    const remaining = state.targetAudienceCatalog.categories.filter(
      (category) => category.name !== selectedName,
    );
    if (remaining.length === 0) {
      setStatus("Det måste finnas minst en kategori.");
      return null;
    }
    return sortCategories(remaining)[0]?.name ?? null;
  }

  function buildCatalogWithoutCategory(
    selectedName: string,
    fallbackName: string,
  ): TargetAudienceCatalog {
    return normalizeOrdering({
      categories: state.targetAudienceCatalog.categories.filter(
        (category) => category.name !== selectedName,
      ),
      audiences: state.targetAudienceCatalog.audiences.map((audience) =>
        audience.category === selectedName
          ? { ...audience, category: fallbackName }
          : audience,
      ),
    });
  }

  function validateNewAudience(label: string, category: string): boolean {
    if (!label) {
      setStatus("Målgruppsnamn krävs.");
      return false;
    }
    if (!category) {
      setStatus("Kategori krävs.");
      return false;
    }
    if (state.targetAudienceCatalog.audiences.some((audience) => audience.label === label)) {
      setStatus("Målgruppen finns redan.");
      return false;
    }
    return true;
  }

  function getNewAudiencePrompt(label: string): string {
    const existingPrompt = refs.targetAudiencePrompt.value.trim();
    return existingPrompt.length > 0
      ? existingPrompt
      : `MÅLGRUPP: ${label}\n\nAnpassning:\n- Anpassa språk, ton och detaljnivå till målgruppen.`;
  }

  async function selectCreatedAudience(label: string, category: string): Promise<void> {
    refs.targetAudienceSelect.value = label;
    refs.easyReadTargetAudienceSelect.value = label;
    refs.targetAudienceCategoryForItemSelect.value = category;
    state.lastTargetAudience = "";
    await loadSelectedPrompt();
  }

  async function selectFirstAudienceAfterDelete(): Promise<void> {
    state.lastTargetAudience = "";
    state.lastEasyToReadTargetAudience = "";
    const firstLabel = sortAudiences(state.targetAudienceCatalog.audiences)[0]?.label ?? "";
    if (!firstLabel) {
      refs.targetAudiencePrompt.value = "";
      refs.easyReadTargetAudiencePrompt.value = "";
      updateTargetAudienceLabels();
      updateEasyReadLabels();
      return;
    }

    refs.targetAudienceSelect.value = firstLabel;
    refs.easyReadTargetAudienceSelect.value = firstLabel;
    await loadSelectedPrompt();
  }

  function getSelectedAudience(): TargetAudienceCatalogItem | undefined {
    return state.targetAudienceCatalog.audiences.find(
      (audience) => audience.label === refs.targetAudienceSelect.value,
    );
  }

  function reorderAudience(
    selected: TargetAudienceCatalogItem,
    direction: "up" | "down",
  ): TargetAudienceCatalog | null {
    const sameCategory = getAudiencesByCategory(selected.category);
    const reordered = reorderByName(sameCategory, selected.label, direction, "label");
    if (!reordered) {
      return null;
    }

    const untouched = state.targetAudienceCatalog.audiences.filter(
      (audience) => audience.category !== selected.category,
    );
    return normalizeOrdering({
      categories: [...state.targetAudienceCatalog.categories],
      audiences: [...untouched, ...reordered],
    });
  }

  return {
    init,
    loadCatalog,
    loadSelectedPrompt,
    updateEasyReadLabels,
    getAudienceMeta,
  };
}

function normalizeCatalog(value: unknown): TargetAudienceCatalog {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return cloneEmptyCatalog();
  }

  const record = value as Record<string, unknown>;
  const categories = readCategories(record.categories);
  const audiences = readAudiences(record.audiences);
  return normalizeCatalogRelationships(categories, audiences);
}

function readCategories(value: unknown): TargetAudienceCategory[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const seen = new Set<string>();
  return value
    .map((entry) => readCategory(entry, seen))
    .filter((entry): entry is TargetAudienceCategory => entry !== null);
}

function readCategory(
  entry: unknown,
  seen: Set<string>,
): TargetAudienceCategory | null {
  if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
    return null;
  }
  const record = entry as Record<string, unknown>;
  const name = typeof record.name === "string" ? record.name.trim() : "";
  const sortOrder = record.sortOrder;
  if (!name || seen.has(name) || !isPositiveInteger(sortOrder)) {
    return null;
  }
  seen.add(name);
  return { name, sortOrder };
}

function readAudiences(value: unknown): TargetAudienceCatalogItem[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const seen = new Set<string>();
  return value
    .map((entry) => readAudience(entry, seen))
    .filter((entry): entry is TargetAudienceCatalogItem => entry !== null);
}

function readAudience(
  entry: unknown,
  seen: Set<string>,
): TargetAudienceCatalogItem | null {
  if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
    return null;
  }
  const record = entry as Record<string, unknown>;
  const label = typeof record.label === "string" ? record.label.trim() : "";
  const category = typeof record.category === "string" ? record.category.trim() : "";
  const sortOrder = record.sortOrder;
  if (!label || !category || seen.has(label) || !isPositiveInteger(sortOrder)) {
    return null;
  }
  seen.add(label);
  return { label, category, sortOrder };
}

function normalizeCatalogRelationships(
  categories: TargetAudienceCategory[],
  audiences: TargetAudienceCatalogItem[],
): TargetAudienceCatalog {
  const normalizedCategories = [...categories];
  if (normalizedCategories.length === 0 && audiences.length > 0) {
    addMissingCategories(normalizedCategories, audiences);
  }
  if (normalizedCategories.length === 0) {
    return cloneEmptyCatalog();
  }

  const categoryNames = new Set(normalizedCategories.map((category) => category.name));
  const fallbackCategoryName = normalizedCategories[0]?.name ?? "Default";
  return {
    categories: sortCategories(normalizedCategories),
    audiences: sortAudiences(
      audiences.map((audience) => ({
        ...audience,
        category: categoryNames.has(audience.category)
          ? audience.category
          : fallbackCategoryName,
      })),
    ),
  };
}

function addMissingCategories(
  categories: TargetAudienceCategory[],
  audiences: TargetAudienceCatalogItem[],
): void {
  Array.from(new Set(audiences.map((audience) => audience.category))).forEach(
    (name, index) => {
      categories.push({ name, sortOrder: (index + 1) * 10 });
    },
  );
}

function normalizeOrdering(catalog: TargetAudienceCatalog): TargetAudienceCatalog {
  const categories = sortCategories(catalog.categories).map((category, index) => ({
    ...category,
    sortOrder: (index + 1) * 10,
  }));
  const audiences = categories.flatMap((category) =>
    sortAudiences(catalog.audiences.filter((audience) => audience.category === category.name)).map(
      (audience, index) => ({ ...audience, sortOrder: (index + 1) * 10 }),
    ),
  );
  return { categories, audiences };
}

function sortCategories(
  categories: TargetAudienceCategory[],
): TargetAudienceCategory[] {
  return [...categories].sort(
    (a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, "sv"),
  );
}

function sortAudiences(
  audiences: TargetAudienceCatalogItem[],
): TargetAudienceCatalogItem[] {
  return [...audiences].sort(
    (a, b) =>
      a.category.localeCompare(b.category, "sv") ||
      a.sortOrder - b.sortOrder ||
      a.label.localeCompare(b.label, "sv"),
  );
}

function reorderByName<T extends { name: string }>(
  items: T[],
  selectedName: string,
  direction: "up" | "down",
): T[] | null;
function reorderByName<T extends { label: string }>(
  items: T[],
  selectedName: string,
  direction: "up" | "down",
  key: "label",
): T[] | null;
function reorderByName<T extends { name?: string; label?: string }>(
  items: T[],
  selectedName: string,
  direction: "up" | "down",
  key: "name" | "label" = "name",
): T[] | null {
  const index = items.findIndex((item) => item[key] === selectedName);
  const targetIndex = direction === "up" ? index - 1 : index + 1;
  if (index < 0 || targetIndex < 0 || targetIndex >= items.length) {
    return null;
  }

  const reordered = [...items];
  const [moved] = reordered.splice(index, 1);
  if (!moved) {
    return null;
  }
  reordered.splice(targetIndex, 0, moved);
  return reordered;
}

function cloneEmptyCatalog(): TargetAudienceCatalog {
  return {
    categories: [...EMPTY_TARGET_AUDIENCE_CATALOG.categories],
    audiences: [...EMPTY_TARGET_AUDIENCE_CATALOG.audiences],
  };
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value > 0;
}

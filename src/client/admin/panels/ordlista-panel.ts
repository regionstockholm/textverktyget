import type { AdminFeedback } from "../admin_feedback.js";

type OrdlistaEntry = {
  id: number;
  fromWord: string;
  toWord: string;
  updatedAt?: string;
  updatedBy?: string | null;
};

type OrdlistaPanelRefs = {
  ordlistaFrom: HTMLInputElement;
  ordlistaTo: HTMLInputElement;
  ordlistaSaveButton: HTMLButtonElement;
  ordlistaClearButton: HTMLButtonElement;
  ordlistaList: HTMLElement;
  ordlistaEmpty: HTMLElement;
};

type OrdlistaPanelOptions = {
  refs: OrdlistaPanelRefs;
  request<T>(
    method: string,
    path: string,
    body?: Record<string, unknown>,
  ): Promise<T>;
  feedback: AdminFeedback;
};

export type OrdlistaPanel = {
  load(): Promise<void>;
};

export function initOrdlistaPanel({
  refs,
  request,
  feedback,
}: OrdlistaPanelOptions): OrdlistaPanel {
  const { setStatus, showHint, showButtonHint } = feedback;

  const listOrdlistaEntries = async (): Promise<OrdlistaEntry[]> =>
    request<OrdlistaEntry[]>("GET", "/admin/ordlista");

  const createOrdlistaEntry = async (
    fromWord: string,
    toWord: string,
  ): Promise<OrdlistaEntry> =>
    request<OrdlistaEntry>("POST", "/admin/ordlista", { fromWord, toWord });

  const deleteOrdlistaEntry = async (id: number): Promise<void> => {
    await request("DELETE", `/admin/ordlista/${id}`);
  };

  const clearOrdlistaEntries = async (): Promise<number> => {
    const result = await request<{ deletedCount?: number }>(
      "DELETE",
      "/admin/ordlista",
    );
    return typeof result?.deletedCount === "number" ? result.deletedCount : 0;
  };

  const loadOrdlista = async (): Promise<void> => {
    try {
      setStatus("Hämtar ordlista...");
      const entries = await listOrdlistaEntries();
      renderOrdlista(entries || []);
      setStatus("Ordlista hämtad.");
    } catch (error) {
      setStatus(
        error instanceof Error ? error.message : "Kunde inte hämta ordlista.",
      );
    }
  };

  const renderOrdlista = (entries: OrdlistaEntry[]): void => {
    refs.ordlistaList.innerHTML = "";
    const sorted = [...(entries || [])].sort((a, b) =>
      a.fromWord.localeCompare(b.fromWord, "sv"),
    );

    if (sorted.length === 0) {
      refs.ordlistaEmpty.hidden = false;
      return;
    }

    refs.ordlistaEmpty.hidden = true;
    sorted.forEach((entry) => {
      const row = document.createElement("div");
      row.className = "flex flex-row flex-wrap gap-2 word-list-row";

      const from = document.createElement("span");
      from.className = "text-base flex-even flex-align-content-center";
      from.textContent = entry.fromWord;

      const to = document.createElement("span");
      to.className = "text-base flex-even flex-align-content-center";
      to.textContent = entry.toWord;

      const actions = document.createElement("div");
      actions.className = "flex flex-row flex-even gap-2";

      const remove = document.createElement("button");
      remove.className =
        "flex flex-row flex-justify-content-center flex-align-items-center text-base filled-white outline-blue large-button";
      remove.textContent = "Ta bort";
      remove.addEventListener("click", async () => {
        try {
          setStatus("Tar bort ord...");
          await deleteOrdlistaEntry(entry.id);
          row.remove();
          if (refs.ordlistaList.children.length === 0) {
            refs.ordlistaEmpty.hidden = false;
          }
          setStatus("Ord borttaget.");
          showHint("Borttaget.", "success");
          await loadOrdlista();
        } catch (error) {
          setStatus(
            error instanceof Error ? error.message : "Kunde inte ta bort ord.",
          );
        }
      });

      actions.appendChild(remove);
      row.appendChild(from);
      row.appendChild(to);
      row.appendChild(actions);
      refs.ordlistaList.appendChild(row);
    });
  };

  const saveOrdlista = async (): Promise<void> => {
    const fromWord = refs.ordlistaFrom.value.trim();
    const toWord = refs.ordlistaTo.value.trim();
    if (!fromWord || !toWord) {
      setStatus("Fyll i båda fälten.");
      showButtonHint(refs.ordlistaSaveButton, "Fel.", "error");
      return;
    }

    try {
      setStatus("Sparar ord...");
      await createOrdlistaEntry(fromWord, toWord);
      refs.ordlistaFrom.value = "";
      refs.ordlistaTo.value = "";
      showHint("Sparat.", "success");
      showButtonHint(refs.ordlistaSaveButton, "Sparat.", "success");
      await loadOrdlista();
    } catch (error) {
      setStatus(
        error instanceof Error ? error.message : "Kunde inte spara ord.",
      );
      showButtonHint(refs.ordlistaSaveButton, "Fel.", "error");
    }
  };

  const clearOrdlista = async (): Promise<void> => {
    const confirmed = window.confirm(
      "Vill du rensa hela ordlistan? Detta kan inte ångras.",
    );
    if (!confirmed) {
      return;
    }
    try {
      setStatus("Rensar ordlista...");
      await clearOrdlistaEntries();
      setStatus("Ordlista rensad.");
      showHint("Rensad.", "success");
      showButtonHint(refs.ordlistaClearButton, "Rensad.", "success");
      await loadOrdlista();
    } catch (error) {
      setStatus(
        error instanceof Error ? error.message : "Kunde inte rensa ordlista.",
      );
      showButtonHint(refs.ordlistaClearButton, "Fel.", "error");
    }
  };

  refs.ordlistaSaveButton.addEventListener("click", () => {
    saveOrdlista();
  });

  refs.ordlistaClearButton.addEventListener("click", () => {
    clearOrdlista();
  });

  return { load: loadOrdlista };
}

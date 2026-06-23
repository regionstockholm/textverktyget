import type { AdminContext } from "../admin_context.js";

export type PromptPanel = {
  init(): void;
  setFields(prompts?: Record<string, string>): void;
};

export function initPromptPanel(context: AdminContext): PromptPanel {
  const { request, feedback } = context;
  const { setStatus, showHint, showButtonHint } = feedback;

  const init = (): void => {
    document
      .querySelectorAll<HTMLButtonElement>("[data-prompt-save]")
      .forEach((button) => {
        button.addEventListener("click", () => saveFromButton(button));
      });
  };

  const setFields = (prompts?: Record<string, string>): void => {
    if (!prompts) {
      return;
    }

    Object.entries(prompts).forEach(([name, value]) => {
      const field = getPromptField(name);
      if (field) {
        field.value = value || "";
      }
    });
  };

  async function saveFromButton(button: HTMLButtonElement): Promise<void> {
    const promptName = button.dataset.promptSave;
    if (promptName) {
      await savePrompt(promptName, button);
    }
  }

  async function savePrompt(
    name: string,
    button?: HTMLButtonElement,
  ): Promise<void> {
    const field = getPromptField(name);
    if (!field) {
      return;
    }

    try {
      setStatus(`Sparar prompt: ${name}...`);
      await request("PUT", `/admin/prompts/${encodeURIComponent(name)}`, {
        content: field.value || "",
      });
      setStatus(`Prompt sparad: ${name}`);
      showHint("Sparat.", "success");
      showButtonHint(button ?? null, "Sparat.", "success");
    } catch (error) {
      setStatus(
        error instanceof Error ? error.message : "Kunde inte spara prompt.",
      );
      showButtonHint(button ?? null, "Fel.", "error");
    }
  }

  function getPromptField(name: string): HTMLTextAreaElement | null {
    return document.getElementById(`prompt-${name}`) as HTMLTextAreaElement | null;
  }

  return { init, setFields };
}

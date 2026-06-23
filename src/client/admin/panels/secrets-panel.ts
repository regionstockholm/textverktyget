import type { AdminContext } from "../admin_context.js";
import { getRequiredElement } from "../admin_dom.js";

const secretInputIds: Record<string, string> = {
  GEMINI_API_KEY: "secret-gemini",
  GEMINI_QE_API_KEY: "secret-gemini-qe",
  OPENAI_API_KEY: "secret-openai",
  OPENAI_QE_API_KEY: "secret-openai-qe",
};

export function initSecretsPanel(context: AdminContext): void {
  document
    .querySelectorAll<HTMLButtonElement>("[data-secret-save]")
    .forEach((button) => {
      button.addEventListener("click", () => saveSecretFromButton(context, button));
    });
}

async function saveSecretFromButton(
  context: AdminContext,
  button: HTMLButtonElement,
): Promise<void> {
  const secretName = button.dataset.secretSave;
  const inputId = secretName ? secretInputIds[secretName] : undefined;
  if (secretName && inputId) {
    await saveSecret(context, secretName, inputId, button);
  }
}

async function saveSecret(
  context: AdminContext,
  secretName: string,
  inputId: string,
  button: HTMLButtonElement,
): Promise<void> {
  const { request, feedback } = context;
  const { setStatus, showHint, showButtonHint } = feedback;
  const input = getRequiredElement<HTMLInputElement>(inputId);
  if (!input) {
    return;
  }

  const value = input.value;
  if (!value) {
    setStatus("Ingen nyckel angiven.");
    showButtonHint(button, "Fel.", "error");
    return;
  }

  try {
    setStatus(`Sparar ${secretName}...`);
    await request("PUT", `/admin/secrets/${secretName}`, { value });
    input.value = "";
    setStatus(`${secretName} sparad.`);
    showHint("Nyckel sparad.", "success");
    showButtonHint(button, "Sparat.", "success");
  } catch (error) {
    setStatus(
      error instanceof Error ? error.message : "Kunde inte spara nyckel.",
    );
    showButtonHint(button, "Fel.", "error");
  }
}

import type { AdminBackupClient } from "../admin_backup.js";
import type { AdminFeedback } from "../admin_feedback.js";

type BackupPanelRefs = {
  backupDownloadButton: HTMLButtonElement;
  backupUploadInput: HTMLInputElement;
  backupImportButton: HTMLButtonElement;
};

type BackupPanelOptions = {
  refs: BackupPanelRefs;
  backupClient: AdminBackupClient;
  feedback: AdminFeedback;
  onImported(): void;
};

function formatBackupFilename(): string {
  const date = new Date();
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}-textverktyg.json`;
}

async function readBackupFile(input: HTMLInputElement): Promise<unknown> {
  const file = input.files?.[0];
  if (!file) {
    throw new Error("Välj en JSON-fil.");
  }

  const text = await file.text();
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (error) {
    throw new Error("Kunde inte läsa JSON-filen.");
  }

  if (!parsed || typeof parsed !== "object") {
    throw new Error("Backup-filen saknar korrekt struktur.");
  }

  const record = parsed as Record<string, unknown>;
  if (
    record.schemaVersion === undefined ||
    record.app === undefined ||
    record.settings === undefined
  ) {
    throw new Error("Backup-filen saknar obligatoriska fält.");
  }

  return parsed;
}

export function initBackupPanel({
  refs,
  backupClient,
  feedback,
  onImported,
}: BackupPanelOptions): void {
  const { setStatus, showHint, showButtonHint } = feedback;

  const downloadBackup = async (): Promise<void> => {
    try {
      setStatus("Hämtar backup...");
      const payload = await backupClient.requestPayload();
      const blob = new Blob([JSON.stringify(payload, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = formatBackupFilename();
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      setStatus("Backup hämtad.");
      showButtonHint(refs.backupDownloadButton, "Hämtad.", "success");
    } catch (error) {
      setStatus(
        error instanceof Error ? error.message : "Kunde inte hämta backup.",
      );
      showButtonHint(refs.backupDownloadButton, "Fel.", "error");
    }
  };

  const importBackup = async (): Promise<void> => {
    try {
      setStatus("Importerar backup...");
      const payload = await readBackupFile(refs.backupUploadInput);
      const result = await backupClient.postPayload(payload);
      const promptCount = result.imported?.prompts ?? 0;
      const ordlistaCount = result.imported?.ordlista ?? 0;
      refs.backupUploadInput.value = "";
      setStatus("Backup importerad.");
      showHint("Import klar.", "success");
      showButtonHint(refs.backupImportButton, "Import klar.", "success");
      if (promptCount > 0 || ordlistaCount > 0) {
        onImported();
      }
    } catch (error) {
      setStatus(
        error instanceof Error ? error.message : "Kunde inte importera backup.",
      );
      showButtonHint(refs.backupImportButton, "Fel.", "error");
    }
  };

  refs.backupDownloadButton.addEventListener("click", () => {
    downloadBackup();
  });

  refs.backupImportButton.addEventListener("click", () => {
    importBackup();
  });
}

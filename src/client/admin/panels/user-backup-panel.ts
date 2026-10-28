import type { AdminContext } from "../admin_context.js";
import { adminRequestHeaders, handleAdminSessionExpiry } from "../admin_api.js";
import { MAX_BACKUP_BYTES, parseUserBackup, type UserBackup } from "../../../validators/user-backup-validator.js";

export function initUserBackupPanel({ request }: Pick<AdminContext, "request">, onImported: () => Promise<void>): void {
  const download = document.getElementById("user-backup-download") as HTMLButtonElement | null;
  const file = document.getElementById("user-backup-file") as HTMLInputElement | null;
  const restore = document.getElementById("user-backup-restore") as HTMLButtonElement | null;
  const status = document.getElementById("user-backup-status");
  if (!download && !file && !restore && !status) return; // Feature removed from the page.
  if (!download || !file || !restore || !status) {
    if (download) download.disabled = true;
    if (restore) restore.disabled = true;
    const error = status || document.getElementById("admin-status");
    if (error) error.textContent = "Användarbackup kunde inte startas: sidans kontroller saknas. Ladda om sidan utan cache.";
    return;
  }
  if (download.dataset.backupInitialized === "true") return;
  download.dataset.backupInitialized = "true";
  let backup: UserBackup | null = null;
  let selection = 0;
  const message = (error: unknown) => error instanceof Error ? error.message : "Åtgärden misslyckades.";

  download.addEventListener("click", () => {
    download.disabled = true;
    void (async () => {
      const response = await fetch("/admin/user-backup/export", {
        headers: adminRequestHeaders(), credentials: "same-origin", cache: "no-store",
      });
      handleAdminSessionExpiry(response);
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.error || payload?.message || "Kunde inte hämta säkerhetskopian.");
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `textverktyg-users-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.append(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      status.textContent = "Säkerhetskopian har hämtats. Förvara filen säkert utanför applikationen.";
    })().catch(error => { status.textContent = message(error); }).finally(() => { download.disabled = false; });
  });

  file.addEventListener("change", () => {
    const current = ++selection;
    backup = null;
    restore.disabled = true;
    status.textContent = "";
    const selected = file.files?.[0];
    if (!selected) return;
    if (selected.size > MAX_BACKUP_BYTES) { status.textContent = "Filen får vara högst 1 MiB."; return; }
    void selected.text().then(text => {
      if (current !== selection) return;
      backup = parseUserBackup(text);
      status.textContent = `${selected.name}: ${backup.users.length} användare. Återställning kräver att användarlistan är tom.`;
      restore.disabled = false;
    }).catch(error => { if (current === selection) status.textContent = message(error); });
  });

  restore.addEventListener("click", () => {
    if (!backup || !window.confirm(`Återställ ${backup.users.length} användare? Användarlistan måste vara tom. Alla sessioner avslutas, även adminsessionen. Logga in igen efter återställning.`)) return;
    restore.disabled = true;
    file.disabled = true;
    void request<{ imported: number }>("POST", "/admin/user-backup/import", backup)
      .then(async result => {
        backup = null;
        file.value = "";
        status.textContent = `${result.imported} användare återställda. Befintliga lösenord fungerar igen.`;
        await onImported();
      })
      .catch(error => { status.textContent = message(error); })
      .finally(() => { file.disabled = false; restore.disabled = backup === null; });
  });
}

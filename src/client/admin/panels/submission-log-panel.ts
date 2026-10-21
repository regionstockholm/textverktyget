import type { AdminContext } from "../admin_context.js";
import { handleAdminSessionExpiry } from "../admin_api.js";

type Settings = { retentionDays: number; environmentDays: number; overrideDays: number | null };

export function initSubmissionLogPanel({ request, feedback }: AdminContext) {
  const days = document.getElementById("submission-log-days") as HTMLInputElement;
  const status = document.getElementById("submission-log-settings-status")!;
  const showError = (error: unknown) => feedback.setStatus(error instanceof Error ? error.message : "Åtgärden misslyckades.");
  async function load(): Promise<void> {
    try {
      const settings = await request<Settings>("GET", "/admin/submission-log/settings");
      days.value = String(settings.retentionDays);
      status.textContent = `Aktuell lagringstid: ${settings.retentionDays} dagar (${settings.overrideDays === null ? ".env" : "admin-överstyrning"}). .env: ${settings.environmentDays} dagar.`;
    } catch (error) { showError(error); }
  }
  async function save(value: number | null): Promise<void> {
    try { await request("PUT", "/admin/submission-log/settings", { retentionDays: value }); await load(); }
    catch (error) { showError(error); }
  }
  function init(): void {
    document.getElementById("submission-log-save")?.addEventListener("click", () => {
      if (days.reportValidity()) void save(Number(days.value));
    });
    document.getElementById("submission-log-reset")?.addEventListener("click", () => { void save(null); });
    document.getElementById("submission-log-export")?.addEventListener("click", event => {
      const button = event.currentTarget as HTMLButtonElement;
      button.disabled = true;
      void (async () => {
        const response = await fetch("/admin/submission-log/export.csv", {
          credentials: "same-origin", cache: "no-store",
        });
        handleAdminSessionExpiry(response);
        if (!response.ok) throw new Error(`Export misslyckades (${response.status}).`);
        const url = URL.createObjectURL(await response.blob());
        const link = document.createElement("a");
        link.href = url;
        link.download = "submission-log.csv";
        document.body.append(link);
        link.click();
        link.remove();
        setTimeout(() => URL.revokeObjectURL(url), 60_000);
        feedback.setStatus("CSV exporterad. Filen innehåller känslig text; hantera den säkert.");
      })().catch(showError).finally(() => { button.disabled = false; });
    });
  }
  return { init, load };
}

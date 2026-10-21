import type { AdminContext } from "../admin_context.js";
import { generatePassword } from "../password-generator.js";

type SafeUser = { id: number; username: string; createdAt: string };

export function initUsersPanel({ request, feedback }: AdminContext) {
  const username = document.getElementById("user-username") as HTMLInputElement;
  const password = document.getElementById("user-password") as HTMLInputElement;
  const list = document.getElementById("users-list")!;
  async function load(): Promise<void> {
    try {
      const response = await request<{ users: SafeUser[] }>("GET", "/admin/users");
      list.replaceChildren();
      for (const user of response.users) {
        const row = document.createElement("div");
        row.className = "admin-list-row";
        const label = document.createElement("span");
        label.textContent = user.username;
        const remove = document.createElement("button");
        remove.type = "button";
        remove.className = "admin-danger";
        remove.setAttribute("aria-label", `Ta bort användaren ${user.username}`);
        remove.textContent = "Ta bort";
        remove.addEventListener("click", () => {
          if (!window.confirm(`Ta bort användaren "${user.username}"? Aktiva sessioner upphör att fungera.`)) return;
          remove.disabled = true;
          void request("DELETE", `/admin/users/${user.id}`).then(load)
            .catch(error => { feedback.setStatus(error instanceof Error ? error.message : "Kunde inte ta bort användare."); remove.disabled = false; });
        });
        row.append(label, remove);
        list.append(row);
      }
      if (!response.users.length) {
        const empty = document.createElement("p");
        empty.className = "admin-empty";
        empty.textContent = "Inga användare ännu.";
        list.append(empty);
      }
    } catch (error) { feedback.setStatus(error instanceof Error ? error.message : "Kunde inte hämta användare."); }
  }
  function init(): void {
    document.getElementById("user-generate-password")?.addEventListener("click", () => { password.value = generatePassword(); });
    document.getElementById("user-create")?.addEventListener("click", event => {
      const button = event.currentTarget as HTMLButtonElement;
      button.disabled = true;
      void request("POST", "/admin/users", { username: username.value.trim(), password: password.value })
        .then(async () => { username.value = ""; password.value = ""; feedback.setStatus("Användare skapad."); await load(); })
        .catch(error => feedback.setStatus(error instanceof Error ? error.message : "Kunde inte skapa användare."))
        .finally(() => { button.disabled = false; });
    });
  }
  return { init, load };
}

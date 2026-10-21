import { createSignInCooldown } from "./sign-in-cooldown.js";

const form = document.getElementById("admin-login-form") as HTMLFormElement | null;
const key = document.getElementById("admin-key") as HTMLInputElement | null;
const button = document.getElementById("admin-login-button") as HTMLButtonElement | null;
const error = document.getElementById("admin-login-error");

// Remove credentials saved by older admin UI versions; the new UI uses an HttpOnly cookie.
try { localStorage.removeItem("adminApiKey"); } catch { /* Storage may be disabled. */ }

if (form && key && button && error) {
  const cooldown = createSignInCooldown(button, error);
  form.addEventListener("submit", event => {
    event.preventDefault();
    if (button.disabled || cooldown.active()) return;
    button.disabled = true;
    error.textContent = "";
    void fetch("/admin/login", {
      method: "POST", credentials: "same-origin", cache: "no-store",
      headers: { Authorization: `Bearer ${key.value.trim()}` },
    }).then(response => {
      if (response.ok) window.location.replace(`/admin-ui${window.location.hash}`);
      else if (response.status === 429) cooldown.start(response);
      else error.textContent = response.status === 401 ? "Fel admin-nyckel. Försök igen." : "Det gick inte att logga in. Försök igen senare.";
    }).catch(() => { error.textContent = "Det gick inte att ansluta. Försök igen."; })
      .finally(() => { if (!cooldown.active()) button.disabled = false; key.value = ""; });
  });
}

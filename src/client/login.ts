const form = document.getElementById("login-form") as HTMLFormElement | null;
const username = document.getElementById("username") as HTMLInputElement | null;
const password = document.getElementById("password") as HTMLInputElement | null;
const button = document.getElementById("login-button") as HTMLButtonElement | null;
const error = document.getElementById("error-message");

const cooldown = button && error ? createSignInCooldown(button, error) : null;
form?.addEventListener("submit", event => {
  event.preventDefault();
  if (!username || !password || !button || !error) return;
  if (button.disabled || cooldown?.active()) return;
  button.disabled = true;
  error.textContent = "";
  void fetch("/auth/login", {
    method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: username.value.trim(), password: password.value }),
  }).then(response => {
    if (response.ok) window.location.replace("/");
    else if (response.status === 429) cooldown?.start(response);
    else error.textContent = "Kunde inte logga in. Kontrollera användarnamn och lösenord.";
  }).catch(() => { error.textContent = "Det gick inte att ansluta. Försök igen."; })
    .finally(() => { if (!cooldown?.active()) button.disabled = false; password.value = ""; });
});
import { createSignInCooldown } from "./sign-in-cooldown.js";

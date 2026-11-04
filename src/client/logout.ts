const logout = document.getElementById("user-logout") as HTMLButtonElement | null;
if (document.body.dataset.userLoginEnabled === "true") {
  // Runs only inside the protected tool, never on the public login page.
  const confirmation = fetch("/auth/session-start", { method: "POST", credentials: "same-origin" })
    .then(response => { if (!response.ok) console.error("Kunde inte registrera inloggningen."); })
    .catch(() => console.error("Kunde inte registrera inloggningen."));
  logout?.addEventListener("click", () => {
    logout.disabled = true;
    void confirmation.then(() => fetch("/auth/logout", { method: "POST", credentials: "same-origin" }))
      .then(response => {
        if (!response.ok) throw new Error("Logout failed");
        window.location.replace("/login");
      }).catch(() => { logout.disabled = false; window.alert("Kunde inte logga ut. Försök igen."); });
  });
} else if (logout) {
  logout.hidden = true;
}

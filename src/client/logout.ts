document.getElementById("user-logout")?.addEventListener("click", () => {
  void fetch("/auth/logout", { method: "POST", credentials: "same-origin" })
    .then(response => { if (response.ok) window.location.replace("/login"); else window.alert("Kunde inte logga ut. Försök igen."); })
    .catch(() => window.alert("Kunde inte logga ut. Försök igen."));
});

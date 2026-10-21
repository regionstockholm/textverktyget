/** Display the server's Retry-After countdown; enforcement always stays on the server. */
export function createSignInCooldown(button: HTMLButtonElement, message: HTMLElement) {
  let deadline = 0;
  let timer = 0;
  const active = (): boolean => Date.now() < deadline;
  const update = (): void => {
    const seconds = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
    button.disabled = seconds > 0;
    message.textContent = seconds > 0
      ? `För många misslyckade försök. Försök igen om ${seconds} sekunder.`
      : "Du kan försöka logga in igen.";
    if (!seconds) { window.clearInterval(timer); timer = 0; }
  };
  const start = (response: Response): void => {
    const header = response.headers.get("Retry-After");
    const seconds = header && /^\d+$/.test(header) ? Number(header) : header ? Math.ceil((Date.parse(header) - Date.now()) / 1000) : 30;
    deadline = Date.now() + (Number.isFinite(seconds) ? Math.max(1, seconds) : 30) * 1000;
    if (timer) window.clearInterval(timer);
    update();
    timer = window.setInterval(update, 1000);
  };
  return { active, start };
}

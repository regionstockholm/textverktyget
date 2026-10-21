// Optimizers can execute a bundle after DOMContentLoaded has already fired.
export function onDocumentReady(callback: () => void, root: Document = document): void {
  if (root.readyState === "loading") root.addEventListener("DOMContentLoaded", callback, { once: true });
  else callback();
}

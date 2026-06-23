export const copyToClipboard = async (text: string): Promise<boolean> => {
  if (typeof text !== "string" || text.length === 0) {
    return false;
  }

  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return copyToClipboardFallback(text);
  }
};

function copyToClipboardFallback(text: string): boolean {
  try {
    const textArea = document.createElement("textarea");
    textArea.value = text;
    textArea.style.position = "fixed";
    textArea.style.left = "-999999px";
    textArea.style.top = "-999999px";

    document.body.appendChild(textArea);
    textArea.select();

    const success = document.execCommand("copy");
    textArea.remove();
    return success;
  } catch {
    return false;
  }
}

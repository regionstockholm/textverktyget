export function normalizeClientProcessId(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  if (trimmed.length > 120) {
    return null;
  }

  if (!/^[A-Za-z0-9:_-]+$/.test(trimmed)) {
    return null;
  }

  return trimmed;
}

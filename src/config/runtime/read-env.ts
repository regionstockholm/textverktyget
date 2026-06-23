export function readIntegerEnv(
  envKey: string,
  fallback: number,
  min: number,
  max?: number,
): number {
  const rawValue = process.env[envKey];
  if (!rawValue || rawValue.trim().length === 0) {
    return fallback;
  }

  const parsed = Number.parseInt(rawValue, 10);
  if (!Number.isInteger(parsed)) {
    return fallback;
  }

  if (parsed < min) {
    return fallback;
  }

  if (typeof max === "number" && parsed > max) {
    return fallback;
  }

  return parsed;
}

export function readBooleanEnv(envKey: string, fallback: boolean): boolean {
  const rawValue = process.env[envKey];
  if (!rawValue || rawValue.trim().length === 0) {
    return fallback;
  }

  const normalized = rawValue.trim().toLowerCase();
  if (normalized === "true" || normalized === "1" || normalized === "yes") {
    return true;
  }

  if (normalized === "false" || normalized === "0" || normalized === "no") {
    return false;
  }

  return fallback;
}

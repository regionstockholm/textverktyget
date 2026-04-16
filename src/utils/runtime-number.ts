export type RuntimeIntegerRoundingMode = "trunc" | "round";

export function readRuntimeInteger(
  value: unknown,
  fallback: number,
  min: number,
  max: number,
  roundingMode: RuntimeIntegerRoundingMode = "trunc",
): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return fallback;
  }

  const parsed = roundingMode === "round" ? Math.round(value) : Math.trunc(value);
  if (parsed < min || parsed > max) {
    return fallback;
  }

  return parsed;
}

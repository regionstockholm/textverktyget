const DEFAULT_ADMIN_API_KEYS = new Set(["admin"]);
const DEFAULT_CONFIG_MASTER_KEYS = new Set([
  "LaNg5Ch1K09BXqXNRlczqFnG9OqFp2gX",
]);
const MIN_CONFIG_MASTER_KEY_LENGTH = 32;

function isProductionRuntime(): boolean {
  return process.env.NODE_ENV === "production";
}

function isLocalDevelopmentOverride(): boolean {
  return process.env.LOCAL_DEV === "true";
}

function hasUnsafeAdminApiKey(value: string | undefined): boolean {
  return !value || DEFAULT_ADMIN_API_KEYS.has(value.trim().toLowerCase());
}

function hasUnsafeConfigMasterKey(value: string | undefined): boolean {
  if (!value || value.trim().length < MIN_CONFIG_MASTER_KEY_LENGTH) {
    return true;
  }

  return DEFAULT_CONFIG_MASTER_KEYS.has(value.trim());
}

export function assertSafeAdminCredentialsForStartup(): void {
  if (!isProductionRuntime() || isLocalDevelopmentOverride()) {
    return;
  }

  const failures: string[] = [];
  if (hasUnsafeAdminApiKey(process.env.ADMIN_API_KEY)) {
    failures.push("ADMIN_API_KEY must be changed from the local default");
  }

  if (hasUnsafeConfigMasterKey(process.env.CONFIG_MASTER_KEY)) {
    failures.push(
      `CONFIG_MASTER_KEY must be set to a non-default value with at least ${MIN_CONFIG_MASTER_KEY_LENGTH} characters`,
    );
  }

  if (failures.length > 0) {
    throw new Error(
      `Unsafe production admin configuration: ${failures.join("; ")}`,
    );
  }
}

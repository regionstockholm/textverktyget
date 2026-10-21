import { adminRequestHeaders, handleAdminSessionExpiry, type AdminTokenProvider } from "./admin_api.js";

export type AdminBackupImportResult = {
  imported?: { prompts?: number; ordlista?: number };
  upgradedFrom?: number;
};

export type AdminBackupClient = {
  requestPayload(): Promise<unknown>;
  postPayload(payload: unknown): Promise<AdminBackupImportResult>;
};

export async function requestAdminBackupPayload(
  token: string,
): Promise<unknown> {
  const response = await fetch("/admin/backup", {
    method: "GET",
    headers: adminRequestHeaders(token),
    cache: "no-store",
    credentials: "same-origin",
  });
  if (!token) handleAdminSessionExpiry(response);

  const payload = (await response.json().catch(() => null)) as
    | { error?: string; message?: string }
    | unknown
    | null;
  if (!response.ok) {
    const errorMessage =
      typeof payload === "object" && payload !== null
        ? (payload as { error?: string; message?: string }).error ||
          (payload as { error?: string; message?: string }).message
        : undefined;
    throw new Error(errorMessage || `Fel (${response.status})`);
  }

  return payload ?? {};
}

export async function postAdminBackupPayload(
  token: string,
  payload: unknown,
): Promise<AdminBackupImportResult> {
  const response = await fetch("/admin/backup", {
    method: "POST",
    headers: {
      ...adminRequestHeaders(token),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
    cache: "no-store",
    credentials: "same-origin",
  });
  if (!token) handleAdminSessionExpiry(response);

  const result = (await response.json().catch(() => null)) as
    | { data?: AdminBackupImportResult }
    | { error?: string; message?: string; validationErrors?: string[] }
    | null;

  if (!response.ok) {
    const errorPayload = result as {
      error?: string;
      message?: string;
      validationErrors?: string[];
    } | null;
    let message =
      errorPayload?.error ||
      errorPayload?.message ||
      `Fel (${response.status})`;
    if (errorPayload?.validationErrors?.length) {
      message = `${message}: ${errorPayload.validationErrors[0]}`;
    }
    throw new Error(message);
  }

  const successPayload = result as {
    data?: AdminBackupImportResult;
  } | null;
  return successPayload?.data ?? {};
}

export function createAdminBackupClient(
  getToken: AdminTokenProvider,
): AdminBackupClient {
  return {
    requestPayload(): Promise<unknown> {
      return requestAdminBackupPayload(getToken());
    },
    postPayload(payload: unknown): Promise<AdminBackupImportResult> {
      return postAdminBackupPayload(getToken(), payload);
    },
  };
}

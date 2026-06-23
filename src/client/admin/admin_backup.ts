import { requireAdminToken, type AdminTokenProvider } from "./admin_api.js";

export type AdminBackupImportResult = {
  imported?: { prompts?: number; ordlista?: number };
};

export type AdminBackupClient = {
  requestPayload(): Promise<unknown>;
  postPayload(payload: unknown): Promise<AdminBackupImportResult>;
};

export async function requestAdminBackupPayload(
  token: string,
): Promise<unknown> {
  const adminToken = requireAdminToken(token);
  const response = await fetch("/admin/backup", {
    method: "GET",
    headers: {
      Authorization: `Bearer ${adminToken}`,
      "X-Admin-Actor": "admin-ui",
    },
    cache: "no-store",
  });

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
  const adminToken = requireAdminToken(token);
  const response = await fetch("/admin/backup", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${adminToken}`,
      "Content-Type": "application/json",
      "X-Admin-Actor": "admin-ui",
    },
    body: JSON.stringify(payload),
    cache: "no-store",
  });

  const result = (await response.json().catch(() => null)) as
    | { data?: { imported?: { prompts?: number; ordlista?: number } } }
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
    data?: { imported?: { prompts?: number; ordlista?: number } };
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

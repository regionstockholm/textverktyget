export type ApiResponse<T> = {
  data?: T;
  message?: string;
  error?: string;
  validationErrors?: string[];
};

export type AdminTokenProvider = () => string;

export type AdminApiClient = {
  request<T>(
    method: string,
    path: string,
    body?: Record<string, unknown>,
  ): Promise<T>;
};

export function adminRequestHeaders(token = ""): Record<string, string> {
  return { "X-Admin-Actor": "admin-ui", ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}

export function handleAdminSessionExpiry(response: Response): void {
  if (response.status === 401) window.location.replace(`/admin-ui${window.location.hash}`);
}

export async function requestAdminApi<T>(
  token: string,
  method: string,
  path: string,
  body?: Record<string, unknown>,
): Promise<T> {
  const headers = adminRequestHeaders(token);

  if (body !== undefined) {
    headers["Content-Type"] = "application/json";
  }

  const response = await fetch(path, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
    cache: "no-store",
    credentials: "same-origin",
  });
  if (!token) handleAdminSessionExpiry(response);

  const payload = (await response
    .json()
    .catch(() => null)) as ApiResponse<T> | null;
  if (!response.ok) {
    let message =
      payload?.message || payload?.error || `Fel (${response.status})`;
    if (payload?.validationErrors?.length) {
      message = `${message}: ${payload.validationErrors[0]}`;
    }
    throw new Error(message);
  }

  return (payload?.data as T) ?? ({} as T);
}

export function createAdminApiClient(
  getToken: AdminTokenProvider,
): AdminApiClient {
  return {
    request<T>(
      method: string,
      path: string,
      body?: Record<string, unknown>,
    ): Promise<T> {
      return requestAdminApi<T>(getToken(), method, path, body);
    },
  };
}

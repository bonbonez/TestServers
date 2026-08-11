const BASE_URL =
  import.meta.env.VITE_CONFIG_SERVER_URL ?? "http://127.0.0.1:7300";

async function request<T>(
  path: string,
  method: string,
  body?: unknown,
): Promise<T> {
  const response = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: body ? { "content-type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!response.ok) {
    const detail = await response.json().catch(() => ({}));
    throw new Error(detail.error ?? `Request failed (${response.status})`);
  }
  if (response.status === 204) {
    return undefined as T;
  }
  return response.json() as Promise<T>;
}

export function apiGet<T>(path: string): Promise<T> {
  return request<T>(path, "GET");
}

export function apiPut<T>(path: string, body: unknown): Promise<T> {
  return request<T>(path, "PUT", body);
}

export function apiPost<T>(path: string, body: unknown): Promise<T> {
  return request<T>(path, "POST", body);
}

export function apiDelete(path: string): Promise<void> {
  return request<void>(path, "DELETE");
}

export async function fetchEnvFile(): Promise<string> {
  const response = await fetch(`${BASE_URL}/api/env-file`);
  return response.text();
}

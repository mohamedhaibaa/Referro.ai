const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000/api/v1";

function getToken(): string | null {
  return localStorage.getItem("access_token");
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(init.headers as Record<string, string>),
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(`${BASE_URL}${path}`, { ...init, headers });

  if (res.status === 401) {
    localStorage.removeItem("access_token");
    localStorage.removeItem("user");
    // REF-26: clear auth-coupled state so zombie polling against a stale
    // workflow_run can't resurrect on the next session.
    localStorage.removeItem("referroing:active");
    window.location.href = "/login";
    throw new Error("Unauthorized");
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.detail ?? `HTTP ${res.status}`);
  }

  if (res.status === 204) return undefined as T;
  return res.json();
}

async function uploadRequest<T>(path: string, form: FormData): Promise<T> {
  // REF-33b: multipart helper. Critical: DO NOT set Content-Type — the
  // browser sets multipart/form-data with the correct boundary when the
  // body is FormData. Reuses request() for auth + 401 handling would be
  // nice but request() forces application/json, so we inline the same
  // 401 + error shape.
  const token = getToken();
  const headers: Record<string, string> = {};
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${BASE_URL}${path}`, { method: "POST", headers, body: form });

  if (res.status === 401) {
    localStorage.removeItem("access_token");
    localStorage.removeItem("user");
    localStorage.removeItem("referroing:active");
    window.location.href = "/login";
    throw new Error("Unauthorized");
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.detail ?? `HTTP ${res.status}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

export const api = {
  get: <T>(path: string) => request<T>(path, { method: "GET" }),
  post: <T>(path: string, body: unknown) =>
    request<T>(path, { method: "POST", body: JSON.stringify(body) }),
  patch: <T>(path: string, body: unknown) =>
    request<T>(path, { method: "PATCH", body: JSON.stringify(body) }),
  delete: <T>(path: string) => request<T>(path, { method: "DELETE" }),
  upload: <T>(path: string, form: FormData) => uploadRequest<T>(path, form),
};

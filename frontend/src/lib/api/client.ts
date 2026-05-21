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

async function streamRequest<T>(
  path: string,
  body: unknown,
  onChunk: (chunk: T) => void,
): Promise<void> {
  // REF-34: NDJSON streaming helper. Reads response body line-by-line,
  // parses each line as JSON, fires onChunk per line. Used by the
  // reply_paste two-stage emission (classification chunk + draft chunk).
  // Inlined 401 + error handling (request() forces application/json on
  // the response and calls res.json() which doesn't work for streams).
  const token = getToken();
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${BASE_URL}${path}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });

  if (res.status === 401) {
    localStorage.removeItem("access_token");
    localStorage.removeItem("user");
    localStorage.removeItem("referroing:active");
    window.location.href = "/login";
    throw new Error("Unauthorized");
  }
  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}));
    throw new Error(errBody?.detail ?? `HTTP ${res.status}`);
  }
  if (!res.body) throw new Error("Empty response body");

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      if (buffer.trim()) {
        try { onChunk(JSON.parse(buffer) as T); } catch { /* ignore trailing partial */ }
      }
      break;
    }
    buffer += decoder.decode(value, { stream: true });
    let nl;
    while ((nl = buffer.indexOf("\n")) !== -1) {
      const line = buffer.slice(0, nl).trim();
      buffer = buffer.slice(nl + 1);
      if (line) {
        try { onChunk(JSON.parse(line) as T); }
        catch (e) { console.warn("invalid NDJSON line", line, e); }
      }
    }
  }
}

export const api = {
  get: <T>(path: string) => request<T>(path, { method: "GET" }),
  post: <T>(path: string, body: unknown) =>
    request<T>(path, { method: "POST", body: JSON.stringify(body) }),
  patch: <T>(path: string, body: unknown) =>
    request<T>(path, { method: "PATCH", body: JSON.stringify(body) }),
  delete: <T>(path: string) => request<T>(path, { method: "DELETE" }),
  upload: <T>(path: string, form: FormData) => uploadRequest<T>(path, form),
  stream: <T>(path: string, body: unknown, onChunk: (chunk: T) => void) =>
    streamRequest<T>(path, body, onChunk),
};

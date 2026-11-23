export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string, public details?: { field: string; message: string }[]) {
    super(message);
  }
}

const BASE = import.meta.env.VITE_API_BASE ?? "/api/v1";

function csrfToken(): string | undefined {
  return document.cookie.split("; ").find((c) => c.startsWith("csrf_token="))?.split("=")[1];
}

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const method = (init.method ?? "GET").toUpperCase();
  const headers: Record<string, string> = { ...(init.headers as Record<string, string> | undefined) };
  if (!(init.body instanceof FormData)) headers["Content-Type"] ??= "application/json";
  const token = csrfToken();
  if (method !== "GET" && token) headers["X-CSRF-Token"] = token;
  const res = await fetch(`${BASE}${path}`, { credentials: "include", ...init, headers });
  if (!res.ok) {
    let code = "http_error";
    let message = res.statusText;
    let details;
    try {
      const body = await res.json();
      code = body?.error?.code ?? code;
      message = body?.error?.message ?? message;
      details = body?.error?.details;
    } catch {
      /* non-JSON error body */
    }
    throw new ApiError(res.status, code, message, details);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

/** Multipart upload with progress (fetch cannot report upload progress). */
export function uploadWithProgress<T>(path: string, form: FormData, onProgress: (pct: number) => void): Promise<T> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${BASE}${path}`);
    xhr.withCredentials = true;
    const token = csrfToken();
    if (token) xhr.setRequestHeader("X-CSRF-Token", token);
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(Math.round((e.loaded / e.total) * 100));
    xhr.onload = () => {
      let body: any = null;
      try { body = JSON.parse(xhr.responseText); } catch { /* empty */ }
      if (xhr.status >= 200 && xhr.status < 300) resolve(body as T);
      else reject(new ApiError(xhr.status, body?.error?.code ?? "http_error", body?.error?.message ?? xhr.statusText));
    };
    xhr.onerror = () => reject(new ApiError(0, "network_error", "Network error"));
    xhr.send(form);
  });
}

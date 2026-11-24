
export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: { field: string; message: string }[],
  ) {
    super(message);
  }
}

const BASE = import.meta.env.VITE_API_BASE ?? "/api/v1";

let cachedCsrfToken: string | undefined;
let csrfRequest: Promise<string> | undefined;

async function csrfToken(): Promise<string> {
  if (cachedCsrfToken) return cachedCsrfToken;

  if (!csrfRequest) {
    csrfRequest = fetch(`${BASE}/auth/csrf`, {
      method: "GET",
      credentials: "include",
    })
      .then(async (res): Promise<string> => {
        if (!res.ok) {
          throw new ApiError(res.status, "csrf_error", "Could not retrieve CSRF token");
        }

        const data = await res.json();

        if (!data.csrf_token) {
          throw new ApiError(403, "csrf_error", "CSRF token missing");
        }

        const token: string = data.csrf_token;
        cachedCsrfToken = token;
        return token;
      })
      .finally(() => {
        csrfRequest = undefined;
      });
  }

  return csrfRequest!;
}

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const method = (init.method ?? "GET").toUpperCase();
  const headers: Record<string, string> = {
    ...(init.headers as Record<string, string> | undefined),
  };

  if (!(init.body instanceof FormData)) {
    headers["Content-Type"] ??= "application/json";
  }

  const requiresCsrf =
    path.startsWith("/admin/") || path === "/auth/change-password";

  if (requiresCsrf && !["GET", "HEAD", "OPTIONS"].includes(method)) {
    headers["X-CSRF-Token"] = await csrfToken();
  }

  const res = await fetch(`${BASE}${path}`, {
    credentials: "include",
    ...init,
    headers,
  });
  if (path === "/auth/login" && res.ok) {
    cachedCsrfToken = undefined;
  }

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

    if (res.status === 401 || res.status === 403) {
      cachedCsrfToken = undefined;
    }

    throw new ApiError(res.status, code, message, details);
  }

  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

/** Multipart upload with progress (fetch cannot report upload progress). */
export function uploadWithProgress<T>(
  path: string,
  form: FormData,
  onProgress: (pct: number) => void,
): Promise<T> {
  return new Promise(async (resolve, reject) => {
    try {
      const token = path.startsWith("/admin/") ? await csrfToken() : undefined;
      const xhr = new XMLHttpRequest();

      xhr.open("POST", `${BASE}${path}`);
      xhr.withCredentials = true;
      if (token) xhr.setRequestHeader("X-CSRF-Token", token);

      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          onProgress(Math.round((e.loaded / e.total) * 100));
        }
      };

      xhr.onload = () => {
        let body: any = null;
        try {
          body = JSON.parse(xhr.responseText);
        } catch {
          /* empty */
        }

        if (xhr.status >= 200 && xhr.status < 300) {
          resolve(body as T);
        } else {
          reject(
            new ApiError(
              xhr.status,
              body?.error?.code ?? "http_error",
              body?.error?.message ?? xhr.statusText,
            ),
          );
        }
      };

      xhr.onerror = () =>
        reject(new ApiError(0, "network_error", "Network error"));

      xhr.send(form);
    } catch (error) {
      reject(error);
    }
  });
}

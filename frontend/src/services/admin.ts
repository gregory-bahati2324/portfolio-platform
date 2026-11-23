import type { AdminInquiry, AdminProject, AdminUser, MediaItem, Overview } from "@/types/admin";
import type { ProjectDetail } from "@/types/api";
import { api, uploadWithProgress } from "./api";

const j = (method: string, body?: unknown) => ({ method, body: body === undefined ? undefined : JSON.stringify(body) });

export const login = (email: string, password: string) => api<AdminUser>("/auth/login", j("POST", { email, password }));
export const logout = () => api<void>("/auth/logout", j("POST"));
export const me = () => api<AdminUser>("/auth/me");
export const changePassword = (current_password: string, new_password: string) => api<void>("/auth/change-password", j("POST", { current_password, new_password }));
export const overview = () => api<Overview>("/admin/overview");

export const get = <T,>(path: string) => api<T>(`/admin${path}`);
export const put = <T,>(path: string, body: unknown) => api<T>(`/admin${path}`, j("PUT", body));
export const post = <T,>(path: string, body?: unknown) => api<T>(`/admin${path}`, j("POST", body));
export const del = (path: string) => api<void>(`/admin${path}`, j("DELETE"));
export const patch = <T,>(path: string, body: unknown) => api<T>(`/admin${path}`, j("PATCH", body));

export const listProjects = () => get<AdminProject[]>("/projects");
export const getProject = (id: string) => get<AdminProject>(`/projects/${id}`);
export const previewProject = (id: string) => get<ProjectDetail>(`/projects/${id}/preview`);
export const listMedia = (kind?: string, q?: string) => {
  const qs = new URLSearchParams();
  if (kind) qs.set("kind", kind);
  if (q) qs.set("q", q);
  return get<MediaItem[]>(`/media?${qs}`);
};
export const uploadMedia = (file: File, onProgress: (n: number) => void, meta: { alt_text?: string } = {}) => {
  const f = new FormData();
  f.append("file", file);
  if (meta.alt_text) f.append("alt_text", meta.alt_text);
  return uploadWithProgress<MediaItem>("/admin/media", f, onProgress);
};
export const listInquiries = (status?: string, q?: string) => {
  const qs = new URLSearchParams();
  if (status) qs.set("status", status);
  if (q) qs.set("q", q);
  return get<AdminInquiry[]>(`/inquiries?${qs}`);
};

export const forgotPassword = (email: string) => api<{ message: string }>("/auth/forgot-password", j("POST", { email }));
export const resetPassword = (token: string, new_password: string) => api<void>("/auth/reset-password", j("POST", { token, new_password }));

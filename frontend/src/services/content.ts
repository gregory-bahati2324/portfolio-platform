import type { InquiryInput, Profile, ProjectCategory, ProjectDetail, ProjectPage, Service, Site, SkillCategory } from "@/types/api";
import { api } from "./api";

export const getProfile = () => api<Profile | null>("/profile");
export const getSite = () => api<Site>("/site");
export const getSkills = () => api<SkillCategory[]>("/skills");
export const getServices = () => api<Service[]>("/services");
export const getProjectCategories = () => api<ProjectCategory[]>("/project-categories");
export const getProject = (slug: string) => api<ProjectDetail>(`/projects/${encodeURIComponent(slug)}`);
export const getProjects = (p: { q?: string; category?: string; featured?: boolean; page?: number; page_size?: number }) => {
  const qs = new URLSearchParams();
  Object.entries(p).forEach(([k, v]) => v !== undefined && v !== "" && qs.set(k, String(v)));
  return api<ProjectPage>(`/projects?${qs}`);
};
export const submitInquiry = (data: InquiryInput) =>
  api<{ reference: string; message: string }>("/inquiries", { method: "POST", body: JSON.stringify(data) });

import type { ArticleDetail, ArticlePage, Testimonial } from "@/types/api";

export const getArticles = (p: { q?: string; category?: string; tag?: string; page?: number; page_size?: number }) => {
  const qs = new URLSearchParams();
  Object.entries(p).forEach(([k, v]) => v !== undefined && v !== "" && qs.set(k, String(v)));
  return api<ArticlePage>(`/articles?${qs}`);
};
export const getArticle = (slug: string) => api<ArticleDetail>(`/articles/${encodeURIComponent(slug)}`);
export const getArticleCategories = () => api<ProjectCategory[]>("/article-categories");
export const getTestimonials = () => api<Testimonial[]>("/testimonials");
export const subscribeNewsletter = (email: string, website = "") => api<{ message: string }>("/newsletter/subscribe", { method: "POST", body: JSON.stringify({ email, website }) });
export const confirmNewsletter = (token: string) => api<{ message: string }>(`/newsletter/confirm?token=${encodeURIComponent(token)}`, { method: "POST" });
export const unsubscribeNewsletter = (token: string) => api<{ message: string }>(`/newsletter/unsubscribe?token=${encodeURIComponent(token)}`, { method: "POST" });

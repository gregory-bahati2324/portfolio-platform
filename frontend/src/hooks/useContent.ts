import { useQuery } from "@tanstack/react-query";
import * as c from "@/services/content";

export const useProfile = () => useQuery({ queryKey: ["profile"], queryFn: c.getProfile });
export const useSite = () => useQuery({ queryKey: ["site"], queryFn: c.getSite });
export const useSkills = () => useQuery({ queryKey: ["skills"], queryFn: c.getSkills });
export const useServices = () => useQuery({ queryKey: ["services"], queryFn: c.getServices });
export const useProjectCategories = () => useQuery({ queryKey: ["project-categories"], queryFn: c.getProjectCategories });
export const useProject = (slug: string) => useQuery({ queryKey: ["project", slug], queryFn: () => c.getProject(slug), retry: false });
export const useProjects = (p: Parameters<typeof c.getProjects>[0]) =>
  useQuery({ queryKey: ["projects", p], queryFn: () => c.getProjects(p), placeholderData: (prev) => prev });
export const useArticles = (p: Parameters<typeof c.getArticles>[0]) => useQuery({ queryKey: ["articles", p], queryFn: () => c.getArticles(p), placeholderData: (prev) => prev });
export const useArticle = (slug: string) => useQuery({ queryKey: ["article", slug], queryFn: () => c.getArticle(slug), retry: false });
export const useArticleCategories = () => useQuery({ queryKey: ["article-categories"], queryFn: c.getArticleCategories });
export const useTestimonials = () => useQuery({ queryKey: ["testimonials"], queryFn: c.getTestimonials });

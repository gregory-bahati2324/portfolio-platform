export interface Media { id: string; kind: string; url: string; thumbnail_url?: string | null; alt_text: string; description: string }
export interface Stat { label: string; value: string }
export interface Profile {
  full_name: string; professional_title: string; headline: string; hero_description: string;
  location: string; email: string; phone: string; whatsapp: string; availability: string;
  bio_sections: Record<string, string>; stats: Stat[]; photo?: Media | null; cv?: Media | null;
}
export interface SocialLink { platform: string; url: string }
export interface Site {
  site_title: string; meta_description: string; primary_color: string; footer_text: string;
  show_proficiency: boolean; logo?: Media | null; social_links: SocialLink[];
}
export interface Skill { id: string; name: string; description: string; technologies: string[]; proficiency?: number | null }
export interface SkillCategory { id: string; name: string; slug: string; description: string; icon: string; skills: Skill[] }
export interface Service {
  slug: string; title: string; summary: string; description: string; problems_solved: string[];
  deliverables: string[]; technologies: string[]; icon: string; cta_label: string;
}
export interface ProjectCard {
  slug: string; title: string; short_description: string; technologies: string[]; status: string;
  is_featured: boolean; completed_on?: string | null; category_name?: string | null; category_slug?: string | null; main_image?: Media | null;
}
export interface ProjectDetail extends ProjectCard {
  description: string; problem: string; solution: string; architecture: string; how_it_works: string;
  challenges: string; results: string; github_url: string; live_url: string; docs_url: string;
  service_slug?: string | null; service_title?: string | null; skills: string[]; media: { caption: string; asset: Media }[];
}
export interface ProjectCategory { name: string; slug: string }
export interface ProjectPage { items: ProjectCard[]; total: number; page: number; page_size: number }
export interface InquiryInput {
  name: string; email: string; phone?: string; company?: string; service_slug?: string | null;
  message: string; budget_range?: string; timeline?: string; website?: string; chat_session_id?: string;
}
export interface ArticleCard {
  slug: string; title: string; excerpt: string; tags: string[]; published_at: string | null; category_name?: string | null;
  category_slug?: string | null; cover?: Media | null; reading_minutes: number;
}
export interface ArticleDetail extends ArticleCard { content: string; seo_description: string }
export interface ArticlePage { items: ArticleCard[]; total: number; page: number; page_size: number }
export interface Testimonial { id: string; author_name: string; author_role: string; company: string; quote: string }

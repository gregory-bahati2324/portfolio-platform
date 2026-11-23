export interface AdminUser { id: string; email: string; role: string }
export interface MediaItem {
  id: string; kind: "image" | "video" | "document"; url: string; thumbnail_url: string | null; mime_type: string | null;
  size_bytes: number | null; alt_text: string; description: string; category: string | null; original_filename: string; created_at: string; in_use: boolean;
}
export interface Overview {
  published_projects: number; draft_projects: number; total_inquiries: number; new_inquiries: number;
  visits_last_30_days: number; project_views_last_30_days: number; chat_conversations: number; chatbot_inquiries: number;
  recent_activity: { action: string; entity: string; created_at: string }[];
}
export interface AdminProject {
  id: string; slug: string; title: string; short_description: string; status: string; is_published: boolean; is_featured: boolean;
  sort_order: number; category_id: string | null; service_id: string | null; main_image_id: string | null;
  description: string; problem: string; solution: string; architecture: string; how_it_works: string; challenges: string; results: string;
  technologies: string[]; github_url: string; live_url: string; docs_url: string; completed_on: string | null; skill_ids: string[];
  media: { media_id: string; caption: string; kind: string; url: string; thumbnail_url: string | null }[];
}
export interface AdminInquiry {
  id: string; reference: string; name: string; email: string; phone: string; company: string; message: string;
  budget_range: string; timeline: string; status: string; source: string; created_at: string; follow_up_on?: string | null;
}

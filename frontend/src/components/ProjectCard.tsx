import { Link } from "react-router-dom";
import type { ProjectCard as P } from "@/types/api";
import { Chip } from "./ui";

const STATUS: Record<string, string> = { completed: "Completed", in_progress: "In progress", prototype: "Prototype", research: "Research" };

export default function ProjectCard({ p }: { p: P }) {
  return (
    <Link to={`/projects/${p.slug}`} className="group flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-xl">
      <div className="aspect-video bg-gradient-to-br from-navy to-brand-dark">
        {p.main_image && <img src={p.main_image.thumbnail_url ?? p.main_image.url} alt={p.main_image.alt_text || p.title} loading="lazy" className="h-full w-full object-cover" />}
      </div>
      <div className="flex flex-1 flex-col gap-3 p-5">
        <div className="flex items-center justify-between text-xs">
          <span className="font-semibold text-brand">{p.category_name ?? "Project"}</span>
          <span>{STATUS[p.status] ?? p.status}</span>
        </div>
        <h3 className="font-display text-xl font-bold text-navy group-hover:text-brand">{p.title}</h3>
        <p className="flex-1 text-sm">{p.short_description}</p>
        <div className="flex flex-wrap gap-2">{p.technologies.slice(0, 4).map((t) => <Chip key={t}>{t}</Chip>)}</div>
      </div>
    </Link>
  );
}

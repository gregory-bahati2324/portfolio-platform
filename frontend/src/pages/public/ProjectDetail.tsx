import { ExternalLink, FileText, Github } from "lucide-react";
import { useEffect } from "react";
import { Link, useParams } from "react-router-dom";
import { trackProjectView } from "@/hooks/useTracker";
import { ButtonLink, Chip, Spinner } from "@/components/ui";
import { useProject } from "@/hooks/useContent";
import type { ProjectDetail } from "@/types/api";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";

export default function ProjectDetail() {
  const { slug = "" } = useParams();
  const { data: p, isLoading, isError } = useProject(slug);
  useDocumentTitle(p ? `${p.title} | Gregory Bahati` : undefined, p?.short_description, p?.main_image?.url);
  useEffect(() => { if (p) trackProjectView(p.slug); }, [p?.slug]); // eslint-disable-line react-hooks/exhaustive-deps
  if (isLoading) return <Spinner />;
  if (isError || !p) {
    return (
      <div className="mx-auto max-w-xl px-4 py-24 text-center">
        <h1 className="font-display text-3xl font-bold text-navy">Project not found</h1>
        <p className="mt-2">It may have been unpublished or moved.</p>
        <div className="mt-6"><ButtonLink to="/projects">Back to projects</ButtonLink></div>
      </div>
    );
  }
  return <ProjectView p={p} />;
}

export function ProjectView({ p }: { p: ProjectDetail }) {
  const sections: [string, string][] = [
    ["About this project", p.description], ["Why it was developed", p.problem], ["The solution", p.solution],
    ["Architecture and technologies", p.architecture], ["How it works", p.how_it_works],
    ["Challenges", p.challenges], ["Results and achievements", p.results],
  ];
  const links = [
    { href: p.github_url, label: "GitHub", icon: <Github className="h-4 w-4" /> },
    { href: p.live_url, label: "Live project", icon: <ExternalLink className="h-4 w-4" /> },
    { href: p.docs_url, label: "Documentation", icon: <FileText className="h-4 w-4" /> },
  ].filter((l) => l.href);
  const gallery = p.media.filter((m) => m.asset.kind === "image");
  const videos = p.media.filter((m) => m.asset.kind === "video");

  return (
    <article className="mx-auto max-w-4xl px-4 py-12">
      <Link to="/projects" className="text-sm text-brand hover:underline">← All projects</Link>
      <p className="mt-4 text-sm font-semibold text-brand">{p.category_name}</p>
      <h1 className="font-display text-4xl font-bold text-navy">{p.title}</h1>
      <p className="mt-2 text-lg">{p.short_description}</p>
      <div className="mt-4 flex flex-wrap gap-2">{p.technologies.map((t) => <Chip key={t}>{t}</Chip>)}</div>
      {links.length > 0 && (
        <div className="mt-5 flex flex-wrap gap-3">
          {links.map((l) => (
            <a key={l.label} href={l.href} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-lg border border-brand px-4 py-2 text-sm font-semibold text-brand hover:bg-brand-light">{l.icon}{l.label}</a>
          ))}
        </div>
      )}
      {p.main_image && <img src={p.main_image.url} alt={p.main_image.alt_text || p.title} className="mt-8 w-full rounded-2xl" />}
      {sections.filter(([, t]) => t.trim()).map(([title, text]) => (
        <section key={title} className="mt-10">
          <h2 className="font-display text-2xl font-bold text-navy">{title}</h2>
          <p className="mt-3 whitespace-pre-line text-lg leading-relaxed">{text}</p>
        </section>
      ))}
      {gallery.length > 0 && (
        <section className="mt-10"><h2 className="mb-4 font-display text-2xl font-bold text-navy">Screenshots</h2>
          <div className="grid gap-4 sm:grid-cols-2">{gallery.map((m) => (
            <figure key={m.asset.id}><img src={m.asset.url} alt={m.asset.alt_text || m.caption} loading="lazy" className="rounded-xl" />{m.caption && <figcaption className="mt-1 text-sm">{m.caption}</figcaption>}</figure>
          ))}</div></section>
      )}
      {videos.length > 0 && (
        <section className="mt-10"><h2 className="mb-4 font-display text-2xl font-bold text-navy">Demonstration videos</h2>
          <div className="space-y-4">{videos.map((m) => <video key={m.asset.id} src={m.asset.url} controls preload="metadata" className="w-full rounded-xl" aria-label={m.asset.alt_text || m.caption || "Project video"} />)}</div></section>
      )}
      <div className="mt-12 rounded-2xl bg-brand-light p-8 text-center">
        <h2 className="font-display text-2xl font-bold text-navy">Need something similar?</h2>
        <div className="mt-4"><ButtonLink to={`/contact${p.service_slug ? `?service=${p.service_slug}` : ""}`}>Discuss your project</ButtonLink></div>
      </div>
    </article>
  );
}

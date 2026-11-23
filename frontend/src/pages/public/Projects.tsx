import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import ProjectCard from "@/components/ProjectCard";
import { EmptyState, SectionHeading, Spinner } from "@/components/ui";
import { useProjectCategories, useProjects } from "@/hooks/useContent";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";

export default function Projects() {
  const [params, setParams] = useSearchParams();
  const category = params.get("category") ?? "";
  const page = Number(params.get("page") ?? 1) || 1;
  const [text, setText] = useState(params.get("q") ?? "");
  const [q, setQ] = useState(text);
  useDocumentTitle("Projects | Gregory Bahati", "Explore completed and ongoing projects.");

  useEffect(() => {
    const t = setTimeout(() => setQ(text), 300);
    return () => clearTimeout(t);
  }, [text]);

  const { data: cats } = useProjectCategories();
  const { data, isLoading, isError } = useProjects({ q, category, page, page_size: 9 });

  const update = (next: Record<string, string>) => {
    const p = new URLSearchParams(params);
    Object.entries(next).forEach(([k, v]) => (v ? p.set(k, v) : p.delete(k)));
    setParams(p, { replace: true });
  };
  useEffect(() => { update({ q, page: "" }); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [q]);

  const pages = data ? Math.max(1, Math.ceil(data.total / data.page_size)) : 1;
  const pill = (active: boolean) => `rounded-full px-4 py-1.5 text-sm font-medium ${active ? "bg-brand text-white" : "bg-white text-slate-700 ring-1 ring-slate-200 hover:ring-brand"}`;

  return (
    <div className="mx-auto max-w-6xl px-4 py-16">
      <SectionHeading eyebrow="Portfolio" title="Projects" />
      <div className="mb-8 space-y-4">
        <label className="block">
          <span className="sr-only">Search projects</span>
          <input type="search" value={text} onChange={(e) => setText(e.target.value)} placeholder="Search projects…" className="w-full rounded-lg border border-slate-300 bg-white px-4 py-3" />
        </label>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by category">
          <button className={pill(!category)} onClick={() => update({ category: "", page: "" })}>All</button>
          {cats?.map((c) => <button key={c.slug} className={pill(category === c.slug)} onClick={() => update({ category: c.slug, page: "" })}>{c.name}</button>)}
        </div>
      </div>
      {isLoading ? <Spinner /> : isError ? <EmptyState title="Could not load projects" text="Please try again shortly." /> : !data?.items.length ? (
        <EmptyState title="No projects found" text={q || category ? "Try a different search or category." : "Projects will appear here once published."} />
      ) : (
        <>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">{data.items.map((p) => <ProjectCard key={p.slug} p={p} />)}</div>
          {pages > 1 && (
            <nav className="mt-10 flex justify-center gap-2" aria-label="Pagination">
              {Array.from({ length: pages }, (_, i) => i + 1).map((n) => (
                <button key={n} className={pill(n === page)} aria-current={n === page ? "page" : undefined} onClick={() => update({ page: String(n) })}>{n}</button>
              ))}
            </nav>
          )}
        </>
      )}
    </div>
  );
}

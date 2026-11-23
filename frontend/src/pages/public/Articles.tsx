import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Chip, EmptyState, SectionHeading, Spinner } from "@/components/ui";
import { useArticleCategories, useArticles } from "@/hooks/useContent";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";

export default function Articles() {
  const [params, setParams] = useSearchParams();
  const category = params.get("category") ?? "";
  const tag = params.get("tag") ?? "";
  const page = Number(params.get("page") ?? 1) || 1;
  const [text, setText] = useState("");
  const [q, setQ] = useState("");
  useDocumentTitle("Articles | Gregory Bahati", "Technical articles on software, AI, cloud and security.");
  useEffect(() => { const t = setTimeout(() => setQ(text), 300); return () => clearTimeout(t); }, [text]);
  const { data: cats } = useArticleCategories();
  const { data, isLoading, isError } = useArticles({ q, category, tag, page, page_size: 9 });
  const upd = (n: Record<string, string>) => { const p = new URLSearchParams(params); Object.entries(n).forEach(([k, v]) => (v ? p.set(k, v) : p.delete(k))); setParams(p, { replace: true }); };
  const pages = data ? Math.max(1, Math.ceil(data.total / data.page_size)) : 1;
  const pill = (a: boolean) => `rounded-full px-4 py-1.5 text-sm font-medium ${a ? "bg-brand text-white" : "bg-white text-slate-700 ring-1 ring-slate-200 hover:ring-brand"}`;
  return (
    <div className="mx-auto max-w-5xl px-4 py-16">
      <SectionHeading eyebrow="Articles" title="Notes on building technology" />
      <input type="search" aria-label="Search articles" placeholder="Search articles…" value={text} onChange={(e) => setText(e.target.value)} className="mb-4 w-full rounded-lg border border-slate-300 bg-white px-4 py-3" />
      <div className="mb-8 flex flex-wrap gap-2" role="group" aria-label="Filter by category">
        <button className={pill(!category && !tag)} onClick={() => upd({ category: "", tag: "", page: "" })}>All</button>
        {cats?.map((c) => <button key={c.slug} className={pill(category === c.slug)} onClick={() => upd({ category: c.slug, tag: "", page: "" })}>{c.name}</button>)}
        {tag && <button className={pill(true)} onClick={() => upd({ tag: "", page: "" })}>#{tag} ✕</button>}
      </div>
      {isLoading ? <Spinner /> : isError ? <EmptyState title="Could not load articles" /> : !data?.items.length ? <EmptyState title="No articles found" text="Articles will appear here once published." /> : (
        <>
          <div className="grid gap-6 md:grid-cols-2">
            {data.items.map((a) => (
              <article key={a.slug} className="overflow-hidden rounded-2xl border border-slate-200 bg-white transition hover:shadow-lg">
                {a.cover && <img src={a.cover.thumbnail_url ?? a.cover.url} alt={a.cover.alt_text || a.title} loading="lazy" className="aspect-video w-full object-cover" />}
                <div className="space-y-2 p-5">
                  <p className="text-xs"><span className="font-semibold text-brand">{a.category_name ?? "Article"}</span> · {a.published_at ? new Date(a.published_at).toLocaleDateString() : ""} · {a.reading_minutes} min read</p>
                  <h2 className="font-display text-xl font-bold text-navy"><Link to={`/articles/${a.slug}`} className="hover:text-brand">{a.title}</Link></h2>
                  <p className="text-sm">{a.excerpt}</p>
                  <div className="flex flex-wrap gap-2">{a.tags.map((t) => <button key={t} onClick={() => upd({ tag: t, page: "" })}><Chip>#{t}</Chip></button>)}</div>
                </div>
              </article>
            ))}
          </div>
          {pages > 1 && <nav className="mt-10 flex justify-center gap-2" aria-label="Pagination">{Array.from({ length: pages }, (_, i) => i + 1).map((n) => <button key={n} className={pill(n === page)} aria-current={n === page ? "page" : undefined} onClick={() => upd({ page: String(n) })}>{n}</button>)}</nav>}
        </>
      )}
    </div>
  );
}

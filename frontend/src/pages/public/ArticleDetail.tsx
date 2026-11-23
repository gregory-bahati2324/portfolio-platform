import { Link, useParams } from "react-router-dom";
import { Chip, Spinner } from "@/components/ui";
import { useArticle } from "@/hooks/useContent";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { Markdown } from "@/utils/markdown";
import type { ArticleDetail as A } from "@/types/api";

export default function ArticleDetail() {
  const { slug = "" } = useParams();
  const { data: a, isLoading, isError } = useArticle(slug);
  useDocumentTitle(a ? `${a.title} | Gregory Bahati` : undefined, a?.seo_description || a?.excerpt, a?.cover?.url);
  if (isLoading) return <Spinner />;
  if (isError || !a) return <div className="mx-auto max-w-xl px-4 py-24 text-center"><h1 className="font-display text-3xl font-bold text-navy">Article not found</h1><Link to="/articles" className="mt-4 inline-block text-brand underline">Back to articles</Link></div>;
  return <ArticleView a={a} />;
}

export function ArticleView({ a }: { a: A }) {
  return (
    <article className="mx-auto max-w-3xl px-4 py-12">
      <Link to="/articles" className="text-sm text-brand hover:underline">← All articles</Link>
      <p className="mt-4 text-sm"><span className="font-semibold text-brand">{a.category_name}</span> {a.published_at && `· ${new Date(a.published_at).toLocaleDateString()}`} · {a.reading_minutes} min read</p>
      <h1 className="font-display text-4xl font-bold text-navy">{a.title}</h1>
      {a.excerpt && <p className="mt-2 text-lg">{a.excerpt}</p>}
      {a.cover && <img src={a.cover.url} alt={a.cover.alt_text || a.title} className="mt-6 w-full rounded-2xl" />}
      <div className="mt-6 text-lg"><Markdown text={a.content} /></div>
      {a.tags.length > 0 && <div className="mt-8 flex flex-wrap gap-2">{a.tags.map((t) => <Link key={t} to={`/articles?tag=${encodeURIComponent(t)}`}><Chip>#{t}</Chip></Link>)}</div>}
    </article>
  );
}

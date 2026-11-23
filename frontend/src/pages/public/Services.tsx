import Icon from "@/components/Icon";
import { ButtonLink, Chip, EmptyState, SectionHeading, Spinner } from "@/components/ui";
import { useServices } from "@/hooks/useContent";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";

export default function Services() {
  const { data, isLoading } = useServices();
  useDocumentTitle("Services | Gregory Bahati", "Web, AI, computer vision, cloud and security services.");
  return (
    <div className="mx-auto max-w-5xl px-4 py-16">
      <SectionHeading eyebrow="Services" title="How I can help" intro="Every project starts with understanding your problem." />
      {isLoading ? <Spinner /> : !data?.length ? <EmptyState title="No services published yet" /> : (
        <div className="space-y-6">
          {data.map((s) => (
            <article id={s.slug} key={s.slug} className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8">
              <h2 className="flex items-center gap-3 font-display text-2xl font-bold text-navy">
                <span className="rounded-lg bg-brand-light p-2 text-brand"><Icon name={s.icon} /></span>{s.title}
              </h2>
              <p className="mt-3 whitespace-pre-line">{s.description || s.summary}</p>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                {s.problems_solved.length > 0 && <List title="Problems it solves" items={s.problems_solved} />}
                {s.deliverables.length > 0 && <List title="What you receive" items={s.deliverables} />}
              </div>
              {s.technologies.length > 0 && <div className="mt-4 flex flex-wrap gap-2">{s.technologies.map((t) => <Chip key={t}>{t}</Chip>)}</div>}
              <div className="mt-6"><ButtonLink to={`/contact?service=${s.slug}`}>{s.cta_label}</ButtonLink></div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

function List({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <h3 className="mb-1 text-sm font-semibold uppercase tracking-wide text-brand">{title}</h3>
      <ul className="list-disc space-y-1 pl-5 text-sm">{items.map((i) => <li key={i}>{i}</li>)}</ul>
    </div>
  );
}

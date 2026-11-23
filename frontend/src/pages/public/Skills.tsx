import Icon from "@/components/Icon";
import { Chip, EmptyState, SectionHeading, Spinner } from "@/components/ui";
import { useSite, useSkills } from "@/hooks/useContent";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";

export default function Skills() {
  const { data, isLoading } = useSkills();
  const { data: site } = useSite();
  useDocumentTitle("Skills | Gregory Bahati", "Technical skills across software, AI, cloud, security and IoT.");
  return (
    <div className="mx-auto max-w-6xl px-4 py-16">
      <SectionHeading eyebrow="Expertise" title="Technical skills" />
      {isLoading ? <Spinner /> : !data?.length ? <EmptyState title="No skills published yet" /> : (
        <div className="grid gap-6 md:grid-cols-2">
          {data.map((c) => (
            <section key={c.id} className="rounded-2xl border border-slate-200 bg-white p-6">
              <h2 className="mb-4 flex items-center gap-3 font-display text-xl font-bold text-navy">
                <span className="rounded-lg bg-brand-light p-2 text-brand"><Icon name={c.icon} /></span>{c.name}
              </h2>
              <ul className="flex flex-wrap gap-2">
                {c.skills.map((s) => (
                  <li key={s.id} title={s.description || undefined}>
                    <Chip>{s.name}{site?.show_proficiency && s.proficiency != null ? ` · ${s.proficiency}%` : ""}</Chip>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

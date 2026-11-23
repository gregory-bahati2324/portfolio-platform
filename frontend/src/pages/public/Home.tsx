import { Link } from "react-router-dom";
import Icon from "@/components/Icon";
import ProjectCard from "@/components/ProjectCard";
import { ButtonLink, SectionHeading } from "@/components/ui";
import { useProfile, useProjects, useServices, useSite, useTestimonials } from "@/hooks/useContent";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";

export default function Home() {
  const { data: profile } = useProfile();
  const { data: site } = useSite();
  const { data: services } = useServices();
  const { data: testimonials } = useTestimonials();
  const { data: featured } = useProjects({ featured: true, page_size: 3 });
  useDocumentTitle(site?.site_title || "Gregory Bahati | GregTech", site?.meta_description);

  return (
    <>
      <section className="relative overflow-hidden bg-navy text-white">
        <div className="blob absolute -left-20 -top-20 h-96 w-96 rounded-full bg-brand/30 blur-3xl" aria-hidden />
        <div className="blob absolute -bottom-32 right-0 h-96 w-96 rounded-full bg-brand-dark/40 blur-3xl" style={{ animationDelay: "-6s" }} aria-hidden />
        <div className="relative mx-auto grid max-w-6xl items-center gap-10 px-4 py-20 md:grid-cols-5 md:py-28">
          <div className="md:col-span-3">
            <p className="mb-3 text-sm font-semibold uppercase tracking-widest text-sky-300">{profile?.professional_title ?? "Software Developer | AI/ML Engineer"}</p>
            <h1 className="font-display text-4xl font-bold leading-tight sm:text-5xl">
              {profile?.headline || "Building Intelligent Systems and Transforming Ideas into Technology."}
            </h1>
            <p className="mt-5 max-w-xl text-lg text-slate-300">{profile?.hero_description}</p>
            {profile?.availability && <p className="mt-4 inline-block rounded-full bg-emerald-500/20 px-3 py-1 text-sm text-emerald-300">{profile.availability}</p>}
            <div className="mt-8 flex flex-wrap gap-3">
              <ButtonLink to="/projects">Explore My Work</ButtonLink>
              <ButtonLink to="/contact" variant="ghost">Hire Me</ButtonLink>
              <ButtonLink to="/contact?topic=discuss" variant="ghost">Let's Discuss Your Project</ButtonLink>
              {profile?.cv && <a href={profile.cv.url} download className="inline-flex items-center justify-center rounded-lg border border-white/30 px-5 py-3 text-sm font-semibold text-white hover:bg-white/10">Download CV</a>}
            </div>
          </div>
          <div className="md:col-span-2">
            <div className="mx-auto aspect-square w-64 overflow-hidden rounded-3xl border border-white/20 bg-gradient-to-br from-brand to-navy shadow-2xl md:w-full">
              {profile?.photo && <img src={profile.photo.url} alt={profile.photo.alt_text || profile.full_name} className="h-full w-full object-cover" />}
            </div>
          </div>
        </div>
      </section>

      {profile && profile.stats.length > 0 && (
        <section className="mx-auto -mt-8 max-w-5xl px-4" aria-label="Key statistics">
          <dl className="grid grid-cols-2 gap-4 rounded-2xl bg-white p-6 shadow-xl md:grid-cols-4">
            {profile.stats.map((s) => (
              <div key={s.label} className="text-center">
                <dd className="font-display text-3xl font-bold text-brand">{s.value}</dd>
                <dt className="text-sm">{s.label}</dt>
              </div>
            ))}
          </dl>
        </section>
      )}

      {services && services.length > 0 && (
        <section className="mx-auto max-w-6xl px-4 py-20">
          <SectionHeading eyebrow="What I do" title="Services built around your goals" />
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {services.slice(0, 6).map((s) => (
              <Link key={s.slug} to="/services" className="rounded-2xl border border-slate-200 bg-white p-6 transition hover:-translate-y-1 hover:shadow-lg">
                <span className="mb-3 inline-flex rounded-lg bg-brand-light p-2 text-brand"><Icon name={s.icon} /></span>
                <h3 className="font-display text-lg font-bold text-navy">{s.title}</h3>
                <p className="mt-1 text-sm">{s.summary}</p>
              </Link>
            ))}
          </div>
        </section>
      )}

      {featured && featured.items.length > 0 && (
        <section className="bg-white py-20">
          <div className="mx-auto max-w-6xl px-4">
            <SectionHeading eyebrow="Featured work" title="Selected projects" />
            <div className="grid gap-6 md:grid-cols-3">{featured.items.map((p) => <ProjectCard key={p.slug} p={p} />)}</div>
          </div>
        </section>
      )}

      {testimonials && testimonials.length > 0 && (
        <section className="mx-auto max-w-6xl px-4 py-20" aria-label="Testimonials">
          <SectionHeading eyebrow="Kind words" title="What clients say" />
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {testimonials.map((t) => (
              <figure key={t.id} className="rounded-2xl border border-slate-200 bg-white p-6">
                <blockquote className="text-sm italic">“{t.quote}”</blockquote>
                <figcaption className="mt-4 text-sm"><strong className="text-navy">{t.author_name}</strong>{(t.author_role || t.company) && <span className="block text-slate-500">{[t.author_role, t.company].filter(Boolean).join(", ")}</span>}</figcaption>
              </figure>
            ))}
          </div>
        </section>
      )}

      <section className="bg-brand-light py-16 text-center">
        <h2 className="font-display text-3xl font-bold text-navy">Have a problem to solve?</h2>
        <p className="mx-auto mt-2 max-w-xl">Tell me what you need and let's work out the right technical approach together.</p>
        <div className="mt-6"><ButtonLink to="/contact">Start a project inquiry</ButtonLink></div>
      </section>
    </>
  );
}

import { Spinner } from "@/components/ui";
import { useProfile } from "@/hooks/useContent";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";

const SECTIONS: [string, string][] = [
  ["introduction", "Professional Introduction"], ["philosophy", "My Engineering Philosophy"],
  ["problem_solving", "My Approach to Problem Solving"], ["interests", "Technical Interests"],
  ["goals", "Professional Goals"], ["journey", "My Journey in Technology"],
];

export default function About() {
  const { data: profile, isLoading } = useProfile();
  useDocumentTitle("About | Gregory Bahati", "Background, engineering philosophy and professional goals.");
  if (isLoading) return <Spinner />;
  const shown = SECTIONS.filter(([k]) => profile?.bio_sections?.[k]?.trim());
  return (
    <div className="mx-auto max-w-3xl px-4 py-16">
      <h1 className="font-display text-4xl font-bold text-navy">About {profile?.full_name ?? "me"}</h1>
      {profile?.location && <p className="mt-1 text-sm">{profile.location}</p>}
      {shown.length === 0 && <p className="mt-6">The biography has not been published yet.</p>}
      {shown.map(([k, title]) => (
        <section key={k} className="mt-10">
          <h2 className="font-display text-2xl font-bold text-navy">{title}</h2>
          <div className="mt-3 space-y-4 whitespace-pre-line text-lg leading-relaxed">{profile!.bio_sections[k]}</div>
        </section>
      ))}
      {profile?.cv && (
        <a href={profile.cv.url} download className="mt-10 inline-block rounded-lg bg-brand px-5 py-3 font-semibold text-white hover:bg-brand-dark">Download CV</a>
      )}
    </div>
  );
}

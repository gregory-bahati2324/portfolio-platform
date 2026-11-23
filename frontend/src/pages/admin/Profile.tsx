import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Area, Btn, Card, ErrorNote, PageTitle, Text } from "@/components/admin/Form";
import { MediaPicker } from "@/components/admin/MediaPicker";
import { get, put } from "@/services/admin";

const BIO: [string, string][] = [
  ["introduction", "Professional Introduction"], ["philosophy", "My Engineering Philosophy"], ["problem_solving", "My Approach to Problem Solving"],
  ["interests", "Technical Interests"], ["goals", "Professional Goals"], ["journey", "My Journey in Technology"],
];
const AVAIL = ["", "Available for projects", "Currently working on projects", "Available for collaboration", "Not currently accepting projects"];
type P = Record<string, any>;

export default function Profile() {
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["admin", "profile"], queryFn: () => get<P>("/profile") });
  const [f, setF] = useState<P | null>(null);
  const [pick, setPick] = useState<"photo_id" | "cv_id" | null>(null);
  useEffect(() => { if (data) setF(data); }, [data]);
  const save = useMutation({
    mutationFn: () => put<P>("/profile", f),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin", "profile"] }); qc.invalidateQueries({ queryKey: ["profile"] }); },
  });
  if (!f) return <p role="status">Loading…</p>;
  const set = (k: string) => (v: any) => setF({ ...f, [k]: v });
  const stats: { label: string; value: string }[] = f.stats ?? [];
  return (
    <form onSubmit={(e) => { e.preventDefault(); save.mutate(); }} className="max-w-3xl space-y-6">
      <PageTitle action={<Btn type="submit" disabled={save.isPending}>{save.isPending ? "Saving…" : "Save changes"}</Btn>}>Profile</PageTitle>
      <ErrorNote error={save.error} />
      {save.isSuccess && <p role="status" className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700">Saved. The public site now shows these changes.</p>}
      <Card className="space-y-4">
        <Text label="Full name" required value={f.full_name} onChange={set("full_name")} />
        <Text label="Professional title" value={f.professional_title} onChange={set("professional_title")} />
        <Text label="Homepage headline" value={f.headline} onChange={set("headline")} />
        <Area label="Homepage introduction" value={f.hero_description} onChange={set("hero_description")} />
        <div className="grid gap-4 sm:grid-cols-2">
          <Text label="Email" type="email" value={f.email} onChange={set("email")} />
          <Text label="Phone" value={f.phone} onChange={set("phone")} />
          <Text label="WhatsApp number" value={f.whatsapp} onChange={set("whatsapp")} hint="International format, e.g. +255…" />
          <Text label="Location" value={f.location} onChange={set("location")} />
        </div>
        <label className="block text-sm font-medium text-navy">Availability
          <select className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm" value={f.availability} onChange={(e) => set("availability")(e.target.value)}>
            {AVAIL.map((a) => <option key={a} value={a}>{a || "Not shown"}</option>)}
          </select>
        </label>
        <div className="flex gap-3">
          <Btn type="button" variant="ghost" onClick={() => setPick("photo_id")}>{f.photo_id ? "Change profile photo" : "Choose profile photo"}</Btn>
          <Btn type="button" variant="ghost" onClick={() => setPick("cv_id")}>{f.cv_id ? "Change CV (PDF)" : "Choose CV (PDF)"}</Btn>
          {(f.photo_id || f.cv_id) && <Btn type="button" variant="ghost" onClick={() => setF({ ...f, photo_id: null, cv_id: null })}>Clear both</Btn>}
        </div>
      </Card>
      <Card className="space-y-4">
        <h2 className="font-display text-lg font-bold text-navy">Biography</h2>
        {BIO.map(([k, label]) => <Area key={k} label={label} rows={5} value={f.bio_sections?.[k] ?? ""} onChange={(v) => setF({ ...f, bio_sections: { ...f.bio_sections, [k]: v } })} />)}
      </Card>
      <Card className="space-y-3">
        <h2 className="font-display text-lg font-bold text-navy">Professional statistics</h2>
        <p className="text-xs text-slate-500">Only add figures you can stand behind. Nothing is shown publicly if this list is empty.</p>
        {stats.map((s, i) => (
          <div key={i} className="flex gap-2">
            <input aria-label="Statistic label" placeholder="Label" className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm" value={s.label} onChange={(e) => set("stats")(stats.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))} />
            <input aria-label="Statistic value" placeholder="Value" className="w-28 rounded-lg border border-slate-300 px-3 py-2 text-sm" value={s.value} onChange={(e) => set("stats")(stats.map((x, j) => (j === i ? { ...x, value: e.target.value } : x)))} />
            <Btn type="button" variant="ghost" onClick={() => set("stats")(stats.filter((_, j) => j !== i))}>Remove</Btn>
          </div>
        ))}
        {stats.length < 8 && <Btn type="button" variant="ghost" onClick={() => set("stats")([...stats, { label: "", value: "" }])}>Add statistic</Btn>}
      </Card>
      {pick && <MediaPicker kind={pick === "photo_id" ? "image" : "document"} onClose={() => setPick(null)} onPick={(m) => { setF({ ...f, [pick]: m.id }); setPick(null); }} />}
    </form>
  );
}

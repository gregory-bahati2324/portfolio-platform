import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Area, Btn, Card, Check, ErrorNote, PageTitle, Text } from "@/components/admin/Form";
import { MediaPicker } from "@/components/admin/MediaPicker";
import { changePassword, del, get, post, put } from "@/services/admin";

interface S { site_title: string; meta_description: string; primary_color: string; footer_text: string; show_proficiency: boolean; logo_id: string | null }
interface Link { id: string; platform: string; url: string; visible: boolean; sort_order: number }

export default function Settings() {
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["admin", "settings"], queryFn: () => get<S>("/settings") });
  const links = useQuery({ queryKey: ["admin", "social"], queryFn: () => get<Link[]>("/social-links") });
  const [f, setF] = useState<S | null>(null);
  const [pick, setPick] = useState(false);
  const [nl, setNl] = useState({ platform: "", url: "" });
  const [pw, setPw] = useState({ current: "", next: "" });
  useEffect(() => { if (data) setF(data); }, [data]);
  const refresh = () => { qc.invalidateQueries({ queryKey: ["admin", "settings"] }); qc.invalidateQueries({ queryKey: ["site"] }); qc.invalidateQueries({ queryKey: ["admin", "social"] }); };
  const save = useMutation({ mutationFn: () => put("/settings", f), onSuccess: refresh });
  const add = useMutation({ mutationFn: () => post("/social-links", { ...nl, sort_order: links.data?.length ?? 0 }), onSuccess: () => { setNl({ platform: "", url: "" }); refresh(); } });
  const remove = useMutation({ mutationFn: (id: string) => del(`/social-links/${id}`), onSuccess: refresh });
  const pass = useMutation({ mutationFn: () => changePassword(pw.current, pw.next), onSuccess: () => setPw({ current: "", next: "" }) });
  if (!f) return <p role="status">Loading…</p>;
  return (
    <div className="max-w-3xl space-y-6">
      <form onSubmit={(e) => { e.preventDefault(); save.mutate(); }} className="space-y-6">
        <PageTitle action={<Btn type="submit" disabled={save.isPending}>Save settings</Btn>}>Site settings</PageTitle>
        <ErrorNote error={save.error} />
        {save.isSuccess && <p role="status" className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700">Saved. Changes are live without a rebuild.</p>}
        <Card className="space-y-4">
          <Text label="Site title" value={f.site_title} onChange={(v) => setF({ ...f, site_title: v })} />
          <Area label="Meta description (SEO)" rows={2} value={f.meta_description} onChange={(v) => setF({ ...f, meta_description: v })} hint="Up to 320 characters." />
          <Area label="Footer text" rows={2} value={f.footer_text} onChange={(v) => setF({ ...f, footer_text: v })} />
          <div className="flex items-center gap-3">
            <label className="text-sm font-medium text-navy">Primary color <input type="color" className="ml-2 h-9 w-14 align-middle" value={f.primary_color} onChange={(e) => setF({ ...f, primary_color: e.target.value.toUpperCase() })} /></label>
            <span className="text-sm">{f.primary_color}</span>
            <Btn type="button" variant="ghost" onClick={() => setF({ ...f, primary_color: "#2563EB" })}>Reset</Btn>
          </div>
          <Check label="Show proficiency percentages on the Skills page" checked={f.show_proficiency} onChange={(v) => setF({ ...f, show_proficiency: v })} />
          <div className="flex gap-2"><Btn type="button" variant="ghost" onClick={() => setPick(true)}>{f.logo_id ? "Change logo" : "Choose logo"}</Btn>{f.logo_id && <Btn type="button" variant="ghost" onClick={() => setF({ ...f, logo_id: null })}>Remove logo</Btn>}</div>
        </Card>
      </form>
      <Card className="space-y-3">
        <h2 className="font-display text-lg font-bold text-navy">Social links</h2>
        <ErrorNote error={add.error ?? remove.error} />
        <ul className="divide-y divide-slate-100 text-sm">
          {links.data?.map((l) => <li key={l.id} className="flex items-center justify-between py-2"><span><strong>{l.platform}</strong> <span className="text-slate-500">{l.url}</span></span><Btn variant="ghost" onClick={() => remove.mutate(l.id)}>Remove</Btn></li>)}
        </ul>
        <form className="flex flex-wrap items-end gap-2" onSubmit={(e) => { e.preventDefault(); add.mutate(); }}>
          <div className="w-40"><Text label="Platform" value={nl.platform} onChange={(v) => setNl({ ...nl, platform: v })} required /></div>
          <div className="min-w-60 flex-1"><Text label="URL" value={nl.url} onChange={(v) => setNl({ ...nl, url: v })} required hint="Must start with https://" /></div>
          <Btn type="submit">Add</Btn>
        </form>
      </Card>
      <Card>
        <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); pass.mutate(); }}>
          <h2 className="font-display text-lg font-bold text-navy">Change password</h2>
          <ErrorNote error={pass.error} />
          {pass.isSuccess && <p role="status" className="text-sm text-emerald-700">Password updated.</p>}
          <Text label="Current password" type="password" value={pw.current} onChange={(v) => setPw({ ...pw, current: v })} required />
          <Text label="New password" type="password" value={pw.next} onChange={(v) => setPw({ ...pw, next: v })} required hint="At least 12 characters." />
          <Btn type="submit" disabled={pass.isPending || pw.next.length < 12}>Update password</Btn>
        </form>
      </Card>
      {pick && <MediaPicker kind="image" onClose={() => setPick(false)} onPick={(m) => { setF({ ...f, logo_id: m.id }); setPick(false); }} />}
    </div>
  );
}

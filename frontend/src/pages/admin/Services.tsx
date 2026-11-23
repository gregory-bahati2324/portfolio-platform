import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Area, Btn, Card, Check, csv, ErrorNote, lines, PageTitle, Text } from "@/components/admin/Form";
import { del, get, post, put } from "@/services/admin";

interface Svc { id?: string; title: string; slug?: string; summary: string; description: string; problems_solved: string[]; deliverables: string[]; technologies: string[]; icon: string; cta_label: string; sort_order: number; visible: boolean }
const blank: Svc = { title: "", summary: "", description: "", problems_solved: [], deliverables: [], technologies: [], icon: "code", cta_label: "Request a quote", sort_order: 0, visible: true };
const ICONS = ["code", "globe", "layers", "brain", "eye", "sparkles", "message-circle", "cloud", "cpu", "shield"];

export default function Services() {
  const qc = useQueryClient();
  const { data = [] } = useQuery({ queryKey: ["admin", "services"], queryFn: () => get<Svc[]>("/services") });
  const [edit, setEdit] = useState<Svc | null>(null);
  const done = () => { setEdit(null); qc.invalidateQueries({ queryKey: ["admin", "services"] }); qc.invalidateQueries({ queryKey: ["services"] }); };
  const save = useMutation({ mutationFn: (s: Svc) => (s.id ? put(`/services/${s.id}`, s) : post("/services", s)), onSuccess: done });
  const remove = useMutation({ mutationFn: (id: string) => del(`/services/${id}`), onSuccess: done });

  if (edit) {
    return (
      <form onSubmit={(e) => { e.preventDefault(); save.mutate(edit); }} className="max-w-3xl space-y-4">
        <PageTitle action={<div className="flex gap-2"><Btn type="button" variant="ghost" onClick={() => setEdit(null)}>Cancel</Btn><Btn type="submit" disabled={save.isPending}>Save</Btn></div>}>{edit.id ? "Edit service" : "New service"}</PageTitle>
        <ErrorNote error={save.error} />
        <Card className="space-y-4">
          <Text label="Title" required value={edit.title} onChange={(v) => setEdit({ ...edit, title: v })} />
          <Text label="Short summary" value={edit.summary} onChange={(v) => setEdit({ ...edit, summary: v })} />
          <Area label="Description (customer-oriented)" rows={5} value={edit.description} onChange={(v) => setEdit({ ...edit, description: v })} />
          <Area label="Problems it solves" hint="One per line" value={edit.problems_solved.join("\n")} onChange={(v) => setEdit({ ...edit, problems_solved: lines(v) })} />
          <Area label="What customers receive" hint="One per line" value={edit.deliverables.join("\n")} onChange={(v) => setEdit({ ...edit, deliverables: lines(v) })} />
          <Text label="Technologies" hint="Comma separated" value={edit.technologies.join(", ")} onChange={(v) => setEdit({ ...edit, technologies: csv(v) })} />
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm font-medium text-navy">Icon<select className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm" value={edit.icon} onChange={(e) => setEdit({ ...edit, icon: e.target.value })}>{ICONS.map((i) => <option key={i}>{i}</option>)}</select></label>
            <Text label="Button text" value={edit.cta_label} onChange={(v) => setEdit({ ...edit, cta_label: v })} />
          </div>
          <Check label="Visible on the public site" checked={edit.visible} onChange={(v) => setEdit({ ...edit, visible: v })} />
        </Card>
      </form>
    );
  }
  return (
    <>
      <PageTitle action={<Btn onClick={() => setEdit({ ...blank, sort_order: data.length })}>New service</Btn>}>Services</PageTitle>
      <ErrorNote error={remove.error} />
      <Card><ul className="divide-y divide-slate-100">
        {data.map((s) => (
          <li key={s.id} className="flex items-center justify-between py-3">
            <div><p className="font-medium text-navy">{s.title}{!s.visible && <em className="ml-2 text-xs text-slate-500">hidden</em>}</p><p className="text-sm">{s.summary}</p></div>
            <div className="flex gap-2"><Btn variant="ghost" onClick={() => setEdit(s)}>Edit</Btn><Btn variant="ghost" onClick={() => window.confirm(`Delete "${s.title}"?`) && remove.mutate(s.id!)}>Delete</Btn></div>
          </li>
        ))}
        {data.length === 0 && <li className="py-6 text-center text-sm">No services yet.</li>}
      </ul></Card>
    </>
  );
}

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Area, Btn, Card, ErrorNote, PageTitle, Text } from "@/components/admin/Form";
import { del, get, post, put } from "@/services/admin";

interface T { id?: string; author_name: string; author_role: string; company: string; quote: string; sort_order: number; is_approved?: boolean }
const blank: T = { author_name: "", author_role: "", company: "", quote: "", sort_order: 0 };

export default function Testimonials() {
  const qc = useQueryClient();
  const { data = [] } = useQuery({ queryKey: ["admin", "testimonials"], queryFn: () => get<T[]>("/testimonials") });
  const [edit, setEdit] = useState<T | null>(null);
  const done = () => { setEdit(null); qc.invalidateQueries({ queryKey: ["admin", "testimonials"] }); qc.invalidateQueries({ queryKey: ["testimonials"] }); };
  const save = useMutation({ mutationFn: (t: T) => (t.id ? put(`/testimonials/${t.id}`, t) : post("/testimonials", t)), onSuccess: done });
  const approve = useMutation({ mutationFn: (t: T) => post(`/testimonials/${t.id}/approve`, { approved: !t.is_approved }), onSuccess: done });
  const remove = useMutation({ mutationFn: (id: string) => del(`/testimonials/${id}`), onSuccess: done });
  return (
    <>
      <PageTitle action={<Btn onClick={() => setEdit({ ...blank })}>Add testimonial</Btn>}>Testimonials</PageTitle>
      <p className="mb-4 max-w-2xl text-sm">Only add testimonials you actually received, with the author's permission. They stay hidden until you approve them, and editing the text withdraws the approval.</p>
      <ErrorNote error={approve.error ?? remove.error} />
      <Card>
        {data.length === 0 && <p className="py-6 text-center text-sm">No testimonials yet.</p>}
        <ul className="divide-y divide-slate-100">
          {data.map((t) => (
            <li key={t.id} className="flex flex-wrap items-start justify-between gap-3 py-3">
              <div className="max-w-xl"><p className="text-sm italic">“{t.quote}”</p><p className="mt-1 text-sm font-medium text-navy">{t.author_name}{(t.author_role || t.company) && <span className="font-normal text-slate-500">, {[t.author_role, t.company].filter(Boolean).join(", ")}</span>}</p><p className={`text-xs ${t.is_approved ? "text-emerald-600" : "text-amber-600"}`}>{t.is_approved ? "Approved and visible" : "Pending approval (hidden)"}</p></div>
              <div className="flex gap-2"><Btn variant="ghost" onClick={() => setEdit(t)}>Edit</Btn><Btn variant="ghost" onClick={() => approve.mutate(t)}>{t.is_approved ? "Hide" : "Approve"}</Btn><Btn variant="danger" onClick={() => window.confirm("Delete?") && remove.mutate(t.id!)}>Delete</Btn></div>
            </li>
          ))}
        </ul>
      </Card>
      {edit && (
        <div role="dialog" aria-modal="true" aria-label="Testimonial" className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4">
          <form className="w-full max-w-lg space-y-3 rounded-2xl bg-white p-6" onSubmit={(e) => { e.preventDefault(); save.mutate(edit); }}>
            <h2 className="font-display text-lg font-bold">{edit.id ? "Edit testimonial" : "New testimonial"}</h2>
            <ErrorNote error={save.error} />
            <Text label="Author name *" required value={edit.author_name} onChange={(v) => setEdit({ ...edit, author_name: v })} />
            <div className="grid grid-cols-2 gap-3"><Text label="Role" value={edit.author_role} onChange={(v) => setEdit({ ...edit, author_role: v })} /><Text label="Company" value={edit.company} onChange={(v) => setEdit({ ...edit, company: v })} /></div>
            <Area label="Quote *" rows={5} value={edit.quote} onChange={(v) => setEdit({ ...edit, quote: v })} />
            <div className="flex justify-end gap-2"><Btn type="button" variant="ghost" onClick={() => setEdit(null)}>Cancel</Btn><Btn type="submit" disabled={save.isPending}>Save</Btn></div>
          </form>
        </div>
      )}
    </>
  );
}

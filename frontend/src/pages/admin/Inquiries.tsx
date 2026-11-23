import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Card, ErrorNote, PageTitle } from "@/components/admin/Form";
import { Btn } from "@/components/admin/Form";
import { del, get, listInquiries, patch, post, put } from "@/services/admin";

interface Note { id: string; body: string; created_at: string }

function Notes({ id, followUp }: { id: string; followUp: string | null }) {
  const qc = useQueryClient();
  const [body, setBody] = useState("");
  const notes = useQuery({ queryKey: ["admin", "notes", id], queryFn: () => get<Note[]>(`/inquiries/${id}/notes`) });
  const refresh = () => qc.invalidateQueries({ queryKey: ["admin", "notes", id] });
  const add = useMutation({ mutationFn: () => post(`/inquiries/${id}/notes`, { body }), onSuccess: () => { setBody(""); refresh(); } });
  const remove = useMutation({ mutationFn: (n: string) => del(`/inquiries/${id}/notes/${n}`), onSuccess: refresh });
  const fu = useMutation({ mutationFn: (d: string) => put(`/inquiries/${id}/follow-up`, { follow_up_on: d || null }), onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "inquiries"] }) });
  return (
    <div className="mt-3 space-y-2 border-t border-slate-100 pt-3">
      <label className="block text-xs font-medium text-navy">Follow-up date<input type="date" defaultValue={followUp ?? ""} onChange={(e) => fu.mutate(e.target.value)} className="ml-2 rounded border border-slate-300 px-2 py-1 text-sm" /></label>
      <p className="text-xs font-semibold text-navy">Private notes (never shown to the customer)</p>
      <ul className="space-y-1">{notes.data?.map((n) => <li key={n.id} className="flex justify-between gap-2 rounded bg-surface px-2 py-1 text-xs"><span className="whitespace-pre-line">{n.body} <em className="text-slate-500">{new Date(n.created_at).toLocaleString()}</em></span><button aria-label="Delete note" className="text-red-600" onClick={() => remove.mutate(n.id)}>✕</button></li>)}</ul>
      <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); if (body.trim()) add.mutate(); }}><input aria-label="New note" value={body} onChange={(e) => setBody(e.target.value)} placeholder="Add a note…" maxLength={5000} className="flex-1 rounded border border-slate-300 px-2 py-1 text-sm" /><Btn type="submit" disabled={add.isPending}>Add</Btn></form>
    </div>
  );
}

const STATUSES = ["new", "reviewing", "contacted", "discussion", "proposal_sent", "converted", "closed"];

export default function Inquiries() {
  const qc = useQueryClient();
  const [status, setStatus] = useState("");
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const { data = [], isLoading } = useQuery({ queryKey: ["admin", "inquiries", status, q], queryFn: () => listInquiries(status, q) });
  const set = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => patch(`/inquiries/${id}/status`, { status }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin"] }); },
  });
  return (
    <>
      <PageTitle>Customer inquiries</PageTitle>
      <div className="mb-4 flex flex-wrap gap-3">
        <input type="search" aria-label="Search inquiries" placeholder="Search name, email, reference…" value={q} onChange={(e) => setQ(e.target.value)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
        <select aria-label="Filter by status" value={status} onChange={(e) => setStatus(e.target.value)} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm">
          <option value="">All statuses</option>{STATUSES.map((s) => <option key={s} value={s}>{s.replace("_", " ")}</option>)}
        </select>
      </div>
      <ErrorNote error={set.error} />
      {isLoading ? <p role="status">Loading…</p> : data.length === 0 ? <Card><p className="py-6 text-center text-sm">No inquiries found.</p></Card> : (
        <div className="space-y-3">
          {data.map((i) => (
            <Card key={i.id}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <button className="text-left" onClick={() => setOpen(open === i.id ? null : i.id)} aria-expanded={open === i.id}>
                  <p className="font-medium text-navy">{i.name} <span className="text-sm font-normal text-slate-500">· {i.reference}</span></p>
                  <p className="text-xs text-slate-500">{new Date(i.created_at).toLocaleString()} · {i.email}</p>
                </button>
                <select aria-label={`Status for ${i.reference}`} value={i.status} onChange={(e) => set.mutate({ id: i.id, status: e.target.value })} className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm">
                  {STATUSES.map((s) => <option key={s} value={s}>{s.replace("_", " ")}</option>)}
                </select>
              </div>
              {open === i.id && (
                <div className="mt-3 space-y-1 border-t border-slate-100 pt-3 text-sm">
                  <p className="whitespace-pre-line">{i.message}</p>
                  {i.company && <p><strong>Company:</strong> {i.company}</p>}
                  {i.phone && <p><strong>Phone:</strong> {i.phone}</p>}
                  {i.budget_range && <p><strong>Budget:</strong> {i.budget_range}</p>}
                  {i.timeline && <p><strong>Timeline:</strong> {i.timeline}</p>}
                  <p><a className="text-brand underline" href={`mailto:${i.email}`}>Reply by email</a></p>
                  <Notes id={i.id} followUp={i.follow_up_on ?? null} />
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
    </>
  );
}

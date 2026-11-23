import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Btn, Card, ErrorNote, PageTitle } from "@/components/admin/Form";
import { del, get } from "@/services/admin";

interface Sub { id: string; email: string; confirmed_at: string | null; unsubscribed_at: string | null; created_at: string }

export default function Newsletter() {
  const qc = useQueryClient();
  const { data = [], isLoading } = useQuery({ queryKey: ["admin", "subscribers"], queryFn: () => get<Sub[]>("/subscribers") });
  const remove = useMutation({ mutationFn: (id: string) => del(`/subscribers/${id}`), onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "subscribers"] }) });
  const active = data.filter((s) => s.confirmed_at && !s.unsubscribed_at).length;
  const status = (s: Sub) => (s.unsubscribed_at ? "Unsubscribed" : s.confirmed_at ? "Confirmed" : "Awaiting confirmation");
  return (
    <>
      <PageTitle action={<a href="/api/v1/admin/subscribers/export.csv" className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold hover:bg-slate-50">Export confirmed (CSV)</a>}>Newsletter</PageTitle>
      <p className="mb-4 text-sm">{active} active subscriber(s). People are added only after confirming their email (double opt-in). Without SMTP configured on the server, confirmation emails cannot be sent and sign-ups stay pending.</p>
      <ErrorNote error={remove.error} />
      <Card>
        {isLoading ? <p role="status">Loading…</p> : data.length === 0 ? <p className="py-6 text-center text-sm">No subscribers yet.</p> : (
          <ul className="divide-y divide-slate-100 text-sm">
            {data.map((s) => <li key={s.id} className="flex items-center justify-between py-2"><span>{s.email} <span className="ml-2 text-xs text-slate-500">{status(s)} · {new Date(s.created_at).toLocaleDateString()}</span></span><Btn variant="ghost" onClick={() => window.confirm(`Delete ${s.email}?`) && remove.mutate(s.id)}>Delete</Btn></li>)}
          </ul>
        )}
      </Card>
    </>
  );
}

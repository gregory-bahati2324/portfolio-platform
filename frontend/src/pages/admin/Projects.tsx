import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Btn, Card, ErrorNote, PageTitle } from "@/components/admin/Form";
import { del, listProjects, post } from "@/services/admin";
import type { AdminProject } from "@/types/admin";

export default function Projects() {
  const qc = useQueryClient();
  const { data = [], isLoading } = useQuery({ queryKey: ["admin", "projects"], queryFn: listProjects });
  const refresh = () => { qc.invalidateQueries({ queryKey: ["admin", "projects"] }); qc.invalidateQueries({ queryKey: ["projects"] }); qc.invalidateQueries({ queryKey: ["admin", "overview"] }); };
  const publish = useMutation({ mutationFn: (p: AdminProject) => post(`/projects/${p.id}/publish`, { published: !p.is_published }), onSuccess: refresh });
  const remove = useMutation({ mutationFn: (id: string) => del(`/projects/${id}`), onSuccess: refresh });
  const reorder = useMutation({ mutationFn: (ids: string[]) => post("/projects/reorder", { ids }), onSuccess: refresh });
  const move = (i: number, d: number) => {
    const ids = data.map((p) => p.id);
    [ids[i], ids[i + d]] = [ids[i + d], ids[i]];
    reorder.mutate(ids);
  };
  return (
    <>
      <PageTitle action={<Link to="/admin/projects/new" className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white">New project</Link>}>Projects</PageTitle>
      <ErrorNote error={publish.error ?? remove.error ?? reorder.error} />
      {isLoading ? <p role="status">Loading…</p> : (
        <Card>
          {data.length === 0 ? <p className="py-6 text-center text-sm">No projects yet. Create your first one.</p> : (
            <ul className="divide-y divide-slate-100">
              {data.map((p, i) => (
                <li key={p.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="font-medium text-navy">{p.title} {p.is_featured && <span className="ml-1 rounded bg-brand-light px-2 text-xs text-brand">Featured</span>}</p>
                    <p className={`text-xs ${p.is_published ? "text-emerald-600" : "text-amber-600"}`}>{p.is_published ? "Published" : "Draft"}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Btn variant="ghost" disabled={i === 0} onClick={() => move(i, -1)} aria-label={`Move ${p.title} up`}>↑</Btn>
                    <Btn variant="ghost" disabled={i === data.length - 1} onClick={() => move(i, 1)} aria-label={`Move ${p.title} down`}>↓</Btn>
                    <Link to={`/admin/projects/${p.id}/preview`} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold hover:bg-slate-50">Preview</Link>
                    <Link to={`/admin/projects/${p.id}`} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold hover:bg-slate-50">Edit</Link>
                    <Btn variant="ghost" onClick={() => publish.mutate(p)}>{p.is_published ? "Unpublish" : "Publish"}</Btn>
                    <Btn variant="danger" onClick={() => window.confirm(`Delete "${p.title}"?`) && remove.mutate(p.id)}>Delete</Btn>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}
    </>
  );
}

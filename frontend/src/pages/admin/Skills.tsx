import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Btn, Card, Check, csv, ErrorNote, PageTitle, Text } from "@/components/admin/Form";
import { del, get, post, put } from "@/services/admin";

interface Cat { id: string; name: string; icon: string; visible: boolean; sort_order: number; description: string }
interface Skill { id: string; category_id: string; name: string; description: string; technologies: string[]; proficiency: number | null; visible: boolean; sort_order: number }

export default function Skills() {
  const qc = useQueryClient();
  const cats = useQuery({ queryKey: ["admin", "skill-categories"], queryFn: () => get<Cat[]>("/skill-categories") });
  const skills = useQuery({ queryKey: ["admin", "skills"], queryFn: () => get<Skill[]>("/skills") });
  const refresh = () => { qc.invalidateQueries({ queryKey: ["admin", "skills"] }); qc.invalidateQueries({ queryKey: ["admin", "skill-categories"] }); qc.invalidateQueries({ queryKey: ["skills"] }); };
  const [newCat, setNewCat] = useState("");
  const [editing, setEditing] = useState<Skill | null>(null);
  const addCat = useMutation({ mutationFn: () => post("/skill-categories", { name: newCat }), onSuccess: () => { setNewCat(""); refresh(); } });
  const delCat = useMutation({ mutationFn: (id: string) => del(`/skill-categories/${id}`), onSuccess: refresh });
  const saveSkill = useMutation({
    mutationFn: (s: Partial<Skill> & { category_id: string; name: string }) => (s.id ? put(`/skills/${s.id}`, s) : post("/skills", s)),
    onSuccess: () => { setEditing(null); refresh(); },
  });
  const delSkill = useMutation({ mutationFn: (id: string) => del(`/skills/${id}`), onSuccess: refresh });
  const toggleCat = useMutation({ mutationFn: (c: Cat) => put(`/skill-categories/${c.id}`, { ...c, visible: !c.visible }), onSuccess: refresh });

  return (
    <>
      <PageTitle>Skills</PageTitle>
      <ErrorNote error={addCat.error ?? delCat.error ?? saveSkill.error ?? delSkill.error} />
      <form className="mb-6 flex max-w-md items-end gap-2" onSubmit={(e) => { e.preventDefault(); if (newCat.trim()) addCat.mutate(); }}>
        <div className="flex-1"><Text label="New category" value={newCat} onChange={setNewCat} /></div><Btn type="submit">Add</Btn>
      </form>
      <div className="space-y-5">
        {cats.data?.map((c) => (
          <Card key={c.id}>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-display text-lg font-bold text-navy">{c.name} {!c.visible && <span className="text-xs font-normal text-slate-500">(hidden)</span>}</h2>
              <div className="flex gap-2">
                <Btn variant="ghost" onClick={() => toggleCat.mutate(c)}>{c.visible ? "Hide" : "Show"}</Btn>
                <Btn variant="ghost" onClick={() => setEditing({ id: "", category_id: c.id, name: "", description: "", technologies: [], proficiency: null, visible: true, sort_order: 0 })}>Add skill</Btn>
                <Btn variant="danger" onClick={() => window.confirm(`Delete category "${c.name}"?`) && delCat.mutate(c.id)}>Delete</Btn>
              </div>
            </div>
            <ul className="divide-y divide-slate-100 text-sm">
              {skills.data?.filter((s) => s.category_id === c.id).map((s) => (
                <li key={s.id} className="flex items-center justify-between py-2">
                  <span>{s.name}{!s.visible && <em className="ml-2 text-xs text-slate-500">hidden</em>}{s.proficiency != null && <span className="ml-2 text-xs text-slate-500">{s.proficiency}%</span>}</span>
                  <span className="flex gap-2"><Btn variant="ghost" onClick={() => setEditing(s)}>Edit</Btn><Btn variant="ghost" onClick={() => window.confirm(`Delete "${s.name}"?`) && delSkill.mutate(s.id)}>Delete</Btn></span>
                </li>
              ))}
            </ul>
          </Card>
        ))}
      </div>
      {editing && (
        <div role="dialog" aria-modal="true" aria-label="Edit skill" className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4">
          <form className="w-full max-w-md space-y-3 rounded-2xl bg-white p-6" onSubmit={(e) => { e.preventDefault(); saveSkill.mutate({ ...editing, id: editing.id || undefined } as any); }}>
            <h2 className="font-display text-lg font-bold">{editing.id ? "Edit skill" : "Add skill"}</h2>
            <Text label="Name" required value={editing.name} onChange={(v) => setEditing({ ...editing, name: v })} />
            <Text label="Description" value={editing.description} onChange={(v) => setEditing({ ...editing, description: v })} />
            <Text label="Related technologies" hint="Comma separated" value={editing.technologies.join(", ")} onChange={(v) => setEditing({ ...editing, technologies: csv(v) })} />
            <Text label="Proficiency 0-100 (optional)" type="number" value={editing.proficiency?.toString() ?? ""} onChange={(v) => setEditing({ ...editing, proficiency: v === "" ? null : Number(v) })} hint="Only shown publicly if enabled in Site settings." />
            <Check label="Visible on the public site" checked={editing.visible} onChange={(v) => setEditing({ ...editing, visible: v })} />
            <div className="flex justify-end gap-2"><Btn type="button" variant="ghost" onClick={() => setEditing(null)}>Cancel</Btn><Btn type="submit" disabled={saveSkill.isPending}>Save</Btn></div>
          </form>
        </div>
      )}
    </>
  );
}

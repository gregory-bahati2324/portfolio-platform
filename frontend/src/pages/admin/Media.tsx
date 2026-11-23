import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { Btn, Card, ErrorNote, Field, inputCls, PageTitle } from "@/components/admin/Form";
import { ApiError } from "@/services/api";
import { del, listMedia, patch, uploadMedia } from "@/services/admin";
import type { MediaItem } from "@/types/admin";

const MAX_MB = { image: 10, video: 200, document: 20 };
const ACCEPT = ".jpg,.jpeg,.png,.webp,.gif,.mp4,.webm,.pdf";

interface Job { name: string; pct: number; error?: string; done?: boolean }

export default function Media() {
  const qc = useQueryClient();
  const [kind, setKind] = useState("");
  const [q, setQ] = useState("");
  const [jobs, setJobs] = useState<Job[]>([]);
  const [sel, setSel] = useState<MediaItem | null>(null);
  const [drag, setDrag] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const { data = [], isLoading } = useQuery({ queryKey: ["media", kind, q], queryFn: () => listMedia(kind, q) });
  const refresh = () => qc.invalidateQueries({ queryKey: ["media"] });

  const guess = (f: File) => (f.type.startsWith("image/") ? "image" : f.type.startsWith("video/") ? "video" : "document") as keyof typeof MAX_MB;
  const upload = async (files: FileList | File[]) => {
    for (const file of Array.from(files)) {
      const idx = jobs.length;
      const lim = MAX_MB[guess(file)];
      if (file.size > lim * 1024 * 1024) { setJobs((j) => [...j, { name: file.name, pct: 0, error: `Larger than ${lim} MB` }]); continue; }
      setJobs((j) => [...j, { name: file.name, pct: 0 }]);
      try {
        await uploadMedia(file, (pct) => setJobs((j) => j.map((x) => (x.name === file.name && !x.done && !x.error ? { ...x, pct } : x))));
        setJobs((j) => j.map((x) => (x.name === file.name && !x.error ? { ...x, pct: 100, done: true } : x)));
      } catch (e) {
        setJobs((j) => j.map((x) => (x.name === file.name && !x.done ? { ...x, error: (e as ApiError).message } : x)));
      }
      void idx;
    }
    refresh();
  };
  const update = useMutation({ mutationFn: (m: MediaItem) => patch<MediaItem>(`/media/${m.id}`, { alt_text: m.alt_text, description: m.description, category: m.category }), onSuccess: () => { setSel(null); refresh(); } });
  const remove = useMutation({ mutationFn: (id: string) => del(`/media/${id}`), onSuccess: () => { setSel(null); refresh(); } });
  const replace = useMutation({
    mutationFn: async ({ id, file }: { id: string; file: File }) => {
      const f = new FormData(); f.append("file", file);
      const { api } = await import("@/services/api");
      return api(`/admin/media/${id}/replace`, { method: "POST", body: f });
    },
    onSuccess: () => { setSel(null); refresh(); },
  });
  const copy = (m: MediaItem) => navigator.clipboard?.writeText(new URL(m.url, window.location.origin).href);

  return (
    <>
      <PageTitle action={<Btn onClick={() => input.current?.click()}>Upload files</Btn>}>Media library</PageTitle>
      <input ref={input} type="file" multiple accept={ACCEPT} className="sr-only" aria-label="Choose files to upload" onChange={(e) => e.target.files && upload(e.target.files)} />
      <div
        onDragOver={(e) => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)}
        onDrop={(e) => { e.preventDefault(); setDrag(false); upload(e.dataTransfer.files); }}
        className={`mb-4 rounded-xl border-2 border-dashed p-8 text-center text-sm ${drag ? "border-brand bg-brand-light" : "border-slate-300 bg-white"}`}
      >
        Drag and drop images, videos (MP4/WebM) or PDFs here. Limits: images 10 MB, videos 200 MB, PDFs 20 MB.
      </div>
      {jobs.length > 0 && (
        <ul className="mb-4 space-y-1 text-sm" aria-label="Uploads">
          {jobs.map((j, i) => (
            <li key={i} className="flex items-center gap-3">
              <span className="w-48 truncate">{j.name}</span>
              {j.error ? <span role="alert" className="text-red-600">{j.error}</span> : <progress className="flex-1" max={100} value={j.pct} aria-label={`Upload progress for ${j.name}`} />}
              {j.done && <span className="text-emerald-600">Done</span>}
            </li>
          ))}
          <li><button className="text-xs underline" onClick={() => setJobs([])}>Clear list</button></li>
        </ul>
      )}
      <div className="mb-4 flex flex-wrap gap-3">
        <input type="search" aria-label="Search media" placeholder="Search…" value={q} onChange={(e) => setQ(e.target.value)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
        <select aria-label="Filter by type" value={kind} onChange={(e) => setKind(e.target.value)} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm">
          <option value="">All types</option><option value="image">Images</option><option value="video">Videos</option><option value="document">Documents</option>
        </select>
      </div>
      {isLoading ? <p role="status">Loading…</p> : data.length === 0 ? <Card><p className="py-6 text-center text-sm">No media yet.</p></Card> : (
        <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          {data.map((m) => (
            <li key={m.id}>
              <button onClick={() => setSel(m)} className="w-full overflow-hidden rounded-xl border border-slate-200 bg-white text-left hover:ring-2 hover:ring-brand">
                {m.kind === "image" ? <img src={m.thumbnail_url ?? m.url} alt={m.alt_text} loading="lazy" className="aspect-square w-full object-cover" /> : <div className="grid aspect-square place-items-center bg-slate-100 text-sm uppercase">{m.kind}</div>}
                <span className="block truncate px-2 py-1 text-xs">{m.original_filename || m.id.slice(0, 8)} {m.in_use && "· in use"}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {sel && (
        <div role="dialog" aria-modal="true" aria-label="Media details" className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4">
          <div className="max-h-[90vh] w-full max-w-lg space-y-3 overflow-auto rounded-2xl bg-white p-6">
            {sel.kind === "image" && <img src={sel.url} alt={sel.alt_text} className="max-h-56 w-full rounded-lg object-contain" />}
            {sel.kind === "video" && <video src={sel.url} controls preload="metadata" className="max-h-56 w-full rounded-lg" />}
            {sel.kind === "document" && <a href={sel.url} target="_blank" rel="noopener noreferrer" className="text-brand underline">Open document</a>}
            <Field label="Alt text (describe the image for accessibility)"><input className={inputCls} value={sel.alt_text} onChange={(e) => setSel({ ...sel, alt_text: e.target.value })} /></Field>
            <Field label="Description"><textarea className={inputCls} rows={2} value={sel.description} onChange={(e) => setSel({ ...sel, description: e.target.value })} /></Field>
            <Field label="Category"><input className={inputCls} value={sel.category ?? ""} onChange={(e) => setSel({ ...sel, category: e.target.value })} /></Field>
            <p className="break-all text-xs text-slate-500">{sel.url}</p>
            <ErrorNote error={update.error ?? remove.error ?? replace.error} />
            <div className="flex flex-wrap justify-between gap-2">
              <div className="flex gap-2">
                <Btn variant="ghost" onClick={() => copy(sel)}>Copy link</Btn>
                <label className="cursor-pointer rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold hover:bg-slate-50">Replace<input type="file" accept={ACCEPT} className="sr-only" onChange={(e) => e.target.files?.[0] && replace.mutate({ id: sel.id, file: e.target.files[0] })} /></label>
                <Btn variant="danger" onClick={() => window.confirm("Delete this file permanently?") && remove.mutate(sel.id)}>Delete</Btn>
              </div>
              <div className="flex gap-2"><Btn variant="ghost" onClick={() => setSel(null)}>Close</Btn><Btn onClick={() => update.mutate(sel)}>Save</Btn></div>
            </div>
            {sel.in_use && <p className="text-xs text-amber-700">This file is in use, so it cannot be deleted until it is removed from where it is used.</p>}
          </div>
        </div>
      )}
    </>
  );
}

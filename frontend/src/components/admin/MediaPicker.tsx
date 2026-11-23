import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { listMedia } from "@/services/admin";
import type { MediaItem } from "@/types/admin";
import { Btn } from "./Form";

/** Modal to choose an existing library item. */
export function MediaPicker({ kind, onPick, onClose }: { kind?: string; onPick: (m: MediaItem) => void; onClose: () => void }) {
  const [q, setQ] = useState("");
  const { data = [] } = useQuery({ queryKey: ["media", kind, q], queryFn: () => listMedia(kind, q) });
  return (
    <div role="dialog" aria-modal="true" aria-label="Choose media" className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4">
      <div className="max-h-[85vh] w-full max-w-3xl overflow-auto rounded-2xl bg-white p-5">
        <div className="mb-3 flex gap-2">
          <input autoFocus type="search" placeholder="Search media…" value={q} onChange={(e) => setQ(e.target.value)} className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm" />
          <Btn variant="ghost" onClick={onClose}>Close</Btn>
        </div>
        {data.length === 0 && <p className="py-8 text-center text-sm">No media found. Upload files in the Media Library first.</p>}
        <ul className="grid grid-cols-3 gap-3 sm:grid-cols-4">
          {data.map((m) => (
            <li key={m.id}>
              <button onClick={() => onPick(m)} className="w-full overflow-hidden rounded-lg border border-slate-200 text-left hover:ring-2 hover:ring-brand">
                {m.kind === "image" ? <img src={m.thumbnail_url ?? m.url} alt={m.alt_text} className="aspect-square w-full object-cover" /> : <div className="grid aspect-square place-items-center bg-slate-100 text-xs uppercase">{m.kind}</div>}
                <span className="block truncate px-2 py-1 text-xs">{m.original_filename || m.id.slice(0, 8)}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

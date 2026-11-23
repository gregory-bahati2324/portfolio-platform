import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { ApiError } from "@/services/api";
import { subscribeNewsletter } from "@/services/content";

export default function NewsletterForm() {
  const [email, setEmail] = useState("");
  const [hp, setHp] = useState("");
  const [err, setErr] = useState("");
  const m = useMutation({ mutationFn: () => subscribeNewsletter(email, hp) });
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setErr("Enter a valid email address"); return; }
    setErr("");
    m.mutate();
  };
  if (m.isSuccess) return <p role="status" className="text-sm text-emerald-300">{m.data.message}</p>;
  return (
    <form onSubmit={submit} noValidate aria-label="Newsletter signup" className="max-w-sm">
      <label htmlFor="nl-email" className="mb-1 block text-sm font-semibold text-white">Technology updates by email</label>
      <div className="flex gap-2">
        <input id="nl-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" className="min-w-0 flex-1 rounded-lg border border-slate-600 bg-navy px-3 py-2 text-sm text-white placeholder:text-slate-500" />
        <div className="hidden" aria-hidden><input tabIndex={-1} autoComplete="off" value={hp} onChange={(e) => setHp(e.target.value)} /></div>
        <button disabled={m.isPending} className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-dark disabled:opacity-60">{m.isPending ? "…" : "Subscribe"}</button>
      </div>
      {(err || m.isError) && <p role="alert" className="mt-1 text-xs text-red-300">{err || ((m.error as ApiError).status === 429 ? "Too many attempts. Try again later." : "Could not subscribe. Please try again.")}</p>}
    </form>
  );
}

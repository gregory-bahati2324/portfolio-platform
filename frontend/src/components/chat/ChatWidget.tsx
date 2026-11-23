import { useMutation, useQuery } from "@tanstack/react-query";
import { Link as LinkIcon, Maximize2, MessageCircle, Minimize2, Send, Trash2, UserRound, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ApiError } from "@/services/api";
import { getChatConfig, sendChat } from "@/services/chat";
import { submitInquiry } from "@/services/content";
import { LinkEl, RichText, safeHref } from "@/utils/richtext";

interface Msg { role: "user" | "assistant"; text: string; links?: { label: string; url: string }[]; error?: boolean }
const KEY = "gt_chat_v1";

function load(): { sid?: string; msgs: Msg[] } {
  try { return JSON.parse(sessionStorage.getItem(KEY) ?? "") ?? { msgs: [] }; } catch { return { msgs: [] }; }
}
const save = (sid: string | undefined, msgs: Msg[]) => { try { sessionStorage.setItem(KEY, JSON.stringify({ sid, msgs: msgs.slice(-40) })); } catch { /* storage unavailable */ } };

function LinkCard({ label, url }: { label: string; url: string }) {
  const kind = safeHref(url);
  if (!kind) return null;
  const inner = (
    <span className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs hover:border-brand">
      <LinkIcon className="h-3.5 w-3.5 shrink-0 text-brand" aria-hidden />
      <span className="min-w-0"><span className="block truncate font-semibold text-navy">{label}</span><span className="block truncate text-slate-500">{kind === "internal" ? url : url.replace(/^https?:\/\//, "")}</span></span>
    </span>
  );
  return kind === "internal" ? <Link to={url}>{inner}</Link> : <a href={url} target="_blank" rel="noopener noreferrer nofollow">{inner}</a>;
}

export default function ChatWidget() {
  const { data: cfg } = useQuery({ queryKey: ["chat-config"], queryFn: getChatConfig, retry: false, staleTime: 300_000 });
  const initial = useRef(load());
  const [open, setOpen] = useState(false);
  const [big, setBig] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>(initial.current.msgs);
  const [sid, setSid] = useState<string | undefined>(initial.current.sid);
  const [text, setText] = useState("");
  const [form, setForm] = useState(false);
  const bottom = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);

  const chat = useMutation({
    mutationFn: (m: string) => sendChat(m, sid),
    onSuccess: (r) => { setSid(r.session_id); setMsgs((p) => { const n = [...p, { role: "assistant" as const, text: r.reply, links: r.links }]; save(r.session_id, n); return n; }); },
    onError: (e) => {
      const err = e as ApiError;
      const text = err.status === 429 ? err.message : "Sorry, I couldn't answer right now. You can reach Gregory directly through the contact form.";
      setMsgs((p) => [...p, { role: "assistant", text, error: true }]);
    },
  });

  useEffect(() => { bottom.current?.scrollIntoView?.({ block: "end" }); }, [msgs, chat.isPending, open, form]);
  useEffect(() => { if (open && !form) input.current?.focus(); }, [open, form]);

  if (!cfg?.enabled) return null;
  const started = msgs.some((m) => m.role === "user");
  const send = (t: string) => {
    const v = t.trim();
    if (!v || chat.isPending) return;
    setText("");
    setMsgs((p) => { const n = [...p, { role: "user" as const, text: v }]; save(sid, n); return n; });
    chat.mutate(v);
  };
  const clear = () => { setMsgs([]); setSid(undefined); save(undefined, []); setForm(false); };

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} aria-label="Open chat with Gregory's AI assistant" className="fixed bottom-5 right-5 z-40 flex items-center gap-2 rounded-full bg-brand px-5 py-3 font-semibold text-white shadow-xl hover:bg-brand-dark">
        <MessageCircle className="h-5 w-5" aria-hidden /> Ask AI
      </button>
    );
  }
  return (
    <section
      role="dialog" aria-label="Chat with Gregory's AI assistant" onKeyDown={(e) => e.key === "Escape" && setOpen(false)}
      className={`fixed z-50 flex flex-col overflow-hidden border border-slate-200 bg-surface shadow-2xl ${big ? "inset-3 rounded-2xl sm:inset-auto sm:bottom-5 sm:right-5 sm:h-[44rem] sm:w-[34rem]" : "inset-x-3 bottom-3 h-[32rem] max-h-[85vh] rounded-2xl sm:inset-x-auto sm:bottom-5 sm:right-5 sm:w-96"}`}
    >
      <header className="flex items-center justify-between bg-navy px-4 py-3 text-white">
        <div><p className="font-display font-bold">Gregory's AI assistant</p><p className="text-xs text-slate-300">Answers about projects, skills and services</p></div>
        <div className="flex items-center gap-1">
          <button onClick={() => setForm(!form)} className="rounded p-2 text-xs hover:bg-white/10" title="Contact Gregory" aria-label="Contact Gregory"><UserRound className="h-4 w-4" aria-hidden /></button>
          <button onClick={clear} className="rounded p-2 hover:bg-white/10" title="Clear conversation" aria-label="Clear conversation"><Trash2 className="h-4 w-4" aria-hidden /></button>
          <button onClick={() => setBig(!big)} className="hidden rounded p-2 hover:bg-white/10 sm:block" title={big ? "Minimize" : "Maximize"} aria-label={big ? "Make chat smaller" : "Make chat larger"}>{big ? <Minimize2 className="h-4 w-4" aria-hidden /> : <Maximize2 className="h-4 w-4" aria-hidden />}</button>
          <button onClick={() => setOpen(false)} className="rounded p-2 hover:bg-white/10" aria-label="Close chat"><X className="h-4 w-4" aria-hidden /></button>
        </div>
      </header>

      {form ? (
        <InquiryForm sid={sid} onCancel={() => setForm(false)} onDone={(ref) => { setForm(false); setMsgs((p) => { const n = [...p, { role: "assistant" as const, text: `Your inquiry was received. Your reference is **${ref}**. Gregory will get back to you personally.` }]; save(sid, n); return n; }); }} />
      ) : (
        <>
          <div className="flex-1 space-y-3 overflow-y-auto p-4 text-sm" aria-live="polite" aria-relevant="additions">
            <Bubble role="assistant"><RichText text={cfg.welcome_message} /></Bubble>
            {!started && cfg.suggested_questions.length > 0 && (
              <div className="flex flex-wrap gap-2" aria-label="Suggested questions">
                {cfg.suggested_questions.map((q) => <button key={q} onClick={() => send(q)} className="rounded-full border border-brand/40 bg-white px-3 py-1.5 text-left text-xs text-brand hover:bg-brand-light">{q}</button>)}
              </div>
            )}
            {msgs.map((m, i) => (
              <Bubble key={i} role={m.role} error={m.error}>
                {m.role === "assistant" ? <RichText text={m.text} /> : <p className="whitespace-pre-line">{m.text}</p>}
                {m.links && m.links.length > 0 && <div className="mt-2 space-y-1.5">{m.links.map((l) => <LinkCard key={l.url} {...l} />)}</div>}
              </Bubble>
            ))}
            {chat.isPending && <Bubble role="assistant"><span role="status" aria-label="Assistant is typing" className="flex gap-1 py-1">{[0, 1, 2].map((d) => <span key={d} className="h-2 w-2 animate-bounce rounded-full bg-slate-400" style={{ animationDelay: `${d * 120}ms` }} />)}</span></Bubble>}
            {started && !chat.isPending && <p className="text-center text-xs"><button onClick={() => setForm(true)} className="text-brand underline">Contact Gregory about a project</button></p>}
            <div ref={bottom} />
          </div>
          <form onSubmit={(e) => { e.preventDefault(); send(text); }} className="border-t border-slate-200 bg-white p-3">
            <div className="flex gap-2">
              <input ref={input} value={text} onChange={(e) => setText(e.target.value)} maxLength={1000} placeholder="Type your question…" aria-label="Your message" className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm" />
              <button type="submit" disabled={chat.isPending || !text.trim()} aria-label="Send message" className="rounded-lg bg-brand p-2.5 text-white disabled:opacity-50"><Send className="h-4 w-4" aria-hidden /></button>
            </div>
            <p className="mt-2 text-[11px] leading-tight text-slate-500">AI-generated answers may be imperfect. Conversations are stored so Gregory can review inquiries. Please don't share passwords or sensitive data.</p>
          </form>
        </>
      )}
    </section>
  );
}

function Bubble({ role, children, error }: { role: "user" | "assistant"; children: React.ReactNode; error?: boolean }) {
  return (
    <div className={`flex ${role === "user" ? "justify-end" : "justify-start"}`}>
      <div className={`max-w-[88%] rounded-2xl px-3.5 py-2 ${role === "user" ? "bg-brand text-white" : error ? "bg-red-50 text-red-800" : "bg-white text-body shadow-sm ring-1 ring-slate-200"}`}>{children}</div>
    </div>
  );
}

function InquiryForm({ sid, onDone, onCancel }: { sid?: string; onDone: (ref: string) => void; onCancel: () => void }) {
  const [f, setF] = useState({ name: "", email: "", phone: "", message: "" });
  const [err, setErr] = useState<Record<string, string>>({});
  const m = useMutation({ mutationFn: () => submitInquiry({ ...f, chat_session_id: sid }), onSuccess: (r) => onDone(r.reference) });
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const e2: Record<string, string> = {};
    if (f.name.trim().length < 2) e2.name = "Please enter your name";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email)) e2.email = "Enter a valid email";
    if (f.message.trim().length < 10) e2.message = "Please describe your project (10+ characters)";
    setErr(e2);
    if (!Object.keys(e2).length) m.mutate();
  };
  const c = "mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm";
  return (
    <form onSubmit={submit} noValidate className="flex-1 space-y-3 overflow-y-auto p-4 text-sm">
      <p className="font-display font-bold text-navy">Contact Gregory</p>
      <p className="text-xs">Share only what's needed for Gregory to reply.</p>
      <label className="block">Name *<input className={c} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />{err.name && <span role="alert" className="text-xs text-red-600">{err.name}</span>}</label>
      <label className="block">Email *<input type="email" className={c} value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />{err.email && <span role="alert" className="text-xs text-red-600">{err.email}</span>}</label>
      <label className="block">Phone (optional)<input className={c} value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} /></label>
      <label className="block">Project description *<textarea rows={4} className={c} value={f.message} onChange={(e) => setF({ ...f, message: e.target.value })} />{err.message && <span role="alert" className="text-xs text-red-600">{err.message}</span>}</label>
      {m.isError && <p role="alert" className="text-xs text-red-600">{(m.error as ApiError).status === 429 ? "Too many submissions. Please try later." : "Could not send. Please try again or use the contact page."}</p>}
      <div className="flex gap-2">
        <button type="submit" disabled={m.isPending} className="rounded-lg bg-brand px-4 py-2 font-semibold text-white disabled:opacity-60">{m.isPending ? "Sending…" : "Send inquiry"}</button>
        <button type="button" onClick={onCancel} className="rounded-lg border border-slate-300 px-4 py-2">Back to chat</button>
      </div>
      <p className="text-xs">Prefer the full form? <LinkEl url="/contact">Open the contact page</LinkEl></p>
    </form>
  );
}

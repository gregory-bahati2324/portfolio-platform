import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Area, Btn, Card, Check, ErrorNote, Field, inputCls, lines, PageTitle, Text } from "@/components/admin/Form";
import { RichText } from "@/utils/richtext";
import { del, get, post, put } from "@/services/admin";

interface Cfg {
  enabled: boolean; model: string; default_model: string; welcome_message: string; suggested_questions: string[]; system_instructions: string;
  knowledge_base: string; max_output_tokens: number | null; temperature: number | null; per_ip_hourly_limit: number; per_session_message_limit: number; api_key_configured: boolean;
}
interface Stats { conversations: number; conversations_last_7_days: number; visitor_messages: number; chatbot_inquiries: number }
interface Conv { id: string; created_at: string; message_count: number; preview: string; has_inquiry: boolean }
interface TestReply { reply: string; model: string; latency_ms: number }
const MODELS = ["gemini-2.0-flash", "gemini-2.5-flash", "gemini-2.5-pro"];

export default function Chatbot() {
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["admin", "chatbot"], queryFn: () => get<Cfg>("/chatbot") });
  const stats = useQuery({ queryKey: ["admin", "chatbot", "stats"], queryFn: () => get<Stats>("/chatbot/stats") });
  const convs = useQuery({ queryKey: ["admin", "chatbot", "convs"], queryFn: () => get<Conv[]>("/chatbot/conversations") });
  const [f, setF] = useState<Cfg | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [days, setDays] = useState("90");
  const [tmsg, setTmsg] = useState("");
  const [thist, setThist] = useState<{ role: string; content: string }[]>([]);
  const msgs = useQuery({ queryKey: ["admin", "chatbot", "conv", open], queryFn: () => get<{ role: string; content: string }[]>(`/chatbot/conversations/${open}`), enabled: !!open });
  useEffect(() => { if (data) setF(data); }, [data]);

  const save = useMutation({
    mutationFn: () => {
      const { api_key_configured: _a, default_model: _d, ...body } = f!;
      return put<Cfg>("/chatbot", body);
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin", "chatbot"] }); qc.invalidateQueries({ queryKey: ["chat-config"] }); },
  });
  const test = useMutation({
    mutationFn: () => {
      const { api_key_configured: _a, default_model: _d, ...draft } = f!;
      return post<TestReply>("/chatbot/test", { message: tmsg, history: thist, draft });
    },
    onSuccess: (r) => { setThist((h) => [...h, { role: "user", content: tmsg }, { role: "assistant", content: r.reply }]); setTmsg(""); },
  });
  const purge = useMutation({ mutationFn: () => del(`/chatbot/conversations?older_than_days=${Number(days)}`), onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "chatbot"] }) });
  if (!f) return <p role="status">Loading…</p>;
  const set = <K extends keyof Cfg>(k: K) => (v: Cfg[K]) => setF({ ...f, [k]: v });

  return (
    <div className="max-w-4xl space-y-6">
      <PageTitle action={<Btn onClick={() => save.mutate()} disabled={save.isPending}>{save.isPending ? "Saving…" : "Publish changes"}</Btn>}>AI chatbot</PageTitle>
      {!f.api_key_configured && <p role="alert" className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">No <code>GEMINI_API_KEY</code> is set on the server, so the chat button is hidden from visitors. Add it to the backend environment (never here) and restart.</p>}
      <ErrorNote error={save.error} />
      {save.isSuccess && <p role="status" className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700">Published. Visitors now get these settings.</p>}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[["Conversations", stats.data?.conversations], ["Last 7 days", stats.data?.conversations_last_7_days], ["Visitor messages", stats.data?.visitor_messages], ["Inquiries from chat", stats.data?.chatbot_inquiries]].map(([l, v]) => (
          <Card key={l as string}><p className="text-sm">{l}</p><p className="font-display text-3xl font-bold text-brand">{v ?? "–"}</p></Card>
        ))}
      </div>

      <Card className="space-y-4">
        <Check label="Chatbot enabled" checked={f.enabled} onChange={set("enabled")} />
        <Field label="Gemini model" hint={`Leave empty to use the server default (${f.default_model}). Changing this needs no code change.`}>
          <input list="models" className={inputCls} value={f.model} onChange={(e) => set("model")(e.target.value.trim())} placeholder={f.default_model} />
          <datalist id="models">{MODELS.map((m) => <option key={m} value={m} />)}</datalist>
        </Field>
        <Area label="Welcome message" rows={3} value={f.welcome_message} onChange={set("welcome_message")} />
        <Area label="Suggested questions" hint="One per line (max 12)" rows={5} value={f.suggested_questions.join("\n")} onChange={(v) => set("suggested_questions")(lines(v))} />
        <Area label="Additional system instructions" rows={5} hint="Added to the built-in instructions. The security rules always take priority and cannot be removed." value={f.system_instructions} onChange={set("system_instructions")} />
        <Area label="Professional knowledge base" rows={8} hint="Facts the assistant may use about you. Only include what is true and public." value={f.knowledge_base} onChange={set("knowledge_base")} />
        <div className="grid gap-4 sm:grid-cols-4">
          <Text label="Max output tokens" type="number" value={f.max_output_tokens?.toString() ?? ""} onChange={(v) => set("max_output_tokens")(v ? Number(v) : null)} hint="Empty = server default" />
          <Text label="Temperature (0–1.5)" type="number" value={f.temperature?.toString() ?? ""} onChange={(v) => set("temperature")(v === "" ? null : Number(v))} hint="Empty = server default" />
          <Text label="Messages per IP / hour" type="number" value={String(f.per_ip_hourly_limit)} onChange={(v) => set("per_ip_hourly_limit")(Number(v) || 1)} />
          <Text label="Messages per conversation" type="number" value={String(f.per_session_message_limit)} onChange={(v) => set("per_session_message_limit")(Number(v) || 1)} />
        </div>
      </Card>

      <Card className="space-y-3">
        <h2 className="font-display text-lg font-bold text-navy">Test before publishing</h2>
        <p className="text-xs text-slate-500">Uses the settings above, including unsaved edits. Nothing here is stored or visible to visitors.</p>
        <div className="max-h-72 space-y-2 overflow-y-auto rounded-lg bg-surface p-3 text-sm" aria-live="polite">
          {thist.length === 0 && <p className="text-slate-500">Ask a question to see how the assistant answers.</p>}
          {thist.map((m, i) => <div key={i} className={m.role === "user" ? "text-right" : ""}><span className={`inline-block max-w-[85%] rounded-xl px-3 py-1.5 text-left ${m.role === "user" ? "bg-brand text-white" : "bg-white ring-1 ring-slate-200"}`}>{m.role === "user" ? m.content : <RichText text={m.content} />}</span></div>)}
        </div>
        <ErrorNote error={test.error} />
        <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); if (tmsg.trim()) test.mutate(); }}>
          <input aria-label="Test message" className={`${inputCls} mt-0 flex-1`} value={tmsg} onChange={(e) => setTmsg(e.target.value)} placeholder="Try: Can Gregory build an inventory system?" maxLength={1000} />
          <Btn type="submit" disabled={test.isPending || !f.api_key_configured}>{test.isPending ? "Thinking…" : "Send"}</Btn>
          <Btn type="button" variant="ghost" onClick={() => setThist([])}>Reset</Btn>
        </form>
        {test.data && <p className="text-xs text-slate-500">Model {test.data.model} · {test.data.latency_ms} ms</p>}
      </Card>

      <Card className="space-y-3">
        <h2 className="font-display text-lg font-bold text-navy">Conversations</h2>
        {convs.data?.length === 0 && <p className="text-sm">No conversations yet.</p>}
        <ul className="divide-y divide-slate-100 text-sm">
          {convs.data?.map((c) => (
            <li key={c.id} className="py-2">
              <button className="w-full text-left" aria-expanded={open === c.id} onClick={() => setOpen(open === c.id ? null : c.id)}>
                <span className="font-medium text-navy">{c.preview || "(empty)"}</span>
                <span className="block text-xs text-slate-500">{new Date(c.created_at).toLocaleString()} · {c.message_count} message(s){c.has_inquiry && " · led to an inquiry"}</span>
              </button>
              {open === c.id && (
                <div className="mt-2 space-y-1 rounded-lg bg-surface p-3">
                  {msgs.data?.map((m, i) => <p key={i}><strong>{m.role === "user" ? "Visitor" : "Assistant"}:</strong> <span className="whitespace-pre-line">{m.content}</span></p>)}
                </div>
              )}
            </li>
          ))}
        </ul>
        <div className="flex items-end gap-2 border-t border-slate-100 pt-3">
          <div className="w-40"><Text label="Delete conversations older than (days)" type="number" value={days} onChange={setDays} /></div>
          <Btn variant="danger" disabled={purge.isPending} onClick={() => window.confirm(`Permanently delete conversations older than ${days} days?`) && purge.mutate()}>Delete</Btn>
        </div>
        <ErrorNote error={purge.error} />
      </Card>
    </div>
  );
}

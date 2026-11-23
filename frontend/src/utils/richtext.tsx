import { Fragment, type ReactNode } from "react";
import { Link } from "react-router-dom";

/** Only these link targets are ever rendered as links. Anything else becomes plain text. */
export function safeHref(url: string): "internal" | "external" | "mail" | null {
  if (/^\/(?!\/)[^\s]*$/.test(url)) return "internal";
  if (/^https:\/\/[^\s<>"']+$/i.test(url)) return "external";
  if (/^mailto:[^\s<>"']+$/i.test(url)) return "mail";
  return null;
}

type Tok = { t: "text"; v: string } | { t: "bold"; v: string } | { t: "link"; label: string; url: string };

export function parseInline(s: string): Tok[] {
  const out: Tok[] = [];
  const re = /\[([^\]]+)\]\(([^)\s]+)\)|\*\*([^*]+)\*\*/g;
  let last = 0;
  for (let m = re.exec(s); m; m = re.exec(s)) {
    if (m.index > last) out.push({ t: "text", v: s.slice(last, m.index) });
    if (m[3] !== undefined) out.push({ t: "bold", v: m[3] });
    else out.push({ t: "link", label: m[1], url: m[2] });
    last = m.index + m[0].length;
  }
  if (last < s.length) out.push({ t: "text", v: s.slice(last) });
  return out;
}

export function LinkEl({ url, children }: { url: string; children: ReactNode }) {
  const kind = safeHref(url);
  const cls = "font-medium text-brand underline underline-offset-2";
  if (kind === "internal") return <Link to={url} className={cls}>{children}</Link>;
  if (kind) return <a href={url} target="_blank" rel="noopener noreferrer nofollow" className={cls}>{children}</a>;
  return <>{children}</>;
}

function Inline({ text }: { text: string }) {
  return (
    <>
      {parseInline(text).map((t, i) =>
        t.t === "text" ? <Fragment key={i}>{t.v}</Fragment> : t.t === "bold" ? <strong key={i}>{t.v}</strong> : <LinkEl key={i} url={t.url}>{t.label}</LinkEl>,
      )}
    </>
  );
}

/** Minimal, XSS-safe formatting: paragraphs, "- " lists, **bold** and links. Never uses innerHTML. */
export function RichText({ text }: { text: string }) {
  const blocks = text.split(/\n{2,}/);
  return (
    <>
      {blocks.map((b, i) => {
        const ls = b.split("\n");
        if (ls.every((l) => /^\s*[-*]\s+/.test(l))) {
          return <ul key={i} className="my-1 list-disc space-y-0.5 pl-5">{ls.map((l, j) => <li key={j}><Inline text={l.replace(/^\s*[-*]\s+/, "")} /></li>)}</ul>;
        }
        return <p key={i} className="my-1 whitespace-pre-line"><Inline text={b} /></p>;
      })}
    </>
  );
}

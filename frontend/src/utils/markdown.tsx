import { Fragment, type ReactNode } from "react";
import { LinkEl, parseInline } from "./richtext";

const safeImg = (src: string) => /^\/media\/[\w./-]+$/.test(src) || /^https:\/\/[^\s<>"']+$/i.test(src);

function inline(text: string): ReactNode {
  return parseInline(text).map((t, i) => {
    if (t.t === "link") return <LinkEl key={i} url={t.url}>{t.label}</LinkEl>;
    if (t.t === "bold") return <strong key={i}>{t.v}</strong>;
    // `code` and *italic* inside plain text
    return <Fragment key={i}>{t.v.split(/(`[^`]+`)/g).map((p, j) => (p.startsWith("`") && p.endsWith("`") && p.length > 2 ? <code key={j} className="rounded bg-slate-100 px-1 text-[0.9em]">{p.slice(1, -1)}</code> : <Fragment key={j}>{p}</Fragment>))}</Fragment>;
  });
}

/** Small, XSS-safe Markdown renderer: headings, paragraphs, lists, quotes, fenced code, images, links.
 *  Never uses innerHTML; unsafe link/image URLs are dropped. */
export function Markdown({ text }: { text: string }) {
  const out: ReactNode[] = [];
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  let i = 0, k = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (line.startsWith("```")) {
      const code: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith("```")) code.push(lines[i++]);
      i++;
      out.push(<pre key={k++} className="my-4 overflow-x-auto rounded-xl bg-navy p-4 text-sm text-slate-100"><code>{code.join("\n")}</code></pre>);
      continue;
    }
    const h = /^(#{1,3})\s+(.*)$/.exec(line);
    if (h) {
      const cls = ["", "mt-8 mb-3 font-display text-3xl font-bold text-navy", "mt-8 mb-3 font-display text-2xl font-bold text-navy", "mt-6 mb-2 font-display text-xl font-bold text-navy"][h[1].length];
      const Tag = (`h${h[1].length + 1}`) as "h2" | "h3" | "h4"; // page title is the h1
      out.push(<Tag key={k++} className={cls}>{inline(h[2])}</Tag>);
      i++;
      continue;
    }
    const img = /^!\[([^\]]*)\]\(([^)\s]+)\)\s*$/.exec(line);
    if (img) {
      if (safeImg(img[2])) out.push(<img key={k++} src={img[2]} alt={img[1]} loading="lazy" className="my-4 w-full rounded-xl" />);
      i++;
      continue;
    }
    if (/^\s*[-*]\s+/.test(line) || /^\s*\d+\.\s+/.test(line)) {
      const ordered = /^\s*\d+\./.test(line);
      const items: string[] = [];
      while (i < lines.length && (ordered ? /^\s*\d+\.\s+/.test(lines[i]) : /^\s*[-*]\s+/.test(lines[i]))) items.push(lines[i++].replace(/^\s*(?:[-*]|\d+\.)\s+/, ""));
      const L = ordered ? "ol" : "ul";
      out.push(<L key={k++} className={`my-3 space-y-1 pl-6 ${ordered ? "list-decimal" : "list-disc"}`}>{items.map((t, j) => <li key={j}>{inline(t)}</li>)}</L>);
      continue;
    }
    if (line.startsWith("> ")) {
      const q: string[] = [];
      while (i < lines.length && lines[i].startsWith("> ")) q.push(lines[i++].slice(2));
      out.push(<blockquote key={k++} className="my-4 border-l-4 border-brand pl-4 italic">{inline(q.join(" "))}</blockquote>);
      continue;
    }
    if (!line.trim()) { i++; continue; }
    // Always consume the current line first, so a line that no block rule accepts (for example a
    // malformed image) can never stall the loop; then gather following plain lines.
    const para: string[] = [lines[i++]];
    while (i < lines.length && lines[i].trim() && !/^(#{1,3}\s|```|>\s|\s*[-*]\s+|\s*\d+\.\s+|!\[)/.test(lines[i])) para.push(lines[i++]);
    out.push(<p key={k++} className="my-3 leading-relaxed">{inline(para.join(" "))}</p>);
  }
  return <>{out}</>;
}

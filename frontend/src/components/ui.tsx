import type { ReactNode } from "react";
import { Link } from "react-router-dom";

export function SectionHeading({ eyebrow, title, intro }: { eyebrow?: string; title: string; intro?: string }) {
  return (
    <div className="mx-auto mb-10 max-w-2xl text-center">
      {eyebrow && <p className="mb-2 text-sm font-semibold uppercase tracking-widest text-brand">{eyebrow}</p>}
      <h2 className="font-display text-3xl font-bold text-navy sm:text-4xl">{title}</h2>
      {intro && <p className="mt-3 text-lg">{intro}</p>}
    </div>
  );
}

const base = "inline-flex items-center justify-center gap-2 rounded-lg px-5 py-3 text-sm font-semibold transition focus-visible:outline-2";
const variants = {
  primary: "bg-brand text-white hover:bg-brand-dark shadow-lg shadow-brand/25",
  ghost: "border border-white/30 text-white hover:bg-white/10",
  outline: "border border-brand text-brand hover:bg-brand-light",
};

export function ButtonLink({ to, variant = "primary", children }: { to: string; variant?: keyof typeof variants; children: ReactNode }) {
  return <Link to={to} className={`${base} ${variants[variant]}`}>{children}</Link>;
}

export function EmptyState({ title, text }: { title: string; text?: string }) {
  return (
    <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center">
      <p className="font-display text-lg font-semibold text-navy">{title}</p>
      {text && <p className="mt-1 text-sm">{text}</p>}
    </div>
  );
}

export function Spinner() {
  return <p role="status" className="py-16 text-center text-sm">Loading…</p>;
}

export function Chip({ children }: { children: ReactNode }) {
  return <span className="rounded-full bg-brand-light px-3 py-1 text-xs font-medium text-brand-dark">{children}</span>;
}

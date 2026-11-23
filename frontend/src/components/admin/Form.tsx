import type { ReactNode } from "react";
import { ApiError } from "@/services/api";

export const inputCls = "mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm";

export function Field({ label, error, hint, children }: { label: string; error?: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block text-sm font-medium text-navy">
      {label}
      {children}
      {hint && <span className="mt-1 block text-xs font-normal text-slate-500">{hint}</span>}
      {error && <span role="alert" className="mt-1 block text-xs font-normal text-red-600">{error}</span>}
    </label>
  );
}

export const Text = (p: { label: string; value: string; onChange: (v: string) => void; error?: string; type?: string; hint?: string; required?: boolean }) => (
  <Field label={p.label} error={p.error} hint={p.hint}>
    <input type={p.type ?? "text"} required={p.required} className={inputCls} value={p.value ?? ""} onChange={(e) => p.onChange(e.target.value)} />
  </Field>
);

export const Area = (p: { label: string; value: string; onChange: (v: string) => void; rows?: number; hint?: string }) => (
  <Field label={p.label} hint={p.hint}>
    <textarea rows={p.rows ?? 4} className={inputCls} value={p.value ?? ""} onChange={(e) => p.onChange(e.target.value)} />
  </Field>
);

export const Check = ({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) => (
  <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />{label}</label>
);

export function Btn({ children, variant = "primary", ...rest }: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "ghost" | "danger" }) {
  const v = { primary: "bg-brand text-white hover:bg-brand-dark", ghost: "border border-slate-300 hover:bg-slate-50", danger: "bg-red-600 text-white hover:bg-red-700" }[variant];
  return <button {...rest} className={`rounded-lg px-4 py-2 text-sm font-semibold disabled:opacity-50 ${v} ${rest.className ?? ""}`}>{children}</button>;
}

export function ErrorNote({ error }: { error: unknown }) {
  if (!error) return null;
  const e = error as ApiError;
  return (
    <div role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
      {e.message}
      {e.details?.map((d) => <div key={d.field}>{d.field}: {d.message}</div>)}
    </div>
  );
}

export const lines = (v: string) => v.split("\n").map((s) => s.trim()).filter(Boolean);
export const csv = (v: string) => v.split(",").map((s) => s.trim()).filter(Boolean);
export const Card = ({ children, className = "" }: { children: ReactNode; className?: string }) => <div className={`rounded-xl border border-slate-200 bg-white p-5 ${className}`}>{children}</div>;
export const PageTitle = ({ children, action }: { children: ReactNode; action?: ReactNode }) => (
  <div className="mb-6 flex items-center justify-between"><h1 className="font-display text-2xl font-bold text-navy">{children}</h1>{action}</div>
);

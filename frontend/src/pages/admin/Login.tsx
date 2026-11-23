import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { z } from "zod";
import { Btn, ErrorNote, Text } from "@/components/admin/Form";
import { useAuth } from "@/context/AuthContext";
import { ApiError } from "@/services/api";
import { login } from "@/services/admin";

const schema = z.object({ email: z.string().email("Enter a valid email"), password: z.string().min(1, "Enter your password") });

export default function Login() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const nav = useNavigate();
  const [f, setF] = useState({ email: "", password: "" });
  const [errs, setErrs] = useState<Record<string, string>>({});
  const m = useMutation({ mutationFn: () => login(f.email, f.password), onSuccess: async () => { await qc.invalidateQueries({ queryKey: ["auth"] }); nav("/admin"); } });
  if (user) return <Navigate to="/admin" replace />;
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const r = schema.safeParse(f);
    if (!r.success) { setErrs(Object.fromEntries(r.error.issues.map((i) => [i.path[0], i.message]))); return; }
    setErrs({});
    m.mutate();
  };
  const msg = m.error instanceof ApiError && m.error.status === 429 ? "Too many attempts. Try again in a few minutes." : m.error;
  return (
    <main className="grid min-h-screen place-items-center bg-navy p-4">
      <form onSubmit={submit} noValidate className="w-full max-w-sm space-y-4 rounded-2xl bg-white p-8">
        <h1 className="font-display text-2xl font-bold text-navy">Admin sign in</h1>
        <Text label="Email" type="email" value={f.email} onChange={(v) => setF({ ...f, email: v })} error={errs.email} />
        <Text label="Password" type="password" value={f.password} onChange={(v) => setF({ ...f, password: v })} error={errs.password} />
        {m.isError && (typeof msg === "string" ? <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{msg}</p> : <ErrorNote error={msg} />)}
        <Btn type="submit" disabled={m.isPending} className="w-full">{m.isPending ? "Signing in…" : "Sign in"}</Btn>
        <Link to="/admin/forgot-password" className="block text-center text-sm text-brand underline">Forgot your password?</Link>
      </form>
    </main>
  );
}

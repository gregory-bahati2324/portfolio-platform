import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { Link } from "react-router-dom";
import { Btn, ErrorNote, Text } from "@/components/admin/Form";
import { ApiError } from "@/services/api";
import { forgotPassword } from "@/services/admin";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [err, setErr] = useState("");
  const m = useMutation({ mutationFn: () => forgotPassword(email) });
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setErr("Enter a valid email"); return; }
    setErr("");
    m.mutate();
  };
  return (
    <main className="grid min-h-screen place-items-center bg-navy p-4">
      <form onSubmit={submit} noValidate className="w-full max-w-sm space-y-4 rounded-2xl bg-white p-8">
        <h1 className="font-display text-2xl font-bold text-navy">Reset your password</h1>
        {m.isSuccess ? <p role="status" className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">{m.data.message}</p> : (
          <>
            <p className="text-sm">Enter your admin email and we will send a link that works for 30 minutes.</p>
            <Text label="Email" type="email" value={email} onChange={setEmail} error={err} />
            {m.isError && ((m.error as ApiError).status === 429 ? <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">Too many requests. Please try again later.</p> : <ErrorNote error={m.error} />)}
            <Btn type="submit" disabled={m.isPending} className="w-full">{m.isPending ? "Sending…" : "Send reset link"}</Btn>
          </>
        )}
        <Link to="/admin/login" className="block text-center text-sm text-brand underline">Back to sign in</Link>
      </form>
    </main>
  );
}

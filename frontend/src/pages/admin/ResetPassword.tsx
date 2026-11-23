import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Btn, ErrorNote, Text } from "@/components/admin/Form";
import { resetPassword } from "@/services/admin";

export default function ResetPassword() {
  const [params] = useSearchParams();
  const token = params.get("token") ?? "";
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [err, setErr] = useState("");
  const m = useMutation({ mutationFn: () => resetPassword(token, pw) });
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (pw.length < 12) { setErr("Use at least 12 characters"); return; }
    if (pw !== pw2) { setErr("The two passwords do not match"); return; }
    setErr("");
    m.mutate();
  };
  return (
    <main className="grid min-h-screen place-items-center bg-navy p-4">
      <form onSubmit={submit} noValidate className="w-full max-w-sm space-y-4 rounded-2xl bg-white p-8">
        <h1 className="font-display text-2xl font-bold text-navy">Choose a new password</h1>
        {!token ? <p role="alert" className="text-sm text-red-700">This link is missing its token. Request a new reset email.</p> : m.isSuccess ? (
          <p role="status" className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">Password updated. All other sessions were signed out. <Link to="/admin/login" className="underline">Sign in</Link></p>
        ) : (
          <>
            <Text label="New password" type="password" value={pw} onChange={setPw} hint="At least 12 characters." />
            <Text label="Repeat new password" type="password" value={pw2} onChange={setPw2} error={err} />
            <ErrorNote error={m.error} />
            <Btn type="submit" disabled={m.isPending} className="w-full">{m.isPending ? "Saving…" : "Update password"}</Btn>
          </>
        )}
        <Link to="/admin/forgot-password" className="block text-center text-sm text-brand underline">Request a new link</Link>
      </form>
    </main>
  );
}

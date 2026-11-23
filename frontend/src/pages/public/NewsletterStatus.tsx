import { useQuery } from "@tanstack/react-query";
import { Link, useLocation, useSearchParams } from "react-router-dom";
import { Spinner } from "@/components/ui";
import { confirmNewsletter, unsubscribeNewsletter } from "@/services/content";

export default function NewsletterStatus() {
  const { pathname } = useLocation();
  const [params] = useSearchParams();
  const token = params.get("token") ?? "";
  const unsub = pathname.includes("unsubscribe");
  const { data, isLoading, isError } = useQuery({ queryKey: ["newsletter", pathname, token], queryFn: () => (unsub ? unsubscribeNewsletter(token) : confirmNewsletter(token)), enabled: !!token, retry: false });
  return (
    <div className="mx-auto max-w-xl px-4 py-24 text-center">
      <h1 className="font-display text-3xl font-bold text-navy">{unsub ? "Unsubscribe" : "Confirm subscription"}</h1>
      {!token || isError ? <p role="alert" className="mt-4">This link is invalid or has expired.</p> : isLoading ? <Spinner /> : <p role="status" className="mt-4">{data?.message}</p>}
      <Link to="/" className="mt-6 inline-block text-brand underline">Back to the site</Link>
    </div>
  );
}

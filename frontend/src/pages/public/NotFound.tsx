import { ButtonLink } from "@/components/ui";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-xl px-4 py-24 text-center">
      <h1 className="font-display text-4xl font-bold text-navy">Page not found</h1>
      <div className="mt-6"><ButtonLink to="/">Go home</ButtonLink></div>
    </div>
  );
}

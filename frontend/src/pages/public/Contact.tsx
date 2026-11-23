import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { useSearchParams } from "react-router-dom";
import { z } from "zod";
import { SectionHeading } from "@/components/ui";
import { useProfile, useServices, useSite } from "@/hooks/useContent";
import { useDocumentTitle } from "@/hooks/useDocumentTitle";
import { ApiError } from "@/services/api";
import { submitInquiry } from "@/services/content";

export const inquirySchema = z.object({
  name: z.string().trim().min(2, "Please enter your name"),
  email: z.string().trim().email("Enter a valid email address"),
  phone: z.string().max(40).optional(),
  company: z.string().max(200).optional(),
  service_slug: z.string().optional(),
  message: z.string().trim().min(10, "Please describe your project (at least 10 characters)").max(5000),
  budget_range: z.string().max(80).optional(),
  timeline: z.string().max(80).optional(),
  website: z.string().max(0).optional(), // honeypot
});
type Form = z.infer<typeof inquirySchema>;

export default function Contact() {
  const [params] = useSearchParams();
  const { data: services } = useServices();
  const { data: profile } = useProfile();
  const { data: site } = useSite();
  useDocumentTitle("Contact | Gregory Bahati", "Send a project inquiry or get in touch.");
  const { register, handleSubmit, formState: { errors }, reset } = useForm<Form>({
    resolver: zodResolver(inquirySchema),
    defaultValues: { service_slug: params.get("service") ?? "" },
  });
  const m = useMutation({ mutationFn: (d: Form) => submitInquiry({ ...d, service_slug: d.service_slug || null }), onSuccess: () => reset() });

  const field = "mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2";
  const err = (n: keyof Form) => errors[n] && <p role="alert" className="mt-1 text-sm text-red-600">{errors[n]?.message as string}</p>;
  const whatsapp = profile?.whatsapp.replace(/\D/g, "");

  return (
    <div className="mx-auto max-w-5xl px-4 py-16">
      <SectionHeading eyebrow="Contact" title="Let's discuss your project" />
      <div className="grid gap-10 md:grid-cols-3">
        <aside className="space-y-3 text-sm md:col-span-1">
          {profile?.email && <p><strong className="block text-navy">Email</strong><a className="text-brand hover:underline" href={`mailto:${profile.email}`}>{profile.email}</a></p>}
          {whatsapp && <p><strong className="block text-navy">WhatsApp</strong><a className="text-brand hover:underline" href={`https://wa.me/${whatsapp}`} target="_blank" rel="noopener noreferrer">{profile?.whatsapp}</a></p>}
          {profile?.phone && <p><strong className="block text-navy">Phone</strong>{profile.phone}</p>}
          {site?.social_links.map((s) => <p key={s.url}><a className="text-brand hover:underline" href={s.url} target="_blank" rel="noopener noreferrer">{s.platform}</a></p>)}
        </aside>
        <div className="md:col-span-2">
          {m.isSuccess ? (
            <div role="status" className="rounded-2xl border border-emerald-200 bg-emerald-50 p-8">
              <h2 className="font-display text-2xl font-bold text-emerald-800">Inquiry received</h2>
              <p className="mt-2">Thank you. Your reference is <strong>{m.data.reference}</strong>. Keep it for any follow-up.</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit((d) => m.mutate(d))} noValidate className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6">
              <div className="grid gap-4 sm:grid-cols-2">
                <div><label htmlFor="name">Name *</label><input id="name" className={field} {...register("name")} />{err("name")}</div>
                <div><label htmlFor="email">Email *</label><input id="email" type="email" className={field} {...register("email")} />{err("email")}</div>
                <div><label htmlFor="phone">Phone</label><input id="phone" className={field} {...register("phone")} /></div>
                <div><label htmlFor="company">Company or organization</label><input id="company" className={field} {...register("company")} /></div>
                <div><label htmlFor="service">Service needed</label>
                  <select id="service" className={field} {...register("service_slug")}>
                    <option value="">Not sure yet</option>
                    {services?.map((s) => <option key={s.slug} value={s.slug}>{s.title}</option>)}
                  </select></div>
                <div><label htmlFor="timeline">Expected timeline</label><input id="timeline" className={field} {...register("timeline")} /></div>
              </div>
              <div><label htmlFor="budget">Budget range (optional)</label><input id="budget" className={field} {...register("budget_range")} /></div>
              <div><label htmlFor="message">Project description *</label><textarea id="message" rows={5} className={field} {...register("message")} />{err("message")}</div>
              <div className="hidden" aria-hidden><label>Website<input tabIndex={-1} autoComplete="off" {...register("website")} /></label></div>
              {m.isError && <p role="alert" className="text-sm text-red-600">{(m.error as ApiError).status === 429 ? "Too many submissions. Please try again later." : "Something went wrong. Please try again or email directly."}</p>}
              <button disabled={m.isPending} className="rounded-lg bg-brand px-6 py-3 font-semibold text-white hover:bg-brand-dark disabled:opacity-60">{m.isPending ? "Sending…" : "Send inquiry"}</button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

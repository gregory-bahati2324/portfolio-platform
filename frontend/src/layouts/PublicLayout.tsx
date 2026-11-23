import { Menu, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import NewsletterForm from "@/components/NewsletterForm";
import { useArticles, useProfile, useSite } from "@/hooks/useContent";
import { usePageViewTracking } from "@/hooks/useTracker";
import ChatWidget from "@/components/chat/ChatWidget";
import { hexToRgbTriplet } from "@/utils/color";

const NAV = [
  { to: "/", label: "Home" }, { to: "/about", label: "About" }, { to: "/skills", label: "Skills" },
  { to: "/services", label: "Services" }, { to: "/projects", label: "Projects" }, { to: "/contact", label: "Contact" },
];

export default function PublicLayout() {
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();
  const { data: site } = useSite();
  const { data: profile } = useProfile();
  const { data: arts } = useArticles({ page_size: 1 });
  usePageViewTracking();
  const nav = arts && arts.total > 0 ? [...NAV.slice(0, 5), { to: "/articles", label: "Articles" }, NAV[5]] : NAV;

  // Block bodies on purpose: an effect must return nothing or a cleanup function, never a value.
  useEffect(() => { setOpen(false); }, [pathname]);
  useEffect(() => { window.scrollTo(0, 0); }, [pathname]);
  useEffect(() => {
    const rgb = site && hexToRgbTriplet(site.primary_color);
    if (rgb) document.documentElement.style.setProperty("--brand", rgb);
  }, [site]);

  const link = ({ isActive }: { isActive: boolean }) =>
    `rounded-md px-3 py-2 text-sm font-medium transition ${isActive ? "text-brand" : "text-slate-700 hover:text-brand"}`;

  return (
    <div className="flex min-h-screen flex-col">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:bg-white focus:p-3">Skip to content</a>
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
          <Link to="/" className="font-display text-xl font-bold text-navy">
            {site?.logo ? <img src={site.logo.url} alt={site.logo.alt_text || "Logo"} className="h-8" /> : <>Greg<span className="text-brand">Tech</span></>}
          </Link>
          <nav className="hidden items-center gap-1 md:flex" aria-label="Main">
            {nav.map((n) => <NavLink key={n.to} to={n.to} end={n.to === "/"} className={link}>{n.label}</NavLink>)}
            <Link to="/contact" className="ml-3 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-dark">Hire me</Link>
          </nav>
          <button className="md:hidden" onClick={() => setOpen(!open)} aria-expanded={open} aria-label="Toggle menu">
            {open ? <X /> : <Menu />}
          </button>
        </div>
        {open && (
          <nav className="border-t border-slate-200 bg-white px-4 py-3 md:hidden" aria-label="Mobile">
            <div className="flex flex-col">{nav.map((n) => <NavLink key={n.to} to={n.to} end={n.to === "/"} className={link}>{n.label}</NavLink>)}</div>
          </nav>
        )}
      </header>
      <div id="main" className="flex-1"><Outlet /></div>
      <footer className="bg-navy text-slate-300">
        <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-10 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-display text-lg font-bold text-white">{profile?.full_name ?? "Gregory Bahati"} · GregTech</p>
            <p className="text-sm">{site?.footer_text || "Building intelligent systems."}</p>
          </div>
          <NewsletterForm />
          <ul className="flex flex-wrap gap-4 text-sm">
            {site?.social_links.map((s) => (
              <li key={s.url}><a href={s.url} target="_blank" rel="noopener noreferrer" className="hover:text-white">{s.platform}</a></li>
            ))}
            {profile?.email && <li><a href={`mailto:${profile.email}`} className="hover:text-white">{profile.email}</a></li>}
          </ul>
        </div>
      </footer>
      <ChatWidget />
    </div>
  );
}

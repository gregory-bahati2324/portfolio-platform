import { BarChart3, Bot, FileText, LineChart, Mail, Newspaper, Quote, FolderKanban, Image, Inbox, LogOut, Settings, Sparkles, User, Wrench } from "lucide-react";
import { Navigate, NavLink, Outlet } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";

const NAV = [
  { to: "/admin", label: "Overview", icon: BarChart3, end: true },
  { to: "/admin/profile", label: "Profile", icon: User },
  { to: "/admin/projects", label: "Projects", icon: FolderKanban },
  { to: "/admin/skills", label: "Skills", icon: Wrench },
  { to: "/admin/services", label: "Services", icon: Sparkles },
  { to: "/admin/media", label: "Media library", icon: Image },
  { to: "/admin/analytics", label: "Analytics", icon: LineChart },
  { to: "/admin/articles", label: "Articles", icon: Newspaper },
  { to: "/admin/testimonials", label: "Testimonials", icon: Quote },
  { to: "/admin/newsletter", label: "Newsletter", icon: Mail },
  { to: "/admin/chatbot", label: "AI chatbot", icon: Bot },
  { to: "/admin/inquiries", label: "Inquiries", icon: Inbox },
  { to: "/admin/settings", label: "Site settings", icon: Settings },
];

export default function AdminLayout() {
  const { user, loading, signOut } = useAuth();
  if (loading) return <p role="status" className="p-8 text-sm">Loading…</p>;
  if (!user) return <Navigate to="/admin/login" replace />;
  return (
    <div className="flex min-h-screen flex-col bg-surface md:flex-row">
      <aside className="bg-navy text-slate-300 md:w-60 md:shrink-0">
        <div className="flex items-center justify-between p-4 md:block">
          <p className="font-display text-lg font-bold text-white">GregTech <span className="text-sky-300">Admin</span></p>
          <p className="hidden truncate text-xs md:block">{user.email}</p>
        </div>
        <nav aria-label="Admin" className="flex gap-1 overflow-x-auto px-2 pb-3 md:flex-col md:overflow-visible">
          {NAV.map(({ to, label, icon: Icon, end }) => (
            <NavLink key={to} to={to} end={end} className={({ isActive }) => `flex items-center gap-2 whitespace-nowrap rounded-lg px-3 py-2 text-sm ${isActive ? "bg-brand text-white" : "hover:bg-white/10"}`}>
              <Icon className="h-4 w-4" aria-hidden />{label}
            </NavLink>
          ))}
          <a href="/" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-white/10"><FileText className="h-4 w-4" aria-hidden />View site</a>
          <button onClick={signOut} className="flex items-center gap-2 rounded-lg px-3 py-2 text-left text-sm hover:bg-white/10"><LogOut className="h-4 w-4" aria-hidden />Sign out</button>
        </nav>
      </aside>
      <main className="flex-1 overflow-x-hidden p-4 md:p-8"><Outlet /></main>
    </div>
  );
}

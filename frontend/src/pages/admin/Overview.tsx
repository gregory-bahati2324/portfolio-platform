import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card, PageTitle } from "@/components/admin/Form";
import { get, overview } from "@/services/admin";

interface Analytics { daily: { date: string; page_views: number; visitors: number }[]; top_projects: { title: string; slug: string; views: number }[] }

export default function Overview() {
  const { data, isLoading, isError } = useQuery({ queryKey: ["admin", "overview"], queryFn: overview });
  const stats = useQuery({ queryKey: ["admin", "analytics", 30], queryFn: () => get<Analytics>("/analytics?days=30") });
  if (isLoading) return <p role="status">Loading…</p>;
  if (isError || !data) return <p role="alert">Could not load the overview.</p>;
  const cards: [string, number][] = [
    ["Website visits (30 days)", data.visits_last_30_days], ["Project views (30 days)", data.project_views_last_30_days],
    ["Chatbot conversations", data.chat_conversations], ["Customer inquiries", data.total_inquiries],
    ["New inquiries", data.new_inquiries], ["Inquiries from chat", data.chatbot_inquiries],
    ["Published projects", data.published_projects], ["Draft projects", data.draft_projects],
  ];
  const daily = stats.data?.daily ?? [];
  const hasTraffic = daily.some((d) => d.page_views > 0);
  return (
    <>
      <PageTitle>Overview</PageTitle>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {cards.map(([l, v]) => <Card key={l}><p className="text-sm">{l}</p><p className="font-display text-3xl font-bold text-brand">{v}</p></Card>)}
      </div>
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <h2 className="mb-3 font-display font-bold text-navy">Traffic, last 30 days</h2>
          {hasTraffic ? (
            <div className="h-56" role="img" aria-label="Daily page views and visitors, last 30 days">
              <ResponsiveContainer><LineChart data={daily}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="date" tickFormatter={(d: string) => d.slice(5)} /><YAxis allowDecimals={false} /><Tooltip /><Line type="monotone" dataKey="page_views" name="Page views" stroke="#2563EB" dot={false} /><Line type="monotone" dataKey="visitors" name="Visitors" stroke="#0F172A" dot={false} /></LineChart></ResponsiveContainer>
            </div>
          ) : <p className="py-10 text-center text-sm text-slate-500">No visits recorded yet.</p>}
          <p className="mt-2 text-xs text-slate-500">Privacy-friendly counts: visitors who opt out of tracking and bots are not included. <Link to="/admin/analytics" className="underline">Full analytics</Link></p>
        </Card>
        <div className="space-y-6">
          <Card>
            <h2 className="mb-2 font-display font-bold text-navy">Most viewed projects</h2>
            {(stats.data?.top_projects.length ?? 0) === 0 ? <p className="text-sm text-slate-500">No project views yet.</p> : (
              <ul className="divide-y divide-slate-100 text-sm">{stats.data!.top_projects.slice(0, 5).map((p) => <li key={p.slug} className="flex justify-between py-1.5"><span className="truncate pr-2">{p.title}</span><span className="font-medium">{p.views}</span></li>)}</ul>
            )}
          </Card>
          <Card>
            <h2 className="mb-2 font-display font-bold text-navy">Recent activity</h2>
            {data.recent_activity.length === 0 ? <p className="text-sm">No activity yet.</p> : (
              <ul className="divide-y divide-slate-100 text-sm">
                {data.recent_activity.map((a, i) => <li key={i} className="flex justify-between py-2"><span>{a.action.replace(/_/g, " ")}</span><time className="text-slate-500">{new Date(a.created_at).toLocaleString()}</time></li>)}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}

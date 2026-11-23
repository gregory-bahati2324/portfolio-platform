import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card, PageTitle } from "@/components/admin/Form";
import { get } from "@/services/admin";

interface S {
  days: number; page_views: number; visits: number; project_views: number;
  daily: { date: string; page_views: number; visitors: number }[];
  top_projects: { title: string; slug: string; views: number }[]; top_pages: { path: string; views: number }[]; top_referrers: { host: string; views: number }[];
}

export default function Analytics() {
  const [days, setDays] = useState(30);
  const { data, isLoading, isError } = useQuery({ queryKey: ["admin", "analytics", days], queryFn: () => get<S>(`/analytics?days=${days}`) });
  const List = ({ title, rows }: { title: string; rows: { k: string; v: number }[] }) => (
    <Card><h2 className="mb-2 font-display font-bold text-navy">{title}</h2>{rows.length === 0 ? <p className="text-sm text-slate-500">No data yet.</p> : <ul className="divide-y divide-slate-100 text-sm">{rows.map((r) => <li key={r.k} className="flex justify-between py-1.5"><span className="truncate pr-2">{r.k}</span><span className="font-medium">{r.v}</span></li>)}</ul>}</Card>
  );
  return (
    <>
      <PageTitle action={<select aria-label="Time range" value={days} onChange={(e) => setDays(Number(e.target.value))} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm">{[7, 30, 90, 365].map((d) => <option key={d} value={d}>Last {d} days</option>)}</select>}>Analytics</PageTitle>
      {isLoading ? <p role="status">Loading…</p> : isError || !data ? <p role="alert">Could not load analytics.</p> : (
        <div className="space-y-6">
          <div className="grid grid-cols-3 gap-4">{[["Page views", data.page_views], ["Visits (unique per day)", data.visits], ["Project views", data.project_views]].map(([l, v]) => <Card key={l as string}><p className="text-sm">{l}</p><p className="font-display text-3xl font-bold text-brand">{v}</p></Card>)}</div>
          <Card><div className="h-64" role="img" aria-label="Daily page views and visitors"><ResponsiveContainer><LineChart data={data.daily}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="date" tickFormatter={(d: string) => d.slice(5)} /><YAxis allowDecimals={false} /><Tooltip /><Legend /><Line type="monotone" dataKey="page_views" name="Page views" stroke="#2563EB" dot={false} /><Line type="monotone" dataKey="visitors" name="Visitors" stroke="#0F172A" dot={false} /></LineChart></ResponsiveContainer></div></Card>
          <div className="grid gap-4 lg:grid-cols-3">
            <List title="Most viewed projects" rows={data.top_projects.map((p) => ({ k: p.title, v: p.views }))} />
            <List title="Top pages" rows={data.top_pages.map((p) => ({ k: p.path, v: p.views }))} />
            <List title="Top referrers" rows={data.top_referrers.map((p) => ({ k: p.host, v: p.views }))} />
          </div>
          <p className="text-xs text-slate-500">Privacy-friendly: no cookies, no stored IP addresses (a daily-changing anonymous hash is used), Do Not Track and Global Privacy Control are honoured, and bots are ignored. Counts are therefore lower than tools that track more.</p>
        </div>
      )}
    </>
  );
}

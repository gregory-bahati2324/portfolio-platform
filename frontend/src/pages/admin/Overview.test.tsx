import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, expect, it, vi } from "vitest";
import Overview from "./Overview";

afterEach(() => vi.restoreAllMocks());
// jsdom has no ResizeObserver, which the chart library needs to measure its container.
vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} });
const json = (b: unknown) => new Response(JSON.stringify(b), { status: 200 });
const OV = { published_projects: 3, draft_projects: 2, total_inquiries: 9, new_inquiries: 4, visits_last_30_days: 120, project_views_last_30_days: 45, chat_conversations: 17, chatbot_inquiries: 5, recent_activity: [{ action: "project_published", entity: "project", created_at: "2026-01-01T10:00:00Z" }] };

function show(analytics: unknown) {
  vi.stubGlobal("fetch", vi.fn(async (url: string) => json(url.includes("/analytics") ? analytics : OV)));
  render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><MemoryRouter><Overview /></MemoryRouter></QueryClientProvider>);
}

it("shows every metric the brief asks for, from real backend data", async () => {
  show({ daily: [{ date: "2026-01-01", page_views: 5, visitors: 3 }], top_projects: [{ title: "Vision System", slug: "v", views: 40 }] });
  expect(await screen.findByText("Website visits (30 days)")).toBeTruthy();
  for (const [label, value] of [["Website visits (30 days)", "120"], ["Project views (30 days)", "45"], ["Chatbot conversations", "17"], ["Customer inquiries", "9"], ["New inquiries", "4"], ["Published projects", "3"], ["Draft projects", "2"]]) {
    expect(screen.getByText(label).parentElement?.textContent).toContain(value);
  }
  expect(await screen.findByText("Vision System")).toBeTruthy();
  expect(screen.getByText("project published")).toBeTruthy();
});

it("shows honest empty states instead of placeholder numbers when there is no traffic", async () => {
  show({ daily: [], top_projects: [] });
  expect(await screen.findByText("No visits recorded yet.")).toBeTruthy();
  expect(screen.getByText("No project views yet.")).toBeTruthy();
});

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import NewsletterForm from "@/components/NewsletterForm";
import { usePageViewTracking } from "@/hooks/useTracker";
import ArticleDetail from "./ArticleDetail";
import NewsletterStatus from "./NewsletterStatus";

const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status });
const wrap = (ui: React.ReactNode, path = "/") => (
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><MemoryRouter initialEntries={[path]}>{ui}</MemoryRouter></QueryClientProvider>
);
let calls: { url: string; body?: any; method?: string }[];
function stub(handler: (url: string) => Response) {
  calls = [];
  vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => { calls.push({ url, body: init?.body ? JSON.parse(init.body as string) : undefined, method: init?.method }); return handler(url); }));
}
beforeEach(() => Object.defineProperty(navigator, "doNotTrack", { value: null, configurable: true }));
afterEach(() => vi.restoreAllMocks());

it("newsletter form validates, then shows the generic confirmation message", async () => {
  stub(() => json({ message: "If this address is valid, a confirmation email is on its way." }, 202));
  render(wrap(<NewsletterForm />));
  fireEvent.click(screen.getByRole("button", { name: /subscribe/i }));
  expect(await screen.findByText(/valid email/i)).toBeTruthy();
  expect(calls).toHaveLength(0);
  fireEvent.change(screen.getByLabelText(/technology updates/i), { target: { value: "a@example.com" } });
  fireEvent.click(screen.getByRole("button", { name: /subscribe/i }));
  expect(await screen.findByText(/confirmation email/i)).toBeTruthy();
  expect(calls[0].body.email).toBe("a@example.com");
});

it("renders an article as safe Markdown and 404s gracefully", async () => {
  stub((url) => url.includes("/articles/good") ? json({ slug: "good", title: "Good Post", excerpt: "e", tags: ["ai"], published_at: null, reading_minutes: 2, content: "## Section\n\n<script>alert(1)</script> [bad](javascript:alert(1))", seo_description: "d" }) : json({ error: { code: "http_error", message: "nf" } }, 404));
  const { container, unmount } = render(wrap(<Routes><Route path="/articles/:slug" element={<ArticleDetail />} /></Routes>, "/articles/good"));
  expect(await screen.findByRole("heading", { name: "Good Post" })).toBeTruthy();
  expect(container.querySelector("script")).toBeNull();
  expect(container.querySelector('a[href^="javascript"]')).toBeNull();
  expect(screen.getByRole("heading", { name: "Section" })).toBeTruthy();
  unmount();
  render(wrap(<Routes><Route path="/articles/:slug" element={<ArticleDetail />} /></Routes>, "/articles/missing"));
  expect(await screen.findByText(/article not found/i)).toBeTruthy();
});

it("newsletter confirmation page handles valid and invalid tokens", async () => {
  stub(() => json({ message: "You are subscribed. Thank you!" }));
  const { unmount } = render(wrap(<Routes><Route path="/newsletter/confirm" element={<NewsletterStatus />} /></Routes>, "/newsletter/confirm?token=abc"));
  expect(await screen.findByText(/you are subscribed/i)).toBeTruthy();
  expect(calls[0].url).toContain("/newsletter/confirm?token=abc");
  expect(calls[0].method).toBe("POST"); // side effect only on POST, never on a prefetchable GET
  unmount();
  render(wrap(<Routes><Route path="/newsletter/confirm" element={<NewsletterStatus />} /></Routes>, "/newsletter/confirm"));
  expect(await screen.findByText(/invalid or has expired/i)).toBeTruthy();
});

function Tracked() { usePageViewTracking(); return null; }

it("tracks public page views but never admin pages or opted-out visitors", async () => {
  stub(() => new Response(null, { status: 204 }));
  render(wrap(<Tracked />, "/projects"));
  await waitFor(() => expect(calls.some((c) => c.body?.type === "page_view" && c.body.path === "/projects")).toBe(true));
  calls.length = 0;
  render(wrap(<Tracked />, "/admin/projects"));
  await new Promise((r) => setTimeout(r, 30));
  expect(calls).toHaveLength(0);
  Object.defineProperty(navigator, "doNotTrack", { value: "1", configurable: true });
  render(wrap(<Tracked />, "/about"));
  await new Promise((r) => setTimeout(r, 30));
  expect(calls).toHaveLength(0);
});

it("public pages never call the session endpoint", async () => {
  const { AuthProvider } = await import("@/context/AuthContext");
  stub(() => json({}));
  render(<QueryClientProvider client={new QueryClient()}><MemoryRouter initialEntries={["/projects"]}><AuthProvider><p>public page</p></AuthProvider></MemoryRouter></QueryClientProvider>);
  await screen.findByText("public page");
  await new Promise((r) => setTimeout(r, 50));
  expect(calls.some((c) => c.url.includes("/auth/me"))).toBe(false);
});

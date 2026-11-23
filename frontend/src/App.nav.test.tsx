import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, expect, it, vi } from "vitest";
import App from "./App";
import { AuthProvider } from "./context/AuthContext";

afterEach(() => vi.restoreAllMocks());
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status });
const CARD = { slug: "e2e", title: "E2E Vision Project", short_description: "Detects", technologies: ["Python"], status: "in_progress", is_featured: false, completed_on: null, category_name: null, category_slug: null, main_image: null };
const DETAIL = { ...CARD, description: "d", problem: "", solution: "", architecture: "", how_it_works: "", challenges: "", results: "", github_url: "", live_url: "", docs_url: "", service_slug: null, service_title: null, skills: [], media: [] };

it("navigating from the projects list to a project detail page keeps the app alive", async () => {
  // A real browser can hand back a value here; effects must never pass it on to React as a "cleanup function".
  Object.defineProperty(window, "scrollTo", { value: vi.fn(() => "not-a-function"), configurable: true });
  vi.stubGlobal("fetch", vi.fn(async (url: string) => {
    if (url.includes("/projects/e2e")) return json(DETAIL);
    if (url.includes("/projects")) return json({ items: [CARD], total: 1, page: 1, page_size: 9 });
    if (url.includes("/chat/config")) return json({ enabled: false, welcome_message: "", suggested_questions: [] });
    if (url.includes("/site")) return json({ site_title: "", meta_description: "", primary_color: "#2563EB", footer_text: "", show_proficiency: false, social_links: [] });
    if (url.includes("/profile")) return json(null);
    if (url.includes("/articles")) return json({ items: [], total: 0, page: 1, page_size: 1 });
    return json([]);
  }));
  const err = vi.spyOn(console, "error").mockImplementation(() => {});
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter initialEntries={["/projects"]}><AuthProvider><App /></AuthProvider></MemoryRouter>
    </QueryClientProvider>,
  );
  fireEvent.click((await screen.findAllByRole("link", { name: /E2E Vision Project/ }))[0]);
  expect(await screen.findByRole("heading", { name: "E2E Vision Project", level: 1 })).toBeTruthy();
  const bad = err.mock.calls.map((c) => String(c[0])).filter((m) => /not a function|Uncaught|The above error|effect function must not return/.test(m));
  expect(bad).toEqual([]);
});

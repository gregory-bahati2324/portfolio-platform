import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, expect, it, vi } from "vitest";
import ProjectDetail from "./ProjectDetail";

afterEach(() => vi.restoreAllMocks());
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status });

const FULL = {
  slug: "e2e", title: "E2E Vision Project", short_description: "Detects objects", technologies: ["Python", "YOLO"], status: "in_progress", is_featured: false,
  completed_on: null, category_name: "Computer Vision", category_slug: "computer-vision",
  main_image: { id: "1", kind: "image", url: "/media/images/a.webp", thumbnail_url: "/media/images/a_thumb.webp", alt_text: "Banner", description: "" },
  description: "Long description", problem: "", solution: "Sol", architecture: "", how_it_works: "", challenges: "", results: "",
  github_url: "https://github.com/example/vision", live_url: "", docs_url: "", service_slug: "web-development", service_title: "Web", skills: ["YOLO"],
  media: [
    { caption: "Screen", asset: { id: "2", kind: "image", url: "/media/images/b.webp", thumbnail_url: null, alt_text: "Shot", description: "" } },
    { caption: "Demo", asset: { id: "3", kind: "video", url: "/media/videos/c.mp4", thumbnail_url: null, alt_text: "", description: "" } },
  ],
};

function show(body: unknown, status = 200) {
  vi.stubGlobal("fetch", vi.fn(async () => json(body, status)));
  return render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter initialEntries={["/projects/e2e"]}><Routes><Route path="/projects/:slug" element={<ProjectDetail />} /></Routes></MemoryRouter>
    </QueryClientProvider>,
  );
}

it("renders a fully populated project (image, gallery, video, links, sections)", async () => {
  const { container } = show(FULL);
  expect(await screen.findByRole("heading", { name: "E2E Vision Project", level: 1 })).toBeTruthy();
  expect(screen.getByRole("heading", { name: "Screenshots" })).toBeTruthy();
  expect(screen.getByRole("heading", { name: "Demonstration videos" })).toBeTruthy();
  expect(container.querySelector("video")).toBeTruthy();
  expect(container.querySelector('a[href="https://github.com/example/vision"]')?.getAttribute("rel")).toBe("noopener noreferrer");
  expect(screen.getByText("Sol")).toBeTruthy();
});

it("renders a minimal project with no image, media or links", async () => {
  show({ ...FULL, main_image: null, media: [], github_url: "", description: "", solution: "", skills: [], category_name: null });
  expect(await screen.findByRole("heading", { name: "E2E Vision Project", level: 1 })).toBeTruthy();
});

it("shows the not-found page for an unknown project", async () => {
  show({ error: { code: "http_error", message: "nf" } }, 404);
  expect(await screen.findByText("Project not found")).toBeTruthy();
});

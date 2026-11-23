import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, expect, it, vi } from "vitest";
import { AuthProvider } from "@/context/AuthContext";
import AdminLayout from "@/layouts/AdminLayout";
import Login from "./Login";

afterEach(() => vi.restoreAllMocks());
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status });

function renderAt(path: string, handler: (url: string, init?: RequestInit) => Response) {
  const calls: { url: string; init?: RequestInit }[] = [];
  vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => { calls.push({ url, init }); return handler(url, init); }));
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter initialEntries={[path]}>
        <AuthProvider>
          <Routes>
            <Route path="/admin/login" element={<Login />} />
            <Route path="/admin" element={<AdminLayout />}><Route index element={<p>Dashboard content</p>} /></Route>
          </Routes>
        </AuthProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return calls;
}

it("redirects unauthenticated visitors from /admin to the login page", async () => {
  renderAt("/admin", (url) => (url.endsWith("/auth/me") ? json({ error: { code: "http_error", message: "Not authenticated" } }, 401) : json({})));
  expect(await screen.findByRole("heading", { name: /admin sign in/i })).toBeTruthy();
  expect(screen.queryByText("Dashboard content")).toBeNull();
});

it("shows the dashboard for an authenticated admin", async () => {
  renderAt("/admin", () => json({ id: "1", email: "owner@example.com", role: "owner" }));
  expect(await screen.findByText("Dashboard content")).toBeTruthy();
  expect(screen.getByText("owner@example.com")).toBeTruthy();
});

it("validates the login form before calling the API", async () => {
  const calls = renderAt("/admin/login", (url) => (url.endsWith("/auth/me") ? json({}, 401) : json({})));
  fireEvent.click(await screen.findByRole("button", { name: /sign in/i }));
  expect(await screen.findByText(/enter a valid email/i)).toBeTruthy();
  expect(calls.some((c) => c.url.endsWith("/auth/login"))).toBe(false);
});

it("shows a rate-limit message after too many failed logins", async () => {
  renderAt("/admin/login", (url) => {
    if (url.endsWith("/auth/me")) return json({}, 401);
    return json({ error: { code: "http_error", message: "Too many requests" } }, 429);
  });
  fireEvent.change(await screen.findByLabelText(/^email/i), { target: { value: "a@example.com" } });
  fireEvent.change(screen.getByLabelText(/^password/i), { target: { value: "x" } });
  fireEvent.click(screen.getByRole("button", { name: /sign in/i }));
  await waitFor(() => expect(screen.getByText(/too many attempts/i)).toBeTruthy());
});

it("does not ask the server about a session on public pages", async () => {
  const calls = renderAt("/admin/login", () => json({}, 401));
  await screen.findByRole("heading", { name: /admin sign in/i });
  expect(calls.some((c) => c.url.endsWith("/auth/me"))).toBe(true); // admin area checks
});

it("signing out leaves the dashboard immediately and ends up on the login page", async () => {
  const calls = renderAt("/admin", (url) => (url.endsWith("/auth/logout") ? new Response(null, { status: 204 }) : json({ id: "1", email: "owner@example.com", role: "owner" })));
  fireEvent.click(await screen.findByRole("button", { name: /sign out/i }));
  expect(await screen.findByRole("heading", { name: /admin sign in/i })).toBeTruthy();
  expect(screen.queryByText("Dashboard content")).toBeNull();
  expect(calls.some((c) => c.url.endsWith("/auth/logout") && c.init?.method === "POST")).toBe(true);
});

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, expect, it, vi } from "vitest";
import Contact from "./Contact";

afterEach(() => vi.restoreAllMocks());

const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status });
const lookup = (url: string) => json(url.includes("/site") ? { social_links: [] } : url.includes("/profile") ? null : []);

function setup(extra: (url: string) => Response | null) {
  const calls: string[] = [];
  vi.stubGlobal("fetch", vi.fn(async (url: string) => { calls.push(url); return extra(url) ?? lookup(url); }));
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter><Contact /></MemoryRouter>
    </QueryClientProvider>,
  );
  return calls;
}

it("shows validation errors and does not call the inquiry API", async () => {
  const calls = setup(() => null);
  fireEvent.click(screen.getByRole("button", { name: /send inquiry/i }));
  expect(await screen.findByText(/please enter your name/i)).toBeTruthy();
  expect(calls.some((u) => u.endsWith("/inquiries"))).toBe(false);
});

it("shows the reference after a successful submission", async () => {
  setup((url) => (url.endsWith("/inquiries") ? json({ reference: "GRG-20260101-ABC123", message: "ok" }, 201) : null));
  fireEvent.change(screen.getByLabelText(/^name/i), { target: { value: "Amina Juma" } });
  fireEvent.change(screen.getByLabelText(/^email/i), { target: { value: "amina@example.com" } });
  fireEvent.change(screen.getByLabelText(/project description/i), { target: { value: "I need an inventory system." } });
  fireEvent.click(screen.getByRole("button", { name: /send inquiry/i }));
  await waitFor(() => expect(screen.getByText(/GRG-20260101-ABC123/)).toBeTruthy());
});

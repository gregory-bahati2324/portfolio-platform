import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, afterEach, expect, it, vi } from "vitest";
import ChatWidget from "./ChatWidget";

const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status });
const CFG = { enabled: true, welcome_message: "Hello! Welcome.", suggested_questions: ["Who is Gregory Bahati?", "How can I hire Gregory?"] };
let calls: { url: string; body?: any }[];

function setup(handler: (url: string, body: any) => Response, cfg = CFG) {
  calls = [];
  vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
    const body = init?.body ? JSON.parse(init.body as string) : undefined;
    calls.push({ url, body });
    if (url.endsWith("/chat/config")) return json(cfg);
    return handler(url, body);
  }));
  render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><MemoryRouter><ChatWidget /></MemoryRouter></QueryClientProvider>);
}
beforeEach(() => sessionStorage.clear());
afterEach(() => vi.restoreAllMocks());

it("renders nothing when the chatbot is disabled", async () => {
  setup(() => json({}), { ...CFG, enabled: false });
  await waitFor(() => expect(calls.length).toBeGreaterThan(0));
  expect(screen.queryByRole("button", { name: /open chat/i })).toBeNull();
});

it("opens with the welcome message and suggested questions", async () => {
  setup(() => json({}));
  fireEvent.click(await screen.findByRole("button", { name: /open chat/i }));
  expect(screen.getByText("Hello! Welcome.")).toBeTruthy();
  expect(screen.getByRole("button", { name: "How can I hire Gregory?" })).toBeTruthy();
});

it("sends a suggested question, keeps the session id and shows a safe reply with a link card", async () => {
  setup(() => json({ session_id: "s".repeat(32), reply: "See [Vision](/projects/vision) and [bad](javascript:alert(1)).", links: [{ label: "Vision", url: "/projects/vision" }] }));
  fireEvent.click(await screen.findByRole("button", { name: /open chat/i }));
  fireEvent.click(screen.getByRole("button", { name: "Who is Gregory Bahati?" }));
  await waitFor(() => expect(screen.getAllByRole("link", { name: /vision/i }).length).toBeGreaterThan(0));
  expect(calls.find((c) => c.url.endsWith("/chat") && c.body)?.body).toEqual({ message: "Who is Gregory Bahati?" });
  expect(document.querySelector('a[href^="javascript"]')).toBeNull();
  expect(screen.queryByRole("button", { name: "How can I hire Gregory?" })).toBeNull(); // suggestions hidden after first question
  fireEvent.change(screen.getByLabelText(/your message/i), { target: { value: "Tell me more" } });
  fireEvent.click(screen.getByRole("button", { name: /send message/i }));
  await waitFor(() => expect(calls.filter((c) => c.url.endsWith("/chat") && c.body).length).toBe(2));
  expect(calls.filter((c) => c.url.endsWith("/chat") && c.body)[1].body.session_id).toBe("s".repeat(32));
});

it("shows a friendly fallback when the model is unavailable", async () => {
  setup(() => json({ error: { code: "http_error", message: "x" } }, 503));
  fireEvent.click(await screen.findByRole("button", { name: /open chat/i }));
  fireEvent.change(screen.getByLabelText(/your message/i), { target: { value: "Hi" } });
  fireEvent.click(screen.getByRole("button", { name: /send message/i }));
  expect(await screen.findByText(/couldn't answer right now/i)).toBeTruthy();
});

it("clears the conversation", async () => {
  setup(() => json({ session_id: "s".repeat(32), reply: "Hi there", links: [] }));
  fireEvent.click(await screen.findByRole("button", { name: /open chat/i }));
  fireEvent.change(screen.getByLabelText(/your message/i), { target: { value: "Hello bot" } });
  fireEvent.click(screen.getByRole("button", { name: /send message/i }));
  await screen.findByText("Hi there");
  fireEvent.click(screen.getByRole("button", { name: /clear conversation/i }));
  expect(screen.queryByText("Hi there")).toBeNull();
  expect(screen.getByRole("button", { name: "Who is Gregory Bahati?" })).toBeTruthy();
});

it("submits an inquiry linked to the chat session and shows the backend reference", async () => {
  setup((url) => (url.endsWith("/inquiries") ? json({ reference: "GRG-20260101-ABC123", message: "ok" }, 201) : json({ session_id: "c".repeat(32), reply: "Sure", links: [] })));
  fireEvent.click(await screen.findByRole("button", { name: /open chat/i }));
  fireEvent.change(screen.getByLabelText(/your message/i), { target: { value: "I need a system" } });
  fireEvent.click(screen.getByRole("button", { name: /send message/i }));
  await screen.findByText("Sure");
  fireEvent.click(screen.getByRole("button", { name: /contact gregory$/i }));
  fireEvent.click(screen.getByRole("button", { name: /send inquiry/i }));
  expect(await screen.findByText(/please enter your name/i)).toBeTruthy(); // validated first
  fireEvent.change(screen.getByLabelText(/^name/i), { target: { value: "Amina Juma" } });
  fireEvent.change(screen.getByLabelText(/^email/i), { target: { value: "a@example.com" } });
  fireEvent.change(screen.getByLabelText(/project description/i), { target: { value: "Inventory system for my shop" } });
  fireEvent.click(screen.getByRole("button", { name: /send inquiry/i }));
  expect(await screen.findByText(/GRG-20260101-ABC123/)).toBeTruthy();
  expect(calls.find((c) => c.url.endsWith("/inquiries"))?.body.chat_session_id).toBe("c".repeat(32));
});

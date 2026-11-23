import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, expect, it, vi } from "vitest";
import ForgotPassword from "./ForgotPassword";
import ResetPassword from "./ResetPassword";

afterEach(() => vi.restoreAllMocks());
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status });
const wrap = (ui: React.ReactNode, path: string) => <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><MemoryRouter initialEntries={[path]}>{ui}</MemoryRouter></QueryClientProvider>;
let calls: { url: string; body?: any }[];
const stub = (h: (url: string) => Response) => { calls = []; vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => { calls.push({ url, body: init?.body ? JSON.parse(init.body as string) : undefined }); return h(url); })); };

it("forgot password validates the email then shows the server's generic message", async () => {
  stub(() => json({ message: "If an account exists for that email, a reset link has been sent." }, 202));
  render(wrap(<ForgotPassword />, "/admin/forgot-password"));
  fireEvent.click(screen.getByRole("button", { name: /send reset link/i }));
  expect(await screen.findByText(/valid email/i)).toBeTruthy();
  expect(calls).toHaveLength(0);
  fireEvent.change(screen.getByLabelText(/^email/i), { target: { value: "owner@example.com" } });
  fireEvent.click(screen.getByRole("button", { name: /send reset link/i }));
  expect(await screen.findByText(/if an account exists/i)).toBeTruthy();
});

it("reset page checks length and match, sends the token from the link, and reports success", async () => {
  stub(() => new Response(null, { status: 204 }));
  render(wrap(<ResetPassword />, "/admin/reset-password?token=" + "t".repeat(30)));
  fireEvent.change(screen.getByLabelText(/^new password/i), { target: { value: "short" } });
  fireEvent.click(screen.getByRole("button", { name: /update password/i }));
  expect(await screen.findByText(/use at least 12/i)).toBeTruthy();
  fireEvent.change(screen.getByLabelText(/^new password/i), { target: { value: "a-long-new-passphrase" } });
  fireEvent.change(screen.getByLabelText(/repeat/i), { target: { value: "different-passphrase!!" } });
  fireEvent.click(screen.getByRole("button", { name: /update password/i }));
  expect(await screen.findByText(/do not match/i)).toBeTruthy();
  expect(calls).toHaveLength(0);
  fireEvent.change(screen.getByLabelText(/repeat/i), { target: { value: "a-long-new-passphrase" } });
  fireEvent.click(screen.getByRole("button", { name: /update password/i }));
  await waitFor(() => expect(screen.getByText(/password updated/i)).toBeTruthy());
  expect(calls[0].body).toEqual({ token: "t".repeat(30), new_password: "a-long-new-passphrase" });
});

it("reset page without a token explains instead of showing a form", () => {
  stub(() => json({}));
  render(wrap(<ResetPassword />, "/admin/reset-password"));
  expect(screen.getByText(/missing its token/i)).toBeTruthy();
  expect(screen.queryByRole("button", { name: /update password/i })).toBeNull();
});

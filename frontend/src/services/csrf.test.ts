import { afterEach, expect, it, vi } from "vitest";
import { api } from "./api";

afterEach(() => vi.restoreAllMocks());

it("sends the CSRF header on mutations but not on GET", async () => {
  document.cookie = "csrf_token=abc123";
  const f = vi.fn().mockImplementation(async () => new Response("{}", { status: 200 }));
  vi.stubGlobal("fetch", f);
  await api("/admin/profile");
  await api("/admin/profile", { method: "PUT", body: "{}" });
  expect((f.mock.calls[0][1].headers as Record<string, string>)["X-CSRF-Token"]).toBeUndefined();
  expect((f.mock.calls[1][1].headers as Record<string, string>)["X-CSRF-Token"]).toBe("abc123");
});

it("handles 204 responses", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 204 })));
  await expect(api("/auth/logout", { method: "POST" })).resolves.toBeUndefined();
});

import { afterEach, expect, it, vi } from "vitest";
import { api } from "./api";

afterEach(() => vi.restoreAllMocks());

it("fetches a CSRF token and sends it on mutations but not on GET", async () => {
  const f = vi.fn().mockImplementation(async (url: string) => {
    if (url.endsWith("/auth/csrf")) {
      return new Response(JSON.stringify({ csrf_token: "abc123" }), { status: 200 });
    }
    return new Response("{}", { status: 200 });
  });

  vi.stubGlobal("fetch", f);

  await api("/admin/profile");
  await api("/admin/profile", { method: "PUT", body: "{}" });

  const getCall = f.mock.calls.find((call) => String(call[0]).endsWith("/admin/profile"));
  const csrfCall = f.mock.calls.find((call) => String(call[0]).endsWith("/auth/csrf"));
  const mutationCall = f.mock.calls.find((call) => String(call[0]).endsWith("/admin/profile") && call[1]?.method === "PUT");

  expect(getCall?.[1]?.headers).toBeDefined();
  expect(csrfCall).toBeDefined();
  expect((mutationCall?.[1]?.headers as Record<string, string>)["X-CSRF-Token"]).toBe("abc123");
});

it("handles 204 responses", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockImplementation(async (url: string) => {
      if (url.endsWith("/auth/csrf")) {
        return new Response(JSON.stringify({ csrf_token: "abc123" }), { status: 200 });
      }
      return new Response(null, { status: 204 });
    }),
  );

  await expect(api("/auth/logout", { method: "POST" })).resolves.toBeUndefined();
});

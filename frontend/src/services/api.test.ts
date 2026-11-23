import { afterEach, describe, expect, it, vi } from "vitest";
import { api, ApiError } from "./api";

afterEach(() => vi.restoreAllMocks());

describe("api client", () => {
  it("returns parsed JSON on success", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ status: "ok" }), { status: 200 })));
    await expect(api("/health")).resolves.toEqual({ status: "ok" });
  });

  it("throws ApiError with server error code", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: { code: "validation_error", message: "bad" } }), { status: 422 })),
    );
    const err = (await api("/x").catch((e: unknown) => e)) as ApiError;
    expect(err).toBeInstanceOf(ApiError);
    expect(err.code).toBe("validation_error");
    expect(err.status).toBe(422);
  });
});

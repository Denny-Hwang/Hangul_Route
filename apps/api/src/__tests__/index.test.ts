import { describe, expect, it } from "vitest";
import app from "../index";

describe("apps/api router", () => {
  it("GET / returns the hello-hoya envelope", async () => {
    const res = await app.request("/");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({
      service: "hangul-route-api",
      status: "ok",
      message: "Hello, Hoya!",
    });
  });

  it("GET /health is 503 misconfigured when the Worker has neither Clerk nor D1 (SEC-2)", async () => {
    const res = await app.request("/health");
    expect(res.status).toBe(503);
    expect(await res.json()).toMatchObject({
      status: "misconfigured",
      environment: "production",
      devFallbacks: false,
      bindings: { db: false, clerk: false },
    });
  });

  it("GET /health is ok with the production bindings and reports booleans only", async () => {
    const res = await app.request("/health", {}, { DB: {}, CLERK_SECRET_KEY: "sk_live_secret" });
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).not.toContain("sk_live_secret");
    expect(JSON.parse(text)).toMatchObject({ status: "ok", bindings: { db: true, clerk: true } });
  });

  it("mounts the class-move routes locked: 422 transfers_locked without CLASS_TRANSFER, before any binding is needed (F-SPACE-002 T-5a, T-5b)", async () => {
    for (const [method, path] of [
      ["POST", "/api/spaces/space:a/transfer-requests/preview"],
      ["POST", "/api/spaces/space:a/transfer-requests"],
      ["GET", "/api/spaces/space:a/transfer-requests"],
      ["POST", "/api/spaces/space:a/transfer-requests/transfer:x/decline"],
      ["POST", "/api/spaces/space:a/transfer-requests/transfer:x/cancel"],
      ["POST", "/api/spaces/space:a/transfer-requests/transfer:x/approve"],
      ["POST", "/api/spaces/space:a/transfer-requests/transfer:x/retry"],
      ["PUT", "/api/spaces/space:a/learners/profile:x/transfer-prefs"],
    ]) {
      const res = await app.request(path, { method });
      expect(res.status, `${method} ${path}`).toBe(422);
      expect(await res.json()).toMatchObject({ ok: false, error: { code: "transfers_locked" } });
    }
  });
});

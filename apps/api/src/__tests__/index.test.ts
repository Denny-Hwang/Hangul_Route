import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";
import worker from "../index";

/** The Worker's fetch, called the way the runtime calls it (`app.request` of Hono, on the exported handler). */
const app = {
  request: (path: string, init: RequestInit = {}, env?: Record<string, unknown>): Promise<Response> =>
    Promise.resolve(worker.fetch(new Request(`http://localhost${path}`, init), env)),
};

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

  it("mounts the note send routes switched off: 404 not_found without NOTES_SEND, before any binding is needed (F-FEEDBACK-001 FB-3a)", async () => {
    for (const [method, path] of [
      ["POST", "/api/spaces/space:a/notes"],
      ["GET", "/api/spaces/space:a/notes/recipients"],
    ]) {
      const res = await app.request(path, { method });
      expect(res.status, `${method} ${path}`).toBe(404);
      expect(await res.json()).toMatchObject({ ok: false, error: { code: "not_found" } });
    }
  });

  it("exports fetch and the scheduled handler of the daily Cron Trigger (F-FEEDBACK-001 FB-3b)", () => {
    expect(Object.keys(worker).sort()).toEqual(["fetch", "scheduled"]);
    expect(typeof worker.scheduled).toBe("function");
  });

  it("wrangler.toml declares one daily cron for the purge, after the D1 binding (F-FEEDBACK-001 section 8.7)", () => {
    const toml = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "../../wrangler.toml"), "utf8");
    expect(toml).toMatch(/^\[triggers\]\ncrons = \["17 11 \* \* \*"\]$/m);
    expect(toml.indexOf("[triggers]")).toBeGreaterThan(toml.indexOf("[[d1_databases]]"));
  });

  it("the scheduled handler fails closed without D1 on a production Worker: it purges nothing from memory", async () => {
    const waitUntil = vi.fn();
    await expect(worker.scheduled({ scheduledTime: Date.now() }, {}, { waitUntil })).rejects.toMatchObject({ status: 503 });
    expect(waitUntil).not.toHaveBeenCalled();
  });
});

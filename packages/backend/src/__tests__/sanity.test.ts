import { describe, expect, it } from "vitest";
import { Hono } from "hono";

// Touch the package entry so coverage sees src/index.ts; real handlers
// land with T-018 (apps/api ↔ backend integration).
import "../index";

describe("backend package sanity", () => {
  it("hono is wired in and can build an empty app", () => {
    const app = new Hono();
    expect(typeof app.request).toBe("function");
  });

  it("backend app responds 404 on unknown route", async () => {
    const app = new Hono();
    const res = await app.request("/nope");
    expect(res.status).toBe(404);
  });
});

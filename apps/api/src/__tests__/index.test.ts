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

  it("GET /health returns { status: 'ok' }", async () => {
    const res = await app.request("/health");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "ok" });
  });
});

import { describe, expect, it } from "vitest";
import { z } from "zod";

describe("content-schema package sanity", () => {
  it("zod is wired in and parses a minimal Quest-like shape", () => {
    const Quest = z.object({ id: z.string(), step: z.number().int().min(1).max(5) });
    expect(Quest.parse({ id: "q-1", step: 1 })).toEqual({ id: "q-1", step: 1 });
  });

  it("rejects an invalid Quest shape", () => {
    const Quest = z.object({ id: z.string(), step: z.number().int().min(1).max(5) });
    expect(() => Quest.parse({ id: 42, step: 1 })).toThrow();
    expect(() => Quest.parse({ id: "q-1", step: 7 })).toThrow();
  });
});

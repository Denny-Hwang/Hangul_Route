import { describe, expect, it } from "vitest";
import { z } from "zod";

// Touch the package entry so coverage sees src/index.ts; real exports
// land with T-016 (Quest / Card / Episode zod schemas).
import "../index";

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

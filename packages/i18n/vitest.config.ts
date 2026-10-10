import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    passWithNoTests: true,
    coverage: {
      provider: "v8",
      reporter: ["text", "json-summary"],
      reportsDirectory: "./coverage",
      include: ["src/**/*.ts"],
      // types.ts is type-only. Message files are data (covered structurally by messages.structure.test.ts),
      // like src/logic/minigame-config.ts in the mobile config (F-I18N-001 §5).
      exclude: ["src/**/__tests__/**", "src/**/*.test.ts", "src/messages/**", "src/types.ts"],
    },
  },
});

import { defineConfig } from 'vitest/config';

/**
 * Mobile vitest config — covers logic layer only (no React Native renderers).
 *
 * Excluded from coverage (per docs/tests/coverage-targets.md §"측정 제외"):
 *   - src/logic/minigame-config.ts — pure data registry (config object only,
 *     no executable branches; mapped by minigame ref → content scope).
 *
 * RN component tests / store tests go through Detox in a separate nightly job
 * once the device matrix is wired (INBOX T-016).
 */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/logic/**/*.test.ts', 'src/store/**/*.test.ts'],
    passWithNoTests: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary'],
      reportsDirectory: './coverage',
      include: ['src/logic/**/*.ts'],
      exclude: [
        'src/**/__tests__/**',
        'src/**/*.test.ts',
        'src/logic/minigame-config.ts',
      ],
    },
  },
});

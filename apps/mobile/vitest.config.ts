import { defineConfig } from 'vitest/config';

/**
 * Mobile vitest config — measures the two coverage lanes from
 * docs/tests/coverage-targets.md (F-COV-003): src/logic (business, 90%) and
 * src/platform (platform wrappers, 70%). scripts/coverage-gate.mjs
 * aggregates each lane from this single coverage-summary.json.
 *
 * Excluded from coverage (per docs/tests/coverage-targets.md §"측정 제외"):
 *   - src/logic/minigame-config.ts — pure data registry (config object only,
 *     no executable branches; mapped by minigame ref → content scope).
 *   - src/platform/motion.ts — React hook over AccessibilityInfo events;
 *     needs a renderer harness, covered by Detox nightly instead.
 *
 * RN component tests go through Detox in a separate nightly job once the
 * device matrix is wired.
 */
export default defineConfig({
  test: {
    environment: 'node',
    include: [
      'src/logic/**/*.test.ts',
      'src/store/**/*.test.ts',
      'src/content/**/*.test.ts',
      'src/config/**/*.test.ts',
      'src/platform/**/*.test.ts',
    ],
    passWithNoTests: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary'],
      reportsDirectory: './coverage',
      include: ['src/logic/**/*.ts', 'src/platform/**/*.ts'],
      exclude: [
        'src/**/__tests__/**',
        'src/**/*.test.ts',
        'src/logic/minigame-config.ts',
        'src/platform/motion.ts',
      ],
    },
  },
});

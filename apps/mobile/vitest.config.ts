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
 *   - src/platform/motion.ts — React hook over AccessibilityInfo events, not
 *     yet tested; it could move to the render project below, which renders hooks.
 *   - every __generated__ folder under src — generated files (the clip map, F-AUDIO-004 §3.10).
 *
 * Screen render tests (the .test.tsx files under src/screens) run in the second project of
 * vitest.workspace.ts, vitest.render.config.ts: react-native resolves to
 * react-native-web there and screens render into react-test-renderer (F-BILL-002 B-13).
 * The `coverage` block below applies to the whole workspace run, so the lane numbers include
 * src/logic and src/platform lines that screen renders reach, not only unit-test hits
 * (docs/tests/coverage-targets.md).
 */
export default defineConfig({
  test: {
    name: 'unit',
    environment: 'node',
    include: [
      'src/logic/**/*.test.ts',
      'src/store/**/*.test.ts',
      'src/content/**/*.test.ts',
      'src/config/**/*.test.ts',
      'src/platform/**/*.test.ts',
      // Build scripts (F-APP-001 A-2: the service worker's grown-up rules read from the emitted sw.js).
      'scripts/__tests__/**/*.test.mjs',
    ],
    passWithNoTests: true,
    // The lesson stage modules load by a Metro-only `require`; Node gets them statically.
    setupFiles: ['src/test-support/lesson-modules-setup.ts'],
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
        'src/**/__generated__/**',
      ],
    },
  },
});

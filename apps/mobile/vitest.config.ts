import { defineConfig } from 'vitest/config';

/**
 * Mobile vitest config — covers logic layer only (no React Native renderers).
 * React Native component tests go through Detox in a separate nightly job.
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
      exclude: ['src/**/__tests__/**', 'src/**/*.test.ts'],
    },
  },
});

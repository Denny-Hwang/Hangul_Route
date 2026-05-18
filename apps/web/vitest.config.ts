import { defineConfig } from 'vitest/config';

/**
 * Web vitest config — covers verification logic only.
 *
 * Next.js App Router pages (src/app/**) are excluded from coverage:
 * they render JSX from data and are validated by `next build` + the
 * Cloudflare Pages preview deploy. Unit-style coverage of RSC components
 * would require a JSDOM setup that isn't worth the maintenance for the
 * minimal logic in pages.
 *
 * Per docs/tests/coverage-targets.md §"측정 제외".
 */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    passWithNoTests: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary'],
      reportsDirectory: './coverage',
      include: ['src/data/**/*.ts', 'src/lib/**/*.ts'],
      exclude: ['src/**/__tests__/**', 'src/**/*.test.ts', 'src/app/**', 'src/components/**'],
    },
  },
});

import { defineConfig } from 'vitest/config';

export default defineConfig({
  // The app's Babel preset (babel-preset-expo) compiles JSX with the automatic runtime, so no module imports React
  // for JSX; the tests compile it the same way.
  esbuild: { jsx: 'automatic' },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    passWithNoTests: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary'],
      reportsDirectory: './coverage',
      include: ['src/**/*.ts'],
      exclude: ['src/**/__tests__/**', 'src/**/*.test.ts', 'src/components/**'],
    },
  },
});

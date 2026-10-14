import { dirname } from 'node:path';
import { createRequire } from 'node:module';
import { defineConfig } from 'vitest/config';

const require = createRequire(import.meta.url);
const pkg = (name: string): string => dirname(require.resolve(`${name}/package.json`));

export default defineConfig({
  resolve: {
    alias: [
      { find: /^react-native$/, replacement: `${pkg('react-native-web')}/dist/index.js` },
    ],
  },
  esbuild: { jsx: 'automatic' },
  test: {
    name: 'render',
    environment: 'node',
    include: ['src/screens/**/*.test.tsx', 'src/test-support/**/*.test.tsx'],
    // F-CURR-001: the lesson stage modules load through a Metro-only `require`; tests get them imported.
    setupFiles: ['src/test-support/render-setup.ts', 'src/content/__tests__/helpers/lesson-modules-setup.ts'],
    server: { deps: { inline: [/react-native-web/] } },
  },
});

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
    setupFiles: ['src/test-support/render-setup.ts', 'src/test-support/lesson-content-setup.ts'],
    server: { deps: { inline: [/react-native-web/] } },
  },
});

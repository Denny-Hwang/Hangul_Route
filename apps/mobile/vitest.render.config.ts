import { dirname } from 'node:path';
import { createRequire } from 'node:module';
import { configDefaults, defineConfig } from 'vitest/config';

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
    // `*.native.test.tsx` runs in the native project (vitest.native.config.ts), with `.native` files resolved first.
    exclude: [...configDefaults.exclude, '**/*.native.test.tsx'],
    setupFiles: ['src/test-support/audio-assets-setup.ts', 'src/test-support/render-setup.ts', 'src/test-support/lesson-content-setup.ts'],
    server: { deps: { inline: [/react-native-web/] } },
  },
});

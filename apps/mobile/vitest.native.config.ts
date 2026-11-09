import { dirname } from 'node:path';
import { createRequire } from 'node:module';
import { defineConfig } from 'vitest/config';

const require = createRequire(import.meta.url);
const pkg = (name: string): string => dirname(require.resolve(`${name}/package.json`));

/**
 * The `native` render project (F-AUTH-004 section 20.1, row NS-2): the files only iOS and Android bundle
 * (`*.native.tsx`, `*.native.ts`), rendered the way the render project renders screens (react-native-web into
 * react-test-renderer, the same setup), but with a `.native` twin resolved first, as Metro does for a native build. So a
 * test here that imports `../platform/clerk` gets `clerk.native.tsx`. Only `*.native.test.tsx` files run here; the
 * render project leaves them out. Clerk's SDK is always mocked at its exports.
 */
export default defineConfig({
  resolve: {
    alias: [{ find: /^react-native$/, replacement: `${pkg('react-native-web')}/dist/index.js` }],
    extensions: ['.native.tsx', '.native.ts', '.tsx', '.ts', '.mjs', '.js', '.jsx', '.json'],
  },
  esbuild: { jsx: 'automatic' },
  test: {
    name: 'native',
    environment: 'node',
    include: ['src/**/*.native.test.tsx'],
    setupFiles: ['src/test-support/audio-assets-setup.ts', 'src/test-support/render-setup.ts', 'src/test-support/lesson-content-setup.ts'],
    server: { deps: { inline: [/react-native-web/] } },
  },
});

import { defineWorkspace } from 'vitest/config';

/**
 * Three projects, one run (so `vitest run`, `--coverage` and `-t` filters cover all):
 * - `vitest.config.ts`: logic, stores, content, config, platform and build-script tests in Node,
 *   and the coverage lanes (the root config's `coverage` block applies to the whole run);
 * - `vitest.render.config.ts`: screen render tests through react-native-web (F-BILL-002 B-13);
 * - `vitest.native.config.ts`: render tests of the iOS and Android files (`*.native.test.tsx`), with a `.native`
 *   twin resolved first (F-AUTH-004 section 20.1, row NS-2).
 */
export default defineWorkspace(['./vitest.config.ts', './vitest.render.config.ts', './vitest.native.config.ts']);

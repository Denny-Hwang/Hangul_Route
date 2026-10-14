import { defineWorkspace } from 'vitest/config';

/**
 * Two projects, one run (so `vitest run`, `--coverage` and `-t` filters cover both):
 * - `vitest.config.ts`: logic, stores, content, config, platform and build-script tests in Node,
 *   and the coverage lanes (the root config's `coverage` block applies to the whole run);
 * - `vitest.render.config.ts`: screen render tests through react-native-web (F-BILL-002 B-13).
 */
export default defineWorkspace(['./vitest.config.ts', './vitest.render.config.ts']);

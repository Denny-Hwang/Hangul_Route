import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';

/**
 * F-AUTH-004 (row NS-4): native-only modules are reached from shared screens through a `require` behind an `EXPO_OS`
 * test (`process.env.EXPO_OS === 'ios' || ... ? require('../account/x') : ...`), which babel-preset-expo inlines so
 * the web build folds the branch and never carries the module. Under vitest that `require` is Node's, which cannot
 * load a TypeScript file. A test that renders such a screen with `setPlatform('ios')` provides the module here: it is
 * imported through vitest (so its mocks apply and its stores are the test's own), and Node's `require` of that path,
 * from any file, returns those exports.
 */

interface NodeModuleLoader {
  _load: (request: string, parent: { filename?: string | null } | null | undefined, isMain: boolean) => unknown;
}

const nodeRequire = createRequire(import.meta.url);
const loader = nodeRequire('node:module') as NodeModuleLoader;
const provided = new Map<string, unknown>();
let installed = false;

function install(): void {
  if (installed) return;
  installed = true;
  const original = loader._load;
  loader._load = function load(this: unknown, request, parent, isMain) {
    if (request.startsWith('.') && typeof parent?.filename === 'string') {
      const key = resolve(dirname(parent.filename), request);
      if (provided.has(key)) return provided.get(key);
    }
    return original.call(this, request, parent, isMain);
  };
}

/**
 * Makes `require('<path>')` (relative, without an extension) answer `exports`. `absolutePath` is the module's path
 * without its extension (for example `resolve(__dirname, '../account-entries')`).
 */
export function provideForRequire(absolutePath: string, exports: unknown): void {
  install();
  provided.set(absolutePath, exports);
}

/** The `src` folder, to name a module by its path from there (`srcPath('screens/account/account-entries')`). */
export function srcPath(path: string): string {
  return resolve(dirname(new URL(import.meta.url).pathname), '..', path);
}

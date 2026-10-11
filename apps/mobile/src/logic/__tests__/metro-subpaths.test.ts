import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Metro (Expo SDK 52, no apps/mobile/metro.config.js) does not read package
 * `exports`, so a runtime import of a design-system subpath such as
 * '@hangul-route/design-system/word-art' does not resolve in the app bundle
 * even though vitest (which does read `exports`) passes. App code imports the
 * package root, or a subpath with `import type` only (erased at build time).
 */
const SRC = join(__dirname, '..', '..');
/** Runtime subpath imports in files that no screen imports yet; switch to the root before one does. */
const KNOWN_UNBUNDLED = new Set(['logic/lecture/stage-scale.ts']);

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return name === '__tests__' || name === '__generated__' ? [] : sources(path);
    return /\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name) ? [path] : [];
  });
}

/** `import { x } from '@hangul-route/design-system/<sub>'` and `export ... from`, but not `import type`. */
const RUNTIME_SUBPATH = /^\s*(?:import|export)\s+(?!type\b)[^;]*?from\s+'@hangul-route\/design-system\/[^']+'/gm;

describe('no runtime design-system subpath imports in app code (Metro cannot resolve them)', () => {
  it('every app source imports the design-system root, or a subpath for types only', () => {
    const offenders = sources(SRC)
      .filter((file) => readFileSync(file, 'utf8').match(RUNTIME_SUBPATH) !== null)
      .map((file) => relative(SRC, file).split('\\').join('/'))
      .filter((file) => !KNOWN_UNBUNDLED.has(file));
    expect(offenders).toEqual([]);
  });

  it('the pattern catches a value import and ignores a type-only import', () => {
    const value = "import { COLOR_CONFUSION_PAIRS } from '@hangul-route/design-system/word-art';";
    const typeOnly = "import type { LayoutClass } from '@hangul-route/design-system/layout';";
    expect(value.match(RUNTIME_SUBPATH)).not.toBeNull();
    expect(typeOnly.match(RUNTIME_SUBPATH)).toBeNull();
    expect("import { colors } from '@hangul-route/design-system';".match(RUNTIME_SUBPATH)).toBeNull();
  });

  it('the known unbundled files are still not imported by any other app source', () => {
    for (const known of KNOWN_UNBUNDLED) {
      const stem = known.replace(/\.tsx?$/, '').split('/').at(-1)!;
      const importers = sources(SRC).filter((file) => new RegExp(`from '[^']*/${stem}'`).test(readFileSync(file, 'utf8')));
      expect(importers.map((f) => relative(SRC, f))).toEqual([]);
    }
  });
});

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * F-APP-001 section 3.17: the child's bundle carries no console code. The learner app (every
 * file under `apps/mobile/src`, plus `App.tsx` and `index.ts`) never imports the console
 * (`apps/web`, `@hangul-route/web`) or Clerk (`@clerk/*`), and never reads a Clerk session.
 * The console's pages reach the app host only through the merged build (A-3), never through an
 * import; the service worker keeps them out of the precache (A-2).
 */
const APP_ROOT = join(__dirname, '..', '..', '..', '..');

function sources(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return name === 'node_modules' || name === '__tests__' ? [] : sources(path);
    return /\.(tsx?|jsx?|mjs|cjs)$/.test(name) ? [path] : [];
  });
}

/** Module specifiers of `import … from`, `export … from`, `import(…)` and `require(…)`. */
const SPECIFIER = /(?:\bfrom\s*|\bimport\s*\(\s*|\brequire\s*\(\s*|^\s*import\s+)['"]([^'"]+)['"]/gm;

function specifiers(source: string): string[] {
  return [...source.matchAll(SPECIFIER)].map((m) => m[1] ?? '');
}

/** A console or Clerk module, by package name or by a relative path that climbs into `apps/web`. */
function isConsoleModule(specifier: string): boolean {
  if (/^@clerk\//.test(specifier) || specifier === '@clerk') return true;
  if (specifier === '@hangul-route/web' || specifier.startsWith('@hangul-route/web/')) return true;
  return /(^|\/)apps\/web(\/|$)/.test(specifier) || /^(\.\.\/)+web(\/|$)/.test(specifier);
}

function consoleImports(files: readonly string[]): string[] {
  return files.flatMap((file) =>
    specifiers(readFileSync(file, 'utf8'))
      .filter(isConsoleModule)
      .map((spec) => `${relative(APP_ROOT, file).split(sep).join('/')}: ${spec}`),
  );
}

describe('the learner bundle never imports console code (F-APP-001 section 3.17)', () => {
  const files = [join(APP_ROOT, 'App.tsx'), join(APP_ROOT, 'index.ts'), ...sources(join(APP_ROOT, 'src'))].filter((f) => existsSync(f));

  it('scans the whole learner source', () => {
    const rel = files.map((f) => relative(APP_ROOT, f).split(sep).join('/'));
    expect(rel).toContain('App.tsx');
    expect(rel).toContain('index.ts');
    expect(rel).toContain('src/platform/app-root.web.ts');
    expect(rel).toContain('src/platform/grown-up-handoff.web.ts');
    expect(rel).toContain('src/screens/parent/PinEntryScreen.tsx');
    expect(rel.length).toBeGreaterThan(200);
  });

  it('nothing under apps/mobile imports apps/web or @clerk/*', () => {
    const found = consoleImports(files);
    expect(found, found.join('\n')).toEqual([]);
  });

  it('the scan sees every way of importing a console module', () => {
    const lines = [
      "import { useAuth } from '@clerk/clerk-react';",
      "import '@clerk/clerk-js';",
      "export { x } from '../../../web/src/lib/console/unlock';",
      "const m = await import('../../apps/web/src/lib/console/api');",
      "const c = require('@hangul-route/web/console');",
      "import type { GrownUpLock } from '../../../../apps/web/src/components/console/GrownUpLock';",
    ];
    for (const line of lines) {
      expect(specifiers(line).some(isConsoleModule), line).toBe(true);
    }
    for (const line of [
      "import { GROWN_UP_PREFIXES } from '@hangul-route/content-schema';",
      "import { track } from '../../platform/telemetry';",
      "import { web } from './web-helpers';",
      "import { x } from '../webview';",
    ]) {
      expect(specifiers(line).some(isConsoleModule), line).toBe(false);
    }
  });
});

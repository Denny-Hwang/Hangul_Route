import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * F-AUTH-004 sections 6.1 and 20.1 (row NS-2; CS-N13): the web bundle guard. The native grown-up account is iOS and
 * Android only; the web keeps the console (F-APP-001). So from the web build's entry (`index.ts`, which reaches
 * `App.tsx`, All lessons and the presenter), following every import the way Metro's web build resolves it (a
 * `.web.tsx` / `.web.ts` twin wins, `.native.*` is never taken) and every kind of import (static, `import()`,
 * `require()`, type imports too, to be safe), nothing reaches:
 * - `@clerk/clerk-expo`, `expo-screen-capture`, `expo-web-browser` or `expo-auth-session`;
 * - a `.native.*` file, `config/native-signin.ts`, `store/native-gate-state.ts`, any `logic/account/*` module or
 *   `platform/clerk-host.ts`.
 * The web start bundle has a few hundred bytes of room (`pwa-postbuild.mjs --budget`); with this row it is byte for
 * byte what it was. The root stack picks the Grown-up area stack through an `EXPO_OS` test that the web build folds
 * away (`navigation/root.tsx`); the last test pins that form.
 */

const APP = join(__dirname, '..', '..', '..');
const SRC = join(APP, 'src');
const REPO = join(APP, '..', '..');
const rel = (file: string): string => relative(APP, file).split(sep).join('/');

const ANY_IMPORT = /(?:\bfrom\s*|\bimport\s*\(\s*|\brequire\s*\(\s*|^\s*import\s+)['"]([^'"]+)['"]/gm;
const NATIVE_ONLY_PACKAGES = /^(@clerk\/clerk-expo|expo-screen-capture|expo-web-browser|expo-auth-session)(\/|$)/;

function resolveWeb(from: string, specifier: string): string | null {
  const base = resolve(dirname(from), specifier);
  for (const candidate of [
    `${base}.web.tsx`,
    `${base}.web.ts`,
    `${base}.tsx`,
    `${base}.ts`,
    `${base}.web.js`,
    `${base}.js`,
    join(base, 'index.web.tsx'),
    join(base, 'index.web.ts'),
    join(base, 'index.tsx'),
    join(base, 'index.ts'),
    base,
  ]) {
    if (/\.(tsx?|js)$/.test(candidate) && existsSync(candidate) && statSync(candidate).isFile()) return candidate;
  }
  return null;
}

/** Every app file the web build can reach from `entry`, and every package name those files import. */
function webGraph(entry: string): { files: Map<string, string[]>; packages: Map<string, string> } {
  const files = new Map<string, string[]>();
  const packages = new Map<string, string>();
  const queue: [string, string[]][] = [[entry, [entry]]];
  while (queue.length > 0) {
    const [file, chain] = queue.shift() as [string, string[]];
    if (files.has(file)) continue;
    files.set(file, chain);
    for (const match of readFileSync(file, 'utf8').matchAll(ANY_IMPORT)) {
      const specifier = match[1] as string;
      if (!specifier.startsWith('.')) {
        if (!packages.has(specifier)) packages.set(specifier, rel(file));
        continue;
      }
      const target = resolveWeb(file, specifier);
      if (target !== null) queue.push([target, [...chain, target]]);
    }
  }
  return { files, packages };
}

const NATIVE_ONLY_FILES = (path: string): boolean =>
  /\.native\.[jt]sx?$/.test(path) ||
  path === 'src/config/native-signin.ts' ||
  path === 'src/store/native-gate-state.ts' ||
  path === 'src/platform/clerk-host.ts' ||
  path.startsWith('src/logic/account/');

describe('no native account module is reachable from a web entry', () => {
  const graph = webGraph(join(APP, 'index.ts'));

  it('walks the whole web build (the app, All lessons, the presenter)', () => {
    const files = [...graph.files.keys()].map(rel);
    expect(files).toContain('App.tsx');
    expect(files).toContain('src/navigation/root.tsx');
    expect(files).toContain('src/screens/parent/ParentDashboardScreen.tsx');
    expect(files).toContain('src/platform/app-root.web.ts');
    expect(files.length).toBeGreaterThan(500);
  });

  it('no file reached is native-only', () => {
    const hits = [...graph.files].filter(([file]) => NATIVE_ONLY_FILES(rel(file))).map(([, chain]) => chain.map(rel).join(' -> '));
    expect(hits, hits.join('\n')).toEqual([]);
  });

  it('no file reached imports Clerk’s Expo SDK or the Expo modules only it and the account screens use', () => {
    const hits = [...graph.packages].filter(([name]) => NATIVE_ONLY_PACKAGES.test(name)).map(([name, from]) => `${from}: ${name}`);
    expect(hits, hits.join('\n')).toEqual([]);
  });

  it('no shared package imports them either', () => {
    const scan = (dir: string): string[] =>
      !existsSync(dir)
        ? []
        : readdirSync(dir).flatMap((name) => {
            const path = join(dir, name);
            if (statSync(path).isDirectory()) return name === 'node_modules' || name === '__tests__' ? [] : scan(path);
            return /\.(tsx?|mjs|js)$/.test(name) ? [path] : [];
          });
    const files = readdirSync(join(REPO, 'packages')).flatMap((pkg) => scan(join(REPO, 'packages', pkg, 'src')));
    expect(files.length).toBeGreaterThan(50);
    const hits = files.filter((file) => [...readFileSync(file, 'utf8').matchAll(ANY_IMPORT)].some((m) => NATIVE_ONLY_PACKAGES.test(m[1] ?? '')));
    expect(hits).toEqual([]);
  });

  it('the root stack reaches the Grown-up area stack only through the EXPO_OS test the web build folds away', () => {
    const root = readFileSync(join(SRC, 'navigation', 'root.tsx'), 'utf8');
    expect(root).toContain(
      "process.env.EXPO_OS === 'ios' || process.env.EXPO_OS === 'android'\n              ? (require('./grown-up-stack') as typeof import('./grown-up-stack')).GrownUpArea\n              : ParentDashboardScreen",
    );
    expect(root).not.toMatch(/^import .*grown-up-stack/m);
    // The web twin the walk takes is the dashboard itself.
    expect(readFileSync(join(SRC, 'navigation', 'grown-up-stack.tsx'), 'utf8')).toMatch(/export const GrownUpArea = ParentDashboardScreen;/);
  });
});

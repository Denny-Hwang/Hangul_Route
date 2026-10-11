import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * F-STORY-002 §3.9.4: the Next.js web app imports scene art only through the
 * `./scene-art` and `./scene-art/dom` subpaths, never the package root (the
 * root pulls react-native). These keep the subpaths declared, pointing at real
 * files, and free of anything react-native.
 */
const pkgDir = join(dirname(fileURLToPath(import.meta.url)), '../../..');
const pkg = JSON.parse(readFileSync(join(pkgDir, 'package.json'), 'utf8')) as { exports: Record<string, string> };
const sceneArtDir = join(pkgDir, 'src/scene-art');

describe('package subpaths', () => {
  it('declares ./scene-art and ./scene-art/dom next to the existing ones', () => {
    expect(pkg.exports['./scene-art']).toBe('./src/scene-art/index.ts');
    expect(pkg.exports['./scene-art/dom']).toBe('./src/scene-art/dom.tsx');
    expect(pkg.exports['.']).toBe('./src/index.ts');
    expect(pkg.exports['./tokens']).toBe('./src/tokens.ts');
  });

  it('every export target exists', () => {
    for (const target of Object.values(pkg.exports)) {
      if (target.includes('*')) continue;
      expect(existsSync(join(pkgDir, target)), target).toBe(true);
    }
  });

  it('the scene-art sources import neither react-native nor react-native-svg', () => {
    const files = readdirSync(sceneArtDir).filter((f) => /\.(ts|tsx)$/.test(f));
    expect(files).toContain('dom.tsx');
    for (const f of files) {
      const imports = [...readFileSync(join(sceneArtDir, f), 'utf8').matchAll(/from\s+'([^']+)'/g)].map((m) => m[1]!);
      expect(imports.filter((i) => i.startsWith('react-native')), f).toEqual([]);
      expect(imports.filter((i) => i.includes('/components/') && !i.endsWith('/components/Hoya/types')), f).toEqual([]);
    }
  });

  it('only dom.tsx imports react; the core is React-free', () => {
    const files = readdirSync(sceneArtDir).filter((f) => /\.(ts|tsx)$/.test(f));
    for (const f of files) {
      const imports = [...readFileSync(join(sceneArtDir, f), 'utf8').matchAll(/from\s+'([^']+)'/g)].map((m) => m[1]!);
      expect(imports.includes('react'), f).toBe(f === 'dom.tsx');
    }
  });

  it('the package root re-exports the pure scene-art API, the path Metro can resolve', () => {
    // Metro (Expo SDK 52) does not read package `exports`, so apps/mobile imports
    // from the root; only the Next.js web app uses the subpaths.
    const index = readFileSync(join(pkgDir, 'src/index.ts'), 'utf8');
    expect(index).toMatch(/export \* from '\.\/scene-art';/);
    expect(index).toMatch(/export \* from '\.\/components\/StoryScene';/);
    expect(index).not.toMatch(/scene-art\/dom/);
  });
});

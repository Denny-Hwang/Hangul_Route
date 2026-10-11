import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';
import pkgJson from '../../../package.json?raw';

/**
 * `@hangul-route/design-system/word-art` is the pure WordArt entry (F-VOC-002
 * §3.9): logic and tests in other packages read glyph data through it without
 * pulling react-native-svg. PR W-1a opens the entry; W-1b fills it.
 */

const WORD_ART_DIR = join(__dirname, '..');

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return name === '__tests__' ? [] : sourceFiles(path);
    return /\.tsx?$/.test(name) ? [path] : [];
  });
}

describe('./word-art entry', () => {
  it('is declared in package.json exports and points at src/word-art/index.ts', () => {
    const pkg = JSON.parse(pkgJson) as { exports: Record<string, string> };
    expect(pkg.exports['./word-art']).toBe('./src/word-art/index.ts');
    expect(statSync(join(WORD_ART_DIR, 'index.ts')).isFile()).toBe(true);
  });

  it('loads in node, where react-native cannot', async () => {
    await expect(import('../index')).resolves.toBeDefined();
  });

  it('no file under src/word-art imports React, react-native, react-native-svg or a component', () => {
    const offenders = sourceFiles(WORD_ART_DIR).filter((file) =>
      /from\s+['"](react|react-native|react-native-svg|[./]+components\/[^'"]*)['"]/.test(readFileSync(file, 'utf8')),
    );
    expect(offenders.map((f) => relative(WORD_ART_DIR, f))).toEqual([]);
  });

  it('holds no .tsx file: the entry is data and logic, never a view', () => {
    expect(sourceFiles(WORD_ART_DIR).filter((f) => f.endsWith('.tsx'))).toEqual([]);
  });
});

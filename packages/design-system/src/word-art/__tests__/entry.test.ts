import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';
import pkgJson from '../../../package.json?raw';
import { SCANNED_SOURCE, impureImports } from '../../__tests__/impure-imports';

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
    return SCANNED_SOURCE.test(name) ? [path] : [];
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

  it('exports the data model, builders, tones, render list, registry, colour-confusion pairs, generators and the component model', async () => {
    const entry = await import('../index');
    for (const name of [
      'WORD_ART',
      'WORD_ART_KEYS',
      'WORD_ART_FAMILIES',
      'WORD_ART_PLAN',
      'getWordArt',
      'wordArtKeyOf',
      'WORD_ART_TONES',
      'isWordArtTone',
      'resolveTone',
      'toRenderList',
      'glyphToSvgString',
      'COLOR_CONFUSION_PAIRS',
      'circle',
      'ellipse',
      'rect',
      'path',
      'poly',
      'blob',
      'curve',
      'leaf',
      'arc',
      'line',
      'drop',
      'star',
      'groundShadow',
      'face',
      'isWordArtPath',
      // W-1c: placement, the generators and the component's pure model
      'placeGlyph',
      'placePath',
      'placeShape',
      'haloOf',
      'swatch',
      'colorGlyphs',
      'COLOR_SWATCHES',
      'count',
      'countGlyphs',
      'COUNT_VALUES',
      'bodyPart',
      'bodyGlyphs',
      'BODY_PARTS',
      'BODY_ANCHORS',
      'ring',
      'figure',
      'figureTop',
      'marker',
      'siblings',
      'wordArtModel',
      // W-3: dense point lists for the art batches
      'pts',
    ]) {
      expect(entry, name).toHaveProperty(name);
    }
  });

  it('keeps the test-only colour science out of the entry', async () => {
    const entry = await import('../index');
    expect(entry).not.toHaveProperty('ciede2000');
    expect(entry).not.toHaveProperty('confusionPairs');
  });

  it('no file under src/word-art imports React, react-native(-svg/-web), the package barrel or a component', () => {
    const offenders = sourceFiles(WORD_ART_DIR)
      .map((file) => ({ file: relative(WORD_ART_DIR, file), imports: impureImports(readFileSync(file, 'utf8')) }))
      .filter(({ imports }) => imports.length > 0);
    expect(offenders).toEqual([]);
  });

  it('holds no .tsx or .jsx file: the entry is data and logic, never a view', () => {
    expect(sourceFiles(WORD_ART_DIR).filter((f) => /\.[jt]sx$/.test(f))).toEqual([]);
  });
});

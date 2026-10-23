import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { impureImports } from '../../../__tests__/impure-imports';
import { supportedCardIds } from '../card-ids';
import { upperCellCardArtIds } from '../upper-card-ids';

/**
 * `supportedCardIds` lives in a pure module (F-VOC-002 §3.9, PR W-1a) so node
 * tests, such as WordArt's `vocab-keys.test.ts`, can ask "is this card drawn?"
 * without loading react-native-svg. The component re-exports it unchanged.
 */

const HERE = join(__dirname, '..');

describe('supportedCardIds (card-ids.ts)', () => {
  it('lists the 30 Stage 1 card arts, each a unique card:<id> ref', () => {
    expect(supportedCardIds).toHaveLength(30);
    expect(new Set(supportedCardIds).size).toBe(supportedCardIds.length);
    for (const id of supportedCardIds) expect(id).toMatch(/^card:[a-z0-9-]+$/);
  });

  it('includes the 13 card arts vocabulary reuses (F-VOC-002 §3.11)', () => {
    const reused = [
      'card:rice',
      'card:kimchi',
      'card:kimbap',
      'card:tiger',
      'card:mountain',
      'card:sea',
      'card:moon',
      'card:book',
      'card:hanbok',
      'card:seollal',
      'card:chuseok',
      'card:yutnori',
      'card:gayageum',
    ];
    for (const id of reused) expect(supportedCardIds).toContain(id);
  });

  it('is a pure module: no React, react-native(-svg/-web), package barrel or component import', () => {
    expect(impureImports(readFileSync(join(HERE, 'card-ids.ts'), 'utf8'))).toEqual([]);
  });

  it('has one source: HeritageCardArt.tsx re-exports it and keeps no list of its own', () => {
    const component = readFileSync(join(HERE, 'HeritageCardArt.tsx'), 'utf8');
    expect(component).toMatch(/from '\.\/card-ids'/);
    expect(component).not.toMatch(/export const supportedCardIds/);
    const index = readFileSync(join(HERE, 'index.ts'), 'utf8');
    expect(index).toMatch(/supportedCardIds/);
  });

  it('every listed id has a drawing in the HeritageCardArt dispatcher', () => {
    const component = readFileSync(join(HERE, 'HeritageCardArt.tsx'), 'utf8');
    for (const id of supportedCardIds) expect(component, id).toContain(`case '${id}'`);
  });
});

/**
 * The upper-cell card art (F-CURR-002 §7.2, row CM-23): its own module, so the app's start bundle never carries it, and
 * an art budget per drawing and for the module (the app measures the chunk on the built bundle, lesson-chunks.mjs).
 */
describe('upperCellCardArtIds and UpperCellArt.tsx (row CM-23)', () => {
  const art = readFileSync(join(HERE, 'UpperCellArt.tsx'), 'utf8');

  it('lists the fifteen album cards of Stages 2 to 4, unique, none of them a Stage 1 drawing', () => {
    expect(upperCellCardArtIds).toHaveLength(15);
    expect(new Set(upperCellCardArtIds).size).toBe(15);
    for (const id of upperCellCardArtIds) {
      expect(id).toMatch(/^card:[a-z0-9-]+$/);
      expect(supportedCardIds).not.toContain(id);
    }
  });

  it('every listed id has a drawing in the UpperCellCardArt dispatcher, and the dispatcher draws nothing else', () => {
    for (const id of upperCellCardArtIds) expect(art, id).toContain(`case '${id}'`);
    expect([...art.matchAll(/case '(card:[a-z0-9-]+)'/g)].map((m) => m[1])).toEqual([...upperCellCardArtIds]);
  });

  it('stays out of the start bundle: not in the barrel, not imported by HeritageCardArt, reached by its file path', () => {
    const index = readFileSync(join(HERE, 'index.ts'), 'utf8');
    const root = readFileSync(join(HERE, '../../index.ts'), 'utf8');
    const component = readFileSync(join(HERE, 'HeritageCardArt.tsx'), 'utf8');
    for (const source of [index, root, component]) expect(source).not.toMatch(/UpperCellArt|upperCellCardArtIds/);
    // The drawings and their ids are reached by the file's own path, which Metro resolves without reading `exports`
    // (Expo SDK 52), while TypeScript and vitest read the matching `exports` entry.
    expect(index).not.toMatch(/upperCellCardArtIds/);
    const pkg = JSON.parse(readFileSync(join(HERE, '../../../package.json'), 'utf8')) as { exports: Record<string, string> };
    expect(pkg.exports['./src/components/HeritageCardArt/UpperCellArt']).toBe('./src/components/HeritageCardArt/UpperCellArt.tsx');
    // Row CM-23 part 2: the album ids are their own pure file, so `card-ids.ts` (in the start bundle for the Stage 1
    // drawings) does not carry a second copy of the app's album list.
    expect(readFileSync(join(HERE, 'card-ids.ts'), 'utf8')).not.toMatch(/upperCellCardArtIds/);
    expect(pkg.exports['./upper-card-ids']).toBe('./src/components/HeritageCardArt/upper-card-ids.ts');
  });

  it('uses theme tokens only: no colour literal and no new token', () => {
    expect(art).not.toMatch(/#[0-9a-fA-F]{3,8}\b|rgba?\(/);
    expect(art).toMatch(/from '\.\.\/\.\.\/tokens'/);
  });

  // Row CM-23 part 2 adds Stage 4's five talks, drawn with the shared two friends and bubbles (`Pal`, `Bubble`): the
  // module line moves from 16,000 B to 22,000 B; the per-drawing line stays.
  it('art budget: each drawing at most 2,000 B of source, the module at most 22,000 B', () => {
    const fns = [...art.matchAll(/^function (\w+Art)\(p: ArtProps\)[\s\S]*?^}$/gm)].map((m) => ({ name: m[1], bytes: Buffer.byteLength(m[0]) }));
    expect(fns).toHaveLength(15);
    for (const f of fns) expect(f.bytes, f.name).toBeLessThanOrEqual(2_000);
    expect(Buffer.byteLength(art)).toBeLessThanOrEqual(22_000);
  });

  it('art budget, Stage 4: the shared friends and bubble at most 2,600 B, each talk at most 1,600 B (row CM-23 part 2)', () => {
    const block = art.slice(art.indexOf('// ---- Stage 4'), art.indexOf('function MwoyeyoArt'));
    expect(Buffer.byteLength(block)).toBeLessThanOrEqual(2_600);
    for (const name of ['MwoyeyoArt', 'MasisseoyoArt', 'InsaArt', 'BigaWayoArt', 'GachiArt']) {
      const fn = new RegExp(`^function ${name}\\(p: ArtProps\\)[\\s\\S]*?^}$`, 'm').exec(art)?.[0] ?? '';
      expect(Buffer.byteLength(fn), name).toBeGreaterThan(0);
      expect(Buffer.byteLength(fn), name).toBeLessThanOrEqual(1_600);
    }
  });

  it('Stage 4 speech bubbles keep the HoyaBubble language: cream fill and sky-blue border, never a danger colour', () => {
    const block = art.slice(art.indexOf('// ---- Stage 4'));
    expect(block).toMatch(/function Bubble[\s\S]*fill=\{colors\.surface\.canvas\} stroke=\{colors\.brand\.secondary\}/);
    expect(block).not.toMatch(/colors\.feedback\.danger|colors\.vocab\.red/);
  });
});

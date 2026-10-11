import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { supportedCardIds } from '../card-ids';

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

  it('is a pure module: no React, react-native or react-native-svg import', () => {
    const source = readFileSync(join(HERE, 'card-ids.ts'), 'utf8');
    expect(source).not.toMatch(/from\s+['"](react|react-native|react-native-svg)['"]/);
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

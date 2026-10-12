import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { HeritageCard, SceneArt } from '@hangul-route/content-schema';
import { typography } from '@hangul-route/design-system/tokens';
import { describe, expect, it } from 'vitest';
import { heritageCardsAll } from '../../content';
import {
  CARD_PLATE_COLUMNS,
  CARD_PLATE_SLOTS,
  cardArtSource,
  cardCoverCrop,
  cardPlateLayout,
  cardWordFontSize,
  type CardArtDeps,
} from '../card-art';

/**
 * `supportedCardIds` of HeritageCardArt, read from its pure source file: the
 * design-system entry pulls in react-native, which node tests cannot load.
 */
function readSupportedCardIds(): string[] {
  const source = readFileSync(join(__dirname, '../../../../../packages/design-system/src/components/HeritageCardArt/card-ids.ts'), 'utf8');
  const block = /export const supportedCardIds[^=]*=\s*\[([\s\S]*?)\];/.exec(source);
  if (block === null) throw new Error('supportedCardIds not found in HeritageCardArt/card-ids.ts');
  return [...(block[1] as string).matchAll(/'(card:[a-z0-9-]+)'/g)].map((m) => m[1] as string);
}
const supportedCardIds = readSupportedCardIds();

const card = (over: Partial<HeritageCard> = {}): HeritageCard => ({
  id: 'card:test',
  titleEn: 'Test',
  subtitleKo: '시험',
  romanization: 'siheom',
  blurbEn: 'A test card.',
  theme: 'letters',
  stage: 'stage1',
  rarity: 'common',
  unlockedBy: 'first-launch',
  ...over,
});

const art = { setting: 'courtyard', altEn: 'A courtyard.' } as unknown as SceneArt;

const deps = (over: Partial<CardArtDeps> = {}): CardArtDeps => ({
  drawnCardIds: ['card:kimchi'],
  storyCover: (id) => (id === 'story:with-art' ? art : null),
  cardsAll: [],
  ...over,
});

describe('cardArtSource (F-STORY-006 §3.8 Art, D7)', () => {
  it('draws the heritage art when the design system has a drawing for the id', () => {
    expect(cardArtSource(card({ id: 'card:kimchi', storyId: 'story:with-art' }), deps())).toEqual({ kind: 'heritage', cardId: 'card:kimchi' });
  });

  it("crops a story card's cover scene when the story's cover has art", () => {
    const c = card({ id: 'card:story-with-art', storyId: 'story:with-art', theme: 'nature' });
    expect(cardArtSource(c, deps())).toEqual({ kind: 'cover', art, theme: 'nature', word: '시험' });
  });

  it('falls back to the Korean word on the theme tint when the cover art is pending or the story is not bundled', () => {
    const c = card({ id: 'card:story-pending', storyId: 'story:pending', theme: 'crafts' });
    expect(cardArtSource(c, deps())).toEqual({ kind: 'word', word: '시험', theme: 'crafts' });
  });

  it('uses the first letter of the English title when a card has no Korean word (as the screens did)', () => {
    expect(cardArtSource(card({ subtitleKo: undefined, romanization: undefined, titleEn: 'Hoya' }), deps())).toEqual({
      kind: 'word',
      word: 'H',
      theme: 'letters',
    });
  });

  it('draws a set card as the collection plate of its member cards, at most six, in catalogue order', () => {
    const members = Array.from({ length: 7 }, (_, i) => card({ id: `card:story-m${i}`, storyId: `story:m${i}`, setId: 'set:cluster' }));
    const other = card({ id: 'card:story-other', storyId: 'story:other', setId: 'set:elsewhere' });
    const set = card({ id: 'card:set-cluster', unlockedBy: 'set:cluster', rarity: 'legendary' });
    const source = cardArtSource(set, deps({ cardsAll: [members[0]!, other, ...members.slice(1), set] }));
    expect(source.kind).toBe('plate');
    if (source.kind !== 'plate') return;
    expect(source.members.map((m) => m.id)).toEqual(members.slice(0, CARD_PLATE_SLOTS).map((m) => m.id));
  });

  it('never puts the set card itself or another set card on its plate', () => {
    const set = card({ id: 'card:set-a', unlockedBy: 'set:a', setId: 'set:a' });
    const nested = card({ id: 'card:set-b', unlockedBy: 'set:b', setId: 'set:a' });
    const member = card({ id: 'card:story-m', storyId: 'story:m', setId: 'set:a' });
    const source = cardArtSource(set, deps({ cardsAll: [set, nested, member] }));
    expect(source).toEqual({ kind: 'plate', members: [member] });
  });

  it('shows the word for a set card whose members are not bundled yet', () => {
    const set = card({ id: 'card:set-empty', unlockedBy: 'set:empty', theme: 'rites' });
    expect(cardArtSource(set, deps({ cardsAll: [set] }))).toEqual({ kind: 'word', word: '시험', theme: 'rites' });
  });

  it('gives every card in the catalogue a face, and draws exactly the ids the design system can draw', () => {
    const real: CardArtDeps = { drawnCardIds: supportedCardIds, storyCover: () => null, cardsAll: heritageCardsAll };
    for (const c of heritageCardsAll) {
      const source = cardArtSource(c, real);
      expect(source.kind === 'heritage', c.id).toBe(supportedCardIds.includes(c.id));
      if (source.kind === 'word') expect(source.word.length, c.id).toBeGreaterThan(0);
    }
  });
});

describe('cardCoverCrop', () => {
  it('draws the 4:3 scene at size * 4/3 and centres it, so a square is cut from the middle', () => {
    expect(cardCoverCrop(96)).toEqual({ sceneWidth: 128, offsetX: -16 });
    expect(cardCoverCrop(200)).toEqual({ sceneWidth: 800 / 3, offsetX: -100 / 3 });
  });

  it('keeps the scene height equal to the square side', () => {
    for (const size of [48, 96, 120, 200]) expect((cardCoverCrop(size).sceneWidth * 3) / 4).toBeCloseTo(size);
  });
});

describe('cardPlateLayout', () => {
  it('lays six cells out three across and two down, inside the plate', () => {
    for (const size of [96, 120, 200]) {
      const plate = cardPlateLayout(size);
      expect(plate.cells).toHaveLength(CARD_PLATE_SLOTS);
      const columns = new Set(plate.cells.map((c) => c.x));
      const rows = new Set(plate.cells.map((c) => c.y));
      expect(columns.size).toBe(CARD_PLATE_COLUMNS);
      expect(rows.size).toBe(CARD_PLATE_SLOTS / CARD_PLATE_COLUMNS);
      for (const cell of plate.cells) {
        expect(cell.x).toBeGreaterThanOrEqual(plate.inset);
        expect(cell.y).toBeGreaterThanOrEqual(plate.inset);
        expect(cell.x + plate.cell).toBeLessThanOrEqual(size - plate.inset);
        expect(cell.y + plate.cell).toBeLessThanOrEqual(size - plate.inset);
      }
    }
  });

  it('centres the two rows vertically and keeps an even gap', () => {
    const plate = cardPlateLayout(200);
    const [a, b, c, d] = plate.cells;
    expect(b!.x - a!.x - plate.cell).toBeCloseTo(plate.gap);
    expect(c!.x - b!.x - plate.cell).toBeCloseTo(plate.gap);
    expect(d!.y - a!.y - plate.cell).toBeCloseTo(plate.gap);
    const top = a!.y;
    const bottom = 200 - (d!.y + plate.cell);
    expect(top).toBeCloseTo(bottom);
    expect(plate.cell).toBeGreaterThan(0);
  });
});

describe('cardWordFontSize', () => {
  it('fills a large square with a short word (the old 80 on a 200 card page)', () => {
    expect(cardWordFontSize(200, '김치', typography.size.caption)).toBe(80);
  });

  it('steps down so a long word stays inside the square', () => {
    const size = cardWordFontSize(96, '금속활자', typography.size.caption);
    expect(size * 4).toBeLessThanOrEqual(96 * 0.8);
    expect(size).toBeLessThan(cardWordFontSize(96, '김치', typography.size.caption));
  });

  it('never goes below the caption size, and treats an empty word as one glyph', () => {
    expect(cardWordFontSize(40, '아주아주아주긴단어', typography.size.caption)).toBe(typography.size.caption);
    expect(cardWordFontSize(100, '', typography.size.caption)).toBe(40);
  });
});

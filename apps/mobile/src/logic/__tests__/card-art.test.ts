import type { HeritageCard, SceneArt } from '@hangul-route/content-schema';
import { supportedCardIds } from '@hangul-route/design-system/heritage-card-ids';
import { borderWidth, typography } from '@hangul-route/design-system/tokens';
import { describe, expect, it } from 'vitest';
import { awardWorld } from '../../content/award-world';
import {
  CARD_PLATE_COLUMNS,
  CARD_PLATE_SLOTS,
  cardArtSource,
  cardCoverCrop,
  cardKoLine,
  cardTitleIsKo,
  cardPlateLayout,
  cardWord,
  cardWordFontSize,
  type CardArtDeps,
} from '../card-art';

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
  world: { cards: [], sets: [] },
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

  it('never shows a blank word: an empty or blank Korean word falls back to the title letter, then a placeholder', () => {
    expect(cardWord({ subtitleKo: '', titleEn: 'Hoya' })).toBe('H');
    expect(cardWord({ subtitleKo: '   ', titleEn: ' Hoya' })).toBe('H');
    expect(cardWord({ subtitleKo: ' 김치 ', titleEn: 'Kimchi' })).toBe('김치');
    expect(cardWord({ subtitleKo: undefined, titleEn: '' })).toBe('?');
    expect(cardArtSource(card({ subtitleKo: '', titleEn: 'Hoya' }), deps())).toEqual({ kind: 'word', word: 'H', theme: 'letters' });
  });

  const cardSet = (id: string, memberCardIds: string[]) => ({ id, cardId: `card:${id}`, titleEn: id, memberCardIds });

  it("draws a set card as the plate of the members its award set lists, at most six, in the set's order", () => {
    const members = Array.from({ length: 7 }, (_, i) => card({ id: `card:story-m${i}`, storyId: `story:m${i}`, setId: 'set:cluster' }));
    const other = card({ id: 'card:story-other', storyId: 'story:other', setId: 'set:elsewhere' });
    const set = card({ id: 'card:set-cluster', unlockedBy: 'set:cluster', rarity: 'legendary' });
    const order = [...members].reverse().map((m) => m.id);
    const world = { cards: [members[0]!, other, ...members.slice(1), set], sets: [cardSet('set:cluster', order), cardSet('set:elsewhere', [other.id])] };
    const source = cardArtSource(set, deps({ world }));
    expect(source.kind).toBe('plate');
    if (source.kind !== 'plate') return;
    expect(source.members.map((m) => m.id)).toEqual(order.slice(0, CARD_PLATE_SLOTS));
  });

  it("follows the award set's member list, not the cards' setId, so the plate shows the cards that earn it", () => {
    const listed = card({ id: 'card:story-listed', storyId: 'story:listed' });
    const tagged = card({ id: 'card:story-tagged', storyId: 'story:tagged', setId: 'set:a' });
    const set = card({ id: 'card:set-a', unlockedBy: 'set:a' });
    const source = cardArtSource(set, deps({ world: { cards: [listed, tagged, set], sets: [cardSet('set:a', [listed.id])] } }));
    expect(source).toEqual({ kind: 'plate', members: [listed] });
  });

  it('never puts the set card itself or another set card on its plate, and skips members not bundled', () => {
    const set = card({ id: 'card:set-a', unlockedBy: 'set:a', setId: 'set:a' });
    const nested = card({ id: 'card:set-b', unlockedBy: 'set:b', setId: 'set:a' });
    const member = card({ id: 'card:story-m', storyId: 'story:m', setId: 'set:a' });
    const world = { cards: [set, nested, member], sets: [cardSet('set:a', [set.id, nested.id, 'card:story-missing', member.id])] };
    expect(cardArtSource(set, deps({ world }))).toEqual({ kind: 'plate', members: [member] });
  });

  it('shows the word for a set card whose set or members are not bundled yet', () => {
    const set = card({ id: 'card:set-empty', unlockedBy: 'set:empty', theme: 'rites' });
    const word = { kind: 'word', word: '시험', theme: 'rites' };
    expect(cardArtSource(set, deps({ world: { cards: [set], sets: [] } }))).toEqual(word);
    expect(cardArtSource(set, deps({ world: { cards: [set], sets: [cardSet('set:empty', ['card:story-missing'])] } }))).toEqual(word);
  });

  it('gives every card in the catalogue a face, and draws exactly the ids the design system can draw', () => {
    const real: CardArtDeps = { drawnCardIds: supportedCardIds, storyCover: () => null, world: awardWorld };
    for (const c of awardWorld.cards) {
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

  it("keeps every cell inside the framed plate's border (frame at half the margin, borderWidth.base wide)", () => {
    for (const size of [90, 96, 120, 200]) {
      const plate = cardPlateLayout(size);
      const innerEdge = plate.inset / 2 + borderWidth.base;
      for (const cell of plate.cells) {
        expect(cell.x).toBeGreaterThanOrEqual(innerEdge);
        expect(cell.y).toBeGreaterThanOrEqual(innerEdge);
        expect(cell.x + plate.cell).toBeLessThanOrEqual(size - innerEdge);
        expect(cell.y + plate.cell).toBeLessThanOrEqual(size - innerEdge);
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

describe('cardKoLine', () => {
  it('shows the Korean line when it differs from the title', () => {
    expect(cardKoLine(card())).toBe('시험');
  });
  it('hides it when a Korean title already is the word (책 / 책)', () => {
    expect(cardKoLine(card({ titleEn: '책', subtitleKo: '책' }))).toBeUndefined();
    expect(cardKoLine(card({ titleEn: ' 책', subtitleKo: '책 ' }))).toBeUndefined();
  });
  it('hides a missing or blank Korean line', () => {
    expect(cardKoLine(card({ subtitleKo: undefined }))).toBeUndefined();
    expect(cardKoLine(card({ subtitleKo: '  ' }))).toBeUndefined();
  });
});

describe('cardTitleIsKo', () => {
  it('is true only when a Korean line exists and the title repeats it', () => {
    expect(cardTitleIsKo(card({ titleEn: '책', subtitleKo: '책' }))).toBe(true);
    expect(cardTitleIsKo(card({ titleEn: ' 책', subtitleKo: '책 ' }))).toBe(true);
    expect(cardTitleIsKo(card())).toBe(false);
    expect(cardTitleIsKo(card({ subtitleKo: undefined }))).toBe(false);
    expect(cardTitleIsKo(card({ subtitleKo: '  ' }))).toBe(false);
  });
});

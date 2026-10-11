import { describe, expect, it } from 'vitest';
import { cardsByRarity, stage1Cards, type CardRarity, type CardTheme } from '../stage1-cards';

const KOREAN_RE = /[ㄱ-㆏가-힣]/;
const VALID_RARITIES: readonly CardRarity[] = ['common', 'uncommon', 'rare', 'legendary'];
const VALID_THEMES: readonly CardTheme[] = ['letters', 'life', 'rites', 'nature', 'crafts'];

describe('stage1Cards', () => {
  it('ships exactly 24 cards (one per Stage 1 jamo)', () => {
    expect(stage1Cards.length).toBe(24);
  });

  it('every card id is unique and prefixed with card:', () => {
    const ids = stage1Cards.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) {
      expect(id.startsWith('card:')).toBe(true);
    }
  });

  it('every card has Korean in the ko field with romanization + English gloss', () => {
    for (const card of stage1Cards) {
      expect(card.ko.length).toBeGreaterThan(0);
      expect(KOREAN_RE.test(card.ko)).toBe(true);
      expect(card.romanization.length).toBeGreaterThan(0);
      expect(card.en.length).toBeGreaterThan(0);
    }
  });

  it('no Korean leaks into title, en, or blurb fields (language policy)', () => {
    for (const card of stage1Cards) {
      expect(KOREAN_RE.test(card.title)).toBe(false);
      expect(KOREAN_RE.test(card.en)).toBe(false);
      expect(KOREAN_RE.test(card.blurb)).toBe(false);
    }
  });

  it('every card has a valid rarity and theme', () => {
    for (const card of stage1Cards) {
      expect(VALID_RARITIES).toContain(card.rarity);
      expect(VALID_THEMES).toContain(card.theme);
    }
  });

  it('every card unlocks from a jamo: id', () => {
    for (const card of stage1Cards) {
      expect(card.unlockedBy.startsWith('jamo:')).toBe(true);
    }
  });

  it('Hoya tiger card is the legendary anchor', () => {
    const tiger = stage1Cards.find((c) => c.id === 'card:horangi');
    expect(tiger?.rarity).toBe('legendary');
  });
});

describe('cardsByRarity', () => {
  it('partitions all 24 cards across the four rarities', () => {
    const groups = cardsByRarity();
    const total = groups.common.length + groups.uncommon.length + groups.rare.length + groups.legendary.length;
    expect(total).toBe(stage1Cards.length);
  });
});

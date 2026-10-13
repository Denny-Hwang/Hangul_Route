import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
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

describe('stage1Cards mirror content/episodes/stage-1/cards.json', () => {
  interface SourceCard {
    id: string;
    title: string;
    ko: string;
    romanization: string;
    theme: string;
    rarity: string;
    unlockedBy: string;
  }
  const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..', '..');
  const source = JSON.parse(readFileSync(join(repoRoot, 'content', 'episodes', 'stage-1', 'cards.json'), 'utf8')) as SourceCard[];
  const pick = ({ id, title, ko, romanization, theme, rarity, unlockedBy }: SourceCard | (typeof stage1Cards)[number]) => ({
    id,
    title,
    ko,
    romanization,
    theme,
    rarity,
    unlockedBy,
  });

  // The short `en` gloss and the blurbs are site wording (the blurbs: F-SITE-002 S-6, OD-9) and may differ from the
  // app's; the card itself must match.
  it('same cards, in the same order, with the same ids, titles, Korean, romanization, theme, rarity and unlock', () => {
    expect(stage1Cards.map(pick)).toEqual(source.map(pick));
  });
});

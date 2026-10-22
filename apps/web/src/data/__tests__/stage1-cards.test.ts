import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Overlays } from '@hangul-route/content-schema';
import { OVERLAYS } from '@hangul-route/content-schema/overlays';
import { describe, expect, it } from 'vitest';
import { cardsByRarity, echoesCard, stage1Cards, stage1CardsIn, type CardRarity, type CardTheme } from '../stage1-cards';

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

describe('stage1Cards English slips (site-learners-l10n)', () => {
  it('the dragon gloss is "Dragon", and the Dano swing blurb reads "at the Dano festival"', () => {
    expect(stage1Cards.find((c) => c.id === 'card:yong')?.en).toBe('Dragon');
    expect(stage1Cards.find((c) => c.id === 'card:geune')?.blurb).toBe('Women in old paintings ride giant swings at the Dano festival.');
  });
});

describe('stage1CardsIn (the cards in the UI language, F-I18N-001 §3.6)', () => {
  const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..', '..');
  const overlayFile = (locale: 'es' | 'ko') =>
    (JSON.parse(readFileSync(join(repoRoot, 'content', 'i18n', locale, 'stage1-cards.json'), 'utf8')) as {
      entries: Record<string, { title?: string; blurb?: string }>;
    }).entries;

  it('English is the source: the site gloss and blurb, the same Korean and romanization', () => {
    const en = stage1CardsIn('en', OVERLAYS);
    expect(en.map((c) => c.id)).toEqual(stage1Cards.map((c) => c.id));
    stage1Cards.forEach((card, i) => {
      expect(en[i]).toEqual({ id: card.id, ko: card.ko, romanization: card.romanization, rarity: card.rarity, gloss: card.en, blurb: card.blurb });
    });
  });

  it.each(['es', 'ko'] as const)('%s: the gloss is the overlay title and the blurb the overlay blurb; Korean and romanization never change', (locale) => {
    const entries = overlayFile(locale);
    const cards = stage1CardsIn(locale, OVERLAYS);
    stage1Cards.forEach((card, i) => {
      const shown = cards[i];
      const entry = entries[card.id];
      expect(entry?.title, card.id).toBeDefined();
      expect(entry?.blurb, card.id).toBeDefined();
      expect(shown?.ko).toBe(card.ko);
      expect(shown?.romanization).toBe(card.romanization);
      expect(shown?.blurb, card.id).toBe(entry?.blurb);
      expect(shown?.gloss, card.id).toBe(echoesCard(card, entry?.title ?? '') ? null : entry?.title);
      // No English left: neither the site gloss nor the site blurb.
      expect(shown?.gloss, card.id).not.toBe(card.en);
      expect(shown?.blurb, card.id).not.toBe(card.blurb);
    });
  });

  it('ko: every title is the word itself, so no tile repeats it', () => {
    expect(stage1CardsIn('ko', OVERLAYS).every((c) => c.gloss === null)).toBe(true);
  });

  it('es: a title that only repeats the romanization (Bap, Ori) is left out; a real gloss stays', () => {
    const es = new Map(stage1CardsIn('es', OVERLAYS).map((c) => [c.id, c.gloss]));
    expect(es.get('card:bap')).toBeNull();
    expect(es.get('card:ori')).toBeNull();
    expect(es.get('card:gangaji')).toBe('Cachorro');
    expect(es.get('card:yong')).toBe('Dragón');
    expect(es.get('card:kpop')).toBe('K-pop');
  });

  it('echoesCard compares letters only, case-blind', () => {
    const bap = { ko: '\uBC25', romanization: 'bap' };
    expect(echoesCard(bap, 'Bap')).toBe(true);
    expect(echoesCard(bap, '\uBC25')).toBe(true);
    expect(echoesCard(bap, 'Arroz')).toBe(false);
    expect(echoesCard({ ko: 'x', romanization: 'keipap' }, 'K-pop')).toBe(false);
    expect(echoesCard({ ko: 'x', romanization: 'taegeukgi' }, 'Taegeukgi')).toBe(true);
  });

  it('a card with no overlay entry keeps its English (never a blank, never the key)', () => {
    const empty: Overlays = { es: {}, ko: {} };
    const es = stage1CardsIn('es', empty);
    stage1Cards.forEach((card, i) => {
      expect(es[i]?.blurb).toBe(card.blurb);
      expect(es[i]?.gloss).toBe(card.en);
    });
  });
});

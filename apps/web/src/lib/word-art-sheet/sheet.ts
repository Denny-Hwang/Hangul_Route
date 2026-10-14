/**
 * The WordArt contact sheet's model (F-VOC-002 §3.10): one card per registry
 * key with its family, review state, shape count and byte size, the
 * vocabulary item(s) it pictures (read from the generated web catalog, never
 * inline words), and the counts for the totals line and the family filter.
 * Pure; the page at /design-preview/word-art renders it.
 */
import { WORD_ART_FAMILIES, type WordArtEntry, type WordArtFamily, type WordArtGlyph, type WordArtStatus } from '@hangul-route/design-system/word-art';
import type { VocabCatalogEntry } from '../../data/vocab-catalog';

/** How the reviewer reads a glyph's `meta.status` (behaviour 8). */
export const STATUS_LABEL: Readonly<Record<WordArtStatus, string>> = Object.freeze({
  draft: 'needs work',
  review: 'needs review',
  approved: 'approved',
});

export interface SheetWord {
  id: string;
  ko: string;
  romanization: string;
  en: string;
  topic: string;
}

export interface WordArtCard {
  key: string;
  family: WordArtFamily;
  status: WordArtStatus;
  glyph: WordArtGlyph;
  /** Shapes in the glyph. */
  shapes: number;
  /** `JSON.stringify(glyph).length`. */
  bytes: number;
  /** Vocabulary items whose visual is `word:<key>`: one for a shipped word, none for a prop or a key whose topic is not merged. */
  words: SheetWord[];
  /** `meta.reserved`: a key no vocabulary topic uses (a lesson picture outside the topics, F-VOC-002 §3.9). */
  reserved: boolean;
}

export interface WordArtSheet {
  cards: WordArtCard[];
  families: Array<{ family: WordArtFamily; count: number }>;
  totals: { glyphs: number; byStatus: Record<WordArtStatus, number> };
}

/** A heritage card picture that vocabulary items reuse as their `visual` (§3.11). */
export interface CardArtReuse {
  /** `card:<id>`, the HeritageCardArt id. */
  cardId: string;
  words: SheetWord[];
}

/** Each `card:` visual of the catalog once, in catalog order, with the words that use it: the reuses §3.11 has reviewed at 96 and 64 px. */
export function cardArtReuses(catalog: readonly VocabCatalogEntry[]): CardArtReuse[] {
  const byCard = new Map<string, SheetWord[]>();
  for (const item of catalog) {
    if (!item.visual.startsWith('card:')) continue;
    const list = byCard.get(item.visual) ?? [];
    list.push({ id: item.id, ko: item.ko, romanization: item.romanization, en: item.en, topic: item.topic });
    byCard.set(item.visual, list);
  }
  return [...byCard].map(([cardId, words]) => ({ cardId, words }));
}

export function glyphBytes(glyph: WordArtGlyph): number {
  return JSON.stringify(glyph).length;
}

export function buildWordArtSheet(registry: Readonly<Record<string, WordArtEntry>>, catalog: readonly VocabCatalogEntry[]): WordArtSheet {
  const wordsByKey = new Map<string, SheetWord[]>();
  for (const item of catalog) {
    if (!item.visual.startsWith('word:')) continue;
    const key = item.visual.slice('word:'.length);
    const list = wordsByKey.get(key) ?? [];
    list.push({ id: item.id, ko: item.ko, romanization: item.romanization, en: item.en, topic: item.topic });
    wordsByKey.set(key, list);
  }
  const familyOrder = (f: WordArtFamily): number => WORD_ART_FAMILIES.indexOf(f);
  const cards = Object.entries(registry)
    .map(([key, { glyph, meta }]) => ({ key, family: meta.family, status: meta.status, glyph, shapes: glyph.length, bytes: glyphBytes(glyph), words: wordsByKey.get(key) ?? [], reserved: meta.reserved === true }))
    .sort((a, b) => familyOrder(a.family) - familyOrder(b.family));
  const byStatus: Record<WordArtStatus, number> = { draft: 0, review: 0, approved: 0 };
  const perFamily = new Map<WordArtFamily, number>();
  for (const card of cards) {
    byStatus[card.status] += 1;
    perFamily.set(card.family, (perFamily.get(card.family) ?? 0) + 1);
  }
  return {
    cards,
    families: [...perFamily].map(([family, count]) => ({ family, count })),
    totals: { glyphs: cards.length, byStatus },
  };
}

const SVG_ELEMENT = /^<svg\b[^>]*>([\s\S]*)<\/svg>$/;

/** The shapes inside a `glyphToSvgString` result, for a sprite `<symbol>` the page draws at every size with `<use>`. */
export function svgBody(svg: string): string {
  const body = SVG_ELEMENT.exec(svg)?.[1];
  if (body === undefined) throw new Error('not an svg element');
  return body;
}

/**
 * The sprite id of a key's colour (`wa_c_`) or silhouette (`wa_m_`) drawing.
 * The mode is a prefix with an underscore, which the key pattern cannot
 * contain, so no key's colour id can equal another key's silhouette id.
 */
export function symbolId(key: string, mono: boolean): string {
  return `${mono ? 'wa_m_' : 'wa_c_'}${key}`;
}

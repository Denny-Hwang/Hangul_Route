import type { Jamo, Quest, RouteCatalog } from '@hangul-route/content-schema';
import type { Messages } from '@hangul-route/i18n';
import { questTeaches } from '../stage1/curriculum';
import type { StageRow } from './types';

/**
 * The letter wall (F-ROUTE-001 R-7c, section 3.11; wireframe
 * `design/wireframes/journey/my-route-overview.md` B): the Stage 1 symbols in
 * teaching order, shown when Stage 1 is open. A symbol is lit when a finished
 * quest teaches it (the union of `questTeaches` over the done quests) and
 * outlined when the level check covered it. The stored result keeps no symbol
 * list, so "covered" is the `teaches` of the placed-out quests the row draws as
 * known. Every Stage 1 quest is open, so play need not follow the teaching
 * order: one finished later quest lights only its own letters, never the
 * letters before it (for in-order play this equals `symbolsMetThrough`).
 *
 * Two spellings meet here: the bundle's Discover steps name jamo ids
 * (`questTeaches`, `jamo:nieun-batchim`), the route catalogue names symbol
 * keys (`RouteQuest.teaches`, `ㄴ/final`). `jamoIdToSymbolKey` joins them.
 * Pure: no React, no store, no clock.
 */

export type LetterState = 'met' | 'known' | 'ahead';

export type WallJamo = Pick<Jamo, 'id' | 'char' | 'kind' | 'romanization'>;

export interface LetterTile {
  /** The catalogue's symbol key: the letter, or `<letter>/final` for a final consonant. */
  key: string;
  jamoId: string;
  char: string;
  romanization: string;
  /** A final consonant (batchim): drawn with the "at the end" gloss so it never reads as the first letter. */
  final: boolean;
  state: LetterState;
}

/** The symbol key the route catalogue spells for a jamo (`catalog/data.ts` `teaches`). */
export const symbolKeyOf = (jamo: Pick<Jamo, 'char' | 'kind'>): string => (jamo.kind === 'batchim' ? `${jamo.char}/final` : jamo.char);

/** The adapter from a bundle jamo id to a catalogue symbol key; `undefined` for an id the jamo list lacks. */
export function jamoIdToSymbolKey(jamoId: string, jamo: readonly WallJamo[]): string | undefined {
  const found = jamo.find((j) => j.id === jamoId);
  return found === undefined ? undefined : symbolKeyOf(found);
}

export interface LetterWallInput {
  /** The Stage 1 row of `buildMyRoute`: its done and known quest pips. */
  row: Pick<StageRow, 'pips' | 'newPips'>;
  /** The Stage 1 quests in teaching order (`STAGE1_QUESTS`). */
  quests: readonly Quest[];
  catalog: RouteCatalog;
  jamo: readonly WallJamo[];
}

/** Every Stage 1 symbol a Discover step teaches, in teaching order; empty when no quest has a Discover step. */
export function letterWallOf(i: LetterWallInput): LetterTile[] {
  const byId = new Map(i.jamo.map((j) => [j.id, j]));
  const pips = [...i.row.pips, ...i.row.newPips].filter((p) => p.kind === 'quest' && p.questId !== undefined);
  const done = new Set(pips.filter((p) => p.state === 'done').map((p) => p.questId));
  const knownQuests = new Set(pips.filter((p) => p.state === 'known').map((p) => p.questId));

  const met = new Set(i.quests.filter((q) => done.has(q.id)).flatMap(questTeaches));
  const covered = new Set(i.catalog.quests.filter((q) => knownQuests.has(q.id)).flatMap((q) => q.teaches));

  const seen = new Set<string>();
  const tiles: LetterTile[] = [];
  for (const jamoId of i.quests.flatMap(questTeaches)) {
    const jamo = byId.get(jamoId);
    if (jamo === undefined || seen.has(jamoId)) continue;
    seen.add(jamoId);
    const key = symbolKeyOf(jamo);
    const state: LetterState = met.has(jamoId) ? 'met' : covered.has(key) ? 'known' : 'ahead';
    tiles.push({ key, jamoId, char: jamo.char, romanization: jamo.romanization, final: jamo.kind === 'batchim', state });
  }
  return tiles;
}

/**
 * The width of one wall tile at the effective text size (`useEffectiveFontScale()`: OS x the Display step):
 * the base width at 1x and wider in step with larger text, so a grown letter chip never
 * spills into the next tile; the row then wraps to fewer tiles across. Never narrower
 * than the base, and a missing or broken scale reads as 1x.
 */
export function letterTileWidth(base: number, fontScale = 1): number {
  const scale = Number.isFinite(fontScale) ? Math.max(fontScale, 1) : 1;
  return Math.ceil(base * scale);
}

export interface LetterTileView {
  key: string;
  ko: string;
  romanization: string;
  /** "at the end" for a final consonant; none for a first letter or a vowel. */
  gloss: string | undefined;
  state: LetterState;
  a11yLabel: string;
}

export interface LetterWallView {
  title: string;
  lead: string;
  /** One line per state the wall shows, in the order met, known, ahead. */
  legend: { state: LetterState; word: string }[];
  tiles: LetterTileView[];
}

const STATES: readonly LetterState[] = ['met', 'known', 'ahead'];

/** The words of the wall; null when there is nothing to draw (no Discover step in the bundle). */
export function letterWallView(tiles: readonly LetterTile[], messages: Messages): LetterWallView | null {
  if (tiles.length === 0) return null;
  const m = messages.learner.myRoute.wall;
  const present = new Set(tiles.map((t) => t.state));
  return {
    title: m.title,
    lead: m.lead,
    legend: STATES.filter((s) => present.has(s)).map((state) => ({ state, word: m.state[state] })),
    tiles: tiles.map((t) => {
      const gloss = t.final ? m.final : undefined;
      const sound = gloss === undefined ? t.romanization : `${t.romanization}, ${gloss}`;
      return {
        key: t.key,
        ko: t.char,
        romanization: t.romanization,
        gloss,
        state: t.state,
        a11yLabel: messages.a11y.myRoute.letter(t.char, sound, m.state[t.state]),
      };
    }),
  };
}

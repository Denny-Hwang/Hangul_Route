import { describe, expect, it } from 'vitest';
import { CATALOG as SHARED_CATALOG, routeCatalogOf, type RouteCatalog, type RouteQuest } from '@hangul-route/content-schema';
import { getMessages } from '@hangul-route/i18n';
import { jamoAll } from '../../../content';
import { STAGE1_QUESTS, questTeaches } from '../../stage1/curriculum';
import { discoverQuest } from '../../stage1/__tests__/fixtures';
import {
  jamoIdToSymbolKey,
  letterWallOf,
  letterWallView,
  symbolKeyOf,
  type LetterTile,
  type WallJamo,
} from '../letter-wall';
import type { Pip, PipState } from '../types';

/**
 * The letter wall (F-ROUTE-001 R-7c, section 3.11): lit when met
 * (`symbolsMetThrough` the furthest finished Stage 1 quest), outlined when a
 * placed-out quest's catalogue `teaches` covers it, and the jamo-id to
 * symbol-key adapter that joins the two spellings.
 */

const EN = getMessages('en');
/** The shared route catalogue: its `teaches` spell symbol keys (the app's own route catalogue leaves them empty). */
const SHARED = routeCatalogOf(SHARED_CATALOG);

const JAMO: WallJamo[] = [
  { id: 'jamo:a', char: 'ㅏ', kind: 'vowel', romanization: 'a' },
  { id: 'jamo:eo', char: 'ㅓ', kind: 'vowel', romanization: 'eo' },
  { id: 'jamo:giyeok', char: 'ㄱ', kind: 'consonant', romanization: 'g/k' },
  { id: 'jamo:nieun', char: 'ㄴ', kind: 'consonant', romanization: 'n' },
  { id: 'jamo:o', char: 'ㅗ', kind: 'vowel', romanization: 'o' },
  { id: 'jamo:nieun-batchim', char: 'ㄴ', kind: 'batchim', romanization: 'n' },
  { id: 'jamo:u', char: 'ㅜ', kind: 'vowel', romanization: 'u' },
  { id: 'jamo:i', char: 'ㅣ', kind: 'vowel', romanization: 'i' },
];

const q1 = discoverQuest('quest:one', ['jamo:a', 'jamo:eo', 'jamo:giyeok', 'jamo:nieun']);
const q2 = discoverQuest('quest:two', ['jamo:o', 'jamo:nieun-batchim']);
const q3 = discoverQuest('quest:three', []); // reads words only: teaches nothing new
const q4 = discoverQuest('quest:four', ['jamo:u', 'jamo:i']);
const QUESTS = [q1, q2, q3, q4];

const routeQuest = (id: string, order: number, teaches: string[]): RouteQuest => ({
  id,
  episodeId: 'episode:stage1-letters',
  stage: 'stage1',
  theme: 'letters',
  order,
  teaches,
  playable: true,
  grid: true,
});

const FIXTURE_CATALOG: RouteCatalog = {
  quests: [
    routeQuest('quest:one', 1, ['ㅏ', 'ㅓ', 'ㄱ', 'ㄴ']),
    routeQuest('quest:two', 2, ['ㅗ', 'ㄴ/final']),
    routeQuest('quest:three', 3, []),
    routeQuest('quest:four', 4, ['ㅜ', 'ㅣ']),
  ],
};

const pip = (questId: string, state: PipState): Pip => ({ key: questId, kind: 'quest', questId, state, isCursor: false, isStart: false });
const rowOf = (states: Record<string, PipState>, newPips: Pip[] = []) => ({
  pips: QUESTS.map((q) => pip(q.id, states[q.id] ?? 'open')),
  newPips,
});
const wall = (states: Record<string, PipState>, newPips: Pip[] = []): LetterTile[] =>
  letterWallOf({ row: rowOf(states, newPips), quests: QUESTS, catalog: FIXTURE_CATALOG, jamo: JAMO });
const stateOf = (tiles: readonly LetterTile[]): Record<string, string> => Object.fromEntries(tiles.map((t) => [t.key, t.state]));

describe('jamoIdToSymbolKey', () => {
  it('spells a letter as itself and a final consonant as <letter>/final', () => {
    expect(jamoIdToSymbolKey('jamo:a', JAMO)).toBe('ㅏ');
    expect(jamoIdToSymbolKey('jamo:nieun', JAMO)).toBe('ㄴ');
    expect(jamoIdToSymbolKey('jamo:nieun-batchim', JAMO)).toBe('ㄴ/final');
    expect(symbolKeyOf({ char: 'ㄱ', kind: 'batchim' })).toBe('ㄱ/final');
  });

  it('returns undefined for an id the jamo list lacks', () => {
    expect(jamoIdToSymbolKey('jamo:ghost', JAMO)).toBeUndefined();
  });

  it('maps every shipped jamo to a distinct symbol key: 24 letters and 6 finals', () => {
    const keys = jamoAll.map((j) => jamoIdToSymbolKey(j.id, jamoAll));
    expect(keys.every((k) => k !== undefined)).toBe(true);
    expect(new Set(keys).size).toBe(30);
    expect(keys.filter((k) => k?.endsWith('/final'))).toHaveLength(6);
  });

  it('turns every shipped Stage 1 Discover step into the catalogue teaches of its quest', () => {
    const byId = new Map(SHARED.quests.map((q) => [q.id, q]));
    for (const quest of STAGE1_QUESTS) {
      expect(questTeaches(quest).map((id) => jamoIdToSymbolKey(id, jamoAll)), quest.id).toEqual(byId.get(quest.id)?.teaches);
    }
  });
});

describe('letterWallOf', () => {
  it('lists every taught symbol once, in teaching order, all ahead before anything is done', () => {
    const tiles = wall({});
    expect(tiles.map((t) => t.key)).toEqual(['ㅏ', 'ㅓ', 'ㄱ', 'ㄴ', 'ㅗ', 'ㄴ/final', 'ㅜ', 'ㅣ']);
    expect(tiles.every((t) => t.state === 'ahead')).toBe(true);
    expect(tiles.find((t) => t.key === 'ㄴ/final')).toEqual({
      key: 'ㄴ/final',
      jamoId: 'jamo:nieun-batchim',
      char: 'ㄴ',
      romanization: 'n',
      final: true,
      state: 'ahead',
    });
    expect(tiles.find((t) => t.key === 'ㄴ')?.final).toBe(false);
  });

  it('lights what the furthest finished quest and the quests before it teach', () => {
    expect(stateOf(wall({ 'quest:one': 'done' }))).toEqual({ ㅏ: 'met', ㅓ: 'met', ㄱ: 'met', ㄴ: 'met', ㅗ: 'ahead', 'ㄴ/final': 'ahead', ㅜ: 'ahead', ㅣ: 'ahead' });
    // A word-reading quest further on reads every letter taught before it.
    const tiles = wall({ 'quest:three': 'done' });
    expect(tiles.filter((t) => t.state === 'met').map((t) => t.key)).toEqual(['ㅏ', 'ㅓ', 'ㄱ', 'ㄴ', 'ㅗ', 'ㄴ/final']);
    expect(wall({ 'quest:four': 'done' }).every((t) => t.state === 'met')).toBe(true);
  });

  it('outlines the catalogue teaches of the quests the level check placed out', () => {
    expect(stateOf(wall({ 'quest:one': 'known', 'quest:two': 'known' }))).toEqual({
      ㅏ: 'known',
      ㅓ: 'known',
      ㄱ: 'known',
      ㄴ: 'known',
      ㅗ: 'known',
      'ㄴ/final': 'known',
      ㅜ: 'ahead',
      ㅣ: 'ahead',
    });
  });

  it('a lit letter wins over an outlined one; a quest that joined a latched stage counts too', () => {
    const tiles = wall({ 'quest:one': 'known', 'quest:two': 'done' });
    expect(tiles.every((t) => t.key === 'ㅜ' || t.key === 'ㅣ' ? t.state === 'ahead' : t.state === 'met')).toBe(true);
    const joined = letterWallOf({
      row: { pips: [pip('quest:one', 'done')], newPips: [pip('quest:four', 'known')] },
      quests: QUESTS,
      catalog: FIXTURE_CATALOG,
      jamo: JAMO,
    });
    expect(stateOf(joined)).toMatchObject({ ㅏ: 'met', ㅗ: 'ahead', ㅜ: 'known', ㅣ: 'known' });
  });

  it('ignores cell pips, open and later pips, ids missing from the catalogue and jamo ids the list lacks', () => {
    const tiles = letterWallOf({
      row: {
        pips: [{ key: 'cell:x', kind: 'cell', state: 'known', isCursor: false, isStart: false }, pip('quest:one', 'open'), pip('quest:ghost', 'known')],
        newPips: [],
      },
      quests: [...QUESTS, discoverQuest('quest:odd', ['jamo:unknown'])],
      catalog: FIXTURE_CATALOG,
      jamo: JAMO,
    });
    expect(tiles).toHaveLength(8);
    expect(tiles.every((t) => t.state === 'ahead')).toBe(true);
  });

  it('is empty when no quest has a Discover step', () => {
    expect(letterWallOf({ row: rowOf({}), quests: [q3], catalog: FIXTURE_CATALOG, jamo: JAMO })).toEqual([]);
    expect(letterWallOf({ row: rowOf({}), quests: [], catalog: FIXTURE_CATALOG, jamo: JAMO })).toEqual([]);
  });

  it('on the shipped bundle draws the 30 Stage 1 symbols, lit or outlined from the route catalogue', () => {
    const pips = STAGE1_QUESTS.map((q, i) => pip(q.id, i < 6 ? 'known' : 'open'));
    const tiles = letterWallOf({ row: { pips, newPips: [] }, quests: STAGE1_QUESTS, catalog: SHARED, jamo: jamoAll });
    expect(tiles).toHaveLength(30);
    expect(new Set(tiles.map((t) => t.key)).size).toBe(30);
    const known = new Set(SHARED.quests.filter((q) => STAGE1_QUESTS.slice(0, 6).some((s) => s.id === q.id)).flatMap((q) => q.teaches));
    expect(known.size).toBeGreaterThan(0);
    for (const t of tiles) expect(t.state, t.key).toBe(known.has(t.key) ? 'known' : 'ahead');
    const last = STAGE1_QUESTS[STAGE1_QUESTS.length - 1];
    const allMet = letterWallOf({ row: { pips: [pip(last?.id ?? '', 'done')], newPips: [] }, quests: STAGE1_QUESTS, catalog: SHARED, jamo: jamoAll });
    expect(allMet.every((t) => t.state === 'met')).toBe(true);
  });
});

describe('letterWallView', () => {
  it('draws nothing for an empty wall', () => {
    expect(letterWallView([], EN)).toBeNull();
  });

  it('carries the title, the lead and a legend line only for the states the wall shows', () => {
    const view = letterWallView(wall({ 'quest:one': 'done' }), EN);
    expect(view?.title).toBe(EN.learner.myRoute.wall.title);
    expect(view?.lead).toBe(EN.learner.myRoute.wall.lead);
    expect(view?.legend).toEqual([
      { state: 'met', word: EN.learner.myRoute.wall.state.met },
      { state: 'ahead', word: EN.learner.myRoute.wall.state.ahead },
    ]);
    expect(letterWallView(wall({ 'quest:one': 'known', 'quest:four': 'done' }), EN)?.legend.map((l) => l.state)).toEqual(['met']);
    expect(letterWallView(wall({ 'quest:one': 'known' }), EN)?.legend.map((l) => l.state)).toEqual(['known', 'ahead']);
  });

  it('gives a final consonant the "at the end" gloss and reads every tile with its sound and state', () => {
    const view = letterWallView(wall({ 'quest:one': 'done', 'quest:two': 'known' }), EN);
    const first = view?.tiles[0];
    expect(first).toEqual({
      key: 'ㅏ',
      ko: 'ㅏ',
      romanization: 'a',
      gloss: undefined,
      state: 'met',
      a11yLabel: EN.a11y.myRoute.letter('ㅏ', 'a', EN.learner.myRoute.wall.state.met),
    });
    const final = view?.tiles.find((t) => t.key === 'ㄴ/final');
    expect(final?.gloss).toBe(EN.learner.myRoute.wall.final);
    expect(final?.a11yLabel).toBe(EN.a11y.myRoute.letter('ㄴ', `n, ${EN.learner.myRoute.wall.final}`, EN.learner.myRoute.wall.state.known));
    expect(final?.a11yLabel).toBe('ㄴ, n, at the end. Already known.');
  });
});

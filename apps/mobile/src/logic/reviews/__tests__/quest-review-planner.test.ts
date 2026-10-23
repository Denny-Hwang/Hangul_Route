import type { MemoryItemState } from '@hangul-route/content-schema';
import type { ReviewItem } from '@hangul-route/content-schema/review-items';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { episodesAll } from '../../../content/episodes';
import { useAudioStore } from '../../../store/audio-store';
import { resetRemoteConfigForTests } from '../../../store/remote-config-store';
import type { MemoryRow } from '../../memory/memory-file';
import { localDay } from '../../vocab/progress';
import { earlierInRoute, glossFor, planQuestTryAgain, planQuestWarmup, routeCellRanks, type ReviewInputs } from '../quest-review-planner';
import type { ReviewItemIndex } from '../review-items-store';

vi.mock('../../../platform/storage', () => ({
  readJson: vi.fn(async () => null),
  readJsonStrict: vi.fn(async () => null),
  readJsonExact: vi.fn(async () => null),
  writeJson: vi.fn(async () => undefined),
  updateJson: vi.fn(async () => true),
  removeKey: vi.fn(async () => undefined),
  listKeys: vi.fn(async () => []),
  setWriteFence: vi.fn(),
}));
vi.mock('../../../platform/telemetry', () => ({ track: vi.fn(async () => true) }));
vi.mock('../../../platform/locale', () => ({ deviceLanguages: () => [], takeLangHandoff: () => null, setDocumentLang: vi.fn() }));
vi.mock('../../../platform/profiles-channel', () => ({ postProfilesChanged: () => undefined, subscribeProfilesChanged: () => () => undefined }));
vi.mock('../../../platform/app-visibility', () => ({ subscribeAppVisibility: () => () => undefined, isAppVisible: () => true }));
vi.mock('../../../platform/app-root', () => ({ peekBootIntent: () => null, consumeBootIntent: () => undefined }));

/**
 * F-CURR-002 section 4.5 (row CM-15): the planner in the memory store's chunk reads the learner's stored rows and
 * this build's review items, and plans the warm-up and Try these again in the UI language.
 */

const today = localDay(new Date());
const stage3 = episodesAll.find((e) => e.stage === 'stage3')!;

function mk(id: string, over: Partial<ReviewItem> = {}): ReviewItem {
  return {
    id,
    kind: 'lex',
    ko: id.slice(4),
    romanization: id.slice(4),
    en: `en-${id.slice(4)}`,
    home: 'rites',
    stage: 2,
    volume: 1,
    cells: ['episode:stage2-rites'],
    asked: [],
    formats: ['hear-pick', 'read-pick'],
    soundChange: false,
    homophoneOf: [],
    ...over,
  };
}
const index = (items: ReviewItem[]): ReviewItemIndex => ({ items, byId: new Map(items.map((i) => [i.id, i])), retired: new Set(), retiredById: new Map() });
const row = (over: Partial<MemoryItemState> = {}): MemoryRow => ({ sh: 'stage2', st: { b: 2, d: today, c: 1, r: 3, n: 2, f: '2026-10-01', s: 2, at: '2026-10-01T09:00:00.000Z', ...over } });
const words = ['lex:mul', 'lex:bap', 'lex:cha', 'lex:kong'].map((id) => mk(id));

beforeEach(() => {
  resetRemoteConfigForTests();
  useAudioStore.setState({ muted: true });
});

describe('glossFor', () => {
  it('reads the English as authored, and another language from the overlay its gloss key names (none when it is not loaded)', () => {
    const item = mk('lex:mul', { glossKey: 'quest:x#discover.pages[0].items[0].word.gloss' });
    const overlays = { es: { 'quest:x': { 'discover.pages[0].items[0].word.gloss': 'agua' } }, ko: {} };
    expect(glossFor('en', overlays)(item)).toBe('en-mul');
    expect(glossFor('es', overlays)(item)).toBe('agua');
    expect(glossFor('ko', overlays)(item)).toBeUndefined();
    expect(glossFor('es', overlays)(mk('lex:bap'))).toBeUndefined();
  });
});

describe('planning from the store', () => {
  const read =
    (rows: Record<string, MemoryRow> | null): ReviewInputs =>
    async () =>
      rows === null ? null : { index: index(words), rows };

  it('the warm-up asks the due items from earlier cells; none when nothing is due, or when the store cannot be read', async () => {
    // At recognize (c = 0): with no voice these are read instead.
    const due = Object.fromEntries(words.map((w) => [w.id, row({ c: 0, r: 0 })]));
    const warm = await planQuestWarmup(read(due), { profileId: 'profile:a', episodeId: stage3.id, locale: 'en' });
    expect(warm?.kind).toBe('warmup');
    expect(warm?.rounds.length).toBe(3);
    // Muted: no voice, so every round is read and the sound notice shows.
    expect(warm?.rounds.every((r) => r.mode === 'see')).toBe(true);
    expect(warm?.soundNotice).toBe(true);
    const later = Object.fromEntries(words.map((w) => [w.id, row({ d: '2999-01-01' })]));
    expect(await planQuestWarmup(read(later), { profileId: 'profile:a', episodeId: stage3.id, locale: 'en' })).toBeNull();
    expect(await planQuestWarmup(read(null), { profileId: 'profile:a', episodeId: stage3.id, locale: 'en' })).toBeNull();
  });

  it('Try these again asks the items the play missed, read from what its rounds asked', async () => {
    const met = Object.fromEntries(words.map((w) => [w.id, row({ d: '2999-01-01' })]));
    const again = await planQuestTryAgain(read(met), { profileId: 'profile:a', episodeId: stage3.id, locale: 'en', missed: [{ texts: ['cha'] }, { texts: ['none'] }] });
    expect(again?.rounds.map((r) => r.itemId)).toEqual(['lex:cha']);
    expect(await planQuestTryAgain(read(met), { profileId: 'profile:a', episodeId: stage3.id, locale: 'en', missed: [] })).toBeNull();
  });
});

describe('the warm-up draws from earlier cells in route order (section 4.3, the CM-13 decision record)', () => {
  // The Stage 2 grid cells in route order: a replay of one never warms up with what a later one taught.
  const ranks = routeCellRanks();
  const stage2 = [...ranks.keys()].filter((cell) => episodesAll.find((e) => e.id === cell)?.stage === 'stage2');
  const [first, quest, last] = [stage2[0]!, stage2[1]!, stage2[stage2.length - 1]!];

  it('the route holds several Stage 2 cells, in order', () => {
    expect(stage2.length).toBeGreaterThanOrEqual(3);
    expect(ranks.get(first)! < ranks.get(quest)!).toBe(true);
    expect(ranks.get(quest)! < ranks.get(last)!).toBe(true);
  });

  it('a due item taught by a later cell of the same stage is never asked; one from an earlier cell of that stage is', async () => {
    const earlier = Array.from({ length: 2 }, (_, i) => mk(`lex:early${i}`, { cells: [first] }));
    const later = Array.from({ length: 3 }, (_, i) => mk(`lex:later${i}`, { cells: [last] }));
    const items = [...earlier, ...later];
    const rows = Object.fromEntries(items.map((w) => [w.id, row({ c: 0, r: 0 })]));
    const read: ReviewInputs = async () => ({ index: index(items), rows });
    const warm = await planQuestWarmup(read, { profileId: 'profile:a', episodeId: quest, locale: 'en' });
    expect(warm?.rounds.map((r) => r.itemId).sort()).toEqual(earlier.map((i) => i.id).sort());
    // From the last Stage 2 cell the first cell's items are earlier, and its own items are left to its steps.
    const fromLast = await planQuestWarmup(read, { profileId: 'profile:a', episodeId: last, locale: 'en' });
    expect(fromLast?.rounds.map((r) => r.itemId).sort()).toEqual(earlier.map((i) => i.id).sort());
    // From the first Stage 2 cell nothing came before it in Stage 2, so nothing is asked.
    expect(await planQuestWarmup(read, { profileId: 'profile:a', episodeId: first, locale: 'en' })).toBeNull();
  });

  it('a cell off the route counts by its stage; a quest off the route keeps the engine’s stage rule', () => {
    const stages: Record<string, number> = { 'story:low': 1, 'story:high': 5 };
    const earlier = earlierInRoute(quest, 2, ranks, (cell) => stages[cell] ?? 0);
    expect(earlier?.(first)).toBe(true);
    expect(earlier?.(last)).toBe(false);
    expect(earlier?.('story:low')).toBe(true);
    expect(earlier?.('story:high')).toBe(false);
    expect(earlier?.('story:unknown')).toBe(false);
    expect(earlierInRoute('story:off-route', 2, ranks)).toBeUndefined();
  });
});

import type { MemoryItemState } from '@hangul-route/content-schema';
import type { ReviewItem } from '@hangul-route/content-schema/review-items';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { episodesAll } from '../../../content/episodes';
import { useAudioStore } from '../../../store/audio-store';
import { resetRemoteConfigForTests } from '../../../store/remote-config-store';
import type { MemoryRow } from '../../memory/memory-file';
import { localDay } from '../../vocab/progress';
import { glossFor, planQuestTryAgain, planQuestWarmup, type ReviewInputs } from '../quest-review-planner';
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

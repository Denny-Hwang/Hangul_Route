import type { OverlayLocale, Overlays, QuestStep } from '@hangul-route/content-schema';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { MinigameScope } from '../../minigame-config';
import { StoryChunkMismatch, StoryChunkTimeout } from '../../story/story-chunk-store';
import {
  LessonChunkMismatch,
  LessonChunkTimeout,
  cellOfScopeRef,
  isNewBuildError,
  createLessonStore,
  mergeOverlaysInto,
  questsOverStore,
  type LessonCellChunk,
  type LessonManifest,
  type LessonTitleChunk,
} from '../lesson-store';

const REF = 'minigame:s2-rites-q1-practice';
const scope: MinigameScope = { kind: 'card-match', rounds: 1, cardPairs: [{ ko: '연', romanization: 'yeon', en: 'kite' }] };
const steps: QuestStep[] = [{ id: 's1', kind: 'intro', titleEn: 'Hello', durationSeconds: 8 }];

const manifest: LessonManifest = {
  episodes: [
    { id: 'episode:stage2-rites', questIds: ['quest:stage2-rites-q1', 'quest:stage2-rites-q2'] },
    { id: 'episode:stage3-life', questIds: ['quest:stage3-life-q1'] },
    // Not in `cells`: a hand-written episode never maps a quest to a chunk.
    { id: 'episode:stage1-letters', questIds: ['quest:stage1-letters-q1'] },
  ],
  cells: { 'episode:stage2-rites': 'h-rites', 'episode:stage3-life': 'h-life' },
  titles: { es: 'h-es', ko: 'h-ko' },
};

const rites: LessonCellChunk = {
  CHUNK_HASH: 'h-rites',
  LESSON_STEPS: { 'quest:stage2-rites-q1': steps, 'quest:stage2-rites-q2': steps },
  LESSON_SCOPES: { [REF]: scope },
  LESSON_OVERLAYS: { es: { [REF]: { 'cardPairs.yeon.gloss': 'cometa' } }, ko: {} },
};
const life: LessonCellChunk = { CHUNK_HASH: 'h-life', LESSON_STEPS: { 'quest:stage3-life-q1': steps }, LESSON_SCOPES: {}, LESSON_OVERLAYS: { es: {}, ko: {} } };
const titles = (locale: OverlayLocale): LessonTitleChunk => ({ CHUNK_HASH: `h-${locale}`, LESSON_TITLE_OVERLAYS: { 'quest:stage2-rites-q1': { title: locale === 'es' ? 'Fiesta' : '명절' } } });

/** A loader that records what it was asked for and resolves on `flush`, so a test sees the in-flight state. */
function loaders(chunks: Record<string, LessonCellChunk> = { 'episode:stage2-rites': rites, 'episode:stage3-life': life }) {
  const asked: string[] = [];
  const failNext = new Set<string>();
  return {
    asked,
    failNext,
    cell: (id: string): Promise<LessonCellChunk> | undefined => {
      asked.push(id);
      const mod = chunks[id];
      if (mod === undefined) return undefined;
      return failNext.delete(id) ? Promise.reject(new Error(`offline: ${id}`)) : Promise.resolve(mod);
    },
    titles: (locale: OverlayLocale): Promise<LessonTitleChunk> => {
      asked.push(`titles-${locale}`);
      return failNext.delete(`titles-${locale}`) ? Promise.reject(new Error('offline')) : Promise.resolve(titles(locale));
    },
  };
}

describe('createLessonStore (F-CURR-002 §10: chunks load on demand, once each)', () => {
  it('loads nothing at start; a quest loads its own cell only, once', async () => {
    const load = loaders();
    const store = createLessonStore(manifest, load);
    expect(load.asked).toEqual([]);
    expect(store.isQuestReady('quest:stage2-rites-q1')).toBe(false);
    expect(store.stepsOf('quest:stage2-rites-q1')).toBeUndefined();
    expect(store.scopeFor(REF)).toBeUndefined();

    const cell = store.cellOfQuest('quest:stage2-rites-q1');
    expect(cell).toBe('episode:stage2-rites');
    const a = store.ensureCells([cell as string]);
    const b = store.ensureCells([cell as string]);
    await Promise.all([a, b]);
    await store.ensureCells(['episode:stage2-rites']);
    expect(load.asked).toEqual(['episode:stage2-rites']);
    expect(store.isQuestReady('quest:stage2-rites-q2')).toBe(true);
    expect(store.isQuestReady('quest:stage3-life-q1')).toBe(false);
    expect(store.stepsOf('quest:stage2-rites-q1')).toBe(steps);
    expect(store.scopeFor(REF)).toBe(scope);
    expect(store.loadedScopes()).toEqual({ [REF]: scope });
    expect(store.isAllReady()).toBe(false);
  });

  it('a quest outside the manifest is always ready and never loads anything', async () => {
    const load = loaders();
    const store = createLessonStore(manifest, load);
    expect(store.cellOfQuest('quest:stage1-letters-q1')).toBeUndefined();
    expect(store.isQuestReady('quest:stage1-letters-q1')).toBe(true);
    expect(store.stepsOf('quest:stage1-letters-q1')).toBeUndefined();
    await store.ensureCells(['episode:stage1-letters', 'episode:nope']);
    expect(store.scopeFor('minigame:s1-letters-q1-check')).toBeUndefined();
    expect(store.scopeFor('minigame:s6-life-q1-apply')).toBeUndefined();
    expect(load.asked).toEqual([]);
  });

  it('ensureAll loads every cell; subscribers hear each load', async () => {
    const load = loaders();
    const store = createLessonStore(manifest, load);
    let heard = 0;
    const off = store.subscribe(() => {
      heard += 1;
    });
    const before = store.version();
    await store.ensureAll();
    expect(store.isAllReady()).toBe(true);
    expect(load.asked.sort()).toEqual(['episode:stage2-rites', 'episode:stage3-life']);
    expect(heard).toBe(2);
    expect(store.version()).toBe(before + 2);
    off();
    await store.ensureAll();
    expect(heard).toBe(2);
  });

  it('a failed load is reported and retried by the next ensure', async () => {
    const load = loaders();
    const store = createLessonStore(manifest, load);
    load.failNext.add('episode:stage3-life');
    await expect(store.ensureCells(['episode:stage3-life'])).rejects.toThrow('offline: episode:stage3-life');
    expect(store.isQuestReady('quest:stage3-life-q1')).toBe(false);
    await store.ensureCells(['episode:stage3-life']);
    expect(store.isQuestReady('quest:stage3-life-q1')).toBe(true);
    expect(load.asked).toEqual(['episode:stage3-life', 'episode:stage3-life']);
  });

  it('a chunk carrying another hash than the manifest names is refused (a shell never reads another build)', async () => {
    const load = loaders({ 'episode:stage2-rites': { ...rites, CHUNK_HASH: 'h-other' } });
    const store = createLessonStore(manifest, load);
    const failed = store.ensureCells(['episode:stage2-rites']);
    await expect(failed).rejects.toBeInstanceOf(LessonChunkMismatch);
    await expect(failed).rejects.toThrow('lesson chunk episode:stage2-rites carries h-other, the manifest names h-rites');
    expect(store.isQuestReady('quest:stage2-rites-q1')).toBe(false);
  });

  it('a manifest cell with no loader rejects', async () => {
    const store = createLessonStore(manifest, loaders({}));
    await expect(store.ensureCells(['episode:stage2-rites'])).rejects.toThrow('no loader for the lesson chunk of episode:stage2-rites');
  });

  it('titles load for the active locale only; English loads none; a failed title load settles to English', async () => {
    const load = loaders();
    const store = createLessonStore(manifest, load);
    expect(store.titlesSettled('en')).toBe(true);
    await store.ensureTitles('en');
    expect(load.asked).toEqual([]);
    expect(store.titlesSettled('es')).toBe(false);
    await Promise.all([store.ensureTitles('es'), store.ensureTitles('es')]);
    await store.ensureTitles('es');
    expect(load.asked).toEqual(['titles-es']);
    expect(store.titlesSettled('es')).toBe(true);
    expect(store.titlesSettled('ko')).toBe(false);

    load.failNext.add('titles-ko');
    await expect(store.ensureTitles('ko')).rejects.toThrow('offline');
    expect(store.titlesSettled('ko')).toBe(true);
    await store.ensureTitles('ko');
    expect(load.asked).toEqual(['titles-es', 'titles-ko', 'titles-ko']);

    const wrong = createLessonStore({ ...manifest, titles: { es: 'h-new', ko: 'h-ko' } }, loaders());
    await expect(wrong.ensureTitles('es')).rejects.toBeInstanceOf(LessonChunkMismatch);
  });

  it('onOverlays replays the glosses loaded so far, then each new chunk; titles land under their own locale', async () => {
    const store = createLessonStore(manifest, loaders());
    await store.ensureCells(['episode:stage2-rites']);
    const into = { es: {}, ko: {} } as { es: Record<string, Record<string, string>>; ko: Record<string, Record<string, string>> };
    const seen: Overlays[] = [];
    const off = store.onOverlays((o) => {
      seen.push(o);
      mergeOverlaysInto(into, o);
    });
    expect(seen).toEqual([rites.LESSON_OVERLAYS]);
    await store.ensureTitles('ko');
    expect(into.ko).toEqual({ 'quest:stage2-rites-q1': { title: '명절' } });
    // Field by field: a quest's title (title chunk) and its step glosses (cell chunk) sit side by side.
    mergeOverlaysInto(into, { es: {}, ko: { 'quest:stage2-rites-q1': { 'steps.s1.title': '안녕' } } });
    expect(into.ko).toEqual({ 'quest:stage2-rites-q1': { title: '명절', 'steps.s1.title': '안녕' } });
    expect(into.es).toEqual({ [REF]: { 'cardPairs.yeon.gloss': 'cometa' } });
    off();
    await store.ensureTitles('es');
    expect(seen).toHaveLength(2);
  });
});

describe('questsOverStore', () => {
  it('gives each header steps that read the store: none before its cell loads, the chunk after', async () => {
    const store = createLessonStore(manifest, loaders());
    const [quest] = questsOverStore([{ id: 'quest:stage2-rites-q1', titleEn: 'Q1', estimatedMinutes: 4 }], store);
    expect(quest?.steps).toEqual([]);
    expect(quest?.titleEn).toBe('Q1');
    await store.ensureCells(['episode:stage2-rites']);
    expect(quest?.steps).toBe(steps);
    // A copy (localize, spreads) keeps the steps read at the time of the copy.
    expect({ ...quest }.steps).toBe(steps);
    expect(Object.keys(quest ?? {})).toContain('steps');
  });
});

describe('cellOfScopeRef', () => {
  it('maps a lesson minigame ref to its cell, and nothing else', () => {
    expect(cellOfScopeRef(REF)).toBe('episode:stage2-rites');
    expect(cellOfScopeRef('minigame:s7-crafts-q3-check')).toBe('episode:stage7-crafts');
    expect(cellOfScopeRef('minigame:s5-rites-q1-check')).toBeUndefined();
    expect(cellOfScopeRef('minigame:s1-letters-q1-check')).toBeUndefined();
    expect(cellOfScopeRef('minigame:story-read-listen-sun-and-moon')).toBeUndefined();
  });
});

describe('load timeout (a hung request fails into the retry path)', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('a cell or title load that does not settle in time rejects; the next ensure asks again and can succeed', async () => {
    vi.useFakeTimers();
    let hang = true;
    const asked: string[] = [];
    const store = createLessonStore(
      manifest,
      {
        cell: (id) => {
          asked.push(id);
          return hang ? new Promise<LessonCellChunk>(() => undefined) : Promise.resolve(rites);
        },
        titles: (locale) => {
          asked.push(`titles-${locale}`);
          return new Promise<LessonTitleChunk>(() => undefined);
        },
      },
      { timeoutMs: 15_000 },
    );
    const cell = store.ensureCells(['episode:stage2-rites']);
    const title = store.ensureTitles('ko');
    const cellFailed = expect(cell).rejects.toBeInstanceOf(LessonChunkTimeout);
    const titleFailed = expect(title).rejects.toThrow('lesson chunk titles-ko did not load within 15000 ms');
    vi.advanceTimersByTime(14_999);
    expect(store.titlesSettled('ko')).toBe(false);
    vi.advanceTimersByTime(1);
    await cellFailed;
    await titleFailed;
    expect(store.titlesSettled('ko')).toBe(true);
    expect(store.isQuestReady('quest:stage2-rites-q1')).toBe(false);
    hang = false;
    await store.ensureCells(['episode:stage2-rites']);
    expect(store.isQuestReady('quest:stage2-rites-q1')).toBe(true);
    expect(asked).toEqual(['episode:stage2-rites', 'titles-ko', 'episode:stage2-rites']);
  });

  it('a load that settles in time is untouched by the timer', async () => {
    vi.useFakeTimers();
    const store = createLessonStore(manifest, loaders(), { timeoutMs: 15_000 });
    await store.ensureCells(['episode:stage2-rites']);
    await store.ensureTitles('es');
    vi.advanceTimersByTime(20_000);
    expect(store.isQuestReady('quest:stage2-rites-q1')).toBe(true);
    expect(store.titlesSettled('es')).toBe(true);
  });
});

describe('isNewBuildError (a page older than its chunks: only a reload mends it)', () => {
  it('is a hash mismatch or a chunk that held no module (the app page served in its place)', () => {
    expect(isNewBuildError(new LessonChunkMismatch('episode:stage2-rites', 'a', 'b'))).toBe(true);
    expect(isNewBuildError(new Error('Requiring unknown module "812".'))).toBe(true);
    // A story chunk of another build (row CM-8) is the same case.
    expect(isNewBuildError(new StoryChunkMismatch('story:sun-and-moon', 'a', 'b'))).toBe(true);
  });

  it('is not a network failure, a timeout or anything else', () => {
    expect(isNewBuildError(new Error('Loading module /_expo/static/js/web/lessons-cell-stage2-rites-0a.js failed.'))).toBe(false);
    expect(isNewBuildError(new LessonChunkTimeout('episode:stage2-rites', 15_000))).toBe(false);
    expect(isNewBuildError(new StoryChunkTimeout('story:sun-and-moon', 15_000))).toBe(false);
    expect(isNewBuildError('Requiring unknown module "1"')).toBe(false);
    expect(isNewBuildError(undefined)).toBe(false);
  });
});

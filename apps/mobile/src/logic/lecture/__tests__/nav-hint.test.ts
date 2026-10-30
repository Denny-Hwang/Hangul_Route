import { CATALOG, LECTURE_PRESETS, LectureDeckSchema, PRESET_LENGTHS, presetDeck, resolvePreset, StageKeySchema, type PresetContext } from '@hangul-route/content-schema';
import { presenter } from '@hangul-route/design-system/tokens';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { episodesAll, gridEpisodes } from '../../../content';
import { lectureBundle } from '../content';
import { expandDeck } from '../deck-builder';
import {
  NAV_HINT_KEY,
  NAV_HINT_MAX_LESSONS,
  NAV_HINT_READ_BOUND_MS,
  claimNavHint,
  finishNavHint,
  navHintAfterShow,
  navHintDue,
  navHintKey,
  navHintStarts,
  parseNavHint,
  type NavHintStore,
} from '../nav-hint';

/**
 * A store in memory; `fail` makes its reads or writes reject, `hang` makes its reads never settle,
 * `hangWrite` makes its writes never settle (recorded, then stalled), `slowReadMs` delays each read.
 */
function memoryStore(
  initial: unknown = null,
  opts: { failRead?: boolean; failWrite?: boolean; hang?: boolean; hangWrite?: boolean; slowReadMs?: number } = {},
): NavHintStore & { value: unknown; writes: unknown[] } {
  const store = {
    value: initial,
    writes: [] as unknown[],
    readJson: async (key: string): Promise<unknown> => {
      expect(key).toBe(NAV_HINT_KEY);
      if (opts.hang) return new Promise<unknown>(() => undefined);
      if (opts.failRead) throw new Error('blocked');
      if (opts.slowReadMs) {
        const value = store.value;
        return new Promise<unknown>((resolve) => setTimeout(() => resolve(value), opts.slowReadMs));
      }
      return store.value;
    },
    writeJson: async (key: string, value: unknown): Promise<void> => {
      expect(key).toBe(NAV_HINT_KEY);
      if (opts.failWrite) throw new Error('blocked');
      store.writes.push(value);
      store.value = value;
      if (opts.hangWrite) return new Promise<void>(() => undefined);
    },
  };
  return store;
}

afterEach(() => {
  vi.useRealTimers();
});

describe('the start hint record (AMENDMENTS-PRESENTER-NAV section 9.3, O7)', () => {
  it('uses the key lecture:navHint and three lessons at most', () => {
    expect(NAV_HINT_KEY).toBe('lecture:navHint');
    expect(NAV_HINT_MAX_LESSONS).toBe(3);
  });

  it('reads only the four records; anything else is nothing stored', () => {
    for (const r of ['1', '2', '3', 'done']) expect(parseNavHint(r)).toBe(r);
    for (const r of [null, undefined, '', '0', '4', 'DONE', 1, 3, {}, ['1'], true]) expect(parseNavHint(r)).toBeNull();
  });

  it('is due until shown on three lessons or until done', () => {
    expect([null, '1', '2', '3', 'done'].map((r) => navHintDue(r as never))).toEqual([true, true, true, false, false]);
  });

  it('counts one lesson per show, and never past three or out of done', () => {
    expect(navHintAfterShow(null)).toBe('1');
    expect(navHintAfterShow('1')).toBe('2');
    expect(navHintAfterShow('2')).toBe('3');
    expect(navHintAfterShow('3')).toBe('3');
    expect(navHintAfterShow('done')).toBe('done');
  });

  it('says nav.hint on the docked bar and the rail, nav.hintOverlay in the overlay layout', () => {
    expect(navHintKey('docked')).toBe('hint');
    expect(navHintKey('rail')).toBe('hint');
    expect(navHintKey('overlay')).toBe('hintOverlay');
  });

  it('shows for 2 x presenter.autoHideMs (6 s); the presenter reads the token', () => {
    expect(2 * presenter.autoHideMs).toBe(6000);
  });
});

describe('claimNavHint and finishNavHint', () => {
  it('shows on three lessons, counting each, then never again', async () => {
    const store = memoryStore();
    const shown: boolean[] = [];
    for (let i = 0; i < 5; i += 1) shown.push(await claimNavHint(store));
    expect(shown).toEqual([true, true, true, false, false]);
    expect(store.writes).toEqual(['1', '2', '3']);
  });

  it('a button or swipe step writes done; the hint never shows after it', async () => {
    const store = memoryStore('1');
    await finishNavHint(store);
    expect(store.value).toBe('done');
    expect(await claimNavHint(store)).toBe(false);
    expect(store.writes).toEqual(['done']);
  });

  it('a damaged value counts as nothing stored', async () => {
    const store = memoryStore('{"shown":2}');
    expect(await claimNavHint(store)).toBe(true);
    expect(store.value).toBe('1');
  });

  it('a blocked store shows the hint on each lesson and never throws', async () => {
    const store = memoryStore(null, { failRead: true, failWrite: true });
    for (let i = 0; i < 5; i += 1) await expect(claimNavHint(store)).resolves.toBe(true);
    await expect(finishNavHint(store)).resolves.toBeUndefined();
    expect(store.writes).toEqual([]);
  });

  it('a read that never settles shows the hint after the bound and writes nothing', async () => {
    vi.useFakeTimers();
    const store = memoryStore(null, { hang: true });
    const claim = claimNavHint(store);
    await vi.advanceTimersByTimeAsync(NAV_HINT_READ_BOUND_MS);
    await expect(claim).resolves.toBe(true);
    expect(store.writes).toEqual([]);
  });

  it('a slow read of done shows the hint this once but leaves done stored (never back to 1)', async () => {
    vi.useFakeTimers();
    const store = memoryStore('done', { slowReadMs: NAV_HINT_READ_BOUND_MS * 2 });
    const claim = claimNavHint(store);
    await vi.advanceTimersByTimeAsync(NAV_HINT_READ_BOUND_MS);
    await expect(claim).resolves.toBe(true);
    await vi.advanceTimersByTimeAsync(NAV_HINT_READ_BOUND_MS * 2);
    expect(store.writes).toEqual([]);
    expect(store.value).toBe('done');
    vi.useRealTimers();
    expect(await claimNavHint(memoryStore('done'))).toBe(false);
  });

  it('a slow read of a count leaves the count as stored', async () => {
    vi.useFakeTimers();
    const store = memoryStore('2', { slowReadMs: NAV_HINT_READ_BOUND_MS * 2 });
    const claim = claimNavHint(store);
    await vi.advanceTimersByTimeAsync(NAV_HINT_READ_BOUND_MS * 3);
    await expect(claim).resolves.toBe(true);
    expect(store.value).toBe('2');
  });

  it('a store whose reads and writes never settle still shows the hint within the bound', async () => {
    vi.useFakeTimers();
    const store = memoryStore(null, { hang: true, hangWrite: true });
    const claim = claimNavHint(store);
    await vi.advanceTimersByTimeAsync(NAV_HINT_READ_BOUND_MS);
    await expect(claim).resolves.toBe(true);
  });

  it('a read that settles but a write that never does still shows the hint and counts the lesson', async () => {
    vi.useFakeTimers();
    const store = memoryStore(null, { hangWrite: true });
    const claim = claimNavHint(store);
    await vi.advanceTimersByTimeAsync(0);
    await expect(claim).resolves.toBe(true);
    expect(store.writes).toEqual(['1']);
  });

  it('a read past a done record keeps it done (nothing is written)', async () => {
    const store = memoryStore('done');
    expect(await claimNavHint(store)).toBe(false);
    expect(store.writes).toEqual([]);
  });
});

describe('navHintStarts: touch seen, the first slide of a lesson, and that slide a title', () => {
  it('needs all three', () => {
    const title = { kind: 'title' } as const;
    expect(navHintStarts({ touchSeen: true, slideIdx: 0, first: title })).toBe(true);
    expect(navHintStarts({ touchSeen: false, slideIdx: 0, first: title })).toBe(false);
    expect(navHintStarts({ touchSeen: true, slideIdx: 4, first: title })).toBe(false);
    expect(navHintStarts({ touchSeen: true, slideIdx: 0, first: { kind: 'letter' } })).toBe(false);
    expect(navHintStarts({ touchSeen: true, slideIdx: 0, first: undefined })).toBe(false);
  });

  /**
   * PN-0b accepted the pill at 568 x 320 because it covers only the slide counter on a title slide. Every
   * lesson of the grid (an episode deck) opens on its title; a ready-made lesson opens on its title when its
   * first block is a lesson or a story, and on letters or word cards otherwise (a warm-up, a word review),
   * where `navHintStarts` keeps the hint off. This pins both, so a builder change that moves a title is seen.
   */
  it('every grid lesson opens on its title slide', () => {
    const bundle = lectureBundle('en');
    let decks = 0;
    for (const episode of gridEpisodes(episodesAll)) {
      if (episode.status === 'preview' || episode.questIds.length === 0) continue;
      const deck = LectureDeckSchema.parse({ v: 1, id: 'lecture:hint00001', title: 'Hint', createdAt: '2026-10-29T09:00:00Z', seed: 1, blocks: [{ kind: 'episode', id: episode.id }] });
      const slides = expandDeck(deck, bundle, { canPlayKorean: true }).slides;
      decks += 1;
      expect(slides[0]!.kind, episode.id).toBe('title');
    }
    expect(decks).toBeGreaterThan(20);
  });

  it('a ready-made lesson shows the hint exactly when it opens on a title slide', () => {
    const bundle = lectureBundle('en');
    const meta = { id: 'lecture:hint00002', title: 'Hint', createdAt: '2026-10-29T09:00:00Z', seed: 7, source: 'quick' as const };
    const contexts: PresetContext[] = [{ catalog: CATALOG }, ...StageKeySchema.options.map((stage): PresetContext => ({ catalog: CATALOG, stage }))];
    const opensOn = new Map<string, Set<string>>();
    for (const preset of LECTURE_PRESETS) {
      for (const length of PRESET_LENGTHS[preset]) {
        for (const ctx of contexts) {
          const slides = expandDeck(LectureDeckSchema.parse(presetDeck(resolvePreset(preset, length, ctx), meta)), bundle, { canPlayKorean: true }).slides;
          const first = slides[0];
          expect(navHintStarts({ touchSeen: true, slideIdx: 0, first })).toBe(first?.kind === 'title');
          opensOn.set(preset, (opensOn.get(preset) ?? new Set()).add(first?.kind ?? 'none'));
        }
      }
    }
    // Every ready-made lesson opens on a title or on a slide with no content target near its top.
    for (const kinds of opensOn.values()) for (const kind of kinds) expect(['title', 'letter', 'syllable', 'vocab']).toContain(kind);
  });
});

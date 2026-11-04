import type { WeekDropEntry, WeekDropsChunk } from '@hangul-route/content-schema/week-drops';
import { describe, expect, it } from 'vitest';
import * as chunk from '../../../content/__generated__/week-drop-chunks/week-drops';
import { WEEK_DROPS_HASH } from '../../../content/__generated__/week-drops-index';
import { WeekDropsChunkMismatch, createWeekDropStore, weekDrops } from '../drop-store';
import { createWeekGlossLoader, weekGlossTables } from '../../reviews/week-glosses';

/*
 * The week-drop chunk at runtime (F-CURR-002 §5.7, §10, row CM-48): loaded once, held to the start bundle's hash, asked
 * for again after a failure. With the network off the chunk comes from the precache (web) or the one native bundle, so the
 * right drop shows offline: the loader here is that chunk. The memory chunk's own loader lays the word meanings into the
 * content overlays the review rounds read.
 */

const real: WeekDropsChunk = { CHUNK_HASH: chunk.CHUNK_HASH, WEEK_DROPS: chunk.WEEK_DROPS };

describe('createWeekDropStore', () => {
  it('loads the chunk once, checks its hash, and finds the drop of a week', async () => {
    let loads = 0;
    const store = createWeekDropStore({ hash: WEEK_DROPS_HASH, load: async () => ((loads += 1), real) });
    expect((await store.dropOf('2026-11-02'))?.title.en).toBe('Winter Begins');
    expect(await store.dropOf('2026-11-03')).toBeUndefined();
    expect((await store.ensure()).length).toBe(13);
    expect(loads).toBe(1);
  });

  it("refuses another build's chunk, and asks again after a failed load", async () => {
    let calls = 0;
    const store = createWeekDropStore({ hash: 'aaaa', load: async () => ((calls += 1) === 1 ? Promise.reject(new Error('offline')) : real) });
    await expect(store.ensure()).rejects.toThrow('offline');
    await expect(store.ensure()).rejects.toBeInstanceOf(WeekDropsChunkMismatch);
    expect(calls).toBe(2);
  });

  it("this build's store reads this build's chunk (the literal import the start bundle names)", async () => {
    expect((await weekDrops.dropOf('2026-10-26'))?.topic).toBe('sanggang');
  });
});

describe('the memory chunk’s week gloss loader', () => {
  it('lays the es and ko meanings in once, keyed by the drop and the item field', async () => {
    const installed: ReturnType<typeof weekGlossTables>[] = [];
    let loads = 0;
    const load = createWeekGlossLoader({ hash: WEEK_DROPS_HASH, load: async () => ((loads += 1), real) }, (t) => installed.push(t));
    await load();
    await load();
    expect(loads).toBe(1);
    expect(installed[0]?.ko['week:2026-11-02']?.['items.gimjang.gloss']).toBe('겨울에 먹을 김치를 한꺼번에 많이 담그는 일');
    expect(installed[0]?.es['week:2026-11-02']?.['items.mu.gloss']).toBe('rábano');
  });

  it("refuses another build's chunk and tries again after a failure", async () => {
    let calls = 0;
    const load = createWeekGlossLoader({ hash: 'bbbb', load: async () => ((calls += 1) === 1 ? Promise.reject(new Error('offline')) : real) }, () => undefined);
    await expect(load()).rejects.toThrow('offline');
    await expect(load()).rejects.toThrow(/start bundle names bbbb/);
    expect(calls).toBe(2);
  });

  it('a drop with no es or ko meaning adds no entry', () => {
    const drop = (id: string, gloss: WeekDropEntry['items'][number]['gloss']): WeekDropEntry =>
      ({ id, weekOf: id.slice(5), day: id.slice(5), topic: 'ipdong', minutes: 2, title: { en: 't' }, note: { en: [] }, source: { publisher: 'p', title: 't', more: 0 }, items: [{ id: 'a', ko: '가', romanization: 'ga', gloss }] }) as WeekDropEntry;
    expect(weekGlossTables([drop('week:2026-11-02', { en: 'x', es: 'y' }), drop('week:2026-11-09', { en: 'x' })])).toEqual({ es: { 'week:2026-11-02': { 'items.a.gloss': 'y' } }, ko: {} });
  });
});

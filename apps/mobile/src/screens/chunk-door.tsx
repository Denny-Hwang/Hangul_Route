import { useEffect, useState } from 'react';
import { retryLoad } from '../logic/lessons/chunk-retry';

/*
 * The start bundle's door to a screen chunk (F-CURR-002 section 10; AMENDMENTS-FINISH-2026-11 FN-7): the pattern of
 * `parent/reports-entry.tsx`, written once. The caller passes its own literal `import()` (`() => import('./x-chunk')`),
 * so Metro still sees the literal in the door's module and emits the chunk as one precached bundle; the door loads it
 * once per app session (a failed load is asked again by the next call), a screen opened after the first load draws it at
 * once, and meanwhile the door draws the lesson waiting screen, or the crash screen's Try again when it cannot load.
 */

export interface ChunkDoor<C> {
  /** Loads the chunk once; a failed load is not kept. */
  load(): Promise<C>;
  /** One import with no retry of its own (SB-4d: a door that loads two chunks under one retry level); the chunk is kept once it is in. */
  attempt(): Promise<C>;
  /** The chunk when it is in, else null. */
  now(): C | null;
  /**
   * Forgets a load still pending (a hung request its caller gave up on: `screens/lesson-content.tsx`'s root timeout),
   * so the next `load()` asks again; the given-up load makes no further attempt. A chunk already in stays.
   */
  drop(): void;
}

/** What a dropped door's pending load fails with at its next attempt: never asked again (`logic/lessons/chunk-retry.ts`). */
export class ChunkDoorDropped extends Error {
  constructor() {
    super('the chunk door dropped this load');
    this.name = 'ChunkDoorDropped';
  }
}

export function chunkDoor<C>(importChunk: () => Promise<C>): ChunkDoor<C> {
  let loading: Promise<C> | null = null;
  let loaded: C | null = null;
  let generation = 0;
  return {
    load() {
      if (loaded !== null) return Promise.resolve(loaded);
      if (loading === null) {
        const mine = generation;
        const attempt = (): Promise<C> => (mine === generation ? importChunk() : Promise.reject(new ChunkDoorDropped()));
        const pending = retryLoad(attempt).then((chunk) => (loaded = chunk));
        pending.catch(() => {
          if (loading === pending) loading = null;
        });
        loading = pending;
      }
      return loading;
    },
    attempt: () => (loaded !== null ? Promise.resolve(loaded) : importChunk().then((chunk) => (loaded = chunk))),
    now: () => loaded,
    drop() {
      generation += 1;
      loading = null;
    },
  };
}

/** The chunk for a component: null while it loads, `failed` when it cannot, and Try again's `retry`. */
export function useChunk<C>(door: ChunkDoor<C>): { chunk: C | null; failed: boolean; retry: () => void } {
  const [chunk, setChunk] = useState<C | null>(door.now);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (chunk !== null || failed) return undefined;
    let live = true;
    door.load().then(
      (c) => live && setChunk(() => c),
      () => live && setFailed(true),
    );
    return () => {
      live = false;
    };
  }, [door, chunk, failed]);
  return { chunk, failed, retry: () => setFailed(false) };
}

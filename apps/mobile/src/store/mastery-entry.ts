import type { ProgressSnapshot } from '@hangul-route/content-schema';
import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { memoryChunk, memoryRecordsFor } from '../logic/memory/boot';
import type { MasteryRead } from '../logic/memory/memory-runtime';
import { currFlagOn, useCurrFlag } from './remote-config-store';

/*
 * The start bundle's door to mastery (F-CURR-002 sections 4.4, 10 and 12.2, row CM-20). The level derivation, its
 * latch into `cellBest` and Words known run in the memory chunk (`logic/memory/mastery.ts`, through
 * `memoryRuntime().mastery`); the ring and the Results banners are a chunk of their own
 * (`screens/mastery/mastery-chunk.ts`, reached through the literal `import()` below). So the start bundle carries only
 * this file and the screens' few lines.
 *
 * The gate: `mastery` on for the profile, and the profile records (`memoryRecordsFor`: `memoryRecord` on and a
 * learner; a grown-up persona never records), since the levels above Done need answered memory. Off, nothing is read
 * and nothing is drawn: no ring, no counter, no banner (section 12.2); `cellBest` stays as it is and shows again when
 * the flag is back on.
 */

export type MasteryChunk = typeof import('../screens/mastery/mastery-chunk');
export type { MasteryRead };

let loading: Promise<MasteryChunk> | null = null;
let loaded: MasteryChunk | null = null;

/** The mastery chunk, loaded once; a failed load (offline before the precache) is tried again on the next call. */
export function loadMasteryChunk(): Promise<MasteryChunk> {
  if (loading === null) {
    loading = import('../screens/mastery/mastery-chunk').then(
      (chunk) => {
        loaded = chunk;
        return chunk;
      },
      (error: unknown) => {
        loading = null;
        throw error;
      },
    );
  }
  return loading;
}

/** Whether the mastery surfaces are on for this profile now. */
export function masteryOn(profileId: string | null): profileId is string {
  return memoryRecordsFor(profileId) && currFlagOn('mastery', profileId);
}

/**
 * The profile's levels and Words known today, latching any rise (`celebrate`: the Results of an activity, which
 * shows the rises and a milestone). Null while off, or when the store cannot be read.
 */
export function readMastery(profileId: string | null, celebrate: boolean): Promise<MasteryRead | null> {
  if (!masteryOn(profileId)) return Promise.resolve(null);
  return memoryChunk()
    .then((chunk) =>
      chunk.memoryRuntime().mastery(profileId, { volumesOn: currFlagOn('volumes', profileId), reviewOn: currFlagOn('dailyReview', profileId), celebrate }),
    )
    .then(
      (read) => read ?? null,
      () => null,
    );
}

function useMasteryUi(on: boolean): MasteryChunk | null {
  const [ui, setUi] = useState<MasteryChunk | null>(loaded);
  useEffect(() => {
    if (!on || ui !== null) return undefined;
    let live = true;
    loadMasteryChunk().then(
      (chunk) => {
        if (live) setUi(chunk);
      },
      () => undefined,
    );
    return () => {
      live = false;
    };
  }, [on, ui]);
  return on ? ui : null;
}

function useOn(profileId: string | null): boolean {
  // Subscribed, so a surface re-renders when the remote copy turns either flag.
  const mastery = useCurrFlag('mastery');
  const record = useCurrFlag('memoryRecord');
  return mastery && record && memoryRecordsFor(profileId);
}

/** The snapshot fields a read depends on (the memory store's own answers come in on focus). */
export type MasteryInputs = Pick<ProgressSnapshot, 'questDoneAt' | 'testedOut' | 'cellCheckAt' | 'vocab' | 'memSeededAt'>;

export interface MasteryView {
  ui: MasteryChunk;
  /** The last read for this profile and day; null until it lands. */
  read: MasteryRead | null;
}

/**
 * The Journey, Home and the Learning Route: the chunk and a read, again when the screen comes into focus, when a
 * snapshot field a level reads changes and when the local day turns. Null while off or while the chunk loads.
 * A read never celebrates. These screens stay mounted under the Results, so their read can come first after a quest:
 * it latches the rise and moves Words known, but the moments stay in the store for the Results' read to show.
 */
export function useMastery(profileId: string | null, snapshot: MasteryInputs | undefined, localToday: string): MasteryView | null {
  const on = useOn(profileId);
  const ui = useMasteryUi(on);
  const [read, setRead] = useState<{ key: string; read: MasteryRead } | null>(null);
  const key = `${profileId ?? ''}|${localToday}`;
  const alive = useRef(true);
  useEffect(
    () => () => {
      alive.current = false;
    },
    [],
  );
  const refresh = useCallback(() => {
    if (!on) return;
    void readMastery(profileId, false).then((r) => {
      if (alive.current && r !== null) setRead({ key, read: r });
    });
  }, [on, profileId, key]);
  // Only the fields a level reads: a write of anything else (a session, a card) asks for no read.
  useEffect(() => {
    refresh();
  }, [refresh, snapshot?.questDoneAt, snapshot?.testedOut, snapshot?.cellCheckAt, snapshot?.vocab, snapshot?.memSeededAt]);
  useFocusEffect(refresh);
  if (!on || ui === null) return null;
  return { ui, read: read !== null && read.key === key ? read.read : null };
}

/**
 * The Results of an activity: one celebrating read once `ready` (the score is written), so the banners show the levels
 * and the Words known milestone this activity reached. Null while off, not ready, or until the read lands.
 */
export function useMasteryMoment(profileId: string | null, ready: boolean): { ui: MasteryChunk; read: MasteryRead } | null {
  const on = useOn(profileId);
  const ui = useMasteryUi(on);
  const [read, setRead] = useState<MasteryRead | null>(null);
  const asked = useRef(false);
  const alive = useRef(true);
  useEffect(
    () => () => {
      alive.current = false;
    },
    [],
  );
  useEffect(() => {
    if (!on || !ready || asked.current) return;
    // Once per Results visit: a second celebrating read would find nothing new (each rise and milestone is taken once).
    asked.current = true;
    void readMastery(profileId, true).then((r) => {
      if (alive.current) setRead(r);
    });
  }, [on, ready, profileId]);
  if (!on || ui === null || read === null) return null;
  return { ui, read };
}

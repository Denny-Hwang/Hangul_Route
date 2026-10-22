import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { MissionDailyReview } from '../../logic/homework/mission-builder';
import { memoryChunk, memoryRecordsFor } from '../../logic/memory/boot';
import { useCurrFlag } from '../../store/remote-config-store';

/**
 * Home's Daily Review (F-CURR-002 sections 4.3, 4.5 and 12.2, row CM-14): how many items are due, whether today's
 * Daily Review is done and whether to suggest it first, read through the memory chunk (never in the start bundle)
 * when Home comes into focus, the learner's reviews change or the local day turns.
 *
 * - `off`: `dailyReview` or `memoryRecord` is off for the learner (or a grown-up persona): slot 3 keeps today's chain.
 * - `loading`: the first read is on its way; Home waits for it before it pins the day's plan (a frame or two).
 * - `unknown`: the store could not be read: a pinned card stays as it was, a fresh plan keeps today's chain.
 * - `ready`: the counts.
 */
export type DailyReviewHome = { state: 'off' } | { state: 'loading' } | { state: 'unknown' } | { state: 'ready'; value: MissionDailyReview };

export function useDailyReviewHome(profileId: string | null, localToday: string, reviewsVersion: unknown): DailyReviewHome {
  const reviewOn = useCurrFlag('dailyReview');
  const recordOn = useCurrFlag('memoryRecord');
  const on = reviewOn && recordOn && memoryRecordsFor(profileId);
  const [read, setRead] = useState<{ key: string; home: DailyReviewHome } | null>(null);
  const key = `${profileId ?? ''}|${localToday}`;
  const alive = useRef(true);
  useEffect(
    () => () => {
      alive.current = false;
    },
    [],
  );

  const refresh = useCallback(() => {
    if (!on || profileId === null) return;
    memoryChunk()
      .then((chunk) => chunk.dailyReviewApi().homeDailyReview(profileId))
      .then(
        (value) => value,
        () => null,
      )
      .then((value) => {
        if (alive.current) setRead({ key, home: value === null ? { state: 'unknown' } : { state: 'ready', value } });
      });
  }, [on, profileId, key]);

  useEffect(() => {
    refresh();
  }, [refresh, reviewsVersion]);
  useFocusEffect(refresh);

  if (!on) return { state: 'off' };
  // A read for another profile or day is never shown; the last read of this one stays while a new one runs.
  return read !== null && read.key === key ? read.home : { state: 'loading' };
}

/** The mission builder's input: null while off, the counts when read, undefined when unknown or still loading. */
export function missionDailyReviewOf(home: DailyReviewHome): MissionDailyReview | null | undefined {
  if (home.state === 'off') return null;
  return home.state === 'ready' ? home.value : undefined;
}

'use client';

import { useEffect, useState } from 'react';
import { useTransfersShown } from '@/components/console/TransferParts';
import type { ConsoleApi } from '@/lib/console/api';
import { pendingCount } from '@/lib/console/transfer';
import { schoolMoveLinks, type SchoolMoveLink } from '@/lib/console/transfer-requests';

/**
 * The class-move counts of the entry points (F-SPACE-002 section 4.8 "Roster chip", "Home badge", PR T-6b;
 * `design/screens/transfer/requests-page.md` "Entry points"): the roster button, the class and family rows' badge and
 * the school row's per-class links. Every count is the space's own `pendingCount` (its own step `waiting`), the school
 * row's from `TransferSchoolCountView` (T-5d, the same rule). Nothing is asked of the Worker while
 * `NEXT_PUBLIC_CLASS_TRANSFER` is unset or after the session's first `422 transfers_locked` (`transfer-lock.ts`);
 * a failed read counts as nothing waiting, so an entry point never shows a guess.
 */

type CountApi = Pick<ConsoleApi, 'transferRequests'>;
type SchoolApi = Pick<ConsoleApi, 'transferRequests' | 'school'>;

/** One read that never throws: a failed or missing call (an older client shape, a network error) answers null. */
const quietly = <T,>(read: () => Promise<T>): Promise<T | null> => Promise.resolve().then(read).catch(() => null);

/** Waiting moves per space id (`pendingCount` of each space's own views); empty while class moves are off. */
export function useMovesWaiting(api: CountApi | null, spaceIds: readonly string[]): Record<string, number> {
  const shown = useTransfersShown();
  const [counts, setCounts] = useState<Record<string, number>>({});
  const key = spaceIds.join('\n');
  useEffect(() => {
    if (!api || !shown || key === '') {
      setCounts({});
      return undefined;
    }
    let live = true;
    const ids = key.split('\n');
    void Promise.all(ids.map(async (id) => [id, await quietly(() => api.transferRequests(id))] as const)).then((answers) => {
      if (!live) return;
      setCounts(Object.fromEntries(answers.map(([id, r]) => [id, r?.ok ? pendingCount(r.data.requests) : 0])));
    });
    return () => {
      live = false;
    };
  }, [api, shown, key]);
  return shown ? counts : {};
}

/** A school row's links per school id: one per child class with a waiting move (counts only, never a name of a learner). */
export function useSchoolMoveLinks(api: SchoolApi | null, schoolIds: readonly string[]): Record<string, SchoolMoveLink[]> {
  const shown = useTransfersShown();
  const [links, setLinks] = useState<Record<string, SchoolMoveLink[]>>({});
  const key = schoolIds.join('\n');
  useEffect(() => {
    if (!api || !shown || key === '') {
      setLinks({});
      return undefined;
    }
    let live = true;
    const ids = key.split('\n');
    void Promise.all(
      ids.map(async (id) => {
        const [counts, school] = await Promise.all([quietly(() => api.transferRequests(id)), quietly(() => api.school(id))]);
        const rows = counts?.ok && school?.ok ? schoolMoveLinks(counts.data.counts ?? [], school.data.classes.map((row) => ({ id: row.space.id, name: row.space.name }))) : [];
        return [id, rows] as const;
      }),
    ).then((answers) => {
      if (live) setLinks(Object.fromEntries(answers));
    });
    return () => {
      live = false;
    };
  }, [api, shown, key]);
  return shown ? links : {};
}

'use client';

import { useEffect, useState } from 'react';
import { useTransfersShown } from '@/components/console/TransferParts';
import { useRosterChanges } from '@/components/console/use-roster-changes';
import { useVisibleRefresh } from '@/components/console/use-visible-refresh';
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

type CountApi = Pick<ConsoleApi, 'transferRequests'> & Partial<Pick<ConsoleApi, 'relinkRequests' | 'classMoves'>>;
type SchoolApi = Pick<ConsoleApi, 'transferRequests' | 'school'>;

/** One read that never throws: a failed or missing call (an older client shape, a network error) answers null. */
const quietly = <T,>(read: () => Promise<T>): Promise<T | null> => Promise.resolve().then(read).catch(() => null);

/** What waits for a space's answer (AMENDMENTS-GROWNUP-UX section 3.4): its re-links, its moves, and both. */
export interface ApprovalCounts {
  relinks: number;
  moves: number;
  all: number;
}

/** GX-W `GET /api/spaces` `items[].attention` (section 12), read leniently: a shape this bundle cannot read is absent. */
export function readAttention(raw: unknown): { relinks: number; moves: number } | null {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return null;
  const { relinks, moves } = raw as Record<string, unknown>;
  const count = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? Math.floor(v) : null);
  const r = count(relinks);
  const m = count(moves);
  return r === null || m === null ? null : { relinks: r, moves: m };
}

export interface ApprovalsOptions {
  /** Read each space's re-links (default on). They are counted whatever `CLASS_TRANSFER` says. */
  relinks?: boolean;
  /** Read each space's teacher moves into it (default on); a family has none. Only while class moves are shown. */
  classMoves?: boolean;
  /** GX-W `attention` per space id, when the caller already read `GET /api/spaces`: that space then asks nothing else. */
  attention?: Readonly<Record<string, unknown>>;
}

/**
 * Everything that waits for each space's answer (AMENDMENTS-GROWNUP-UX GX-D5, section 3.4; rename of `useMovesWaiting`):
 * its pending re-links (whatever `CLASS_TRANSFER` says), its transfers whose own step waits (`pendingCount`, every role)
 * and its teacher moves into it (`kind: 'accept'`, wire status `waiting`); only the move reads follow the flag
 * (`useTransfersShown`). Read once on mount, on focus or when the tab comes back into view (at most every 30 s), when a
 * roster changes in another tab, and whenever `refreshKey` changes (after a decision); **never on a timer**, so a school
 * admin with 60 classes does not send 180 requests a minute. A space with a readable GX-W `attention` is not asked again.
 */
export function useApprovalsWaiting(api: CountApi | null, spaceIds: readonly string[], refreshKey: number | string = 0, options: ApprovalsOptions = {}): Record<string, ApprovalCounts> {
  const shown = useTransfersShown();
  const [counts, setCounts] = useState<Record<string, ApprovalCounts>>({});
  const [again, setAgain] = useState(0);
  const key = spaceIds.join('\n');
  const wantRelinks = options.relinks !== false;
  const wantClassMoves = options.classMoves !== false;
  const attention = options.attention;
  const attentionKey = attention ? spaceIds.map((id) => JSON.stringify(readAttention(attention[id]))).join('\n') : '';
  const enabled = !!api && key !== '' && (wantRelinks || shown);
  useVisibleRefresh(() => setAgain((n) => n + 1), enabled);
  useRosterChanges(() => setAgain((n) => n + 1), enabled);
  useEffect(() => {
    if (!api || key === '' || (!wantRelinks && !shown)) {
      setCounts({});
      return undefined;
    }
    let live = true;
    const ids = key.split('\n');
    void Promise.all(
      ids.map(async (id): Promise<readonly [string, ApprovalCounts]> => {
        const known = attention ? readAttention(attention[id]) : null;
        if (known) {
          const moves = shown ? known.moves : 0;
          const relinks = wantRelinks ? known.relinks : 0;
          return [id, { relinks, moves, all: relinks + moves }] as const;
        }
        const readRelinks = wantRelinks ? api.relinkRequests : undefined;
        const readClassMoves = shown && wantClassMoves ? api.classMoves : undefined;
        const [relinkList, transfers, classMoves] = await Promise.all([
          readRelinks ? quietly(() => readRelinks(id)) : null,
          shown ? quietly(() => api.transferRequests(id)) : null,
          readClassMoves ? quietly(() => readClassMoves(id)) : null,
        ]);
        const now = Date.now();
        const relinks = relinkList?.ok ? relinkList.data.filter((r) => r.status === 'pending' && Date.parse(r.expiresAt) > now).length : 0;
        const teacherIn = classMoves?.ok ? classMoves.data.incoming.filter((m) => m.status === 'waiting' && m.kind === 'accept').length : 0;
        const moves = (transfers?.ok ? pendingCount(transfers.data.requests) : 0) + teacherIn;
        return [id, { relinks, moves, all: relinks + moves }] as const;
      }),
    ).then((answers) => {
      if (live) setCounts(Object.fromEntries(answers));
    });
    return () => {
      live = false;
    };
    // `attentionKey` stands for `attention`: a new object with the same counts asks nothing again.
  }, [api, shown, key, wantRelinks, wantClassMoves, attentionKey, refreshKey, again]);
  return counts;
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

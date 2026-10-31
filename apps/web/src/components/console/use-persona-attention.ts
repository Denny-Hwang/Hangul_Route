'use client';

import type { ClassAttention } from '@hangul-route/content-schema';
import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { useTransfersShown } from '@/components/console/TransferParts';
import { useRosterChanges } from '@/components/console/use-roster-changes';
import { useVisibleRefresh } from '@/components/console/use-visible-refresh';
import type { ConsoleApi, SpaceListItem } from '@/lib/console/api';
import { ATTENTION_GAP_MS, ATTENTION_POLL_MS, adminSchoolIds, attentionDeployed, teacherAttention, titleWithCount, type PersonaAttention } from '@/lib/console/persona-attention';

/**
 * The teacher's waiting counts for the adult frame (AMENDMENTS-GROWNUP-UX GX-3, sections 5.4, 5.5 and 6): the frame
 * holds them, draws the Classes tab's number and the re-link bar, and hands them to the page through
 * `FrameAttentionContext` (the home row chips, a school row's class links, the school page's class rows).
 *
 * Reads, only once GX-W is deployed (the spaces list carries `attention`): the spaces list the frame already has, then
 * `GET /api/spaces` again every `ATTENTION_POLL_MS` (30 s) while the tab is in view, on focus and when it comes back
 * into view (`poll`); a school owner's or admin's `GET /:id/attention` with each of those reads; a school's own class
 * names once per tab, only when one of its classes waits and the list cannot name it. With an older Worker nothing is
 * read and nothing is drawn (never a guess, never a timer). A failed read in the background keeps what is drawn.
 */

export type AttentionApi = Pick<ConsoleApi, 'listSpaces' | 'schoolAttention' | 'school'>;

export interface PersonaAttentionOptions {
  /** The teacher persona's frame with its spaces list (not a lecture page). */
  enabled: boolean;
  /** Read again every 30 s while in view; off on the class page, which reads its own every 20 s (section 5.4). */
  poll: boolean;
}

/** One read that never throws: a failed or missing call answers null. */
const quietly = <T,>(read: () => Promise<T>): Promise<T | null> => Promise.resolve().then(read).catch(() => null);

/** A school's class names, read once per tab per school (memory only). */
const schoolNames = new Map<string, Promise<Record<string, string>>>();

/** Test hook (and sign-out): forget the per-tab school name reads. */
export function resetAttentionMemory(): void {
  schoolNames.clear();
}

function readSchoolNames(api: AttentionApi, schoolId: string): Promise<Record<string, string>> {
  let pending = schoolNames.get(schoolId);
  if (!pending) {
    pending = quietly(() => api.school(schoolId)).then((result) => (result?.ok ? Object.fromEntries(result.data.classes.map((row) => [row.space.id, row.space.name])) : {}));
    schoolNames.set(schoolId, pending);
  }
  return pending;
}

export function usePersonaAttention(api: AttentionApi | null, list: readonly SpaceListItem[] | null, options: PersonaAttentionOptions): PersonaAttention | null {
  const shown = useTransfersShown();
  const [polled, setPolled] = useState<{ from: readonly SpaceListItem[] | null; spaces: readonly SpaceListItem[] } | null>(null);
  const [schools, setSchools] = useState<Record<string, ClassAttention[] | null>>({});
  const [names, setNames] = useState<Record<string, string>>({});
  const [tick, setTick] = useState(0);
  // A poll's answer stands until the page hands the frame a newer list of its own.
  const current = polled && polled.from === list ? polled.spaces : list;
  const live = options.enabled && !!api && !!current;
  const deployed = live && !!current && attentionDeployed(current);
  const schoolKey = deployed && current ? adminSchoolIds(current).join('\n') : '';

  const again = (): void => setTick((n) => n + 1);
  useVisibleRefresh(again, deployed && options.poll, { pollMs: ATTENTION_POLL_MS, gapMs: ATTENTION_GAP_MS });
  useRosterChanges(again, deployed);

  useEffect(() => {
    if (tick === 0 || !api || !deployed) return undefined;
    let alive = true;
    const from = list;
    void quietly(() => api.listSpaces()).then((result) => {
      if (alive && result?.ok) setPolled({ from, spaces: result.data });
    });
    return () => {
      alive = false;
    };
    // `deployed` and `list` are read when a tick happens; a new tick is the only thing that asks again.
  }, [tick, api]);

  useEffect(() => {
    if (!api || schoolKey === '') {
      setSchools((prev) => (Object.keys(prev).length === 0 ? prev : {}));
      return undefined;
    }
    let alive = true;
    const ids = schoolKey.split('\n');
    void Promise.all(ids.map(async (id) => [id, await quietly(() => api.schoolAttention(id))] as const)).then((answers) => {
      if (!alive) return;
      setSchools((prev) => Object.fromEntries(answers.map(([id, result]) => [id, result?.ok ? result.data : (prev[id] ?? null)])));
    });
    return () => {
      alive = false;
    };
  }, [api, schoolKey, tick]);

  const view = useMemo(() => (live && current ? teacherAttention({ spaces: current, schools, movesShown: shown }) : null), [live, current, schools, shown]);

  // A school class that waits and that the list cannot name (the admin is not a member): its school's names, once.
  const unnamed = view
    ? Object.entries(view.schools)
        .filter(([, ids]) => ids.some((id) => (view.bySpace[id]?.all ?? 0) > 0 && view.names[id] === undefined && names[id] === undefined))
        .map(([schoolId]) => schoolId)
        .join('\n')
    : '';
  useEffect(() => {
    if (!api || unnamed === '') return undefined;
    let alive = true;
    void Promise.all(unnamed.split('\n').map((id) => readSchoolNames(api, id))).then((found) => {
      if (alive) setNames((prev) => Object.assign({}, prev, ...found) as Record<string, string>);
    });
    return () => {
      alive = false;
    };
  }, [api, unnamed]);

  return useMemo(() => (view ? { ...view, names: { ...names, ...view.names } } : null), [view, names]);
}

/** The frame's counts for the page inside it; null outside a teacher frame or before GX-W. */
export const FrameAttentionContext = createContext<PersonaAttention | null>(null);

export function useFrameAttention(): PersonaAttention | null {
  return useContext(FrameAttentionContext);
}

/**
 * The tab title with "(n) " in front while something waits (section 5.4; a count only, never a name). A page that sets
 * its own title later keeps the prefix: the `<title>` element is watched while the count is shown.
 */
export function useTitleCount(n: number, enabled: boolean): void {
  useEffect(() => {
    if (!enabled || typeof document === 'undefined' || typeof document.querySelector !== 'function') return undefined;
    const apply = (count: number): void => {
      const next = titleWithCount(document.title, count);
      if (next !== document.title) document.title = next;
    };
    apply(n);
    const title = document.querySelector('title');
    const observer = title && typeof MutationObserver !== 'undefined' && n > 0 ? new MutationObserver(() => apply(n)) : null;
    if (observer && title) observer.observe(title, { childList: true, characterData: true, subtree: true });
    return () => {
      observer?.disconnect();
      apply(0);
    };
  }, [n, enabled]);
}

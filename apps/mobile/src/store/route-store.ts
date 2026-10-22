import { CATALOG, type CurriculumDraft, type SelfRoute } from '@hangul-route/content-schema';
import { z } from 'zod';
import { create } from 'zustand';
import { dayKey } from '../logic/homework/mission-builder';
import { seenKey } from '../logic/my-route/seen';
import { createdEvent } from '../logic/route/proposal-flow';
import { applyCheckIn, autoRepaceDue, checkInOffer, pendingPastOf, repaceSelfRoute, repacedEvent, type CheckInOffer } from '../logic/route/repace';
import { activeSelfRoute, archivedRoute, completedQuestIdsOf, newSelfRouteId, selfRouteOf } from '../logic/route/self-route';
import { readJson, removeKey, writeJson } from '../platform/storage';
import { track } from '../platform/telemetry';
import { usePlanStore } from './plan-store';
import { onProfileRemoved } from './profile-removal';
import { useProgressStore } from './progress-store';

/**
 * The learner's own weekly plan (F-PLAN-002 section 3.9): `create` stores the `SelfRoute` in
 * the progress snapshot (it rides sync, the backup and Rescue Code restore), derives its first
 * week into homework through the plan store and fires `route.created`; `archive` stops it
 * (pending plan homework leaves, history stays). `route-ui:<profileId>` remembers the plan
 * prompt's Not now (AM-6, OD-16). Storage goes through `platform/storage` only (CLAUDE.md
 * section 8); a failed write keeps the mark in memory for the session.
 */

/** The weekly plan's prompt marks (`hr:route-ui:<id>`); exported for the removal sweep (row OA-7a). */
export const ROUTE_UI_KEY = (profileId: string): string => `route-ui:${profileId}`;
const uiKey = ROUTE_UI_KEY;

const RouteUiSchema = z.object({
  /** The plan prompt's Not now (AM-6, OD-16). */
  dismissedAt: z.string().optional(),
  /** The plan whose Hoya check-in was answered (FP-B14): it shows once per plan. */
  checkInFor: z.string().optional(),
  /** The last automatic re-pace, and when its calm line was last seen (section 3.7). */
  movedAt: z.string().optional(),
  movedSeenAt: z.string().optional(),
  /** The grown-up report's Not now on the Suggested weekly plan card (F-PLC-001 P-7b): that card only. */
  reportDismissedAt: z.string().optional(),
  /** Keep my plan / Not now on a plan update: the start change it answered (`planChangeAt`); the update stays hidden until the next one. */
  keptFor: z.string().optional(),
});
export type RouteUi = z.infer<typeof RouteUiSchema>;

/** How a check-in answer ended (`answerCheckIn`). */
export type CheckInAnswer = 'answered' | 'gone' | 'failed';

export interface CreateOptions {
  from: 'proposal' | 'setup';
  /** The learner changed what Hoya proposed (`route.created.changed`). */
  changed: boolean;
  /**
   * Change the plan (section 3.9): the id of the active plan this one replaces. Without it, or with
   * an id that is no longer the active plan, an active plan is never overwritten.
   */
  replacing?: string;
}

interface State {
  ui: Record<string, RouteUi>;
}

interface Actions {
  /** Reads `route-ui:<profileId>`; a mark made while the read was in flight is kept. */
  loadUi: (profileId: string) => Promise<RouteUi>;
  /** Not now (the Home prompt or the proposal screen): hides the prompt for 14 days or until the next result. */
  markDismissed: (profileId: string, at: string) => Promise<void>;
  /** A new active plan from a draft; null when another plan is active (unless `replacing` names it) or it would not parse (nothing is stored then). */
  create: (profileId: string, draft: CurriculumDraft, opts: CreateOptions, now?: Date) => Promise<SelfRoute | null>;
  /** Stop the active plan; false when there is none. */
  archive: (profileId: string, now?: Date) => Promise<boolean>;
  /**
   * The automatic re-pace (section 3.7): at most once per UTC day, never while a session is open,
   * when three or more past-dated plan items wait or the oldest is a week old. True when it ran.
   */
  autoRepace: (profileId: string, now?: Date) => Promise<boolean>;
  /** Whether `autoRepace` would run now (read-only): the caller syncs first, so the re-pace works on the newest copy. */
  repaceDue: (profileId: string, now?: Date) => Promise<boolean>;
  /** "Move my plan along": the same re-pace by hand; false without an active plan. */
  repaceNow: (profileId: string, now?: Date) => Promise<boolean>;
  /**
   * The Hoya check-in's answer: an offer applies the new pace, null is Not now; either closes it for
   * this plan. `gone` when the check-in no longer applies (answered already, another plan, overlap),
   * `failed` when the new pace could not be laid out or stored (the check-in stays open).
   */
  answerCheckIn: (profileId: string, offer: CheckInOffer | null, now?: Date) => Promise<CheckInAnswer>;
  /** The calm "Hoya moved your plan along" line was seen. */
  markMovedSeen: (profileId: string, at: string) => Promise<void>;
  /** The report card's Not now (F-PLC-001 P-7b): hides that card for 14 days or until the next result. */
  markReportDismissed: (profileId: string, at: string) => Promise<void>;
  /** Keep my plan / Not now on a plan update, for the start change `changeAt` (F-PLC-001 P-7b). */
  markKept: (profileId: string, changeAt: string) => Promise<void>;
}

const completedOf = (profileId: string): string[] => completedQuestIdsOf(useProgressStore.getState().byProfile[profileId]?.quests);

/** Check-in answers in flight, per learner: a second tap before the first answer lands changes nothing. */
const answering = new Set<string>();
/** Re-paces in flight, per learner: overlapping triggers (a sync and the foreground) move the plan, and report it, once. */
const repacing = new Set<string>();

/** Runs `work` unless a re-pace for this learner is already running; false then. */
async function oneRepace(profileId: string, work: () => Promise<boolean>): Promise<boolean> {
  if (repacing.has(profileId)) return false;
  repacing.add(profileId);
  try {
    return await work();
  } finally {
    repacing.delete(profileId);
  }
}

export const useRouteStore = create<State & Actions>((set, get) => {
  /** Merge a patch into `route-ui:<profileId>`; the stored record is read first, so no other mark is lost. */
  const mark = async (profileId: string, patch: RouteUi): Promise<void> => {
    const known = get().ui[profileId] !== undefined;
    set((s) => ({ ui: { ...s.ui, [profileId]: { ...s.ui[profileId], ...patch } } }));
    // Not read yet (an automatic re-pace at app start): fold the stored record in under the new marks.
    const ui = known ? (get().ui[profileId] as RouteUi) : await get().loadUi(profileId);
    await writeJson(uiKey(profileId), ui).catch(() => undefined);
  };

  /** The active plan, after the saved snapshot is read; null when there is none. */
  const activeOf = async (profileId: string): Promise<SelfRoute | null> => {
    await useProgressStore.getState().hydrate(profileId);
    return activeSelfRoute(useProgressStore.getState().byProfile[profileId]);
  };

  /** Store the changed plan and derive its week again (section 3.6 rule 2 reconciles the dates); false when it was not stored. */
  const replace = async (profileId: string, route: SelfRoute): Promise<boolean> => {
    if (!useProgressStore.getState().setSelfRoute(profileId, route)) return false;
    await usePlanStore.getState().rederive(profileId);
    return true;
  };

  /** The re-pace itself; false when the plan could not be laid out again or stored (no event then). */
  const repace = async (profileId: string, active: SelfRoute, mode: 'auto' | 'manual', now: Date): Promise<boolean> => {
    const today = dayKey(now.toISOString());
    const homework = useProgressStore.getState().byProfile[profileId]?.homework ?? [];
    const pending = pendingPastOf(active, homework, today).length;
    let next: SelfRoute;
    try {
      next = repaceSelfRoute(active, completedOf(profileId), today, CATALOG, now.toISOString());
    } catch {
      return false;
    }
    if (!(await replace(profileId, next))) return false;
    const event = repacedEvent(profileId, mode, pending);
    void track({ name: event.name, profileId, payload: { ...event.payload } });
    return true;
  };

  const dueNow = async (profileId: string, now: Date): Promise<{ due: boolean; active: SelfRoute | null }> => {
    const active = await activeOf(profileId);
    const progress = useProgressStore.getState();
    const due = autoRepaceDue({
      route: active,
      homework: progress.byProfile[profileId]?.homework ?? [],
      today: dayKey(now.toISOString()),
      sessionOpen: progress.openSession?.profileId === profileId,
    });
    return { due, active };
  };

  return {
    ui: {},

    loadUi: async (profileId) => {
      const parsed = RouteUiSchema.safeParse(await readJson<unknown>(uiKey(profileId)));
      const stored = parsed.success ? parsed.data : {};
      const ui = { ...stored, ...get().ui[profileId] };
      set((s) => ({ ui: { ...s.ui, [profileId]: ui } }));
      return ui;
    },

    markDismissed: (profileId, at) => mark(profileId, { dismissedAt: at }),

    markMovedSeen: (profileId, at) => mark(profileId, { movedSeenAt: at }),

    markReportDismissed: (profileId, at) => mark(profileId, { reportDismissedAt: at }),

    markKept: (profileId, changeAt) => mark(profileId, { keptFor: changeAt }),

    create: async (profileId, draft, opts, now = new Date()) => {
      const progress = useProgressStore.getState();
      await progress.hydrate(profileId);
      // A plan stops only by archiving it or by Change the plan naming it (section 3.9): never overwrite another one here.
      const active = activeSelfRoute(useProgressStore.getState().byProfile[profileId]);
      if (active !== null && active.id !== opts.replacing) return null;
      let route: SelfRoute;
      try {
        route = selfRouteOf(draft, newSelfRouteId(now.getTime()), now.toISOString());
      } catch {
        return null;
      }
      if (!useProgressStore.getState().setSelfRoute(profileId, route)) return null;
      // The first week becomes homework now (section 3.6), not at the next app start.
      await usePlanStore.getState().rederive(profileId);
      const event = createdEvent(profileId, draft, opts.from, opts.changed);
      void track({ name: event.name, profileId, payload: { ...event.payload } });
      return route;
    },

    archive: async (profileId, now = new Date()) => {
      const progress = useProgressStore.getState();
      await progress.hydrate(profileId);
      const active = activeSelfRoute(useProgressStore.getState().byProfile[profileId]);
      if (active === null) return false;
      if (!useProgressStore.getState().setSelfRoute(profileId, archivedRoute(active, now.toISOString()))) return false;
      // The source leaves the derivation: its pending items are dropped, done ones stay (section 3.6 rule 2).
      await usePlanStore.getState().rederive(profileId);
      return true;
    },

    autoRepace: (profileId, now = new Date()) =>
      oneRepace(profileId, async () => {
        const { due, active } = await dueNow(profileId, now);
        if (!due || active === null) return false;
        if (!(await repace(profileId, active, 'auto', now))) return false;
        await mark(profileId, { movedAt: now.toISOString() });
        return true;
      }),

    repaceDue: async (profileId, now = new Date()) => (await dueNow(profileId, now)).due,

    repaceNow: (profileId, now = new Date()) =>
      oneRepace(profileId, async () => {
        const active = await activeOf(profileId);
        if (active === null) return false;
        return repace(profileId, active, 'manual', now);
      }),

    answerCheckIn: async (profileId, offer, now = new Date()) => {
      // Once per plan (FP-B14): a second answer, or one that overlaps the first, changes nothing.
      if (answering.has(profileId)) return 'gone';
      answering.add(profileId);
      try {
        const active = await activeOf(profileId);
        if (active === null) return 'gone';
        const today = dayKey(now.toISOString());
        // The answer is for the offer this learner's plan has now: a card kept from another
        // learner or another plan (a profile switch while the screen stayed) changes nothing.
        const current = checkInOffer({ route: active, completedQuestIds: completedOf(profileId), today, answeredFor: (await get().loadUi(profileId)).checkInFor });
        if (current === null) return 'gone';
        if (offer !== null && (offer.kind !== current.kind || offer.pace !== current.pace)) return 'gone';
        if (offer !== null) {
          let next: SelfRoute | null;
          try {
            next = applyCheckIn(active, offer, completedOf(profileId), today, CATALOG, now.toISOString());
          } catch {
            return 'failed';
          }
          // Yes never drops a lesson (section 3.7): a pace the plan cannot hold is not applied.
          if (next === null || !(await replace(profileId, next))) return 'failed';
        }
        await mark(profileId, { checkInFor: active.id });
        return 'answered';
      } finally {
        answering.delete(profileId);
      }
    },
  };
});

/**
 * [OA] Row OA-7a (section 10.4, CS-20): a learner removed from this device leaves no plan prompt marks and no
 * Learning Route "seen" record (`route-map-ui:<id>`, written by the My route screen through `logic/my-route/seen`).
 */
onProfileRemoved((profileId) => {
  useRouteStore.setState((s) => {
    const { [profileId]: _gone, ...ui } = s.ui;
    return { ui };
  });
  for (const stored of [ROUTE_UI_KEY, seenKey]) removeKey(stored(profileId)).catch(() => undefined);
});

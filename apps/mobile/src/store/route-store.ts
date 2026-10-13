import { CATALOG, type CurriculumDraft, type SelfRoute } from '@hangul-route/content-schema';
import { z } from 'zod';
import { create } from 'zustand';
import { dayKey } from '../logic/homework/mission-builder';
import { createdEvent } from '../logic/route/proposal-flow';
import { applyCheckIn, autoRepaceDue, pendingPastOf, repaceSelfRoute, repacedEvent, type CheckInOffer } from '../logic/route/repace';
import { activeSelfRoute, archivedRoute, newSelfRouteId, selfRouteOf } from '../logic/route/self-route';
import { readJson, writeJson } from '../platform/storage';
import { track } from '../platform/telemetry';
import { usePlanStore } from './plan-store';
import { useProgressStore } from './progress-store';

/**
 * The learner's own weekly plan (F-PLAN-002 section 3.9): `create` stores the `SelfRoute` in
 * the progress snapshot (it rides sync, the backup and Rescue Code restore), derives its first
 * week into homework through the plan store and fires `route.created`; `archive` stops it
 * (pending plan homework leaves, history stays). `route-ui:<profileId>` remembers the plan
 * prompt's Not now (AM-6, OD-16). Storage goes through `platform/storage` only (CLAUDE.md
 * section 8); a failed write keeps the mark in memory for the session.
 */

const uiKey = (profileId: string): string => `route-ui:${profileId}`;

const RouteUiSchema = z.object({
  /** The plan prompt's Not now (AM-6, OD-16). */
  dismissedAt: z.string().optional(),
  /** The plan whose Hoya check-in was answered (FP-B14): it shows once per plan. */
  checkInFor: z.string().optional(),
  /** The last automatic re-pace, and when its calm line was last seen (section 3.7). */
  movedAt: z.string().optional(),
  movedSeenAt: z.string().optional(),
});
export type RouteUi = z.infer<typeof RouteUiSchema>;

export interface CreateOptions {
  from: 'proposal' | 'setup';
  /** The learner changed what Hoya proposed (`route.created.changed`). */
  changed: boolean;
}

interface State {
  ui: Record<string, RouteUi>;
}

interface Actions {
  /** Reads `route-ui:<profileId>`; a mark made while the read was in flight is kept. */
  loadUi: (profileId: string) => Promise<RouteUi>;
  /** Not now (the Home prompt or the proposal screen): hides the prompt for 14 days or until the next result. */
  markDismissed: (profileId: string, at: string) => Promise<void>;
  /** A new active plan from a draft; null when one is already active or it would not parse (nothing is stored then). */
  create: (profileId: string, draft: CurriculumDraft, opts: CreateOptions, now?: Date) => Promise<SelfRoute | null>;
  /** Stop the active plan; false when there is none. */
  archive: (profileId: string, now?: Date) => Promise<boolean>;
  /**
   * The automatic re-pace (section 3.7): at most once per UTC day, never while a session is open,
   * when three or more past-dated plan items wait or the oldest is a week old. True when it ran.
   */
  autoRepace: (profileId: string, now?: Date) => Promise<boolean>;
  /** "Move my plan along": the same re-pace by hand; false without an active plan. */
  repaceNow: (profileId: string, now?: Date) => Promise<boolean>;
  /** The Hoya check-in's answer: an offer applies the new pace, null is Not now; either closes it for this plan. */
  answerCheckIn: (profileId: string, offer: CheckInOffer | null, now?: Date) => Promise<boolean>;
  /** The calm "Hoya moved your plan along" line was seen. */
  markMovedSeen: (profileId: string, at: string) => Promise<void>;
}

const completedOf = (profileId: string): string[] =>
  (useProgressStore.getState().byProfile[profileId]?.quests ?? []).filter((q) => q.completedAt !== undefined).map((q) => q.questId);

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

  /** Store the changed plan and derive its week again (section 3.6 rule 2 reconciles the dates). */
  const replace = async (profileId: string, route: SelfRoute): Promise<void> => {
    useProgressStore.getState().setSelfRoute(profileId, route);
    await usePlanStore.getState().rederive(profileId);
  };

  const repace = async (profileId: string, active: SelfRoute, mode: 'auto' | 'manual', now: Date): Promise<void> => {
    const today = dayKey(now.toISOString());
    const homework = useProgressStore.getState().byProfile[profileId]?.homework ?? [];
    const pending = pendingPastOf(active, homework, today).length;
    await replace(profileId, repaceSelfRoute(active, completedOf(profileId), today, CATALOG, now.toISOString()));
    const event = repacedEvent(profileId, mode, pending);
    void track({ name: event.name, profileId, payload: { ...event.payload } });
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

    create: async (profileId, draft, opts, now = new Date()) => {
      const progress = useProgressStore.getState();
      await progress.hydrate(profileId);
      // A plan stops only by archiving it (section 3.9): never overwrite an active one here.
      if (activeSelfRoute(useProgressStore.getState().byProfile[profileId]) !== null) return null;
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
      useProgressStore.getState().setSelfRoute(profileId, archivedRoute(active, now.toISOString()));
      // The source leaves the derivation: its pending items are dropped, done ones stay (section 3.6 rule 2).
      await usePlanStore.getState().rederive(profileId);
      return true;
    },

    autoRepace: async (profileId, now = new Date()) => {
      const active = await activeOf(profileId);
      const progress = useProgressStore.getState();
      const due = autoRepaceDue({
        route: active,
        homework: progress.byProfile[profileId]?.homework ?? [],
        today: dayKey(now.toISOString()),
        sessionOpen: progress.openSession?.profileId === profileId,
      });
      if (!due || active === null) return false;
      await repace(profileId, active, 'auto', now);
      await mark(profileId, { movedAt: now.toISOString() });
      return true;
    },

    repaceNow: async (profileId, now = new Date()) => {
      const active = await activeOf(profileId);
      if (active === null) return false;
      await repace(profileId, active, 'manual', now);
      return true;
    },

    answerCheckIn: async (profileId, offer, now = new Date()) => {
      const active = await activeOf(profileId);
      if (active === null) return false;
      if (offer !== null) {
        await replace(profileId, applyCheckIn(active, offer, completedOf(profileId), dayKey(now.toISOString()), CATALOG, now.toISOString()));
      }
      await mark(profileId, { checkInFor: active.id });
      return true;
    },
  };
});

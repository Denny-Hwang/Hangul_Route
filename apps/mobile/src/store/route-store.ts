import type { CurriculumDraft, SelfRoute } from '@hangul-route/content-schema';
import { z } from 'zod';
import { create } from 'zustand';
import { createdEvent } from '../logic/route/proposal-flow';
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

const RouteUiSchema = z.object({ dismissedAt: z.string().optional() });
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
  /** A new active plan from a draft; null when it would not parse (nothing is stored then). */
  create: (profileId: string, draft: CurriculumDraft, opts: CreateOptions, now?: Date) => Promise<SelfRoute | null>;
  /** Stop the active plan; false when there is none. */
  archive: (profileId: string, now?: Date) => Promise<boolean>;
}

export const useRouteStore = create<State & Actions>((set, get) => ({
  ui: {},

  loadUi: async (profileId) => {
    const parsed = RouteUiSchema.safeParse(await readJson<unknown>(uiKey(profileId)));
    const stored = parsed.success ? parsed.data : {};
    const ui = { ...stored, ...get().ui[profileId] };
    set((s) => ({ ui: { ...s.ui, [profileId]: ui } }));
    return ui;
  },

  markDismissed: async (profileId, at) => {
    const ui = { ...get().ui[profileId], dismissedAt: at };
    set((s) => ({ ui: { ...s.ui, [profileId]: ui } }));
    await writeJson(uiKey(profileId), ui).catch(() => undefined);
  },

  create: async (profileId, draft, opts, now = new Date()) => {
    const progress = useProgressStore.getState();
    await progress.hydrate(profileId);
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
}));

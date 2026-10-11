import { apply as applyEvent, type Motivation, type PlacementEvent, type PlacementRunState, type PlacementSource, type UiLocale } from '@hangul-route/content-schema';
import { z } from 'zod';
import { create } from 'zustand';
import { resumableRun, resumeClocks, type ResumeOffer, type SavedRun } from '../logic/placement/flow';
import { readJson, removeKey, writeJson } from '../platform/storage';

/**
 * The level check in progress (F-PLC-001 section 3.1 step 8, section 3.8).
 * The run is written after every answer under `placement-run:<profileId>`;
 * reopening within 24 hours offers Continue, anything older or from another
 * bank version is discarded silently. A run that stopped but was never
 * recorded is offered as `finish`, so a completed check is never lost. The run is never uploaded in pieces:
 * only the finished result enters the snapshot (`recordPlacement`).
 * `placement-ui:<profileId>` remembers the fork decline and the Home "Not now".
 * Storage goes through `platform/storage` only (CLAUDE.md section 8); a write
 * that fails keeps the run in memory for the session.
 */

const runKey = (profileId: string): string => `placement-run:${profileId}`;
const uiKey = (profileId: string): string => `placement-ui:${profileId}`;

const PlacementUiSchema = z.object({ declinedAt: z.string().optional(), dismissedAt: z.string().optional() });
export type PlacementUi = z.infer<typeof PlacementUiSchema>;

export interface RunContext {
  testLocale: UiLocale;
  source: PlacementSource;
  motivation?: Motivation;
}

interface State {
  active: Record<string, SavedRun>;
  ui: Record<string, PlacementUi>;
}

interface Actions {
  /** A new run: kept in memory and saved at once. */
  begin: (profileId: string, ctx: RunContext, run: PlacementRunState, nowMs: number) => void;
  /** Apply an engine event; saved whenever a response is recorded or the run stops. Null without an active run. */
  apply: (profileId: string, event: PlacementEvent, nowMs: number) => PlacementRunState | null;
  /**
   * What to offer on reopening (`continue`, or `finish` for a stopped run never
   * recorded), or null; a stale or other-bank run is removed. The run in
   * memory, when there is one, wins over storage. Clocks are moved past the
   * time away (`resumeClocks`).
   */
  resume: (profileId: string, nowMs: number, bankVersion: number) => Promise<ResumeOffer | null>;
  /** Start again, or the run finished and its result is recorded. */
  discard: (profileId: string) => void;
  /** Reads `placement-ui:<profileId>`; a mark made in memory before the read finished is kept. */
  loadUi: (profileId: string) => Promise<PlacementUi>;
  /** Each mark keeps the other stored timestamp, whether or not `loadUi` ran first. */
  markDeclined: (profileId: string, at: string) => Promise<void>;
  markDismissed: (profileId: string, at: string) => Promise<void>;
}

/**
 * Bumped by `begin` and `discard`, so a `resume` whose storage read was in
 * flight neither restores an old run over a new one nor removes the new
 * run's record.
 */
const generation = new Map<string, number>();
const genOf = (profileId: string): number => generation.get(profileId) ?? 0;
const bump = (profileId: string): void => {
  generation.set(profileId, genOf(profileId) + 1);
};

function write(key: string, value: unknown): void {
  // A failed write keeps the run in memory; the next answer tries again.
  writeJson(key, value).catch(() => undefined);
}

export const usePlacementRunStore = create<State & Actions>((set, get) => ({
  active: {},
  ui: {},

  begin: (profileId, ctx, run, nowMs) => {
    const saved: SavedRun = {
      version: 1,
      savedAtMs: nowMs,
      testLocale: ctx.testLocale,
      source: ctx.source,
      ...(ctx.motivation === undefined ? {} : { motivation: ctx.motivation }),
      run,
    };
    bump(profileId);
    set((s) => ({ active: { ...s.active, [profileId]: saved } }));
    write(runKey(profileId), saved);
  },

  apply: (profileId, event, nowMs) => {
    const current = get().active[profileId];
    if (current === undefined) return null;
    const run = applyEvent(current.run, event, nowMs);
    const recorded = run.responses.length !== current.run.responses.length || run.stop !== current.run.stop;
    const saved: SavedRun = { ...current, run, savedAtMs: recorded ? nowMs : current.savedAtMs };
    set((s) => ({ active: { ...s.active, [profileId]: saved } }));
    if (recorded) write(runKey(profileId), saved);
    return run;
  },

  resume: async (profileId, nowMs, bankVersion) => {
    const offerFrom = (candidate: unknown): ResumeOffer | null => {
      const offer = resumableRun(candidate, nowMs, bankVersion);
      if (offer === null) return null;
      const saved: SavedRun = { ...offer.saved, run: resumeClocks(offer.saved.run, nowMs) };
      set((s) => ({ active: { ...s.active, [profileId]: saved } }));
      return { kind: offer.kind, saved };
    };
    const inMemory = get().active[profileId];
    if (inMemory !== undefined) return offerFrom(inMemory);
    const startedAt = genOf(profileId);
    const stored = await readJson<unknown>(runKey(profileId));
    // A run begun, or discarded, while the read was in flight wins.
    const now = get().active[profileId];
    if (now !== undefined) return offerFrom(now);
    if (genOf(profileId) !== startedAt || stored === null) return null;
    const offer = offerFrom(stored);
    if (offer === null) removeKey(runKey(profileId)).catch(() => undefined);
    return offer;
  },

  discard: (profileId) => {
    bump(profileId);
    set((s) => {
      const active = { ...s.active };
      delete active[profileId];
      return { active };
    });
    removeKey(runKey(profileId)).catch(() => undefined);
  },

  loadUi: async (profileId) => {
    const parsed = PlacementUiSchema.safeParse(await readJson<unknown>(uiKey(profileId)));
    const stored = parsed.success ? parsed.data : {};
    // A mark made while the read was in flight is newer than storage.
    const ui = { ...stored, ...get().ui[profileId] };
    set((s) => ({ ui: { ...s.ui, [profileId]: ui } }));
    return ui;
  },

  markDeclined: async (profileId, at) => {
    await mark(profileId, { declinedAt: at });
  },

  markDismissed: async (profileId, at) => {
    await mark(profileId, { dismissedAt: at });
  },
}));

/** Merges one timestamp into the stored record (read first when this session has not read it). */
async function mark(profileId: string, patch: PlacementUi): Promise<void> {
  const store = usePlacementRunStore;
  if (store.getState().ui[profileId] === undefined) await store.getState().loadUi(profileId);
  const ui = { ...store.getState().ui[profileId], ...patch };
  store.setState((s) => ({ ui: { ...s.ui, [profileId]: ui } }));
  write(uiKey(profileId), ui);
}

import { apply as applyEvent, type Motivation, type PlacementEvent, type PlacementRunState, type PlacementSource, type UiLocale } from '@hangul-route/content-schema';
import { z } from 'zod';
import { create } from 'zustand';
import { resumableRun, type SavedRun } from '../logic/placement/flow';
import { readJson, removeKey, writeJson } from '../platform/storage';

/**
 * The level check in progress (F-PLC-001 section 3.1 step 8, section 3.8).
 * The run is written after every answer under `placement-run:<profileId>`;
 * reopening within 24 hours offers Continue, anything older or from another
 * bank version is discarded silently. The run is never uploaded in pieces:
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
  /** The saved run to offer as Continue, or null (a stale or other-bank run is removed). */
  resume: (profileId: string, nowMs: number, bankVersion: number) => Promise<SavedRun | null>;
  /** Start again, or the run finished and its result is recorded. */
  discard: (profileId: string) => void;
  loadUi: (profileId: string) => Promise<PlacementUi>;
  markDeclined: (profileId: string, at: string) => void;
  markDismissed: (profileId: string, at: string) => void;
}

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
    const stored = await readJson<unknown>(runKey(profileId));
    if (stored === null) return null;
    const saved = resumableRun(stored, nowMs, bankVersion);
    if (saved === null) {
      removeKey(runKey(profileId)).catch(() => undefined);
      return null;
    }
    set((s) => ({ active: { ...s.active, [profileId]: saved } }));
    return saved;
  },

  discard: (profileId) => {
    set((s) => {
      const active = { ...s.active };
      delete active[profileId];
      return { active };
    });
    removeKey(runKey(profileId)).catch(() => undefined);
  },

  loadUi: async (profileId) => {
    const parsed = PlacementUiSchema.safeParse(await readJson<unknown>(uiKey(profileId)));
    const ui = parsed.success ? parsed.data : {};
    set((s) => ({ ui: { ...s.ui, [profileId]: ui } }));
    return ui;
  },

  markDeclined: (profileId, at) => {
    const ui = { ...get().ui[profileId], declinedAt: at };
    set((s) => ({ ui: { ...s.ui, [profileId]: ui } }));
    write(uiKey(profileId), ui);
  },

  markDismissed: (profileId, at) => {
    const ui = { ...get().ui[profileId], dismissedAt: at };
    set((s) => ({ ui: { ...s.ui, [profileId]: ui } }));
    write(uiKey(profileId), ui);
  },
}));

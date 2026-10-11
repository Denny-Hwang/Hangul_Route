import { create } from 'zustand';
import { readJson, writeJson } from '../platform/storage';

/**
 * Per-device layout preference (F-LAYOUT-001 §3.4): "Keep sideways" on the
 * portrait guard. Key `device:layout`, `{ v: 1, allowedSideways }`. Local only,
 * never synced; a missing or corrupt value means `false` (the guard may ask
 * once more, nothing else is lost).
 */
export const LAYOUT_PREFS_KEY = 'device:layout';

export interface LayoutPrefs {
  v: 1;
  allowedSideways: boolean;
}

function parse(value: unknown): LayoutPrefs | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
  const v = value as Record<string, unknown>;
  return v.v === 1 && typeof v.allowedSideways === 'boolean' ? { v: 1, allowedSideways: v.allowedSideways } : null;
}

interface State {
  allowedSideways: boolean;
  hydrated: boolean;
}

interface Actions {
  /** Reads `device:layout`; never writes. Called from `hydrateLearnerData`. */
  hydrate: () => Promise<void>;
  /** "Keep sideways": remembered on this device. */
  allowSideways: () => void;
}

export const useLayoutStore = create<State & Actions>((set, get) => ({
  allowedSideways: false,
  hydrated: false,

  hydrate: async () => {
    const saved = parse(await readJson<unknown>(LAYOUT_PREFS_KEY));
    // A tap on "Keep sideways" during the read wins over the stored value.
    set({ allowedSideways: get().allowedSideways || (saved?.allowedSideways ?? false), hydrated: true });
  },

  allowSideways: () => {
    set({ allowedSideways: true });
    const prefs: LayoutPrefs = { v: 1, allowedSideways: true };
    // A storage failure must never reach the screen: the choice still holds for this session.
    writeJson(LAYOUT_PREFS_KEY, prefs).catch(() => undefined);
  },
}));

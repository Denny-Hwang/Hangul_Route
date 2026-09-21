import { create } from 'zustand';
import { snoozeUntil } from '../logic/pwa/install-guide';
import { readJson, writeJson } from '../platform/storage';

/**
 * Per-device install-guide conveniences (F-PWA-001 §3.1): open count,
 * snooze window, installed flag. Never synced; losing it only means the
 * guide may show once more.
 */
const KEY = 'pwa:install-guide';

interface Persisted {
  visits: number;
  snoozedUntilVisit: number;
  installed: boolean;
}

interface State extends Persisted {
  hydrated: boolean;
  /** Set by settings "Install on this device"; cleared on dismiss. */
  forced: boolean;
}

interface Actions {
  /** Load and count this open. Safe to call once per app start. */
  hydrateAndCountVisit: () => Promise<void>;
  dismiss: () => void;
  markInstalled: () => void;
  force: () => void;
}

function persist(s: Persisted): void {
  void writeJson(KEY, s);
}

export const usePwaStore = create<State & Actions>((set, get) => ({
  visits: 0,
  snoozedUntilVisit: 0,
  installed: false,
  hydrated: false,
  forced: false,

  hydrateAndCountVisit: async () => {
    const saved = (await readJson<Persisted>(KEY)) ?? { visits: 0, snoozedUntilVisit: 0, installed: false };
    const next: Persisted = { ...saved, visits: saved.visits + 1 };
    set({ ...next, hydrated: true });
    persist(next);
  },

  dismiss: () => {
    const { visits, installed } = get();
    const next: Persisted = { visits, installed, snoozedUntilVisit: snoozeUntil(visits) };
    set({ ...next, forced: false });
    persist(next);
  },

  markInstalled: () => {
    const { visits, snoozedUntilVisit } = get();
    const next: Persisted = { visits, snoozedUntilVisit, installed: true };
    set({ ...next, forced: false });
    persist(next);
  },

  force: () => set({ forced: true }),
}));

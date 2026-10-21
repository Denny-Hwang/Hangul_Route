import { create } from 'zustand';
import { currBuildFloor, currBuiltInPct, type CurrFlagName } from '../config/flags';
import {
  DEFAULT_MAX_AGE_S,
  parentFlagOf,
  parseConfigBody,
  parseMaxAge,
  parseStoredConfig,
  refetchDue,
  resolveRemoteFlag,
  type RemoteConfigCache,
} from '../logic/remote-config/remote-config';
import { subscribeAppVisibility } from '../platform/app-visibility';
import { readJson, writeJson } from '../platform/storage';
import { apiBaseUrl } from '../platform/sync-api';
import { useProfileStore } from './profile-store';

/**
 * The remote config shell (F-CURR-002 section 12.2, row CM-2): the last known copy of `GET /api/config`, kept through
 * the storage wrapper (`hr:remote-config`), fetched at start and again on each foreground once the copy is older
 * than 15 minutes (and past its max-age). The request carries no identifier: no credentials, no device or profile
 * header, no query. A failed or unreadable answer keeps the last copy, so an offline device uses its last known
 * values and a device that never fetched uses each flag's built-in pct. Decisions live in `logic/remote-config`.
 */
export const REMOTE_CONFIG_KEY = 'remote-config';
export const CONFIG_PATH = '/api/config';

interface State {
  cache: RemoteConfigCache | null;
  hydrated: boolean;
}

interface Deps {
  endpoint?: string | null;
  fetchImpl?: typeof fetch;
  now?: () => number;
}

interface Actions {
  /** Reads the stored copy once; a damaged one counts as never fetched. */
  hydrate: () => Promise<void>;
  /** Fetches now; resolves true when a new copy was kept. Never throws; one fetch at a time. */
  refresh: (deps?: Deps) => Promise<boolean>;
  /** Fetches only when `refetchDue` says so. */
  refreshIfDue: (deps?: Deps) => Promise<boolean>;
}

let inFlight: Promise<boolean> | null = null;

export const useRemoteConfigStore = create<State & Actions>((set, get) => ({
  cache: null,
  hydrated: false,

  hydrate: async () => {
    if (get().hydrated) return;
    const stored = parseStoredConfig(await readJson<unknown>(REMOTE_CONFIG_KEY));
    // A copy fetched while hydrating wins over the stored one.
    set((s) => ({ cache: s.cache ?? stored, hydrated: true }));
  },

  refresh: (deps = {}) => {
    if (inFlight) return inFlight;
    const endpoint = deps.endpoint === undefined ? apiBaseUrl() : deps.endpoint;
    if (!endpoint) return Promise.resolve(false);
    const fetchImpl = deps.fetchImpl ?? globalThis.fetch;
    const now = deps.now ?? Date.now;
    const run = (async (): Promise<boolean> => {
      try {
        const res = await fetchImpl(`${endpoint}${CONFIG_PATH}`, { method: 'GET', credentials: 'omit', headers: { Accept: 'application/json' } });
        if (!res.ok) return false;
        const flags = parseConfigBody(await res.json());
        if (!flags) return false;
        const cache: RemoteConfigCache = { v: 1, fetchedAt: now(), maxAgeS: parseMaxAge(res.headers.get('cache-control')) ?? DEFAULT_MAX_AGE_S, flags };
        set({ cache });
        await writeJson(REMOTE_CONFIG_KEY, cache).catch(() => undefined);
        return true;
      } catch {
        return false;
      }
    })();
    inFlight = run;
    void run.finally(() => {
      if (inFlight === run) inFlight = null;
    });
    return run;
  },

  refreshIfDue: (deps = {}) => {
    const now = deps.now ?? Date.now;
    if (!refetchDue(get().cache, now())) return Promise.resolve(false);
    return get().refresh(deps);
  },
}));

/**
 * Starts the remote config: reads the stored copy, fetches when due, and checks again each time the app comes back
 * to the foreground. Returns the unsubscribe. Called once from `App.tsx`.
 */
export function startRemoteConfig(deps: Deps & { subscribe?: typeof subscribeAppVisibility } = {}): () => void {
  const store = useRemoteConfigStore.getState();
  void store
    .hydrate()
    .catch(() => undefined)
    .then(() => useRemoteConfigStore.getState().refreshIfDue(deps));
  const subscribe = deps.subscribe ?? subscribeAppVisibility;
  return subscribe((visible) => {
    if (visible) void useRemoteConfigStore.getState().refreshIfDue(deps);
  });
}

function oneFlagOn(flag: CurrFlagName, profileId: string | null, cache: RemoteConfigCache | null): boolean {
  return resolveRemoteFlag({ flag, buildOn: currBuildFloor(flag), builtInPct: currBuiltInPct(flag), remote: cache?.flags ?? null, profileId });
}

/**
 * Whether an F-CURR-002 switch is on for a profile (default: the active one): its build floor, then the last known
 * remote copy or its built-in pct, bucketed per profile. A `pack.<key>` also needs `topicPacks`.
 */
export function currFlagOn(
  flag: CurrFlagName,
  profileId: string | null = useProfileStore.getState().activeId,
  cache: RemoteConfigCache | null = useRemoteConfigStore.getState().cache,
): boolean {
  const parent = parentFlagOf(flag);
  if (parent && !oneFlagOn(parent as CurrFlagName, profileId, cache)) return false;
  return oneFlagOn(flag, profileId, cache);
}

/** Tests only. */
export function resetRemoteConfigForTests(): void {
  inFlight = null;
  useRemoteConfigStore.setState({ cache: null, hydrated: false });
}

import { create } from 'zustand';
import { currBuildFloor, currBuiltInPct, type CurrFlagName } from '../config/flags';
import {
  DEFAULT_MAX_AGE_S,
  REFETCH_MIN_AGE_MS,
  parentFlagOf,
  parseConfigBody,
  parseMaxAge,
  parseStoredConfig,
  refetchDue,
  resolveRemoteFlag,
  retryWaiting,
  type RemoteConfigCache,
} from '../logic/remote-config/remote-config';
import { isAppVisible, subscribeAppVisibility } from '../platform/app-visibility';
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
  /** Fetches only when `refetchDue` says so, and not within 5 minutes of a failed fetch (`RETRY_AFTER_FAILURE_MS`). */
  refreshIfDue: (deps?: Deps) => Promise<boolean>;
}

let inFlight: Promise<boolean> | null = null;
/** When the last fetch failed (device clock), in memory only; null after a success. */
let failedAt: number | null = null;

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
    const attempt = async (): Promise<boolean> => {
      try {
        // `no-store`: skip the device's HTTP cache (browser or NSURLCache), which would otherwise add up to another
        // max-age of staleness after an urgent off; the device's own 15-minute gate and the edge cache still hold.
        const res = await fetchImpl(`${endpoint}${CONFIG_PATH}`, {
          method: 'GET',
          credentials: 'omit',
          cache: 'no-store',
          headers: { Accept: 'application/json' },
        });
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
    };
    const run = attempt().then((kept) => {
      failedAt = kept ? null : now();
      return kept;
    });
    inFlight = run;
    void run.finally(() => {
      if (inFlight === run) inFlight = null;
    });
    return run;
  },

  refreshIfDue: (deps = {}) => {
    const now = deps.now ?? Date.now;
    const t = now();
    if (!refetchDue(get().cache, t) || retryWaiting(failedAt, t)) return Promise.resolve(false);
    return get().refresh(deps);
  },
}));

/**
 * Starts the remote config: reads the stored copy, fetches when due, and checks again each time the app comes back
 * to the foreground. While the app stays in front it also checks every 15 minutes (`REFETCH_MIN_AGE_MS`), so a
 * screen that is never hidden (a presenter on a classroom display, a tablet left on one session) still picks up an
 * urgent off; the check is a no-op until the copy is due. Returns the unsubscribe. Called once from `App.tsx`.
 */
export function startRemoteConfig(
  deps: Deps & { subscribe?: typeof subscribeAppVisibility; isVisible?: () => boolean } = {},
): () => void {
  const check = () => void useRemoteConfigStore.getState().refreshIfDue(deps);
  let timer: ReturnType<typeof setInterval> | null = null;
  const startTimer = () => {
    if (timer === null) timer = setInterval(check, REFETCH_MIN_AGE_MS);
  };
  const stopTimer = () => {
    if (timer !== null) clearInterval(timer);
    timer = null;
  };
  void useRemoteConfigStore
    .getState()
    .hydrate()
    .catch(() => undefined)
    .then(() => useRemoteConfigStore.getState().refreshIfDue(deps));
  if ((deps.isVisible ?? isAppVisible)()) startTimer();
  const subscribe = deps.subscribe ?? subscribeAppVisibility;
  const unsubscribe = subscribe((visible) => {
    if (visible) {
      check();
      startTimer();
    } else {
      stopTimer();
    }
  });
  return () => {
    stopTimer();
    unsubscribe();
  };
}

function oneFlagOn(flag: CurrFlagName, profileId: string | null, cache: RemoteConfigCache | null): boolean {
  return resolveRemoteFlag({ flag, buildOn: currBuildFloor(flag), builtInPct: currBuiltInPct(flag), remote: cache?.flags ?? null, profileId });
}

/** Whether the store can decide yet: the stored copy has been read, or a fetch has already kept a copy. */
function decidable(s: State): boolean {
  return s.hydrated || s.cache !== null;
}

/**
 * Whether an F-CURR-002 switch is on for a profile (default: the active one): its build floor, then the last known
 * remote copy or its built-in pct, bucketed per profile. A `pack.<key>` also needs `topicPacks`.
 *
 * For logic outside React. A component uses `useCurrFlag`, which re-renders when the copy arrives or the active
 * profile changes. With no `cache` given it reads the store, and it is off until the stored copy has been read (or a
 * fetch kept one), so a cold start never shows a feature on its built-in pct that the last known copy turned off.
 */
export function currFlagOn(
  flag: CurrFlagName,
  profileId: string | null = useProfileStore.getState().activeId,
  cache?: RemoteConfigCache | null,
): boolean {
  let copy: RemoteConfigCache | null;
  if (cache === undefined) {
    const state = useRemoteConfigStore.getState();
    if (!decidable(state)) return false;
    copy = state.cache;
  } else {
    copy = cache;
  }
  const parent = parentFlagOf(flag);
  if (parent && !oneFlagOn(parent as CurrFlagName, profileId, copy)) return false;
  return oneFlagOn(flag, profileId, copy);
}

/**
 * The React form of `currFlagOn` for the active profile: subscribes to the remote copy, the hydration and the active
 * profile, so a surface re-renders when any of them changes. Off until the stored copy has been read.
 */
export function useCurrFlag(flag: CurrFlagName): boolean {
  const cache = useRemoteConfigStore((s) => s.cache);
  const ready = useRemoteConfigStore(decidable);
  const activeId = useProfileStore((s) => s.activeId);
  return ready ? currFlagOn(flag, activeId, cache) : false;
}

/** Tests only. */
export function resetRemoteConfigForTests(): void {
  inFlight = null;
  failedAt = null;
  useRemoteConfigStore.setState({ cache: null, hydrated: false });
}

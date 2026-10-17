import {
  DEVICE_SETTINGS_KEY,
  DeviceSettingsSchema,
  PREFS_CHANNEL,
  PrefsMessageSchema,
  mergeDeviceSettings,
  prefsMessage,
  type DeviceSettings,
  type DeviceSettingsPatch,
} from '@hangul-route/content-schema';
import { createStore, get, update } from 'idb-keyval';
import { LEARNER_DB, LEARNER_STORE, PROFILES_STORAGE_KEY, hasProfileList } from '../console/device-marker';
import { indexedDbAvailable } from './safe-storage';

/**
 * The device's one display record on the grown-up pages (owner items 6 and 7): the learner app
 * keeps its language and text size in its default idb-keyval store as a JSON string under
 * `hr:device:settings` (`apps/mobile/src/platform/storage.web.ts`). The grown-up pages are on the
 * same origin, so they read and write that same record (the reader pattern of
 * `lib/console/device-marker.ts`: a read or a write that fails is retried once on a fresh
 * connection), and every write is told to the other tabs on `BroadcastChannel('hr-prefs')`.
 * Besides the record, the console reads only whether `hr:profiles` holds a non-empty list (the
 * presence check `device-marker.ts` already makes); it never reads or writes `hr:settings:*`.
 * Every access is guarded: no IndexedDB, a failed read or a refused write never throws.
 */
export const DEVICE_SETTINGS_STORAGE_KEY = `hr:${DEVICE_SETTINGS_KEY}`;

export interface IdbStore {
  get: (key: string) => Promise<unknown>;
  /**
   * Read-modify-write of one key in one readwrite transaction (idb-keyval `update`): `next` gets the
   * stored value and returns the value to store; a throw from `next` ends it without a write.
   */
  update: (key: string, next: (stored: unknown) => string) => Promise<void>;
}

/** Opens the learner's store: `fresh` asks for a new connection (the retry); null where there is no IndexedDB. */
export type OpenIdbStore = (fresh: boolean) => IdbStore | null;

const learnerStore: OpenIdbStore = (fresh) => {
  if (!indexedDbAvailable()) return null;
  if (!fresh) return { get: (key) => get(key), update: (key, next) => update(key, next) };
  const store = createStore(LEARNER_DB, LEARNER_STORE);
  return { get: (key) => get(key, store), update: (key, next) => update(key, next, store) };
};

/**
 * What a read found: the record (`{}` when the device never chose anything) and whether the
 * device holds learner profiles (the presence check only), or that it cannot be read.
 */
export type DeviceSettingsRead = { readable: true; value: DeviceSettings; hasProfiles: boolean } | { readable: false };

/** A stored JSON string as the plain object it holds (every key kept); missing, empty, damaged or not an object is `{}`. */
export function parseStoredObject(raw: unknown): Record<string, unknown> {
  if (typeof raw !== 'string' || raw === '') return {};
  try {
    const parsed: unknown = JSON.parse(raw);
    return parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

/** A stored object as a record: a field this version does not know reads as absent. */
function settingsOf(stored: Record<string, unknown>): DeviceSettings {
  const parsed = DeviceSettingsSchema.safeParse(stored);
  return parsed.success ? parsed.data : {};
}

/** A stored JSON string as a record; a missing, empty or damaged value is `{}` (never chosen), a field this version does not know is absent. */
export function parseStoredSettings(raw: unknown): DeviceSettings {
  return settingsOf(parseStoredObject(raw));
}

async function readOnce(store: IdbStore): Promise<DeviceSettingsRead | null> {
  try {
    const [settings, profiles] = await Promise.all([store.get(DEVICE_SETTINGS_STORAGE_KEY), store.get(PROFILES_STORAGE_KEY)]);
    return { readable: true, value: parseStoredSettings(settings), hasProfiles: hasProfileList(profiles) };
  } catch {
    return null;
  }
}

/** Runs `attempt` on the learner's store, and once more on a fresh connection when it fails; null when both fail. */
async function withRetry<T>(open: OpenIdbStore, attempt: (store: IdbStore) => Promise<T | null>): Promise<T | null> {
  const first = open(false);
  if (!first) return null;
  const result = await attempt(first);
  if (result !== null) return result;
  try {
    const retry = open(true);
    return retry ? await attempt(retry) : null;
  } catch {
    return null;
  }
}

export async function readDeviceSettings(open: OpenIdbStore = learnerStore): Promise<DeviceSettingsRead> {
  return (await withRetry(open, readOnce)) ?? { readable: false };
}

interface ChannelLike {
  postMessage: (message: unknown) => void;
  close: () => void;
  onmessage: ((event: { data: unknown }) => void) | null;
}

export type OpenChannel = () => ChannelLike | null;

const browserChannel: OpenChannel = () => {
  const Ctor = (globalThis as { BroadcastChannel?: new (name: string) => ChannelLike }).BroadcastChannel;
  if (typeof Ctor !== 'function') return null;
  try {
    return new Ctor(PREFS_CHANNEL);
  } catch {
    return null;
  }
};

/**
 * One `hr-prefs` channel per tab, used both to post and to listen. A BroadcastChannel never
 * delivers a message to the instance that posted it, so a tab never receives its own writes (an
 * older write echoing back would briefly undo a newer one). Opened on first use and kept for the
 * life of the page.
 */
export interface PrefsHub {
  post: (message: unknown) => void;
  listen: (onData: (data: unknown) => void) => () => void;
}

export function createPrefsHub(open: OpenChannel = browserChannel): PrefsHub {
  let channel: ChannelLike | null | undefined;
  const listeners = new Set<(data: unknown) => void>();
  const ensure = (): ChannelLike | null => {
    if (channel !== undefined) return channel;
    channel = open();
    if (channel) {
      channel.onmessage = (event) => {
        for (const onData of [...listeners]) onData(event.data);
      };
    }
    return channel;
  };
  return {
    post: (message) => {
      const c = ensure();
      if (!c) return;
      try {
        c.postMessage(message);
      } catch {
        // Only the live update is lost; the other tab re-reads when it comes back to the front.
      }
    },
    listen: (onData) => {
      ensure();
      listeners.add(onData);
      return () => {
        listeners.delete(onData);
      };
    },
  };
}

let tabHub: PrefsHub | null = null;
/** This tab's hub (created on first use). */
function defaultHub(): PrefsHub {
  tabHub ??= createPrefsHub();
  return tabHub;
}

/** Tells the other tabs of the origin (the learner app, All lessons, the presenter, other grown-up pages). */
export function postDeviceSettings(value: DeviceSettings, hub: PrefsHub = defaultHub()): void {
  try {
    hub.post(prefsMessage(value));
  } catch {
    // Nothing to tell.
  }
}

/** Thrown out of an `update` callback when `decide` changes nothing: the transaction ends without a write. */
const UNCHANGED = Symbol('unchanged');

interface WriteOnce {
  next: DeviceSettings;
  wrote: boolean;
}

async function writeOnce(store: IdbStore, decide: (stored: DeviceSettings) => DeviceSettingsPatch | null): Promise<WriteOnce | null> {
  // One transaction reads and writes, so a field another tab writes in between is never lost.
  const found: { result: WriteOnce | null } = { result: null };
  try {
    await store.update(DEVICE_SETTINGS_STORAGE_KEY, (value) => {
      const raw = parseStoredObject(value);
      const stored = settingsOf(raw);
      const patch = decide(stored);
      if (patch === null) {
        found.result = { next: stored, wrote: false };
        throw UNCHANGED;
      }
      const merged = mergeDeviceSettings(raw, patch);
      found.result = { next: settingsOf(merged), wrote: true };
      return JSON.stringify(merged);
    });
    return found.result;
  } catch (error) {
    return error === UNCHANGED ? found.result : null;
  }
}

/**
 * Read-modify-write of the record (AMENDMENTS-DISPLAY-NAV section 3.1), in one IndexedDB
 * transaction: `decide` gets what is stored now and returns the fields to change, or null to change
 * nothing (a seed that finds a choice already there, an account value that is no longer newer).
 * Only those fields change, so a key the learner app or a newer build wrote is kept, and a write
 * another tab makes at the same moment is not lost. A failed read or write is retried once on a
 * fresh connection. A record that was written is posted to the other tabs. Returns the record as
 * it is stored now (written, or as found when `decide` changed nothing), or null when it could not
 * be read or written (no IndexedDB, a refused write); the page keeps the change for this tab then.
 */
export async function writeDeviceSettings(
  decide: (stored: DeviceSettings) => DeviceSettingsPatch | null,
  deps: { open?: OpenIdbStore; hub?: PrefsHub } = {},
): Promise<DeviceSettings | null> {
  const result = await withRetry(deps.open ?? learnerStore, (store) => writeOnce(store, decide));
  if (result === null) return null;
  if (result.wrote) postDeviceSettings(result.next, deps.hub);
  return result.next;
}

interface EventTargetLike {
  addEventListener: (type: string, fn: () => void) => void;
  removeEventListener: (type: string, fn: () => void) => void;
}

export interface FollowDeps {
  hub?: PrefsHub;
  win?: EventTargetLike | null;
  doc?: (EventTargetLike & { visibilityState?: string }) | null;
}

/**
 * Follows the record across tabs: `onRecord` gets a record another tab posted, `onReturn` runs
 * when the page comes back to the front (`visibilitychange` to visible) or is restored from the
 * back/forward cache (`pageshow`). Returns the unsubscribe.
 */
export function followDeviceSettings(onRecord: (value: DeviceSettings) => void, onReturn: () => void, deps: FollowDeps = {}): () => void {
  const stopListening = (deps.hub ?? defaultHub()).listen((data) => {
    const parsed = PrefsMessageSchema.safeParse(data);
    if (parsed.success) onRecord(parsed.data.settings);
  });
  const g = globalThis as { addEventListener?: unknown; document?: FollowDeps['doc'] };
  const win = deps.win !== undefined ? deps.win : typeof g.addEventListener === 'function' ? (globalThis as unknown as EventTargetLike) : null;
  const doc = deps.doc !== undefined ? deps.doc : (g.document ?? null);
  const onVisibility = (): void => {
    if (doc?.visibilityState !== 'hidden') onReturn();
  };
  const onShow = (): void => onReturn();
  try {
    doc?.addEventListener('visibilitychange', onVisibility);
    win?.addEventListener('pageshow', onShow);
  } catch {
    // No events: the channel still works.
  }
  return () => {
    stopListening();
    try {
      doc?.removeEventListener('visibilitychange', onVisibility);
      win?.removeEventListener('pageshow', onShow);
    } catch {
      // Already gone.
    }
  };
}

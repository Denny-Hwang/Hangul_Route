import { DEVICE_SETTINGS_KEY, DeviceSettingsSchema, PREFS_CHANNEL, PrefsMessageSchema, prefsMessage, type DeviceSettings } from '@hangul-route/content-schema';
import { createStore, get, set } from 'idb-keyval';
import { LEARNER_DB, LEARNER_STORE } from '../console/device-marker';
import { indexedDbAvailable } from './safe-storage';

/**
 * The device's one display record on the grown-up pages (owner items 6 and 7): the learner app
 * keeps its language and text size in its default idb-keyval store as a JSON string under
 * `hr:device:settings` (`apps/mobile/src/platform/storage.web.ts`). The grown-up pages are on the
 * same origin, so they read and write that same record (the reader pattern of
 * `lib/console/device-marker.ts`: a read that fails is retried once on a fresh connection), and
 * every write is told to the other tabs on `BroadcastChannel('hr-prefs')`. Every access is
 * guarded: no IndexedDB, a failed read or a refused write never throws.
 */
export const DEVICE_SETTINGS_STORAGE_KEY = `hr:${DEVICE_SETTINGS_KEY}`;

export interface IdbStore {
  get: (key: string) => Promise<unknown>;
  set: (key: string, value: string) => Promise<void>;
}

/** Opens the learner's store: `fresh` asks for a new connection (the retry); null where there is no IndexedDB. */
export type OpenIdbStore = (fresh: boolean) => IdbStore | null;

const learnerStore: OpenIdbStore = (fresh) => {
  if (!indexedDbAvailable()) return null;
  if (!fresh) return { get: (key) => get(key), set: (key, value) => set(key, value) };
  const store = createStore(LEARNER_DB, LEARNER_STORE);
  return { get: (key) => get(key, store), set: (key, value) => set(key, value, store) };
};

/** What a read found: the record (`{}` when the device never chose anything), or that it cannot be read. */
export type DeviceSettingsRead = { readable: true; value: DeviceSettings } | { readable: false };

/** A stored JSON string as a record; a missing, empty or damaged value is `{}` (never chosen). */
export function parseStoredSettings(raw: unknown): DeviceSettings {
  if (typeof raw !== 'string' || raw === '') return {};
  try {
    const parsed = DeviceSettingsSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : {};
  } catch {
    return {};
  }
}

async function readOnce(store: IdbStore): Promise<DeviceSettingsRead | null> {
  try {
    return { readable: true, value: parseStoredSettings(await store.get(DEVICE_SETTINGS_STORAGE_KEY)) };
  } catch {
    return null;
  }
}

export async function readDeviceSettings(open: OpenIdbStore = learnerStore): Promise<DeviceSettingsRead> {
  const first = open(false);
  if (!first) return { readable: false };
  const read = await readOnce(first);
  if (read) return read;
  try {
    const retry = open(true);
    return (retry && (await readOnce(retry))) ?? { readable: false };
  } catch {
    return { readable: false };
  }
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

/** Tells the other tabs of the origin (the learner app, All lessons, the presenter, other grown-up pages). */
export function postDeviceSettings(value: DeviceSettings, open: OpenChannel = browserChannel): void {
  const channel = open();
  if (!channel) return;
  try {
    channel.postMessage(prefsMessage(value));
  } catch {
    // Only the live update is lost; the other tab re-reads when it comes back to the front.
  } finally {
    try {
      channel.close();
    } catch {
      // Nothing to release.
    }
  }
}

/**
 * Read-modify-write of the record: `patch` gets what is stored now (so a field the learner app
 * wrote meanwhile is kept), the result is written and posted. Returns the record written, or null
 * when nothing could be written (no IndexedDB, a refused write); the page keeps the change for
 * this tab then.
 */
export async function writeDeviceSettings(
  patch: (stored: DeviceSettings) => DeviceSettings,
  deps: { open?: OpenIdbStore; channel?: OpenChannel } = {},
): Promise<DeviceSettings | null> {
  const open = deps.open ?? learnerStore;
  const store = open(false);
  if (!store) return null;
  try {
    const stored = parseStoredSettings(await store.get(DEVICE_SETTINGS_STORAGE_KEY));
    const next = patch(stored);
    await store.set(DEVICE_SETTINGS_STORAGE_KEY, JSON.stringify(next));
    postDeviceSettings(next, deps.channel);
    return next;
  } catch {
    return null;
  }
}

interface EventTargetLike {
  addEventListener: (type: string, fn: () => void) => void;
  removeEventListener: (type: string, fn: () => void) => void;
}

export interface FollowDeps {
  channel?: OpenChannel;
  win?: EventTargetLike | null;
  doc?: (EventTargetLike & { visibilityState?: string }) | null;
}

/**
 * Follows the record across tabs: `onRecord` gets a record another tab posted, `onReturn` runs
 * when the page comes back to the front (`visibilitychange` to visible) or is restored from the
 * back/forward cache (`pageshow`). Returns the unsubscribe.
 */
export function followDeviceSettings(onRecord: (value: DeviceSettings) => void, onReturn: () => void, deps: FollowDeps = {}): () => void {
  const channel = (deps.channel ?? browserChannel)();
  if (channel) {
    channel.onmessage = (event) => {
      const parsed = PrefsMessageSchema.safeParse(event.data);
      if (parsed.success) onRecord(parsed.data.value);
    };
  }
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
    try {
      if (channel) {
        channel.onmessage = null;
        channel.close();
      }
      doc?.removeEventListener('visibilitychange', onVisibility);
      win?.removeEventListener('pageshow', onShow);
    } catch {
      // Already gone.
    }
  };
}

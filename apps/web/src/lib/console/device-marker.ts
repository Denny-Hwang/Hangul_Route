import { DEVICE_GATE_KEY, DeviceGateMarkerSchema, parseLenient } from '@hangul-route/content-schema';
import { createStore, get } from 'idb-keyval';
import { indexedDbAvailable } from '../i18n/safe-storage';
import type { DeviceGateRead } from './grown-up-lock';

/**
 * The learner app's device state, read by the grown-up lock (F-APP-001 section 3.9). The
 * learner app keeps its records in the default idb-keyval store as JSON strings under `hr:`
 * (`apps/mobile/src/platform/storage.web.ts`). The console reads exactly two keys: the gate
 * marker, and whether `hr:profiles` holds a non-empty list (for learner apps older than A-6).
 * It never parses or shows profile data. Every access is guarded (the web stand-in for the
 * safe storage hook, like `session.ts`):
 * - no IndexedDB API reads as `unavailable` (such a browser cannot keep learner profiles);
 * - a read that rejects or throws (a connection the browser closed, a backing store error) is
 *   retried once on a fresh connection, then reads as `failed`, which the lock treats as a
 *   device that may hold profiles (A-4a review 2026-10-12).
 */
export const DEVICE_GATE_STORAGE_KEY = `hr:${DEVICE_GATE_KEY}`;
export const PROFILES_STORAGE_KEY = 'hr:profiles';
/** idb-keyval's default database and store, which the learner app uses. */
export const LEARNER_DB = 'keyval-store';
export const LEARNER_STORE = 'keyval';

export interface IdbReader {
  get: (key: string) => Promise<unknown>;
}

/** Opens a reader: `fresh` asks for a new connection (the retry); null where there is no IndexedDB. */
export type OpenIdbReader = (fresh: boolean) => IdbReader | null;

const UNAVAILABLE: DeviceGateRead = { readable: false, reason: 'unavailable' };
const FAILED: DeviceGateRead = { readable: false, reason: 'failed' };

/** The learner's default store (idb-keyval's cached connection), or a new connection to it. */
const learnerReader: OpenIdbReader = (fresh) => {
  if (!indexedDbAvailable()) return null;
  if (!fresh) return { get: (key) => get(key) };
  const store = createStore(LEARNER_DB, LEARNER_STORE);
  return { get: (key) => get(key, store) };
};

/** Presence only: a stored string longer than `[]`. */
export function hasProfileList(raw: unknown): boolean {
  return typeof raw === 'string' && raw.length > '[]'.length;
}

/** Both keys, or null when either read fails. */
async function readOnce(reader: IdbReader): Promise<DeviceGateRead | null> {
  try {
    const [marker, profiles] = await Promise.all([reader.get(DEVICE_GATE_STORAGE_KEY), reader.get(PROFILES_STORAGE_KEY)]);
    return { readable: true, marker: parseLenient(DeviceGateMarkerSchema, marker), hasProfiles: hasProfileList(profiles) };
  } catch {
    return null;
  }
}

export async function readDeviceGate(open: OpenIdbReader = learnerReader): Promise<DeviceGateRead> {
  const first = open(false);
  if (!first) return UNAVAILABLE;
  const read = await readOnce(first);
  if (read) return read;
  try {
    const retry = open(true);
    return (retry && (await readOnce(retry))) ?? FAILED;
  } catch {
    return FAILED;
  }
}

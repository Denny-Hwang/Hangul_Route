import { DEVICE_GATE_KEY, DeviceGateMarkerSchema, parseLenient } from '@hangul-route/content-schema';
import { get } from 'idb-keyval';
import { indexedDbAvailable } from '../i18n/safe-storage';
import type { DeviceGateRead } from './grown-up-lock';

/**
 * The learner app's device state, read by the grown-up lock (F-APP-001 section 3.9). The
 * learner app keeps its records in the default idb-keyval store as JSON strings under `hr:`
 * (`apps/mobile/src/platform/storage.web.ts`). The console reads exactly two keys: the gate
 * marker, and whether `hr:profiles` holds a non-empty list (for learner apps older than A-6).
 * It never parses or shows profile data. Every access is guarded (the web stand-in for the
 * safe storage hook, like `session.ts`): any failure reads as unreadable.
 */
export const DEVICE_GATE_STORAGE_KEY = `hr:${DEVICE_GATE_KEY}`;
export const PROFILES_STORAGE_KEY = 'hr:profiles';

export interface IdbReader {
  get: (key: string) => Promise<unknown>;
}

/** The learner's default store, or null where the browser has no IndexedDB (SSR, node, blocked). */
function defaultReader(): IdbReader | null {
  return indexedDbAvailable() ? { get: (key) => get(key) } : null;
}

/** Presence only: a stored string longer than `[]`. */
export function hasProfileList(raw: unknown): boolean {
  return typeof raw === 'string' && raw.length > '[]'.length;
}

export async function readDeviceGate(reader: IdbReader | null = defaultReader()): Promise<DeviceGateRead> {
  if (!reader) return { readable: false };
  try {
    const [marker, profiles] = await Promise.all([reader.get(DEVICE_GATE_STORAGE_KEY), reader.get(PROFILES_STORAGE_KEY)]);
    return { readable: true, marker: parseLenient(DeviceGateMarkerSchema, marker), hasProfiles: hasProfileList(profiles) };
  } catch {
    return { readable: false };
  }
}

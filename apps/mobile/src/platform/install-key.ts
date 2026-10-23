import * as Crypto from 'expo-crypto';
import { readJson, writeJson } from './storage';

/*
 * The install key (F-CURR-002 section 4.8, row CM-17): a random id made on this device, once, kept in the storage
 * wrapper (`hr:goals:install-key`). It keys this device's points in `dayLog` and never leaves the snapshot: no
 * summary, report, header or telemetry event carries it, and it is not the sync device id.
 */

const KEY = 'goals:install-key';
const SHAPE = /^ik-[0-9a-f]{16}$/;

let key: string | null = null;
let read: Promise<void> | null = null;

/** Reads the stored key once; call before the first `goalInstallKey()` so this device keeps one key. */
export function loadInstallKey(): Promise<void> {
  if (read) return read;
  read = (async () => {
    const stored = await readJson<unknown>(KEY);
    if (key === null && typeof stored === 'string' && SHAPE.test(stored)) key = stored;
  })().catch(() => undefined);
  return read;
}

/** This device's install key, made once (in memory at once, saved for the next start). */
export function goalInstallKey(): string {
  if (key !== null) return key;
  key = `ik-${Crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;
  void writeJson(KEY, key).catch(() => undefined);
  return key;
}

/** Test seam. */
export function resetInstallKeyForTests(): void {
  key = null;
  read = null;
}

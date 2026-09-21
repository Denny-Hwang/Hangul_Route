import * as Crypto from 'expo-crypto';
import { readJson, writeJson } from './storage';

/**
 * Stable per-device id (F-SYNC-002 §3.1). Random, never derived from
 * hardware identifiers, created once and kept in the sanctioned storage.
 */
const KEY = 'device:id';
let cached: string | null = null;

export async function getDeviceId(): Promise<string> {
  if (cached) return cached;
  const saved = await readJson<string>(KEY);
  if (saved) {
    cached = saved;
    return saved;
  }
  const fresh = `device-${Crypto.randomUUID()}`;
  await writeJson(KEY, fresh);
  cached = fresh;
  return fresh;
}

/** Test seam: forget the in-memory copy (storage is left alone). */
export function resetDeviceIdCache(): void {
  cached = null;
}

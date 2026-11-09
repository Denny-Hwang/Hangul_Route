import type { AccountTrust, DeviceUses } from '@hangul-route/content-schema';
import { DEVICE_USES_RECORD_KEY, RETRUST_NOTICE_KEY, TRUST_RECORD_KEY, trustReadOf, type TrustRead } from '../logic/account/sign-in-records';
import { readJsonExact, removeKey, writeJson } from './storage';

/**
 * F-AUTH-004 sections 6.5, 6.6 and 13.1 (row NS-3): the native account's device records, through the `hr:` storage
 * wrapper (never AsyncStorage directly): the uses record `hr:grownup:deviceUses`, the trust `hr:grownup:trust` and the
 * re-trust notice `hr:grownup:retrustNotice`. None holds a name, an email, an account or space id, or anything of
 * Clerk's (CS-N7). Only native code imports this module.
 */

/** The trust record, read exactly: a failed read or a value that does not parse is `damaged` (no trust, CS-N3). */
export async function readTrust(): Promise<TrustRead> {
  try {
    return trustReadOf(await readJsonExact<unknown>(TRUST_RECORD_KEY), false);
  } catch {
    return trustReadOf(null, true);
  }
}

export function writeTrust(record: AccountTrust): Promise<void> {
  return writeJson(TRUST_RECORD_KEY, record);
}

export function writeDeviceUses(record: DeviceUses): Promise<void> {
  return writeJson(DEVICE_USES_RECORD_KEY, record);
}

/** The home's once-only notice after a re-trust (section 8.2; row NS-5 shows it and deletes it). */
export function writeRetrustNotice(at: number): Promise<void> {
  return writeJson(RETRUST_NOTICE_KEY, { v: 1, at });
}

/** Deletes one of the records above (`recordsToDelete` names them). */
export function removeRecord(key: string): Promise<void> {
  return removeKey(key);
}

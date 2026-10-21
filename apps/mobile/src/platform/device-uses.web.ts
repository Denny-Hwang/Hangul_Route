import { DEVICE_USES_TTL_MS, DeviceUsesSchema, SHELL_KEYS, parseLenient, type GrownUpUse } from '@hangul-route/content-schema';
import { defaultReader, type ShellReader } from './shell-store.web';

/**
 * [OA] The grown-up uses of the signed-in account known on this browser (AMENDMENTS-ONE-ACCOUNT-MANY-USERS section 7.1,
 * row OA-4b): the console's adult frame writes `{ v: 1, uses, at }` to `hr-shell` / `kv` key `deviceUses` whenever a
 * persona home renders, and Sign out deletes it. The learner app reads it here, read-only, for the chooser's Family,
 * Teacher and School rows; it never writes there. It holds no name, email or id (unknown keys are stripped).
 *
 * A record seen more than `DEVICE_USES_TTL_MS` (30 days) ago, or dated more than that ahead of this clock, a value that
 * does not parse, a failed read, a store that cannot open and a browser without IndexedDB all read as no uses: the
 * chooser then shows Sign in as a grown-up. Never throws.
 */
export async function readDeviceUses(open: () => ShellReader | null = defaultReader, now: () => number = Date.now): Promise<GrownUpUse[]> {
  try {
    const reader = open();
    if (!reader) return [];
    const record = parseLenient(DeviceUsesSchema, await reader.get(SHELL_KEYS.deviceUses));
    if (record === null || Math.abs(now() - record.at) > DEVICE_USES_TTL_MS) return [];
    return [...record.uses];
  } catch {
    return [];
  }
}

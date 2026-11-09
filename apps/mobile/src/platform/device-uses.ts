import type { GrownUpUse } from '@hangul-route/content-schema';
import { nativeSignInConfig } from '../config/native-signin';
import { readUsesRecord } from './account-records';

/**
 * [OA] The known grown-up uses on iOS and Android (AMENDMENTS-ONE-ACCOUNT-MANY-USERS section 7.1, row OA-4b; the web
 * variant is `device-uses.web.ts`, the console's record). F-AUTH-004 sections 7.1 and 13.1 (row NS-4): with the native
 * account on (`nativeSignInConfig`), the native uses record `hr:grownup:deviceUses`, which a native sign-in writes on a
 * device that holds a grown-up PIN only (ND-9), so a known use makes such a device shared (OA-D6); with it off, none,
 * exactly as at the basis (CS-N13). A record that is absent, stale, unreadable or not parsing is none. Never throws.
 */
export async function readDeviceUses(): Promise<GrownUpUse[]> {
  if (!nativeSignInConfig().enabled) return [];
  return (await readUsesRecord()) ?? [];
}

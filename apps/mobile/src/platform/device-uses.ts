import type { GrownUpUse } from '@hangul-route/content-schema';

/**
 * [OA] Native stub of the known grown-up uses (AMENDMENTS-ONE-ACCOUNT-MANY-USERS section 7.1, row OA-4b): `deviceUses`
 * is the console's record in its `hr-shell` database on the web app host, and the native chooser shows only the
 * Grown-up area (no sign-in until F-AUTH-004), so native knows none. The web variant is `device-uses.web.ts`.
 */
export async function readDeviceUses(): Promise<GrownUpUse[]> {
  return [];
}

import { listKeys, removeKey } from '../platform/storage';

/**
 * [OA] Row OA-7a (AMENDMENTS-ONE-ACCOUNT-MANY-USERS section 10.4, CS-20): the stored keys of a removed learner. Every
 * per-profile key keeps the id at its end (`<prefix>:<id>`, `store/profile-keys.ts`), so a key belongs to `id` when it
 * ends with `:<id>`. Used after a removal (each store has already deleted its own key; this catches a delete that
 * failed and a key a store wrote back meanwhile) and at launch for every tombstoned id (a key an older bundle in
 * another tab wrote back). Storage only: no store, no server.
 */
export const keyOfProfile = (key: string, profileId: string): boolean => key.endsWith(`:${profileId}`);

/** The stored keys of `profileIds`; an unreadable key list reads as none (the next pass tries again). */
async function keysOf(profileIds: readonly string[]): Promise<string[]> {
  if (profileIds.length === 0) return [];
  let keys: string[];
  try {
    keys = await listKeys();
  } catch {
    return [];
  }
  return keys.filter((key) => profileIds.some((id) => keyOfProfile(key, id)));
}

/**
 * Deletes every stored key of `profileIds`, then looks again and retries once what is still there. Answers whether
 * none is left. Never throws.
 */
export async function sweepProfileKeys(profileIds: readonly string[]): Promise<boolean> {
  for (let pass = 0; pass < 2; pass += 1) {
    const left = await keysOf(profileIds);
    if (left.length === 0) return true;
    await Promise.all(left.map((key) => removeKey(key).catch(() => undefined)));
  }
  return (await keysOf(profileIds)).length === 0;
}

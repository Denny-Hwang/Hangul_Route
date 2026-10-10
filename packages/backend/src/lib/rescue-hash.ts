import { hashSecret, toHex } from './device-auth';

/**
 * Rescue Codes at rest — F-RESTORE-001 §3.1, SEC-5. With the Worker secret
 * `RESCUE_PEPPER` set (`rescuePepper(env)` in lib/runtime), the stored hash is
 * HMAC-SHA-256(pepper, code), so a copy of the database alone cannot be
 * brute-forced offline. Without it the hash is plain SHA-256(code) — what
 * every code issued before SEC-5 was stored under — so turning the pepper on
 * never strands an existing code. Once set, the pepper must not change: codes
 * hashed under it would stop matching.
 *
 * The hash to store for a freshly issued code.
 */
export async function rescueHash(code: string, pepper: string | undefined): Promise<string> {
  if (!pepper) return hashSecret(code);
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', encoder.encode(pepper), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return toHex(new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(code))));
}

/** Hashes a typed code may be stored under: the keyed one first, then the legacy SHA-256. */
export async function rescueLookupHashes(code: string, pepper: string | undefined): Promise<string[]> {
  const legacy = await hashSecret(code);
  return pepper ? [await rescueHash(code, pepper), legacy] : [legacy];
}

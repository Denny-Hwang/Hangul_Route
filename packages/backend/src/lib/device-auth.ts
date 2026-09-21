import type { Context } from 'hono';
import { fail } from '../envelope';
import { store } from '../store';

/**
 * Device principal for learner traffic (F-SYNC-001 §1). Children have no
 * accounts, so a device registered for a learner holds a random secret;
 * only its SHA-256 is stored. Header: `Authorization: Device <deviceId>:<secret>`.
 */
const SECRET_BYTES = 32;

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

export function newDeviceSecret(): string {
  const bytes = new Uint8Array(SECRET_BYTES);
  crypto.getRandomValues(bytes);
  return toHex(bytes);
}

export async function hashSecret(secret: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(secret));
  return toHex(new Uint8Array(digest));
}

function constantTimeEquals(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export function parseDeviceHeader(header: string | undefined): { deviceId: string; secret: string } | null {
  if (!header || !header.startsWith('Device ')) return null;
  const raw = header.slice('Device '.length).trim();
  const sep = raw.indexOf(':');
  if (sep <= 0 || sep === raw.length - 1) return null;
  return { deviceId: raw.slice(0, sep), secret: raw.slice(sep + 1) };
}

/**
 * Authorize the calling device for `learnerId`. Returns the deviceId, or a
 * ready-to-return error Response (401 bad/missing credentials, 403 when the
 * device belongs to someone else, 404 unknown learner).
 */
export async function authorizeDevice(c: Context, learnerId: string): Promise<Response | string> {
  const creds = parseDeviceHeader(c.req.header('Authorization'));
  if (!creds) return fail(c, 'unauthorized', 'Device credentials required', 401);
  if (!store.learners.has(learnerId)) return fail(c, 'not_found', 'Learner not found', 404);
  const binding = store.device(learnerId, creds.deviceId);
  if (!binding) {
    // A device that exists for another learner is a mismatch, not a guess.
    const elsewhere = [...store.learnerDevices.values()].some((d) => d.deviceId === creds.deviceId);
    return fail(c, elsewhere ? 'forbidden' : 'unauthorized', 'Device is not bound to this learner', elsewhere ? 403 : 401);
  }
  if (!constantTimeEquals(await hashSecret(creds.secret), binding.secretHash)) {
    return fail(c, 'unauthorized', 'Bad device secret', 401);
  }
  binding.lastSeenAt = new Date().toISOString();
  return creds.deviceId;
}

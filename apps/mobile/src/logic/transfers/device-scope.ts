import { pinHashFingerprint } from '../shell/device-gate';

/**
 * Which credential this device holds for a learner — F-SPACE-002 section
 * 4.12 variant (a). The inbox does not say: a class-scoped device reads the
 * same `transfers: []` as an idle full one. A class re-link is the only path
 * that mints a class-scoped device (F-TCH-001 section 10.1); a Rescue Code
 * claim or a first sync mints a full one with a new secret. So the app marks
 * the scope when a re-link is approved (or a route answers `scope_limited`),
 * tied to a fingerprint of the secret it was minted with: a later claim on
 * the same device changes the secret and the marker no longer applies.
 */
export interface ScopeMarker {
  scope: 'class';
  /** A fingerprint of the device secret, never the secret itself (not a security primitive). */
  credential: string;
}

export function classScopeMarker(secret: string): ScopeMarker {
  return { scope: 'class', credential: pinHashFingerprint(secret) };
}

/** `class` only for a marker written for this very secret; anything else, damaged or missing, reads `full`. */
export function deviceScopeOf(marker: unknown, secret: string | null): 'full' | 'class' {
  if (secret === null || !marker || typeof marker !== 'object') return 'full';
  const m = marker as { scope?: unknown; credential?: unknown };
  return m.scope === 'class' && m.credential === pinHashFingerprint(secret) ? 'class' : 'full';
}

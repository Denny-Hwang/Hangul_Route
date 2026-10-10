import type { SpaceKind } from '@hangul-route/content-schema';

/** Re-link approval helpers — F-TCH-001 §10.1 (wireframe console/relink-approval). */
const MIN_MS = 60_000;

export function minutesLeft(expiresAt: string, now: Date): number {
  const ms = Date.parse(expiresAt) - now.getTime();
  return Number.isNaN(ms) ? 0 : Math.max(0, Math.ceil(ms / MIN_MS));
}

/** "expires in 8 min" · "expires in 1 min" · "expired" */
export function expiresLabel(expiresAt: string, now: Date): string {
  const left = minutesLeft(expiresAt, now);
  return left === 0 ? 'expired' : `expires in ${left} min`;
}

/** "asked just now" · "asked 2 min ago" */
export function requestedLabel(requestedAt: string, now: Date): string {
  const ms = now.getTime() - Date.parse(requestedAt);
  if (Number.isNaN(ms) || ms < MIN_MS) return 'asked just now';
  return `asked ${Math.floor(ms / MIN_MS)} min ago`;
}

/** Who may delete a learner's data from this space (F-TCH-001 §10.3). */
export function canDeleteLearnerData(kind: SpaceKind, consentMode: 'parent' | 'school'): boolean {
  if (kind === 'family') return true;
  return kind === 'class' && consentMode === 'school';
}

/**
 * Who may issue a new rescue code from the console (SEC-4): a code opens the
 * learner's whole snapshot, so it follows snapshot.read — family owners and
 * caregivers. The server refuses class and school roles with 403.
 */
export function canReissueRescueCode(kind: SpaceKind): boolean {
  return kind === 'family';
}

export const RELINK_REFRESH_MS = 10_000;

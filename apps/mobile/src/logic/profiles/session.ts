/**
 * Profile session lifecycle — F-PROF-001 §3.2, §3.4, §3.6.
 *
 * Pure logic: the clock is always passed in, never read from Date.now here,
 * so cooldown/expiry behaviour is deterministic under test.
 */

/** A verified parent session lets "add another child" skip a re-PIN (§3.2). */
export const PARENT_SESSION_MS = 15 * 60_000;

export interface ParentSession {
  /** Epoch ms at which the PIN was verified. */
  openedAt: number;
  /** Profile whose PIN opened this session. */
  profileId: string;
}

export function openParentSession(profileId: string, now: number): ParentSession {
  return { openedAt: now, profileId };
}

export function isParentSessionValid(session: ParentSession | null, now: number): boolean {
  if (session === null) return false;
  const age = now - session.openedAt;
  return age >= 0 && age < PARENT_SESSION_MS;
}

export function parentSessionRemainingMs(session: ParentSession | null, now: number): number {
  if (!isParentSessionValid(session, now)) return 0;
  return session!.openedAt + PARENT_SESSION_MS - now;
}

export function closeParentSession(): null {
  return null;
}

/**
 * Where a profile switch may be initiated from — §3.4. Switching mid-Quest
 * would strand the running game's state, so it is offered on home only.
 */
export type SwitchOrigin = 'home' | 'quest' | 'minigame' | 'onboarding';

export function canSwitchProfileFrom(origin: SwitchOrigin): boolean {
  return origin === 'home';
}

/**
 * Deep links and back-handlers must not cross into another profile's data
 * once a profile is active (§3.6) — the picker is a cold-launch surface.
 */
export function canEnterPicker(hasActiveProfile: boolean, origin: SwitchOrigin): boolean {
  if (!hasActiveProfile) return true;
  return canSwitchProfileFrom(origin);
}

export interface SwitchPlan {
  allowed: boolean;
  /** Work that must complete before the picker renders (§3.4). */
  persistRequired: boolean;
  reason?: 'locked-to-quest';
}

/**
 * A switch always persists the leaving profile's in-flight state first; a
 * paused Quest is resumable, never lost.
 */
export function planProfileSwitch(origin: SwitchOrigin, questInProgress: boolean): SwitchPlan {
  if (!canSwitchProfileFrom(origin)) {
    return { allowed: false, persistRequired: false, reason: 'locked-to-quest' };
  }
  return { allowed: true, persistRequired: questInProgress };
}

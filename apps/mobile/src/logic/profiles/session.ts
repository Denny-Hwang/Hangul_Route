/**
 * Profile session lifecycle — F-PROF-001 §3.2, §3.4, §3.6.
 *
 * Pure logic: the clock is always passed in, never read from Date.now here,
 * so cooldown/expiry behaviour is deterministic under test.
 */

import { GROWN_UP_BACKGROUND_MS, GROWN_UP_FRESH_PIN_MS } from '@hangul-route/content-schema';

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
 * [OA] AMENDMENTS-ONE-ACCOUNT-MANY-USERS section 6.2 (row OA-4a): `resume` is a pick on the chooser that a return
 * from the background opened over a running screen (a quest, a game, the story reader, the level check). It is
 * always allowed and always persists the leaving learner's state first.
 */
export type SwitchOrigin = 'home' | 'quest' | 'minigame' | 'onboarding' | 'resume';

export function canSwitchProfileFrom(origin: SwitchOrigin): boolean {
  return origin === 'home' || origin === 'resume';
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
  // [OA] A pick over a running screen never discards it without a persist, whatever the screen reports.
  if (origin === 'resume') return { allowed: true, persistRequired: true };
  return { allowed: true, persistRequired: questInProgress };
}

// ---- [OA] AMENDMENTS-ONE-ACCOUNT-MANY-USERS (row OA-2): the grown-up session closes on every hand-back ----

/**
 * [OA] OA-D5b (1): a change of the active learner, from any surface, closes the grown-up session. Choosing the
 * active learner again is no change; a first choice (no active learner before) is one.
 */
export function closesSession(prevActiveId: string | null, nextActiveId: string | null): boolean {
  return prevActiveId !== nextActiveId;
}

/** [OA] The grown-up controls that change who is on the device need a PIN within `GROWN_UP_FRESH_PIN_MS` (OA-D5b (3)). */
export type FreshPinAction = 'remove' | 'lock' | 'unlock' | 'join_other';

/**
 * [OA] Whether `action` must ask for the PIN (or face or fingerprint) again: unless one was entered in the last
 * `GROWN_UP_FRESH_PIN_MS` (2 minutes). An open 15-minute session alone is not enough. A clock that ran backwards
 * does not count as fresh.
 */
export function needsFreshPin(_action: FreshPinAction, lastPinVerifiedAt: number | null, now: number): boolean {
  if (lastPinVerifiedAt === null) return true;
  const age = now - lastPinVerifiedAt;
  return !(age >= 0 && age < GROWN_UP_FRESH_PIN_MS);
}

/**
 * [OA] OA-D16: a grown-up session ends after `GROWN_UP_BACKGROUND_MS` (5 minutes) in the background. Wall-clock
 * times (when the app was hidden, when it came back), not a timer, so a suspended page still counts the time.
 */
export function backgroundLapsed(hiddenAt: number | null, shownAt: number): boolean {
  if (hiddenAt === null) return false;
  return shownAt - hiddenAt >= GROWN_UP_BACKGROUND_MS;
}

/**
 * [OA] OA-D5b (2): where a route belongs. `area` is the Grown-up area stack (the local dashboard and every page
 * reached through the grown-up gate); `gate` is the PIN screens and onboarding, which never close or open
 * anything by themselves; every other route is a learner screen, so a route added later counts as a learner one
 * (the safe side: leaving the area for it asks the PIN again).
 */
export type RouteZone = 'area' | 'gate' | 'learner';

const AREA_ROUTES: ReadonlySet<string> = new Set([
  'ParentDashboard',
  'LearnerReport',
  'PlacementReport',
  'NotesGrownUp',
  'NoteReport',
  'EditProfile',
  'Restore',
  'SaveProgress',
  'Paywall',
  'MoveClass',
  'ApproveTransfer',
  'ClassScope',
  'RouteProposal',
  'RouteSetup',
  'RoutePreview',
]);
const GATE_ROUTES: ReadonlySet<string> = new Set(['PinEntry', 'PinReset', 'Onboarding']);

export function routeZone(name: string, params?: unknown): RouteZone {
  if (GATE_ROUTES.has(name)) return 'gate';
  if (AREA_ROUTES.has(name)) return 'area';
  // A learner's Learning Route opened read-only from the Grown-up area (F-ROUTE-001 section 3.1).
  if (name === 'MyRoute' && (params as { viewer?: unknown } | undefined)?.viewer === 'grownup') return 'area';
  return 'learner';
}

/**
 * [OA] Follows focus from route to route and says when it left the Grown-up area for a learner screen (Back,
 * Close or the tab bar, whatever the area was opened from). The PIN screens in between do not count: area, PIN
 * screen, learner screen is a leave too.
 */
export function areaExitTracker(): (zone: RouteZone) => boolean {
  let last: RouteZone | null = null;
  return (zone) => {
    if (zone === 'gate') return false;
    const left = last === 'area' && zone === 'learner';
    last = zone;
    return left;
  };
}

/** [OA] The grown-up session times the learner app holds in memory (`ui-store`). */
export interface GrownUpSessionTimes {
  parentGateOpenedAt: number | null;
  lastPinVerifiedAt: number | null;
}

/** [OA] What arriving at the chooser does (section 6.3, OA-D5, CS-2). */
export interface ChooserArrival {
  /** The session times after the arrival: both cleared. */
  times: GrownUpSessionTimes;
  /** Whether a grown-up session (the gate or a fresh PIN) was open and is now closed. */
  closed: boolean;
  /** This tab's `hr:grownup:unlock` and `hr:console:session` are cleared (web). */
  clearTab: true;
  /** The `hr-grownup` lock message is posted to the other tabs (web). */
  postLock: true;
}

/**
 * [OA] Section 6.3, OA-D5, CS-2: arriving at the chooser closes the grown-up session whatever it was (the 15-minute
 * gate and the fresh PIN both), clears the tab's unlock and console session, and tells the other tabs to lock. It
 * writes nothing else. A grown-up row opened right after asks the PIN again.
 */
export function closeOnChooser(state: GrownUpSessionTimes): ChooserArrival {
  return {
    times: { parentGateOpenedAt: null, lastPinVerifiedAt: null },
    closed: state.parentGateOpenedAt !== null || state.lastPinVerifiedAt !== null,
    clearTab: true,
    postLock: true,
  };
}

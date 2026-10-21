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

// ---- [OA] AMENDMENTS-ONE-ACCOUNT-MANY-USERS (row OA-2): the grown-up session closes on every hand-back ----

/**
 * [OA] OA-D5b (1): a change of the active learner, from any surface, closes the grown-up session. Choosing the
 * active learner again is no change; a first choice (no active learner before) is one.
 */
export function closesSession(prevActiveId: string | null, nextActiveId: string | null): boolean {
  return prevActiveId !== nextActiveId;
}

/**
 * [OA] The grown-up controls that change who is on the device need a PIN within `GROWN_UP_FRESH_PIN_MS` (OA-D5b (3));
 * so does Change PIN on the reset-by-wait notice (OA-D21), which sets a new PIN without asking the current one, and
 * so does turning face or fingerprint on (`biometric_on`, section 8.6, row OA-9).
 */
export type FreshPinAction = 'remove' | 'lock' | 'unlock' | 'join_other' | 'change_pin' | 'biometric_on';

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
// The onboarding stack's own screens are the focused routes while it shows (`getCurrentRoute` names the leaf).
const GATE_ROUTES: ReadonlySet<string> = new Set(['PinEntry', 'PinReset', 'Onboarding', 'Welcome', 'CreateProfile', 'FirstQuestPreview', 'PlacementInvite']);
/** Routes shared by learners and grown-ups: in the area when opened from it (`viewer: 'grownup'`), else a learner screen. */
const SHARED_ROUTES: ReadonlySet<string> = new Set(['MyRoute', 'RouteOverview']);

export function routeZone(name: string, params?: unknown): RouteZone {
  if (GATE_ROUTES.has(name)) return 'gate';
  if (AREA_ROUTES.has(name)) return 'area';
  // A learner's Learning Route or weekly plan opened from the Grown-up area (F-ROUTE-001 section 3.1, F-PLAN-002 3.9).
  if (SHARED_ROUTES.has(name) && (params as { viewer?: unknown } | undefined)?.viewer === 'grownup') return 'area';
  return 'learner';
}

/** [OA] What the tracker needs to know about the grown-up session when focus lands on a route. */
export interface FocusContext {
  /** A grown-up session (the 15-minute gate or a fresh PIN) is open. */
  sessionOpen: boolean;
  /**
   * The PIN screen just went back to the screen that asked, with the gate open for the action that waited there
   * (an Open link, Open billing, the level check's finish): that one landing keeps the session for that action.
   */
  returning: boolean;
}

const NO_SESSION: FocusContext = { sessionOpen: false, returning: false };

/**
 * [OA] Follows focus from route to route and says when the grown-up session must close (OA-D5b (2), CS-1, CS-15):
 * when focus leaves the Grown-up area for a learner screen (Back, Close or the tab bar, whatever the area was opened
 * from), and when it lands on any learner screen while a session is open, unless that landing is the PIN screen's
 * return to the action that asked for it. So an open session is honoured only inside the Grown-up area stack and
 * for that one waiting action, never by a later gate on a learner screen. The PIN screens and onboarding in
 * between do not count: area, PIN screen, learner screen is a leave too.
 */
export function areaExitTracker(): (zone: RouteZone, ctx?: FocusContext) => boolean {
  let last: RouteZone | null = null;
  return (zone, ctx = NO_SESSION) => {
    if (zone === 'gate') return false;
    const close = zone === 'learner' && (last === 'area' || (ctx.sessionOpen && !ctx.returning));
    last = zone;
    return close;
  };
}

/** [OA] A root stack route as the navigator keeps it; `key` and nested `state` are kept as they are. */
export interface LeaveRoute {
  name: string;
  params?: unknown;
  key?: string;
  state?: unknown;
}

/**
 * [OA] OA-D16, CS-14: the root routes to keep when a closed session leaves the Grown-up area: everything below the
 * first Grown-up area route (the learner screens the area was opened from). Null when no area route is on the
 * stack. A stack that starts in the area keeps the learner home (`Main`).
 */
export function areaLeaveRoutes(routes: ReadonlyArray<LeaveRoute>): LeaveRoute[] | null {
  const first = routes.findIndex((r) => routeZone(r.name, r.params) === 'area');
  if (first < 0) return null;
  return first === 0 ? [{ name: 'Main' }] : routes.slice(0, first);
}

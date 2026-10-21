import { parseJoinLink, safeNextPath } from '@hangul-route/content-schema';
import { afterGateHandoff } from '../browse/gate-entry';
import { grownUpPinParams } from './handoff-rules';
import { PIN_RESET_SETUP_PARAMS, type PinResetOutcome } from './pin-reset-ticket';

/**
 * Boot intents of the learner app (F-APP-001 sections 3.9 and 3.11). Pure: the root reads the
 * address once before `App` mounts (`platform/app-root.web.ts`), takes the intent, and writes
 * back the query this returns with `history.replaceState`, so a reload or a shared address never
 * repeats it.
 *
 * `gate=grown-up&next=<path>` is the grown-up lock's "Use the grown-up PIN" (A-4a `pinPathUrl`):
 * it opens the PIN screen for the grown-up area over the start screen and then returns to `next`.
 * `next` must pass `safeNextPath` (a grown-up path on this origin, section 3.11); anything else is
 * no intent, and both keys still leave the address. Every other key stays where it was, `lang`
 * included (the locale hand-off, `platform/locale.web.ts`, reads it later). An unknown `gate`
 * value is not an intent and is left alone.
 *
 * `gate=browse` (F-BROWSE-001 section 4.3, BR-12b) is the All lessons Access screen's "Back to the
 * grown-up area": the PIN screen for All lessons (`PinEntry { next: 'BrowseLessons' }`), then a fresh
 * gate pass. Only `gate` leaves the address; every other key stays, `lang` included.
 *
 * [OA] `gate=pin-reset` (AMENDMENTS-ONE-ACCOUNT-MANY-USERS section 8.5 step 5, row OA-6) is the console's
 * `/account/pin-reset` after a fresh sign-in by the PIN owner: the ticket it wrote decides (`pin-reset-ticket.ts`), so
 * the intent itself carries nothing. Only `gate` leaves the address; every other key stays, `lang` included.
 */
export interface GrownUpBootIntent {
  kind: 'grown-up';
  /** The grown-up page to open after the PIN: path and query, no fragment. */
  next: string;
}

export interface BrowseBootIntent {
  kind: 'browse';
}

/**
 * The class join link (owner decision 2026-10-17): `/join#c=<code>` opens Join a class with the code filled in
 * (`code` null: the link held no valid code, so the screen opens empty). A device with no profile yet starts the
 * class-code first run (the profile and consent steps, then Join a class), as Welcome's "Got a class code?" does.
 */
export interface JoinBootIntent {
  kind: 'join';
  code: string | null;
}

/** [OA] Section 8.5 step 5: the sign-in reset's hand-off; the ticket in `sessionStorage` holds the rest. */
export interface PinResetBootIntent {
  kind: 'pin-reset';
}

export type BootIntent = GrownUpBootIntent | BrowseBootIntent | JoinBootIntent | PinResetBootIntent;

export interface ParsedBootIntent {
  intent: BootIntent | null;
  /** The query to keep (`''` or `?…`): the input itself when nothing was read. */
  search: string;
  /** Whether the address must be rewritten. */
  changed: boolean;
}

const GATE = 'gate';
const NEXT = 'next';
const GROWN_UP_GATE = 'grown-up';
const BROWSE_GATE = 'browse';
const PIN_RESET_GATE = 'pin-reset';

const queryOf = (params: URLSearchParams): string => {
  const rest = params.toString();
  return rest === '' ? '' : `?${rest}`;
};

/**
 * The join link (owner decision 2026-10-17): on `/join` the intent is `join`, and the address the root writes back is
 * the app root with the query kept (`?lang=` included) and no fragment, so the code never stays in the address, in
 * the history entry or in a shared or reloaded link. Null on any other path (`parseBootIntent` then reads the query).
 */
export function parseJoinBootIntent(location: { pathname: string; search: string; hash: string }): { intent: JoinBootIntent; address: string } | null {
  const link = parseJoinLink(location);
  if (link === null) return null;
  return { intent: { kind: 'join', code: link.code }, address: `/${location.search}` };
}

export function parseBootIntent(search: string): ParsedBootIntent {
  const params = new URLSearchParams(search);
  const gate = params.get(GATE);
  if (gate === BROWSE_GATE) {
    params.delete(GATE);
    return { intent: { kind: 'browse' }, search: queryOf(params), changed: true };
  }
  if (gate === PIN_RESET_GATE) {
    params.delete(GATE);
    return { intent: { kind: 'pin-reset' }, search: queryOf(params), changed: true };
  }
  if (gate !== GROWN_UP_GATE) return { intent: null, search, changed: false };
  const next = safeNextPath(params.get(NEXT));
  params.delete(GATE);
  params.delete(NEXT);
  return {
    intent: next === null ? null : { kind: 'grown-up', next },
    search: queryOf(params),
    changed: true,
  };
}

/** What `openBootIntentWhenReady` needs of the navigation container (a subset of its ref). */
/** The PIN screen params a boot intent opens: the grown-up area's, All lessons' (BR-12b), or [OA] the new PIN's. */
export type BootPinParams = ReturnType<typeof grownUpPinParams> | { next: 'BrowseLessons' } | typeof PIN_RESET_SETUP_PARAMS;

/**
 * Where the join link opens: Join a class on a device with a profile, else Welcome with the link's code shown, where
 * Start runs the class-code first run and "I already have progress" (Restore) stays beside it.
 */
export type JoinIntentTarget =
  | { screen: 'JoinSpace'; params: { code?: string } }
  | { screen: 'Onboarding'; params: { screen: 'Welcome'; params: { classLink: true; code?: string } } };

export interface BootIntentNavigator {
  isReady: () => boolean;
  navigate: ((screen: 'PinEntry', params: BootPinParams) => void) &
    ((screen: 'ParentDashboard', params: { browseBlocked: true }) => void) &
    ((screen: 'JoinSpace', params: Extract<JoinIntentTarget, { screen: 'JoinSpace' }>['params']) => void) &
    ((screen: 'Onboarding', params: Extract<JoinIntentTarget, { screen: 'Onboarding' }>['params']) => void);
  addListener: (event: 'state', listener: () => void) => () => void;
}

/**
 * The join link's target (pure): Join a class when the device has a profile. A device with no profile opens Welcome
 * with the code on it, not the first-run form: on iOS a QR code scanned with the camera opens Safari, whose storage is
 * not the installed home-screen app's or the native app's, so a learner who already plays there lands here with "no
 * profile". Welcome shows the code to type in that app and keeps "I already have progress" next to Start.
 */
export function joinIntentTarget(intent: JoinBootIntent, hasProfile: boolean): JoinIntentTarget {
  const code = intent.code === null ? {} : { code: intent.code };
  if (hasProfile) return { screen: 'JoinSpace', params: code };
  return { screen: 'Onboarding', params: { screen: 'Welcome', params: { classLink: true, ...code } } };
}

export interface BootIntentSource {
  peek: () => BootIntent | null;
  consume: () => void;
}

/** What the join link needs to know of the device (owner decision 2026-10-17). */
export interface JoinIntentHandoff {
  /** Whether a learner profile exists on this device (the profile store, hydrated before the navigator mounts). */
  hasProfile: () => boolean;
}

/** [OA] The sign-in reset's hand-off for `gate=pin-reset` (section 8.5 step 5): web only. */
export interface PinResetIntentHandoff {
  /** The ticket read once at boot, checked against the clock and the current marker; `off` when the switch is off. */
  outcome: () => PinResetOutcome | 'off';
  /** Shows "That took a while. Sign in again to set a new PIN." over the start screen. */
  showExpired: () => void;
}

/** The All lessons gate hand-off for `gate=browse` (F-BROWSE-001 section 4.3): web only. */
export interface BrowseIntentHandoff {
  /** Whether the grown-up gate opens without the PIN now (`gateOpensDirectlyNow`). */
  opensDirectly: () => boolean;
  /** `openBrowseFromGate()`: writes the gate pass and leaves for All lessons; `false` when the browser refused the pass. */
  open: () => boolean;
}

/**
 * Opens the PIN screen for the intent the root read, exactly once (`navigation/boot-intent.tsx`):
 * at once when the navigator is ready, else on its first state change once it is, and then it
 * stops listening. Nothing happens when there is no intent, or when it was already taken (an
 * ErrorBoundary remount). `gate=browse` opens the PIN screen for All lessons, or the hand-off
 * itself when the gate opens directly; without a `browse` hand-off it is taken and dropped.
 * [OA] `gate=pin-reset` opens the new-PIN screen for an accepted ticket, else the expired line; with the switch off, or
 * without a `pinReset` hand-off, it is taken and dropped.
 * Returns the cleanup for the effect.
 */
export function openBootIntentWhenReady(
  nav: BootIntentNavigator,
  source: BootIntentSource,
  browse?: BrowseIntentHandoff,
  join?: JoinIntentHandoff,
  pinReset?: PinResetIntentHandoff,
): () => void {
  const open = (): boolean => {
    const intent = source.peek();
    if (intent === null) return true;
    if (!nav.isReady()) return false;
    source.consume();
    if (intent.kind === 'grown-up') nav.navigate('PinEntry', grownUpPinParams({ via: 'lock', target: intent.next }));
    else if (intent.kind === 'pin-reset') {
      const outcome = pinReset?.outcome() ?? 'off';
      if (outcome === 'setup') nav.navigate('PinEntry', PIN_RESET_SETUP_PARAMS);
      else if (outcome === 'expired') pinReset?.showExpired();
    } else if (intent.kind === 'join') {
      // The join link (owner decision 2026-10-17): without a `join` hand-off it is taken and dropped, as `browse` is.
      if (join === undefined) return true;
      const target = joinIntentTarget(intent, join.hasProfile());
      if (target.screen === 'JoinSpace') nav.navigate('JoinSpace', target.params);
      else nav.navigate('Onboarding', target.params);
    } else if (browse === undefined) return true;
    else if (browse.opensDirectly()) {
      // A refused pass opens the dashboard, which says why under Open all lessons (as the PIN screen does).
      if (afterGateHandoff(browse.open()) === 'dashboard') nav.navigate('ParentDashboard', { browseBlocked: true });
    } else nav.navigate('PinEntry', { next: 'BrowseLessons' });
    return true;
  };
  if (open()) return () => undefined;
  let off: (() => void) | null = null;
  off = nav.addListener('state', () => {
    if (open() && off !== null) {
      off();
      off = null;
    }
  });
  return () => {
    off?.();
    off = null;
  };
}

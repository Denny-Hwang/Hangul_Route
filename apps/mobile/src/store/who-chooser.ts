import { JOIN_HANDOFF_MS, PROFILE_LOCKS_KEY, ProfileLocksSchema, type Profile } from '@hangul-route/content-schema';
import { flags } from '../config/flags';
import { gateRequired } from '../logic/profiles/learner-type';
import { routeZone } from '../logic/profiles/session';
import { chooserTrigger, isSharedDevice, type ChooserEvent, type WhoMarker, type WhoTrigger } from '../logic/profiles/who';
import { consumeBootIntent, peekBootIntent } from '../platform/app-root';
import { subscribeAppVisibility } from '../platform/app-visibility';
import { takeJoinHandoff } from '../platform/join-handoff';
import { readJsonExact } from '../platform/storage';
import { useAccountStore } from './account-store';
import { useProfileStore } from './profile-store';
import { useProgressStore } from './progress-store';

/**
 * [OA] "Who is using this?" at run time (AMENDMENTS-ONE-ACCOUNT-MANY-USERS sections 6.2, 6.3, OA-D6, OA-D20; row
 * OA-4a): what the device looks like to the chooser now (shared or not, the active profile locked), the join code
 * held in memory for the learner picked there, the launch decision and the resume rule. The rules are pure in
 * `logic/profiles/who.ts`; this module reads the stores and the clock. Everything is inert while
 * `flags.whoChooserEnabled` is off.
 */

/** The learner profiles of the device, in creation order (grown-up device roles are never created, OA-D2). */
export function learnerProfiles(profiles: readonly Profile[] = useProfileStore.getState().profiles): Profile[] {
  return profiles.filter((p) => p.role === 'learner');
}

/** The device gate marker code as the gate behaves now: `none` (self-only, no PIN), `pin`, or `nopin`. */
export function whoMarker(): WhoMarker {
  const { profiles } = useProfileStore.getState();
  const { parentPinHash } = useAccountStore.getState();
  if (!gateRequired({ profiles, parentPinHash })) return 'none';
  return parentPinHash !== null ? 'pin' : 'nopin';
}

/** The locks as read at launch: ids, or `unread` for a stored record that does not parse or a failed read (13.2). */
export type LocksRead = readonly string[] | 'unread';

/**
 * Reads `hr:profiles:locks` for the launch and resume triggers (OA-D9, CS-19). Locks themselves are row OA-5; this
 * only reads them, failing closed: a record that does not parse, or a read that fails, is `unread`.
 */
export async function readProfileLocks(): Promise<LocksRead> {
  try {
    const raw = await readJsonExact<unknown>(PROFILE_LOCKS_KEY);
    if (raw === null) return [];
    const parsed = ProfileLocksSchema.safeParse(raw);
    return parsed.success ? parsed.data.ids : 'unread';
  } catch {
    return 'unread';
  }
}

let locksAtLaunch: LocksRead = [];

/** The locks that count now: none without a PIN (a lock without a PIN is void), every profile while unreadable. */
function effectiveLocks(profiles: readonly Profile[]): string[] {
  if (useAccountStore.getState().parentPinHash === null) return [];
  return locksAtLaunch === 'unread' ? profiles.map((p) => p.id) : [...locksAtLaunch];
}

/** Section 6.2: whether the device is shared now. The known uses (`deviceUses`, web) arrive with row OA-4b. */
export function deviceShared(): boolean {
  const profiles = learnerProfiles();
  return isSharedDevice({ profiles, locks: effectiveLocks(profiles), uses: [], marker: whoMarker() });
}

/** Whether any learner profile is locked now (`who.shown` `anyLocked`, section 15); every one while unreadable. */
export function anyProfileLocked(): boolean {
  return effectiveLocks(learnerProfiles()).length > 0;
}

/** Whether the active profile is locked now (CS-19). */
export function activeProfileLocked(): boolean {
  const { activeId } = useProfileStore.getState();
  return activeId !== null && effectiveLocks(learnerProfiles()).includes(activeId);
}

// ---- The held join code (OA-D20) ----

interface HeldJoin {
  code: string | null;
  at: number;
}

let held: HeldJoin | null = null;

/** Keeps a join code (or a link with no valid code) in memory, never in the address or a route, for 30 minutes. */
export function holdJoin(code: string | null, now: number = Date.now()): void {
  held = { code, at: now };
}

/** The held join while it is fresh (the hand-off's 30-minute life), else nothing; a stale one is dropped. */
export function heldJoin(now: number = Date.now()): { code: string | null } | null {
  if (held === null) return null;
  const age = now - held.at;
  if (age < 0 || age >= JOIN_HANDOFF_MS) {
    held = null;
    return null;
  }
  return { code: held.code };
}

/** Join consumes the held code for the learner picked on the chooser. */
export function takeHeldJoin(now: number = Date.now()): { code: string | null } | null {
  const fresh = heldJoin(now);
  held = null;
  return fresh;
}

// ---- Launch (section 6.2) ----

/**
 * The trigger the chooser opens with at launch, or `null` (Home or onboarding as before). Reads the locks first. On a
 * shared device, a `/join` link or the family home's hand-off code (`hr:shell:joinCode`) is moved into memory and
 * the chooser opens as `join`; the `who=1` intent is taken here too. Every other boot intent stays for
 * `BootIntentHook` (a `gate=` intent then opens its PIN screen over the chooser, CS-5). With the flag off nothing is
 * read and nothing is taken.
 */
export async function chooserLaunchTrigger(now: number = Date.now()): Promise<WhoTrigger | null> {
  if (!flags.whoChooserEnabled) return null;
  const profiles = learnerProfiles();
  if (profiles.length === 0) return null;
  locksAtLaunch = await readProfileLocks();
  const shared = deviceShared();
  const intent = peekBootIntent();
  let joinHeld = false;
  if (shared) {
    if (intent?.kind === 'join') {
      holdJoin(intent.code, now);
      consumeBootIntent();
      joinHeld = true;
    } else {
      const handed = takeJoinHandoff();
      if (handed !== null && batchOpensAtLaunch(profiles.length)) {
        // [OA] OA-D20, OA-D14 (row OA-7b): the family home's code opens Who is joining? instead of the chooser.
        batchHandoff = handed;
        if (intent?.kind === 'who') consumeBootIntent();
        return null;
      }
      if (handed !== null) {
        holdJoin(handed, now);
        joinHeld = true;
      }
    }
  }
  const event: ChooserEvent = intent?.kind === 'who' ? 'return' : 'launch';
  if (intent?.kind === 'who') consumeBootIntent();
  return chooserTrigger({ event, shared, activeLocked: activeProfileLocked(), profiles: profiles.length, backgroundMs: 0, joinHeld, flag: true });
}

// ---- [OA] Who is joining? at launch (OA-D14, OA-D20; row OA-7b) ----

/** The family home's hand-off code taken at launch for Who is joining?, in memory only (never in the address). */
let batchHandoff: string | null = null;

/**
 * [OA] Whether a family hand-off code at launch opens Who is joining? instead of the chooser (OA-D20): the flag on
 * (`EXPO_PUBLIC_MULTI_JOIN`), 2 or more learner profiles, and the active profile not locked. A locked active profile
 * keeps the chooser (CS-19): the hand-off is then held for the learner picked there, as before.
 */
export function batchOpensAtLaunch(learnerCount: number = learnerProfiles().length): boolean {
  return flags.multiJoinEnabled && learnerCount >= 2 && !activeProfileLocked();
}

/** Whether the launch took a hand-off code for Who is joining? (the root stack then opens Join over Home). */
export function batchHandoffPending(): boolean {
  return batchHandoff !== null;
}

/** Join takes the launch's hand-off code once; the lookup then runs at once and the checklist follows. */
export function takeBatchHandoff(): string | null {
  const code = batchHandoff;
  batchHandoff = null;
  return code;
}

/** The `who=1` hand-off for `BootIntentHook`: opens the chooser when the flag is on and a profile exists. */
export function whoReturnTrigger(): WhoTrigger | null {
  return chooserTrigger({
    event: 'return',
    shared: deviceShared(),
    activeLocked: activeProfileLocked(),
    profiles: learnerProfiles().length,
    backgroundMs: 0,
    joinHeld: heldJoin() !== null,
    flag: flags.whoChooserEnabled,
  });
}

/** Whether the Home Switch and the Profile row show (section 6.2): the flag on, 2 or more learners or a known use. */
export function switchOffered(profileCount: number = learnerProfiles().length): boolean {
  return flags.whoChooserEnabled && profileCount >= 2;
}

// ---- Resume (section 6.2) ----

/** A root route as the navigation container holds it. */
interface ChooserStackRoute {
  name: string;
  params?: unknown;
  key?: string;
  state?: unknown;
}

/** What the resume rule needs of the navigation container. */
export interface ChooserNavigation {
  isReady: () => boolean;
  getCurrentRoute: () => { name: string; params?: unknown } | undefined;
  navigate: (screen: 'WhoIsUsing', params: { trigger: WhoTrigger }) => void;
  getRootState: () => { routes: ReadonlyArray<ChooserStackRoute> } | undefined;
  /** `CommonActions.reset`, written out so this module loads without the navigation package. */
  dispatch: (action: { type: 'RESET'; payload: { index: number; routes: ChooserStackRoute[] } }) => void;
}

export interface ResumeDeps {
  subscribe: (listener: (visible: boolean) => void) => () => void;
  now: () => number;
  flag: () => boolean;
}

const resumeDeps = (): ResumeDeps => ({ subscribe: subscribeAppVisibility, now: () => Date.now(), flag: () => flags.whoChooserEnabled });

/** Routes the chooser never opens over on a resume: itself, and the PIN screens and onboarding (`gate`). */
function opensOver(route: { name: string; params?: unknown } | undefined): boolean {
  if (route === undefined || route.name === 'WhoIsUsing') return false;
  return routeZone(route.name, route.params) !== 'gate';
}

/**
 * The PIN screen a closed session leaves in place of the Grown-up area (`leaveGrownUpAreaOnClose`: 5 minutes in the
 * background end the session first, with the area in front). On a resume that opens the chooser it gives way to it.
 */
function areaLeavePin(route: { name: string; params?: unknown } | undefined): boolean {
  if (route?.name !== 'PinEntry') return false;
  const params = (route.params ?? {}) as Record<string, unknown>;
  return params.next === 'ParentDashboard' && Object.keys(params).length === 1;
}

/**
 * Section 6.2: back from the background (web `visibilitychange`, native `AppState`) after `CHOOSER_RESUME_MS`
 * (30 minutes) on a shared device, or after `GROWN_UP_BACKGROUND_MS` (5 minutes) with the active profile locked,
 * the chooser opens over the screen in front (a quest included; any other pick persists it first). Wall-clock
 * times, not a timer. Bound once for the learner app (App.tsx). Returns the unsubscribe.
 */
export function bindChooserResume(nav: ChooserNavigation, deps: ResumeDeps = resumeDeps()): () => void {
  let hiddenAt: number | null = null;
  return deps.subscribe((visible) => {
    if (!visible) {
      hiddenAt ??= deps.now();
      return;
    }
    const away = hiddenAt === null ? 0 : deps.now() - hiddenAt;
    hiddenAt = null;
    if (!deps.flag() || !nav.isReady()) return;
    const trigger = chooserTrigger({
      event: 'resume',
      shared: deviceShared(),
      activeLocked: activeProfileLocked(),
      profiles: learnerProfiles().length,
      backgroundMs: away,
      joinHeld: false,
      flag: true,
    });
    if (trigger === null) return;
    const route = nav.getCurrentRoute();
    if (opensOver(route)) {
      nav.navigate('WhoIsUsing', { trigger });
      return;
    }
    // A Grown-up area page was in front: the background rule already closed the session and left the area for its
    // PIN screen. The chooser takes that PIN screen's place, so whoever picks the device up is asked who is using it
    // (OA-D6), never handed the last learner's screen by Cancel.
    const routes = nav.getRootState()?.routes ?? [];
    if (!areaLeavePin(route) || routes.length < 2) return;
    const kept = [...routes.slice(0, -1), { name: 'WhoIsUsing', params: { trigger } }];
    nav.dispatch({ type: 'RESET', payload: { index: kept.length - 1, routes: kept } });
  });
}

/**
 * Section 6.2: a pick over a running screen persists the leaving learner first (`planProfileSwitch('resume')`): the
 * open practice session is ended and saved (every progress write is already saved as it happens). Never throws.
 */
export function persistLeaving(): void {
  try {
    const { openSession, endSession } = useProgressStore.getState();
    if (openSession !== null) endSession(openSession.profileId, openSession.sessionId);
  } catch {
    // Nothing open to save.
  }
}

/** Test seam: forget the launch locks and the held join. */
export function resetChooserState(): void {
  locksAtLaunch = [];
  held = null;
  batchHandoff = null;
}

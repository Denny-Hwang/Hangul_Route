import {
  APP_ROUTES,
  BROWSE_PASS_SESSION_KEY,
  CONSOLE_SESSION_KEY,
  UNLOCK_SESSION_KEY,
  safeNextPath,
  type DeviceGateMarker,
} from '@hangul-route/content-schema';
import type { UiLocale } from '@hangul-route/i18n';
import {
  decideHandoff,
  handoffTargetCode,
  handoffUrl,
  type GrownUpHandoffRequest,
} from '../logic/shell/handoff-rules';
import { currentDeviceGateMarker } from '../store/device-gate';
import { activeLocale, useLocaleStore } from '../store/locale-store';
import { useUiStore } from '../store/ui-store';
import { track as sendEvent, type TelemetryEvent } from './telemetry';
import { markLeaving } from './history-bridge.web';

/**
 * The learner app's hand-off into the grown-up area on the same origin (F-APP-001 section 3.9),
 * web only. The rules are `logic/shell/handoff-rules.ts`; this module reads the device state,
 * writes the per-tab unlock (`sessionStorage` `hr:grownup:unlock`) and navigates **in the same
 * tab**, so the unlock is in the tab that opens the grown-up page (and survives its Stripe round
 * trip). Every `sessionStorage` access is guarded (the web stand-in for the safe storage hook):
 * a browser that refuses storage gets no unlock and the console's lock asks for a sign-in.
 *
 * Callers: the PIN screen for `GrownUpArea` (the lock's PIN path, A-6) and, from A-7, the
 * Profile row, the dashboard card and the Plan screen. Native builds use the stub
 * (`grown-up-handoff.ts`), which no native screen calls (OD-6).
 */
export interface SessionArea {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem: (key: string) => void;
}

export interface HandoffState {
  /** The device gate marker as the learner app sees it (`null` before the stores load). */
  marker: DeviceGateMarker | null;
  lastPinVerifiedAt: number | null;
  locale: UiLocale;
}

export interface HandoffEnv {
  now: () => number;
  area: () => SessionArea | null;
  state: () => HandoffState;
  track: (event: TelemetryEvent) => Promise<boolean>;
  assign: (url: string) => void;
  wait: (ms: number) => Promise<void>;
}

/** `opened`: the tab is on its way to the grown-up page; `pin`: a fresh PIN is needed first (open the PIN screen). */
export type HandoffResult = 'opened' | 'pin';

/**
 * The longest a hand-off waits for its telemetry event before it leaves: long enough for a
 * normal POST, short enough that a slow network never holds the grown-up on a blank step.
 */
export const LEAVE_TELEMETRY_WAIT_MS = 1000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** This tab's `sessionStorage`, or null where it is missing or the browser refuses it. */
export function sessionArea(): SessionArea | null {
  try {
    return (globalThis as { sessionStorage?: SessionArea }).sessionStorage ?? null;
  } catch {
    // Blocked site data: the getter itself throws.
    return null;
  }
}

function browserAssign(url: string): void {
  // The history bridge writes nothing from here on: a traversal would cancel this navigation (AMENDMENTS-DISPLAY-NAV 7.2).
  markLeaving();
  (globalThis as { location?: { assign: (to: string) => void } }).location?.assign(url);
}

function browserEnv(): HandoffEnv {
  return {
    now: () => Date.now(),
    area: sessionArea,
    state: () => ({
      marker: currentDeviceGateMarker(),
      lastPinVerifiedAt: useUiStore.getState().lastPinVerifiedAt,
      locale: activeLocale(useLocaleStore.getState()),
    }),
    track: (event) => sendEvent(event),
    assign: browserAssign,
    wait: sleep,
  };
}

/**
 * Sends `event`, then calls `leave` once it is sent or after `LEAVE_TELEMETRY_WAIT_MS`, whichever
 * comes first, so a normal send is not cut short by the page change and a slow network never
 * keeps the tab here. Telemetry is best effort: a send the page change cuts short is lost (an
 * answered failure is queued by the telemetry client as usual).
 */
export async function trackThenLeave(
  event: TelemetryEvent,
  leave: () => void,
  deps: { track: (event: TelemetryEvent) => Promise<boolean>; wait?: (ms: number) => Promise<void> },
): Promise<void> {
  let sent: Promise<unknown>;
  try {
    sent = deps.track(event).catch(() => undefined);
  } catch {
    sent = Promise.resolve();
  }
  await Promise.race([sent, (deps.wait ?? sleep)(LEAVE_TELEMETRY_WAIT_MS)]);
  leave();
}

function writeUnlock(env: HandoffEnv, value: string): void {
  try {
    env.area()?.setItem(UNLOCK_SESSION_KEY, value);
  } catch {
    // No unlock: the console's lock then asks for a sign-in, never opens.
  }
}

/**
 * `openGrownUpArea({ via, target? })` (section 3.9): marker `none` goes straight on; `nopin` writes
 * nothing and goes (the console asks for a sign-in); `pin` needs a PIN verified in the last 2
 * minutes, else it returns `'pin'` and writes nothing. Then it writes the PIN unlock with the
 * marker epoch, emits `shell.grown_up_handoff { via, target }` and opens the target (a grown-up
 * path, `safeNextPath`) or the sign-in router, always with `?lang=` (English included).
 */
export async function openGrownUpArea(request: GrownUpHandoffRequest, env: HandoffEnv = browserEnv()): Promise<HandoffResult> {
  const { marker, lastPinVerifiedAt, locale } = env.state();
  const decision = decideHandoff({ marker, lastPinVerifiedAt, now: env.now() });
  if (decision.step === 'pin') return 'pin';
  const target = safeNextPath(request.target);
  if (decision.unlock) writeUnlock(env, JSON.stringify(decision.unlock));
  await trackThenLeave(
    { name: 'shell.grown_up_handoff', payload: { via: request.via, target: handoffTargetCode(request.via, target) } },
    () => env.assign(handoffUrl(target, locale)),
    env,
  );
  return 'opened';
}

/**
 * Removes the grown-up unlock, the console session and the All lessons pass of this tab
 * (section 3.9; the pass is F-BROWSE-001 section 4.3's `hr:browse:pass`): every boot of a learner
 * root and a learner page restored from the back/forward cache. A device handed back to a child
 * after [ Close ] or Back therefore cannot reopen All lessons from this tab by typing `/browse` or
 * pressing Forward (BR-6 review). The gate hand-off writes its pass after this boot, just before it
 * leaves, so it is unaffected. Nothing else in `sessionStorage` is touched; blocked or missing
 * storage is a no-op.
 */
export function clearGrownUpTab(area: SessionArea | null = sessionArea()): void {
  for (const key of [UNLOCK_SESSION_KEY, CONSOLE_SESSION_KEY, BROWSE_PASS_SESSION_KEY]) {
    try {
      area?.removeItem(key);
    } catch {
      // A storage that refuses keeps nothing we could remove.
    }
  }
}

/**
 * Forgets the PIN this tab saw: the fresh-PIN time and the 15-minute parent gate session, both in
 * memory only. A learner page restored from the back/forward cache calls it (`app-root.web.ts`),
 * so a device handed back after a grown-up page asks for the PIN again (A-6 review).
 */
export function forgetFreshPin(): void {
  useUiStore.setState({ lastPinVerifiedAt: null, parentGateOpenedAt: null });
}

/**
 * The PIN screen for `GrownUpArea` on a device with no PIN stored: Continue opens the waiting
 * grown-up page (or the sign-in router) without writing an unlock, so the console asks for a
 * sign-in (section 3.9).
 */
export function continueToGrownUpPage(
  target: string | null | undefined,
  locale: UiLocale,
  assign: (url: string) => void = browserAssign,
): void {
  assign(handoffUrl(safeNextPath(target) ?? APP_ROUTES.signIn, locale));
}

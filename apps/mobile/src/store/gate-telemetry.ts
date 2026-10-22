import { gateDestOf, gateOpenedEvent, markerCode, pinPausedEvent, profileSwitchEvent, type GateVia, type SwitchTrigger, type SwitchVia } from '../logic/profiles/gate-events';
import { gateOpensDirectly } from '../logic/profiles/gate-route';
import { track } from '../platform/telemetry';
import { useAccountStore } from './account-store';
import { currentDeviceGateMarker } from './device-gate';
import { useProfileStore } from './profile-store';

/**
 * [OA] AMENDMENTS-ONE-ACCOUNT-MANY-USERS section 15 (row OA-2): the gate and switch events, sent with codes only and
 * never a `profileId` (the Worker drops one anyway, `OA_PAYLOAD_RULES`). Best effort, never throws.
 */

/** `parent.gate.opened` for the PIN screen destination `next`, opened by `via`. */
export function trackGateOpened(next: string | undefined, via: GateVia): void {
  const marker = markerCode(currentDeviceGateMarker(), useAccountStore.getState().parentPinHash !== null);
  void track(gateOpenedEvent({ dest: gateDestOf(next), via, marker }));
}

/**
 * [OA] Section 15 (`parent.gate.opened` from every gate): the one call at a gate's decision, wrapped around whether
 * it opens with no PIN screen (`gateOpensDirectlyNow()`, `opensDirectly(...)`). It returns that decision unchanged
 * and, when the gate opens directly, sends the event for `next` (the destination the PIN screen would have opened):
 * `via: 'open'` on a device whose gate needs no PIN (a self-only device that never set one), else `via: 'session'`
 * (an open grown-up session). A gate that sends the PIN screen sends the event from there (`via: 'pin'`). Call it
 * only when the gate is used (a press, an entry), never while a screen renders.
 */
export function passGate(next: string, opens: boolean): boolean {
  if (!opens) return false;
  const account = useAccountStore.getState();
  const noGate = gateOpensDirectly({ profiles: useProfileStore.getState().profiles, parentPinHash: account.parentPinHash, sessionOpen: false });
  trackGateOpened(next, noGate ? 'open' : 'session');
  return true;
}

/**
 * `profile.switch` for a switch about to happen, timed from the leaving learner's session start (G1). [OA] `trigger`
 * (row OA-4a): the chooser's trigger when `via` is `chooser`.
 */
export function trackProfileSwitch(via: SwitchVia, locked: boolean, now: number = Date.now(), trigger?: SwitchTrigger): void {
  void track(profileSwitchEvent({ via, locked, sinceMs: now - useProfileStore.getState().activeSince, ...(trigger === undefined ? {} : { trigger }) }));
}

/** `pin.paused` with the step of the pause that just started. */
export function trackPinPaused(step: number): void {
  void track(pinPausedEvent(step));
}

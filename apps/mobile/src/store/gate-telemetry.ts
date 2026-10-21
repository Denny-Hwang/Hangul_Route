import { gateDestOf, gateOpenedEvent, markerCode, pinPausedEvent, profileSwitchEvent, type GateVia, type SwitchTrigger, type SwitchVia } from '../logic/profiles/gate-events';
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

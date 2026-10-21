import type { DeviceGateMarker, TelemetryEventName } from '@hangul-route/content-schema';

/**
 * [OA] Typed builders for the grown-up gate and profile switch events (AMENDMENTS-ONE-ACCOUNT-MANY-USERS section 15,
 * row OA-2). Payloads are codes, booleans and buckets only and **never** carry a `profileId`, a name or a PIN
 * fact beyond a code; the Worker enforces the same keys (`OA_PAYLOAD_RULES`) and the tests parse every builder
 * against `OA_TELEMETRY_PAYLOADS`.
 */
export interface GateEvent {
  name: TelemetryEventName;
  payload: Record<string, unknown>;
}

export type SwitchVia = 'chooser' | 'profile' | 'home';
export type SwitchTrigger = 'launch' | 'return' | 'resume' | 'join' | 'manual' | 'none';
export type MinutesIn = '0-2' | '2-10' | '10+';

const MINUTE_MS = 60_000;

/** Minutes since the session start, bucketed: under 2, under 10, then 10 or more. A clock that ran backwards is 0. */
export function minutesInBucket(sinceMs: number): MinutesIn {
  const ms = Math.max(0, sinceMs);
  if (ms < 2 * MINUTE_MS) return '0-2';
  if (ms < 10 * MINUTE_MS) return '2-10';
  return '10+';
}

/**
 * `profile.switch` (G1): `trigger` is the chooser's trigger when `via` is `chooser`, else `none`. The Profile tiles
 * send `{ via: 'profile', trigger: 'none' }` from OA-2 on, which starts the G1 baseline.
 */
export function profileSwitchEvent(input: { via: SwitchVia; trigger?: SwitchTrigger; locked: boolean; sinceMs: number }): GateEvent {
  const trigger: SwitchTrigger = input.via === 'chooser' ? (input.trigger ?? 'manual') : 'none';
  return { name: 'profile.switch', payload: { via: input.via, trigger, locked: input.locked, minutesIn: minutesInBucket(input.sinceMs) } };
}

export type GateDest = 'area' | 'use' | 'locked_profile' | 'action' | 'cancel_reset';
export type GateVia = 'pin' | 'biometric' | 'session' | 'open';
export type GateMarkerCode = 'none' | 'pin' | 'nopin';

const AREA_DESTINATIONS: ReadonlySet<string> = new Set([
  'ParentDashboard',
  'LearnerReport',
  'PlacementReport',
  'NotesGrownUp',
  'NoteReport',
  'MoveClass',
  'ApproveTransfer',
  'ClassScope',
  'LectureMode',
]);

/**
 * The `dest` code of a PIN screen destination: the Grown-up area and its pages are `area`; the grown-up pages on
 * the app host (`GrownUpArea`, and `GrownUpUse` from OA-4b) are `use`; a locked tile and Cancel the wait have their
 * own codes; every other gated control (add a learner, billing, a plan change, a link) is `action`.
 */
export function gateDestOf(next: string | undefined): GateDest {
  if (next === undefined || AREA_DESTINATIONS.has(next)) return 'area';
  if (next === 'GrownUpArea' || next === 'GrownUpUse') return 'use';
  if (next === 'LockedProfile') return 'locked_profile';
  if (next === 'CancelReset') return 'cancel_reset';
  return 'action';
}

/** The device gate marker as a code; before the marker is known it follows the PIN (`pin`, else `nopin`). */
export function markerCode(marker: DeviceGateMarker | null, pinSet: boolean): GateMarkerCode {
  if (marker !== null) return marker.gate;
  return pinSet ? 'pin' : 'nopin';
}

/** `parent.gate.opened`, from every gate: what opened (`dest`), how (`via`) and the device marker. */
export function gateOpenedEvent(input: { dest: GateDest; via: GateVia; marker: GateMarkerCode }): GateEvent {
  return { name: 'parent.gate.opened', payload: { dest: input.dest, via: input.via, marker: input.marker } };
}

/** `pin.paused`: the step (1 to 5) of the pause that just started. */
export function pinPausedEvent(step: number): GateEvent {
  return { name: 'pin.paused', payload: { step } };
}

/** [OA] Why the face or fingerprint shortcut changed (section 15, row OA-9). */
export type BiometricChangeReason = 'user' | 'pin_changed' | 'enrolment_changed';

/** `pin.biometric_changed`: turned on or off, and why. No token, no epoch, no time. */
export function biometricChangedEvent(on: boolean, reason: BiometricChangeReason): GateEvent {
  return { name: 'pin.biometric_changed', payload: { on, reason } };
}

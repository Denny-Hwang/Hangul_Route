import { OA_TELEMETRY_PAYLOADS, TELEMETRY_EVENT_NAMES } from '@hangul-route/content-schema';
import { describe, expect, it } from 'vitest';
import { biometricChangedEvent, gateDestOf, gateOpenedEvent, markerCode, minutesInBucket, pinPausedEvent, profileSwitchEvent } from '../gate-events';

const parse = (event: { name: string; payload: Record<string, unknown> }) =>
  OA_TELEMETRY_PAYLOADS[event.name as keyof typeof OA_TELEMETRY_PAYLOADS].safeParse(event.payload);

describe('[OA] profile.switch payload (section 15)', () => {
  it('Profile tiles: via profile, trigger none, the minutes bucket, no profile id', () => {
    const event = profileSwitchEvent({ via: 'profile', locked: false, sinceMs: 30_000 });
    expect(event).toEqual({ name: 'profile.switch', payload: { via: 'profile', trigger: 'none', locked: false, minutesIn: '0-2' } });
    expect(parse(event).success).toBe(true);
    expect('profileId' in event).toBe(false);
  });

  it('trigger is kept only for the chooser (default manual), and none for every other via', () => {
    expect(profileSwitchEvent({ via: 'chooser', trigger: 'launch', locked: true, sinceMs: 0 }).payload.trigger).toBe('launch');
    expect(profileSwitchEvent({ via: 'chooser', locked: false, sinceMs: 0 }).payload.trigger).toBe('manual');
    expect(profileSwitchEvent({ via: 'home', trigger: 'launch', locked: false, sinceMs: 0 }).payload.trigger).toBe('none');
    for (const via of ['chooser', 'profile', 'home'] as const) expect(parse(profileSwitchEvent({ via, locked: false, sinceMs: 0 })).success).toBe(true);
  });

  it('buckets the minutes since the session start', () => {
    expect(minutesInBucket(-5)).toBe('0-2');
    expect(minutesInBucket(119_999)).toBe('0-2');
    expect(minutesInBucket(120_000)).toBe('2-10');
    expect(minutesInBucket(599_999)).toBe('2-10');
    expect(minutesInBucket(600_000)).toBe('10+');
  });
});

describe('[OA] parent.gate.opened payload (section 15)', () => {
  it('maps every PIN screen destination to a dest code', () => {
    for (const next of [undefined, 'ParentDashboard', 'LearnerReport', 'PlacementReport', 'NotesGrownUp', 'NoteReport', 'MoveClass', 'ApproveTransfer', 'ClassScope', 'LectureMode', 'BiometricShortcut']) {
      expect(gateDestOf(next), String(next)).toBe('area');
    }
    expect(gateDestOf('GrownUpArea')).toBe('use');
    expect(gateDestOf('GrownUpUse')).toBe('use');
    expect(gateDestOf('LockedProfile')).toBe('locked_profile');
    expect(gateDestOf('CancelReset')).toBe('cancel_reset');
    for (const next of ['AddProfile', 'Restore', 'SaveProgress', 'Paywall', 'Billing', 'ExternalLink', 'EditProfile', 'RouteProposal', 'BrowseLessons']) {
      expect(gateDestOf(next), next).toBe('action');
    }
  });

  it('reads the marker, and before it is known follows the PIN', () => {
    expect(markerCode({ v: 1, gate: 'pin', pinEpoch: 5 }, false)).toBe('pin');
    expect(markerCode({ v: 1, gate: 'none' }, true)).toBe('none');
    expect(markerCode({ v: 1, gate: 'nopin' }, true)).toBe('nopin');
    expect(markerCode(null, true)).toBe('pin');
    expect(markerCode(null, false)).toBe('nopin');
  });

  it('builds a payload the schema accepts for every combination', () => {
    for (const dest of ['area', 'use', 'locked_profile', 'action', 'cancel_reset'] as const)
      for (const via of ['pin', 'biometric', 'session', 'open'] as const)
        for (const marker of ['none', 'pin', 'nopin'] as const) {
          const event = gateOpenedEvent({ dest, via, marker });
          expect(event.name).toBe('parent.gate.opened');
          expect(parse(event).success).toBe(true);
        }
  });
});

describe('[OA] pin.paused payload', () => {
  it('carries the step only, and the names are registered', () => {
    expect(pinPausedEvent(3)).toEqual({ name: 'pin.paused', payload: { step: 3 } });
    for (const step of [1, 2, 3, 4, 5]) expect(parse(pinPausedEvent(step)).success).toBe(true);
    expect(parse(pinPausedEvent(6)).success).toBe(false);
    for (const name of ['pin.paused', 'parent.gate.opened', 'profile.switch']) expect(TELEMETRY_EVENT_NAMES).toContain(name);
  });
});

describe('[OA] pin.biometric_changed payload (section 15, row OA-9)', () => {
  it('on and the reason only, for every reason, and the Worker rule accepts it', () => {
    for (const reason of ['user', 'pin_changed', 'enrolment_changed'] as const) {
      for (const on of [true, false]) {
        const event = biometricChangedEvent(on, reason);
        expect(event).toEqual({ name: 'pin.biometric_changed', payload: { on, reason } });
        expect(parse(event).success).toBe(true);
      }
    }
    expect(TELEMETRY_EVENT_NAMES).toContain('pin.biometric_changed');
  });

  it('the gate opened by face or fingerprint is via biometric', () => {
    const event = gateOpenedEvent({ dest: 'area', via: 'biometric', marker: 'pin' });
    expect(parse(event).success).toBe(true);
  });
});

import { layoutClassFor } from '@hangul-route/design-system/layout';
import { describe, expect, it } from 'vitest';
import {
  GUARD_EXEMPT_ROUTES,
  guardLockAction,
  guardTransition,
  isDeviceLandscape,
  isGuardExempt,
  isPhoneDevice,
  layoutObservedPayload,
  shouldEmitObserved,
  shouldShowPortraitGuard,
  type DeviceSignals,
  type GuardInput,
} from '../orientation-guard';

const at = (width: number, height: number) => layoutClassFor({ width, height });

/** Nothing known about the physical device: the window decides (native, or a browser without the APIs). */
const UNKNOWN: DeviceSignals = { screenForm: null, orientation: null };

/** The form of a physical screen, as `PortraitGuard` derives it. */
const screenOf = (width: number, height: number) => layoutClassFor({ width, height }).form;

const base: GuardInput = {
  layout: at(844, 390),
  device: UNKNOWN,
  coarsePointer: true,
  route: '/',
  allowedSideways: false,
  dismissedThisSession: false,
  editingText: false,
};

/** F-LAYOUT-001 §3.4: true iff phone && landscape && coarse && !allowed && !dismissed && !exempt. */
describe('shouldShowPortraitGuard', () => {
  it('shows for a touch phone on its side', () => {
    expect(shouldShowPortraitGuard(base)).toBe(true);
    expect(shouldShowPortraitGuard({ ...base, layout: at(932, 430) })).toBe(true);
    expect(shouldShowPortraitGuard({ ...base, layout: at(568, 320) })).toBe(true);
  });

  it('never shows upright', () => {
    expect(shouldShowPortraitGuard({ ...base, layout: at(390, 844) })).toBe(false);
    expect(shouldShowPortraitGuard({ ...base, layout: at(320, 568) })).toBe(false);
  });

  it('never shows on a tablet, in either orientation', () => {
    expect(shouldShowPortraitGuard({ ...base, layout: at(1180, 820) })).toBe(false);
    expect(shouldShowPortraitGuard({ ...base, layout: at(1024, 768) })).toBe(false);
    expect(shouldShowPortraitGuard({ ...base, layout: at(960, 600) })).toBe(false);
    expect(shouldShowPortraitGuard({ ...base, layout: at(768, 1024) })).toBe(false);
  });

  it('never shows on a short desktop window (long side over 1000)', () => {
    expect(shouldShowPortraitGuard({ ...base, layout: at(1100, 500) })).toBe(false);
  });

  it('never shows with a mouse or trackpad', () => {
    expect(shouldShowPortraitGuard({ ...base, coarsePointer: false })).toBe(false);
  });

  it('stays away once "Keep sideways" was chosen on this device', () => {
    expect(shouldShowPortraitGuard({ ...base, allowedSideways: true })).toBe(false);
  });

  it('asks once a session: after the learner turned the phone upright it does not come back', () => {
    expect(shouldShowPortraitGuard({ ...base, dismissedThisSession: true })).toBe(false);
  });

  it('never shows on the presenter route', () => {
    expect(shouldShowPortraitGuard({ ...base, route: '/present' })).toBe(false);
    expect(shouldShowPortraitGuard({ ...base, route: '/present/abc' })).toBe(false);
  });

  it('shows on any other route, and when the route is unknown (native)', () => {
    expect(shouldShowPortraitGuard({ ...base, route: '/Main/Journey' })).toBe(true);
    expect(shouldShowPortraitGuard({ ...base, route: null })).toBe(true);
  });

  it('does not show before the window size is known (first web frame 0 x 0)', () => {
    expect(shouldShowPortraitGuard({ ...base, layout: at(0, 0) })).toBe(false);
  });
});

describe('isGuardExempt', () => {
  it('matches /present by path prefix only', () => {
    expect(GUARD_EXEMPT_ROUTES).toEqual(['/present']);
    expect(isGuardExempt('/present')).toBe(true);
    expect(isGuardExempt('/present/')).toBe(true);
    expect(isGuardExempt('/present/lecture-1')).toBe(true);
    expect(isGuardExempt('/presents')).toBe(false);
    expect(isGuardExempt('/presenter')).toBe(false);
    expect(isGuardExempt('/Main/present')).toBe(false);
    expect(isGuardExempt('/')).toBe(false);
    expect(isGuardExempt(null)).toBe(false);
  });
});

describe('device signals: the physical screen and orientation win over the window shape', () => {
  it('an upright phone whose window the soft keyboard made short is not on its side (review of PR 3)', () => {
    // iPhone SE, Safari tab, keyboard open: the visual viewport is 375x290, the phone is upright.
    const keyboard = { ...base, layout: at(375, 290), device: { screenForm: screenOf(375, 667), orientation: 'portrait' as const } };
    expect(shouldShowPortraitGuard(keyboard)).toBe(false);
    // Android split-screen 360x640 with a 300 px keyboard: 360x340.
    expect(shouldShowPortraitGuard({ ...keyboard, layout: at(360, 340), device: { screenForm: screenOf(360, 640), orientation: 'portrait' } })).toBe(false);
  });

  it('a phone really on its side shows the guard whatever the window does', () => {
    expect(shouldShowPortraitGuard({ ...base, device: { screenForm: screenOf(390, 844), orientation: 'landscape' } })).toBe(true);
  });

  it('never shows while a text field has focus, even when nothing else is known', () => {
    expect(shouldShowPortraitGuard({ ...base, layout: at(375, 290), editingText: true })).toBe(false);
  });

  it('a phone-sized window on a tablet screen (200 % zoom, Stage Manager, Slide Over) is not a phone', () => {
    const ipad = { screenForm: screenOf(820, 1180), orientation: 'landscape' as const };
    expect(shouldShowPortraitGuard({ ...base, layout: at(590, 410), device: ipad })).toBe(false);
    expect(shouldShowPortraitGuard({ ...base, layout: at(700, 500), device: ipad })).toBe(false);
  });

  it('isPhoneDevice: the screen decides when known, else the window', () => {
    expect(isPhoneDevice(at(590, 410), screenOf(820, 1180))).toBe(false);
    expect(isPhoneDevice(at(844, 390), screenOf(390, 844))).toBe(true);
    expect(isPhoneDevice(at(1100, 500), screenOf(1100, 500))).toBe(false);
    expect(isPhoneDevice(at(844, 390), null)).toBe(true);
    expect(isPhoneDevice(at(1180, 820), null)).toBe(false);
  });

  it('isDeviceLandscape: the device orientation decides when known, else the window', () => {
    expect(isDeviceLandscape(at(375, 290), 'portrait')).toBe(false);
    expect(isDeviceLandscape(at(390, 844), 'landscape')).toBe(true);
    expect(isDeviceLandscape(at(844, 390), null)).toBe(true);
    expect(isDeviceLandscape(at(390, 844), null)).toBe(false);
  });
});

describe('guardTransition (what the guard reports and remembers on each change)', () => {
  const upright = { ...base, layout: at(390, 844) };

  it('reports "shown" each time it appears', () => {
    expect(guardTransition({ wasShowing: false, show: true, input: base })).toEqual({ emit: 'shown', dismissedThisSession: false });
  });

  it('reports nothing while it keeps showing or stays away', () => {
    expect(guardTransition({ wasShowing: true, show: true, input: base })).toEqual({ emit: null, dismissedThisSession: false });
    expect(guardTransition({ wasShowing: false, show: false, input: upright })).toEqual({ emit: null, dismissedThisSession: false });
  });

  it('"rotated" and asks no more this session when a showing guard goes because the phone is upright', () => {
    expect(guardTransition({ wasShowing: true, show: false, input: upright })).toEqual({ emit: 'rotated', dismissedThisSession: true });
    const device = { screenForm: screenOf(390, 844), orientation: 'portrait' as const };
    expect(guardTransition({ wasShowing: true, show: false, input: { ...base, device } })).toEqual({ emit: 'rotated', dismissedThisSession: true });
  });

  it('"Keep sideways" is reported by its button, not as a rotation', () => {
    expect(guardTransition({ wasShowing: true, show: false, input: { ...base, allowedSideways: true } })).toEqual({ emit: null, dismissedThisSession: false });
  });

  it('a keyboard closing is not a rotation: no "rotated" while a field has focus', () => {
    expect(guardTransition({ wasShowing: true, show: false, input: { ...upright, editingText: true } })).toEqual({ emit: null, dismissedThisSession: false });
  });

  it('a window that stops being a phone (a resized desktop window) is not the learner turning it', () => {
    expect(guardTransition({ wasShowing: true, show: false, input: { ...base, layout: at(1180, 820) } })).toEqual({ emit: null, dismissedThisSession: false });
  });
});

describe('guardLockAction (best-effort runtime lock)', () => {
  const ready = { hydrated: true, knownSize: true, phone: true, allowedSideways: false };

  it('locks a phone that did not choose "Keep sideways"', () => {
    expect(guardLockAction(ready)).toBe('lock');
  });

  it('unlocks a tablet and after "Keep sideways"', () => {
    expect(guardLockAction({ ...ready, phone: false })).toBe('unlock');
    expect(guardLockAction({ ...ready, allowedSideways: true })).toBe('unlock');
  });

  it('does nothing before device:layout is read or the size is known', () => {
    expect(guardLockAction({ ...ready, hydrated: false })).toBeNull();
    expect(guardLockAction({ ...ready, knownSize: false })).toBeNull();
  });
});

describe('shouldEmitObserved (layout.observed once a session)', () => {
  it('fires once the window size is known, and only once', () => {
    expect(shouldEmitObserved(false, { windowWidth: 390, windowHeight: 844 })).toBe(true);
    expect(shouldEmitObserved(true, { windowWidth: 390, windowHeight: 844 })).toBe(false);
  });

  it('waits while the first web frame reports 0 x 0', () => {
    expect(shouldEmitObserved(false, { windowWidth: 0, windowHeight: 844 })).toBe(false);
    expect(shouldEmitObserved(false, { windowWidth: 390, windowHeight: 0 })).toBe(false);
  });
});

describe('layoutObservedPayload (layout.observed, §3.13)', () => {
  it('carries the class, form, orientation, panes and standalone, and no sizes', () => {
    expect(layoutObservedPayload(at(1180, 820), true)).toEqual({
      width: 'wide',
      form: 'tablet',
      orientation: 'landscape',
      panes: 2,
      standalone: true,
    });
    expect(layoutObservedPayload(at(390, 844), false)).toEqual({
      width: 'compact',
      form: 'phone',
      orientation: 'portrait',
      panes: 1,
      standalone: false,
    });
    const keys = Object.keys(layoutObservedPayload(at(844, 390), false));
    expect(keys.sort()).toEqual(['form', 'orientation', 'panes', 'standalone', 'width']);
  });
});

import { layoutClassFor } from '@hangul-route/design-system/layout';
import { describe, expect, it } from 'vitest';
import {
  GUARD_EXEMPT_ROUTES,
  guardDismissal,
  isGuardExempt,
  layoutObservedPayload,
  shouldShowPortraitGuard,
  type GuardInput,
} from '../orientation-guard';

const at = (width: number, height: number) => layoutClassFor({ width, height });

const base: GuardInput = {
  layout: at(844, 390),
  coarsePointer: true,
  route: '/',
  allowedSideways: false,
  dismissedThisSession: false,
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

describe('guardDismissal', () => {
  it('reports "rotated" when a showing guard goes away because the phone is upright', () => {
    expect(guardDismissal({ wasShowing: true, layout: at(390, 844) })).toBe('rotated');
  });

  it('reports nothing while it keeps showing, or when it was not showing', () => {
    expect(guardDismissal({ wasShowing: true, layout: at(844, 390) })).toBeNull();
    expect(guardDismissal({ wasShowing: false, layout: at(390, 844) })).toBeNull();
  });

  it('reports nothing when the window stops being a phone (resized), which is not the learner turning it', () => {
    expect(guardDismissal({ wasShowing: true, layout: at(1180, 820) })).toBeNull();
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

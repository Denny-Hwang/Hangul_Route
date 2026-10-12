import { APP_ROUTES, GROWN_UP_FRESH_PIN_MS, GrownUpUnlockSchema } from '@hangul-route/content-schema';
import { describe, expect, it } from 'vitest';
import { decideHandoff, grownUpPinParams, handoffTargetCode, handoffUrl, isFreshPin } from '../handoff-rules';

/**
 * F-APP-001 section 3.9, `openGrownUpArea` (OD-3): marker `none` goes straight on, `nopin` writes
 * nothing, `pin` needs a PIN verified in the last 2 minutes (a gate the 15-minute session opened
 * does not count) and then writes a PIN unlock carrying the marker epoch.
 */
const NOW = 1_760_100_000_000;

describe('isFreshPin', () => {
  it('counts a PIN verified less than 2 minutes ago', () => {
    expect(GROWN_UP_FRESH_PIN_MS).toBe(120_000);
    expect(isFreshPin(NOW, NOW)).toBe(true);
    expect(isFreshPin(NOW - 119_000, NOW)).toBe(true);
    expect(isFreshPin(NOW - 119_999, NOW)).toBe(true);
  });

  it('does not count 2:00 or more, no PIN at all, or a clock that ran backwards', () => {
    expect(isFreshPin(NOW - 120_000, NOW)).toBe(false);
    expect(isFreshPin(NOW - 600_000, NOW)).toBe(false);
    expect(isFreshPin(null, NOW)).toBe(false);
    expect(isFreshPin(NOW + 1, NOW)).toBe(false);
  });
});

describe('decideHandoff', () => {
  it('none: no unlock is needed; go', () => {
    expect(decideHandoff({ marker: { v: 1, gate: 'none' }, lastPinVerifiedAt: null, now: NOW })).toEqual({ step: 'go', unlock: null });
  });

  it('nopin: writes nothing; go (the console lock asks for a sign-in)', () => {
    expect(decideHandoff({ marker: { v: 1, gate: 'nopin' }, lastPinVerifiedAt: NOW, now: NOW })).toEqual({ step: 'go', unlock: null });
  });

  it('pin with a PIN verified 1:59 ago: go with a PIN unlock carrying the marker epoch', () => {
    const decision = decideHandoff({ marker: { v: 1, gate: 'pin', pinEpoch: 1_759_000_000_000 }, lastPinVerifiedAt: NOW - 119_000, now: NOW });
    expect(decision).toEqual({ step: 'go', unlock: { v: 1, at: NOW, seen: NOW, src: 'pin', pinEpoch: 1_759_000_000_000 } });
    expect(decision.step === 'go' && GrownUpUnlockSchema.safeParse(decision.unlock).success).toBe(true);
  });

  it('pin with a PIN verified 2:00 ago, or only the 15-minute session open: ask for the PIN', () => {
    const marker = { v: 1, gate: 'pin', pinEpoch: 9 } as const;
    expect(decideHandoff({ marker, lastPinVerifiedAt: NOW - 120_000, now: NOW })).toEqual({ step: 'pin' });
    expect(decideHandoff({ marker, lastPinVerifiedAt: null, now: NOW })).toEqual({ step: 'pin' });
  });

  it('a PIN set before A-6 still writes its epoch 0 (the console never trusts it and says why)', () => {
    expect(decideHandoff({ marker: { v: 1, gate: 'pin', pinEpoch: 0 }, lastPinVerifiedAt: NOW, now: NOW })).toEqual({
      step: 'go',
      unlock: { v: 1, at: NOW, seen: NOW, src: 'pin', pinEpoch: 0 },
    });
  });
});

describe('handoffTargetCode', () => {
  it('no target is the sign-in router', () => {
    expect(handoffTargetCode('profile', undefined)).toBe('router');
    expect(handoffTargetCode('dashboard', null)).toBe('router');
  });

  it('the billing page is billing, except from the lock, which returns to its own page', () => {
    expect(handoffTargetCode('plan', APP_ROUTES.billing)).toBe('billing');
    expect(handoffTargetCode('lock', APP_ROUTES.billing)).toBe('next');
  });

  it('any other page is next', () => {
    expect(handoffTargetCode('lock', '/parent')).toBe('next');
    expect(handoffTargetCode('lock', '/signin')).toBe('next');
    expect(handoffTargetCode('profile', '/teach/home')).toBe('next');
  });
});

describe('handoffUrl', () => {
  it('no target opens the sign-in router; English adds no lang', () => {
    expect(handoffUrl(null, 'en')).toBe('/signin');
    expect(handoffUrl('/parent', 'en')).toBe('/parent');
  });

  it('appends lang for a UI locale that is not the default (F-I18N-001 hand-off)', () => {
    expect(handoffUrl(null, 'ko')).toBe('/signin?lang=ko');
    expect(handoffUrl('/teach/space?id=sp_1', 'es')).toBe('/teach/space?id=sp_1&lang=es');
    expect(handoffUrl(APP_ROUTES.billing, 'es')).toBe('/account/billing?lang=es');
  });

  it('replaces a lang the target already carries, keeping the rest of its query as written', () => {
    expect(handoffUrl('/parent?lang=ko&x=a%3Ab', 'es')).toBe('/parent?x=a%3Ab&lang=es');
  });

  it('drops a lang the target carries for the default locale (the learner app speaks English now)', () => {
    expect(handoffUrl('/parent?lang=ko', 'en')).toBe('/parent');
    expect(handoffUrl('/teach/space?lang=ko&id=sp_1', 'en')).toBe('/teach/space?id=sp_1');
    expect(handoffUrl('/teach/space?id=sp_1&', 'en')).toBe('/teach/space?id=sp_1');
  });
});

describe('grownUpPinParams', () => {
  it('opens the PIN screen for GrownUpArea with the target and the entry', () => {
    expect(grownUpPinParams({ via: 'lock', target: '/parent' })).toEqual({ next: 'GrownUpArea', url: '/parent', grownUpVia: 'lock' });
    expect(grownUpPinParams({ via: 'profile' })).toEqual({ next: 'GrownUpArea', grownUpVia: 'profile' });
  });
});

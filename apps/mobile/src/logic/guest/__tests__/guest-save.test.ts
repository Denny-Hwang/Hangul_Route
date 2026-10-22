import { describe, expect, it } from 'vitest';
import { guestFormParams, guestSaveRecheck, guestSaveStack, guestSaveTarget, setupPromotesGuest } from '../guest-save';
import { guestLaterCard, guestSaveCard } from '../guest-save-cards';

/**
 * [GU] AMENDMENTS-GUEST-FIRST-LESSON sections 8.1, 8.2 and 8.6, CS-G9, CS-G10 (row GU-4, section 19): the save card,
 * the Not now card and where the save opens, for each case of `guestSaveGate`.
 */
const learner = { id: 'profile:mina0001', role: 'learner' as const };
const parent = { id: 'profile:dad00001', role: 'parent' as const };

describe('guestSaveCard (8.1)', () => {
  it('open: Hoya\'s line (card kept, or not yet), Keep my progress, a quiet Not now, no caption', () => {
    expect(guestSaveCard('open', true)).toEqual({ heading: 'line', keep: true, caption: false, notNow: 'quiet' });
    expect(guestSaveCard('open', false)).toEqual({ heading: 'lineNoCard', keep: true, caption: false, notNow: 'quiet' });
  });

  it('verify: the same with the PIN caption', () => {
    expect(guestSaveCard('verify', true)).toEqual({ heading: 'line', keep: true, caption: true, notNow: 'quiet' });
  });

  it('owner: only the ask-the-owner line and a filled Not now; no Keep my progress', () => {
    expect(guestSaveCard('owner', true)).toEqual({ heading: 'askOwner', keep: false, caption: false, notNow: 'filled' });
  });
});

describe('guestLaterCard (8.6)', () => {
  it('Add my name with an outlined Close; on an owner device the ask-the-owner line and a filled Close', () => {
    expect(guestLaterCard('open')).toEqual({ line: 'line', save: true, close: 'outlined' });
    expect(guestLaterCard('verify')).toEqual({ line: 'line', save: true, close: 'outlined' });
    expect(guestLaterCard('owner')).toEqual({ line: 'askOwner', save: false, close: 'filled' });
  });
});

describe('guestSaveTarget (8.2, CS-G9, CS-G10)', () => {
  it('open: the form as a first run', () => {
    expect(guestSaveTarget({ profiles: [], parentPinHash: null })).toEqual({ screen: 'CreateProfile', params: { firstRun: true, from: 'guest' } });
    // A grown-up role is not a learner.
    expect(guestSaveTarget({ profiles: [parent], parentPinHash: null })).toEqual({ screen: 'CreateProfile', params: { firstRun: true, from: 'guest' } });
  });

  it('verify: the PIN, verify only, with or without profiles', () => {
    expect(guestSaveTarget({ profiles: [], parentPinHash: 'salt:hash' })).toEqual({ screen: 'PinEntry', params: { next: 'SaveGuest' } });
    expect(guestSaveTarget({ profiles: [learner], parentPinHash: 'salt:hash' })).toEqual({ screen: 'PinEntry', params: { next: 'SaveGuest' } });
  });

  it('owner: nothing (never the form, never a PIN setup)', () => {
    expect(guestSaveTarget({ profiles: [learner], parentPinHash: null })).toBeNull();
  });

  it('the form after the PIN: a first run only on a device with no learner profile', () => {
    expect(guestFormParams([])).toEqual({ firstRun: true, from: 'guest' });
    expect(guestFormParams([learner])).toEqual({ firstRun: false, from: 'guest' });
  });
});

describe('guestSaveStack (6.3): Welcome\'s Add my name', () => {
  it('opens the save over the Not now card, so Back on step 1 lands there', () => {
    expect(guestSaveStack({ screen: 'CreateProfile', params: { firstRun: true, from: 'guest' } })).toEqual({
      index: 1,
      routes: [{ name: 'GuestLater' }, { name: 'CreateProfile', params: { firstRun: true, from: 'guest' } }],
    });
  });
});

describe('guestSaveRecheck: the gate read again before Continue writes anything (8.2, CS-G9, CS-G10)', () => {
  const base = { gated: false, guestId: 'profile:guest001', profiles: [] as { id: string; role?: 'learner' | 'parent' }[], parentPinHash: null as string | null, ownPinHash: null as string | null, readFailed: false };

  it('the case the form opened in still holds: go', () => {
    expect(guestSaveRecheck(base)).toBe('go');
    expect(guestSaveRecheck({ ...base, gated: true, parentPinHash: 'h' })).toBe('go');
    expect(guestSaveRecheck({ ...base, gated: true, parentPinHash: 'h', profiles: [learner] })).toBe('go');
    // A grown-up role is not a learner: still a first run.
    expect(guestSaveRecheck({ ...base, profiles: [parent] })).toBe('go');
  });

  it('open, then a learner added in another tab (no PIN): back to the save card, which now asks the owner (CS-G10)', () => {
    expect(guestSaveRecheck({ ...base, profiles: [learner] })).toBe('card');
    // A profile with no role reads as a learner.
    expect(guestSaveRecheck({ ...base, profiles: [{ id: 'profile:old00001' }] })).toBe('card');
  });

  it('open, then a PIN set in another tab: the SaveGuest PIN first (CS-G9), with or without a learner', () => {
    expect(guestSaveRecheck({ ...base, parentPinHash: 'h' })).toBe('pin');
    expect(guestSaveRecheck({ ...base, parentPinHash: 'h', profiles: [learner] })).toBe('pin');
  });

  it('a PIN this form wrote itself on an earlier Continue (the promotion failed) is not a PIN set elsewhere', () => {
    expect(guestSaveRecheck({ ...base, parentPinHash: 'mine', ownPinHash: 'mine' })).toBe('go');
    expect(guestSaveRecheck({ ...base, parentPinHash: 'theirs', ownPinHash: 'mine' })).toBe('pin');
  });

  it('verified, then the PIN removed: back to the save card (it draws the case as it now is)', () => {
    expect(guestSaveRecheck({ ...base, gated: true })).toBe('card');
    expect(guestSaveRecheck({ ...base, gated: true, profiles: [learner] })).toBe('card');
  });

  it('this guest saved in another tab: its Home; a read that failed or no guest: nothing is written', () => {
    expect(guestSaveRecheck({ ...base, profiles: [{ id: 'profile:guest001', role: 'learner' }] })).toBe('saved');
    expect(guestSaveRecheck({ ...base, readFailed: true })).toBe('retry');
    expect(guestSaveRecheck({ ...base, guestId: null })).toBe('retry');
  });
});

describe('setupPromotesGuest (GU-D11): the same learner count as the guest rules', () => {
  it('a live guest and no learner profile; a profile with no role counts as a learner, a grown-up role does not', () => {
    expect(setupPromotesGuest({ guestLive: true, profiles: [] })).toBe(true);
    expect(setupPromotesGuest({ guestLive: true, profiles: [parent] })).toBe(true);
    expect(setupPromotesGuest({ guestLive: true, profiles: [{ id: 'profile:old00001' }] })).toBe(false);
    expect(setupPromotesGuest({ guestLive: true, profiles: [learner] })).toBe(false);
    expect(setupPromotesGuest({ guestLive: false, profiles: [] })).toBe(false);
  });
});

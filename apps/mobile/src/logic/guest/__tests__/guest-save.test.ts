import { describe, expect, it } from 'vitest';
import { guestFormParams, guestSaveStack, guestSaveTarget } from '../guest-save';
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

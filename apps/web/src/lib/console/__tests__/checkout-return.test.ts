import { CHECKOUT_POLL_MAX, CHECKOUT_POLL_MS, type BillingSpaceCard, type BillingSummary } from '@hangul-route/content-schema';
import { getMessages } from '@hangul-route/i18n';
import { describe, expect, it } from 'vitest';
import {
  busyCardId,
  cleanedReturnSearch,
  focusCardId,
  initialReturnState,
  readCheckoutReturn,
  returnNotice,
  returnStep,
  shouldPoll,
  POLL_INTERVAL_MS,
  type ReturnEvent,
  type ReturnState,
} from '../checkout-return';

/**
 * F-BILL-002 B-7: the return from Stripe as a pure state machine (section 4.5,
 * wireframe billing/checkout-return). The page polls the summary while
 * `shouldPoll` says so and feeds each result in as an event.
 */
const b = getMessages('en').console.billing;
const now = new Date('2026-10-12T12:00:00.000Z');
const YEAR_ON = '2027-10-12T00:00:00.000Z';

const card = (over: Partial<BillingSpaceCard> = {}): BillingSpaceCard => ({
  spaceId: 'space:fam',
  kind: 'family',
  name: 'Kim family',
  role: 'owner',
  archived: false,
  payer: true,
  readOnlyReason: null,
  coverage: { state: 'free' },
  usage: { learners: 2, learnerCap: 5, teachers: null, teacherCap: null },
  actions: { buy: 'family_lifetime', manage: false, contact: false },
  receipts: [],
  hasReceipts: false,
  legacyNoHistory: false,
  ...over,
});
const active = (over: Partial<BillingSpaceCard> = {}): BillingSpaceCard =>
  card({ coverage: { state: 'own', planKey: 'family_lifetime', status: 'active', expiresAt: YEAR_ON, statusSince: '2026-10-12T11:59:00.000Z', endsAtPeriodEnd: false }, actions: { buy: null, manage: true, contact: false }, ...over });
const summary = (cards: BillingSpaceCard[]): BillingSummary => ({ mode: 'test', purchasesOpen: true, cards, account: [] });
const polled = (cards: BillingSpaceCard[]): ReturnEvent => ({ type: 'polled', summary: summary(cards) });

function run(state: ReturnState, events: ReturnEvent[]): ReturnState {
  return events.reduce((s, e) => returnStep(s, e, now), state);
}

describe('readCheckoutReturn: the query Stripe sends back', () => {
  it('reads success with the plan and the opaque space id', () => {
    expect(readCheckoutReturn('?checkout=success&plan=family_lifetime&id=space%3Afam')).toEqual({ kind: 'success', plan: 'family_lifetime', spaceId: 'space:fam' });
    expect(readCheckoutReturn(new URLSearchParams({ checkout: 'success', plan: 'group_license', id: 'space:cls' }))).toEqual({ kind: 'success', plan: 'group_license', spaceId: 'space:cls' });
  });

  it('reads an older success without plan or id, or with values it does not know, as done-unknown', () => {
    expect(readCheckoutReturn('?checkout=success')).toEqual({ kind: 'successUnknown' });
    expect(readCheckoutReturn('?checkout=success&plan=gold&id=space%3Afam')).toEqual({ kind: 'successUnknown' });
    expect(readCheckoutReturn('?checkout=success&plan=school_seat&id=space%3Afam')).toEqual({ kind: 'successUnknown' });
    expect(readCheckoutReturn('?checkout=success&plan=family_lifetime&id=')).toEqual({ kind: 'successUnknown' });
    expect(readCheckoutReturn('?checkout=success&plan=family_lifetime&id=acct%3A1')).toEqual({ kind: 'successUnknown' });
  });

  it('reads cancel, and nothing for any other query', () => {
    expect(readCheckoutReturn('?checkout=cancel')).toEqual({ kind: 'cancel' });
    expect(readCheckoutReturn('')).toBeNull();
    expect(readCheckoutReturn('?checkout=maybe')).toBeNull();
    expect(readCheckoutReturn('?id=space%3Afam')).toBeNull();
  });

  it('removes checkout, plan and id from the query and keeps everything else (history.replaceState)', () => {
    expect(cleanedReturnSearch('?checkout=success&plan=family_lifetime&id=space%3Afam')).toBe('');
    expect(cleanedReturnSearch('?lang=ko&checkout=cancel')).toBe('?lang=ko');
    expect(cleanedReturnSearch('?a=1&id=space%3Afam&b=2')).toBe('?a=1&b=2');
    expect(cleanedReturnSearch('')).toBe('');
  });
});

describe('initialReturnState', () => {
  it('starts checking for a success, cancelled for a cancel, nothing otherwise', () => {
    expect(initialReturnState({ kind: 'success', plan: 'family_lifetime', spaceId: 'space:fam' })).toEqual({ phase: 'checking', target: { plan: 'family_lifetime', spaceId: 'space:fam' }, attempts: 0 });
    expect(initialReturnState({ kind: 'successUnknown' })).toEqual({ phase: 'checking', target: null, attempts: 0 });
    expect(initialReturnState({ kind: 'cancel' })).toEqual({ phase: 'cancelled' });
    expect(initialReturnState(null)).toBeNull();
  });

  it('polls every CHECKOUT_POLL_MS (2 s)', () => {
    expect(POLL_INTERVAL_MS).toBe(CHECKOUT_POLL_MS);
    expect(CHECKOUT_POLL_MS).toBe(2000);
    expect(CHECKOUT_POLL_MAX).toBe(10);
  });
});

describe('returnStep: checking → done / still processing', () => {
  const start = initialReturnState({ kind: 'success', plan: 'family_lifetime', spaceId: 'space:fam' }) as ReturnState;

  it('stays checking while the card is not active, and is done once it is', () => {
    const after2 = run(start, [polled([card()]), polled([card()])]);
    expect(after2).toEqual({ phase: 'checking', target: { plan: 'family_lifetime', spaceId: 'space:fam' }, attempts: 2 });
    expect(shouldPoll(after2)).toBe(true);
    const done = returnStep(after2, polled([active({ usage: { learners: 2, learnerCap: 5, teachers: null, teacherCap: null } })]), now);
    expect(done).toEqual({ phase: 'done', target: { plan: 'family_lifetime', spaceId: 'space:fam' }, nextStep: null });
    expect(shouldPoll(done)).toBe(false);
    expect(focusCardId(done)).toBe('space:fam');
  });

  it('done with a family that has no learner yet shows the connect-a-learner step', () => {
    const done = returnStep(start, polled([active({ usage: { learners: 0, learnerCap: 5, teachers: null, teacherCap: null } })]), now);
    expect(done).toMatchObject({ phase: 'done', nextStep: 'connectLearner' });
  });

  it('a trial counts as active; another plan, another space, an expired or archived row does not', () => {
    const trial = active({ coverage: { state: 'own', planKey: 'family_lifetime', status: 'trial', expiresAt: YEAR_ON, statusSince: 't', endsAtPeriodEnd: false } });
    expect(returnStep(start, polled([trial]), now).phase).toBe('done');
    const otherPlan = active({ coverage: { state: 'own', planKey: 'group_license', status: 'active', expiresAt: YEAR_ON, statusSince: 't', endsAtPeriodEnd: false } });
    const otherSpace = active({ spaceId: 'space:other' });
    const expired = active({ coverage: { state: 'own', planKey: 'family_lifetime', status: 'active', expiresAt: '2026-10-01T00:00:00.000Z', statusSince: 't', endsAtPeriodEnd: false } });
    const cancelled = active({ coverage: { state: 'own', planKey: 'family_lifetime', status: 'cancelled', expiresAt: YEAR_ON, statusSince: 't', endsAtPeriodEnd: true } });
    for (const c of [otherPlan, otherSpace, expired, cancelled]) expect(returnStep(start, polled([c]), now).phase).toBe('checking');
    // An active row with no date (a legacy one-time row) still counts.
    expect(returnStep(start, polled([active({ coverage: { state: 'own', planKey: 'family_lifetime', status: 'active', expiresAt: null, statusSince: 't', endsAtPeriodEnd: false } })]), now).phase).toBe('done');
  });

  it(`after ${CHECKOUT_POLL_MAX} polls without the plan: still processing, and Check again starts one more round`, () => {
    const tenNotYet = Array.from({ length: CHECKOUT_POLL_MAX }, () => polled([card()]));
    const late = run(start, tenNotYet);
    expect(late).toEqual({ phase: 'stillProcessing', target: { plan: 'family_lifetime', spaceId: 'space:fam' } });
    expect(shouldPoll(late)).toBe(false);
    const again = returnStep(late, { type: 'checkAgain' }, now);
    expect(again).toEqual({ phase: 'checking', target: { plan: 'family_lifetime', spaceId: 'space:fam' }, attempts: 0 });
    expect(run(again, Array.from({ length: CHECKOUT_POLL_MAX - 1 }, () => polled([card()]))).phase).toBe('checking');
    expect(run(again, tenNotYet).phase).toBe('stillProcessing');
  });

  it('offline pauses without using attempts, and resumes on online', () => {
    const three = run(start, [polled([card()]), polled([card()]), polled([card()])]);
    const off = returnStep(three, { type: 'offline' }, now);
    expect(off).toEqual({ phase: 'offline', target: { plan: 'family_lifetime', spaceId: 'space:fam' }, attempts: 3 });
    expect(shouldPoll(off)).toBe(false);
    // A poll that fails because the network is gone keeps the count too.
    expect(returnStep(three, { type: 'pollFailed', offline: true }, now)).toEqual(off);
    // A late result while offline still lands.
    expect(returnStep(off, polled([active()]), now).phase).toBe('done');
    expect(returnStep(off, { type: 'online' }, now)).toEqual(three);
    expect(returnStep(off, { type: 'retry' }, now)).toEqual(three);
  });

  it('a poll that fails while online: error, and Try again resumes with the attempts kept', () => {
    const one = run(start, [polled([card()])]);
    const failed = returnStep(one, { type: 'pollFailed', offline: false }, now);
    expect(failed).toEqual({ phase: 'error', target: { plan: 'family_lifetime', spaceId: 'space:fam' }, attempts: 1 });
    expect(shouldPoll(failed)).toBe(false);
    expect(returnStep(failed, { type: 'retry' }, now)).toEqual(one);
    expect(returnStep(failed, { type: 'offline' }, now)).toMatchObject({ phase: 'offline', attempts: 1 });
  });

  it('events that do not apply leave the state as it is', () => {
    const one = run(start, [polled([card()])]);
    for (const e of [{ type: 'online' }, { type: 'retry' }, { type: 'checkAgain' }] as ReturnEvent[]) expect(returnStep(one, e, now)).toBe(one);
    const done = returnStep(start, polled([active()]), now);
    for (const e of [polled([card()]), { type: 'offline' }, { type: 'pollFailed', offline: false }, { type: 'checkAgain' }] as ReturnEvent[]) expect(returnStep(done, e, now)).toBe(done);
    const cancelled: ReturnState = { phase: 'cancelled' };
    expect(returnStep(cancelled, polled([active()]), now)).toBe(cancelled);
    const late: ReturnState = { phase: 'stillProcessing', target: null };
    expect(returnStep(late, { type: 'offline' }, now)).toBe(late);
  });
});

describe('done-unknown: an older return without plan or id', () => {
  it('reloads the summary once and shows the done line', () => {
    const start = initialReturnState({ kind: 'successUnknown' }) as ReturnState;
    expect(shouldPoll(start)).toBe(true);
    const done = returnStep(start, polled([card()]), now);
    expect(done).toEqual({ phase: 'done', target: null, nextStep: null });
    expect(focusCardId(done)).toBeNull();
    expect(returnNotice(done, 'en')).toEqual({ text: b.done, action: null });
  });
});

describe('returnNotice and the card being checked', () => {
  const target = { plan: 'family_lifetime' as const, spaceId: 'space:fam' };

  it('words each state, with Check again or Try again where the wireframe draws one', () => {
    expect(returnNotice({ phase: 'checking', target, attempts: 0 }, 'en')).toEqual({ text: b.checking, action: null });
    expect(returnNotice({ phase: 'done', target, nextStep: null }, 'en')).toEqual({ text: b.done, action: null });
    expect(returnNotice({ phase: 'stillProcessing', target }, 'en')).toEqual({ text: b.stillProcessing, action: { event: 'checkAgain', label: b.checkAgain.cta } });
    expect(returnNotice({ phase: 'offline', target, attempts: 2 }, 'en')).toEqual({ text: b.offline, action: { event: 'retry', label: b.retry.cta } });
    expect(returnNotice({ phase: 'error', target, attempts: 2 }, 'en')).toEqual({ text: b.cantCheck, action: { event: 'retry', label: b.retry.cta } });
    expect(returnNotice({ phase: 'cancelled' }, 'en')).toEqual({ text: getMessages('en').console.billingCancelled, action: null });
    expect(returnNotice(null, 'en')).toBeNull();
    expect(returnNotice({ phase: 'checking', target, attempts: 0 })).toEqual({ text: b.checking, action: null });
  });

  it('the error line never repeats that the payment went through (we do not know)', () => {
    expect(returnNotice({ phase: 'error', target, attempts: 0 }, 'en')?.text).not.toBe(b.stillProcessing);
  });

  it('disables the target card buttons while checking (and paused), never once done', () => {
    expect(busyCardId({ phase: 'checking', target, attempts: 3 })).toBe('space:fam');
    expect(busyCardId({ phase: 'offline', target, attempts: 3 })).toBe('space:fam');
    expect(busyCardId({ phase: 'error', target, attempts: 3 })).toBe('space:fam');
    expect(busyCardId({ phase: 'stillProcessing', target })).toBe('space:fam');
    expect(busyCardId({ phase: 'done', target, nextStep: null })).toBeNull();
    expect(busyCardId({ phase: 'checking', target: null, attempts: 0 })).toBeNull();
    expect(busyCardId({ phase: 'cancelled' })).toBeNull();
    expect(busyCardId(null)).toBeNull();
    expect(focusCardId({ phase: 'checking', target, attempts: 0 })).toBeNull();
    expect(focusCardId(null)).toBeNull();
    expect(shouldPoll(null)).toBe(false);
  });
});

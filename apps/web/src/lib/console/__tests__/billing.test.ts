import { FREE_CLASS_STUDENT_CAP, PLAN_PRICING } from '@hangul-route/content-schema';
import { formatDate, formatUsd, getMessages, type UiLocale } from '@hangul-route/i18n';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { EntitlementView, SpaceListItem } from '../api';
import { billingNoteText, checkoutReturnNote, currentPlanCards, freePlanLine, isActive, planIncludes, planPrice, planRowsFor, planTitle, promoNoteText, promoPriceLine, rowPrice, sourceLine, statusLine } from '../billing';

const now = new Date('2026-09-21T12:00:00.000Z');
const ent = (over: Partial<EntitlementView>): EntitlementView => ({ id: 'ent:1', subjectKind: 'space', subjectId: 'space:fam', planKey: 'group_license', status: 'active', provider: 'stripe', providerRef: 'sub', customerRef: 'cus', seats: null, expiresAt: '2026-10-21T00:00:00.000Z', promoCode: null, updatedAt: '2026-09-20T00:00:00.000Z', subjectName: 'Kim family', ...over });
const space = (id: string, kind: SpaceListItem['space']['kind'], role: SpaceListItem['role'] = 'owner', archivedAt: string | null = null): SpaceListItem => ({
  space: { id, kind, name: id, parentSpaceId: id === 'space:inschool' ? 'space:sch' : null, settings: { consentMode: 'parent', anonymizeRoster: false }, archivedAt, createdAt: 't' },
  role,
  counts: { learners: 0, accounts: 1, classes: 0 },
  joinCode: null,
  joinCodeExpiresAt: null,
});

describe('billing view models (F-ENT-001 §3.6)', () => {
  it('mirrors the activity rule and labels statuses', () => {
    expect(isActive(ent({}), now)).toBe(true);
    expect(isActive(ent({ status: 'active', expiresAt: '2026-09-01T00:00:00.000Z' }), now)).toBe(false);
    expect(isActive(ent({ status: 'cancelled' }), now)).toBe(true);
    expect(isActive(ent({ status: 'cancelled', expiresAt: null }), now)).toBe(false);
    expect(isActive(ent({ status: 'past_due' }), now)).toBe(true);
    expect(isActive(ent({ status: 'past_due', updatedAt: '2026-09-01T00:00:00.000Z' }), now)).toBe(false);
    expect(isActive(ent({ status: 'expired' }), now)).toBe(false);
    expect(statusLine(ent({ status: 'trial' }), now)).toBe('trial · ends Oct 21, 2026');
    expect(statusLine(ent({ status: 'trial', expiresAt: null }), now)).toBe('trial');
    expect(statusLine(ent({}), now)).toBe('active · renews Oct 21, 2026');
    expect(statusLine(ent({ expiresAt: null }), now)).toBe('active');
    expect(statusLine(ent({ planKey: 'family_lifetime', expiresAt: null }), now)).toBe('active · yours for good');
    expect(isActive(ent({ planKey: 'family_lifetime', expiresAt: null }), new Date('2099-01-01T00:00:00.000Z'))).toBe(true); // never lapses
    expect(statusLine(ent({ status: 'past_due' }), now)).toContain('kept for a week');
    expect(statusLine(ent({ status: 'past_due', updatedAt: '2026-09-01T00:00:00.000Z' }), now)).toContain('paused');
    expect(statusLine(ent({ status: 'cancelled' }), now)).toBe('cancelled · ends Oct 21, 2026');
    expect(statusLine(ent({ status: 'cancelled', expiresAt: null }), now)).toBe('cancelled');
    expect(statusLine(ent({ status: 'expired' }), now)).toBe('ended Oct 21, 2026');
    expect(statusLine(ent({ status: 'expired', expiresAt: null }), now)).toBe('ended');
  });

  it('builds current-plan cards and role-aware plan rows with one recommendation', () => {
    const cards = currentPlanCards([ent({ subjectId: 'space:cls', subjectName: 'Class A' }), ent({ id: 'ent:2', planKey: 'family_lifetime', provider: 'stripe', customerRef: 'cus_fam', expiresAt: null })], now);
    expect(cards[0]).toMatchObject({ title: 'Group License', subject: 'Class A', active: true, canManage: true });
    expect(cards[1]).toMatchObject({ title: 'Family Lifetime', subject: 'Kim family', status: 'active · yours for good', canManage: false }); // nothing to cancel

    const rows = planRowsFor('me', [space('space:fam', 'family'), space('space:cls', 'class'), space('space:inschool', 'class'), space('space:sch', 'school'), space('space:old', 'family', 'owner', 'a'), space('space:other', 'family', 'caregiver')], [], now);
    expect(rows.map((r) => [r.planKey, r.subjectId, r.action, r.recommended])).toEqual([
      ['free', null, 'current', false],
      ['family_lifetime', 'space:fam', 'choose', true],
      ['group_license', 'space:cls', 'choose', false],
      ['group_license', 'space:sch', 'choose', false],
      ['school_seat', 'space:sch', 'contact', false],
    ]); // the class inside the school gets no row of its own
    expect(rows[1]?.price).toBe('$15.30 once');
    expect(rows[2]?.price).toBe('$153 / year');
    expect(rows[4]?.price).toBe('Contact us');
    const withLicence = planRowsFor('me', [space('space:cls', 'class')], [ent({ subjectId: 'space:cls' })], now);
    expect(withLicence.map((r) => [r.planKey, r.action])).toEqual([['free', 'none'], ['group_license', 'current']]);
    expect(planRowsFor('me', [], [], now).map((r) => r.planKey)).toEqual(['free']);
    expect(planRowsFor('me', [space('space:sch', 'school')], [ent({ subjectId: 'space:sch', planKey: 'school_seat', seats: 300 })], now).find((r) => r.planKey === 'group_license')?.action).toBe('current');
  });

  it('prices a plan with a promo code (F-ENT-002)', () => {
    const pct = { id: 'promo_1', code: 'HOYA20', name: 'Launch', percentOff: 20, amountOffCents: null, duration: 'once' as const };
    expect(promoPriceLine('family_lifetime', pct)).toBe('$12.24 once with HOYA20 (20% off), was $15.30 once');
    expect(promoPriceLine('group_license', pct)).toBe('$122.40 / year with HOYA20 (20% off, first year), was $153 / year');
    expect(promoPriceLine('group_license', { ...pct, duration: 'forever', percentOff: null, amountOffCents: 300 })).toBe('$150.00 / year with HOYA20 ($3.00 off), was $153 / year');
    expect(promoPriceLine('school_seat', pct)).toBeNull();
    expect(promoPriceLine('free', pct)).toBeNull();
    expect(promoPriceLine('family_lifetime', null)).toBeNull();
  });

  it('maps the checkout return parameter to a note key, worded at render time', () => {
    expect(checkoutReturnNote('success')).toBe('success');
    expect(checkoutReturnNote('cancel')).toBe('cancelled');
    expect(checkoutReturnNote(null)).toBeNull();
    expect(checkoutReturnNote('weird')).toBeNull();
    expect(billingNoteText('success')).toBe('Thank you — the plan is active. Learners see it on their next sync.');
    expect(billingNoteText('cancelled')).toBe('Nothing was charged.');
    expect(billingNoteText('notConfigured')).toBe('Checkout is not set up on this deployment yet. Nothing was charged.');
    expect(billingNoteText('checkoutFailed')).toBe("Couldn't start checkout. Try again.");
    expect(billingNoteText('portalFailed')).toBe("Couldn't open the billing portal.");
  });

  it('words the promo note from data', () => {
    expect(promoNoteText({ kind: 'applied', code: 'HOYA20', name: null })).toBe('HOYA20 applied.');
    expect(promoNoteText({ kind: 'applied', code: 'HOYA20', name: 'Launch' })).toBe('HOYA20 applied · Launch.');
    expect(promoNoteText({ kind: 'tooMany' })).toBe('Too many tries — wait a minute and try again.');
    expect(promoNoteText({ kind: 'notConfigured' })).toBe('Codes are not set up on this deployment yet.');
    expect(promoNoteText({ kind: 'invalid' })).toBe("That code can't be used right now — check the spelling or the date.");
  });
});

describe('sourceLine', () => {
  it('names the source and the code, never "paid"', () => {
    expect(sourceLine({ provider: 'stripe', promoCode: null })).toBe('via web (Stripe)');
    expect(sourceLine({ provider: 'stripe', promoCode: 'KPCCW2026' })).toBe('via web (Stripe) · code KPCCW2026');
    expect(sourceLine({ provider: 'manual', promoCode: null })).toBe('via contract');
    expect(sourceLine({ provider: 'apple', promoCode: null })).toBe('via App Store');
    expect(sourceLine({ provider: 'google', promoCode: 'X1' })).toBe('via Google Play · code X1');
  });
});

describe('billing words and prices per locale (F-I18N-001 PR 9)', () => {
  it('prices plans from PLAN_PRICING amounts through formatUsd, never the English label (F-I18N-001 §3.1)', () => {
    expect(planPrice('family_lifetime')).toBe('$15.30 once');
    expect(planPrice('group_license')).toBe('$153 / year');
    expect((['free', 'family_lifetime', 'group_license', 'school_seat'] as const).map((k) => rowPrice(k))).toEqual(['$0', '$15.30 once', '$153 / year', 'Contact us']);
    for (const locale of ['en', 'es', 'ko'] as const) {
      const price = getMessages(locale).console.price;
      expect(planPrice('family_lifetime', locale)).toBe(price.once(formatUsd(locale, PLAN_PRICING.family_lifetime.amountUsd)));
      expect(planPrice('group_license', locale)).toBe(price.year(formatUsd(locale, PLAN_PRICING.group_license.amountUsd)));
    }
  });

  it('words statuses and promo prices in every locale (F-I18N-001 PR 9)', () => {
    const pct = { id: 'promo_1', code: 'HOYA20', name: 'Launch', percentOff: 20, amountOffCents: null, duration: 'once' as const };
    for (const locale of ['en', 'es', 'ko'] as const) {
      const c = getMessages(locale).console;
      const day = formatDate(locale, '2026-10-21T00:00:00.000Z', 'monthDayYear', { utc: true });
      expect(statusLine(ent({ status: 'trial' }), now, locale)).toBe(c.entitlementStatus.trialEnds(day));
      expect(statusLine(ent({}), now, locale)).toBe(c.entitlementStatus.activeRenews(day));
      expect(statusLine(ent({ status: 'cancelled' }), now, locale)).toBe(c.entitlementStatus.cancelledEnds(day));
      expect(statusLine(ent({ status: 'expired' }), now, locale)).toBe(c.entitlementStatus.endedOn(day));
      expect(statusLine(ent({ status: 'past_due' }), now, locale)).toBe(c.entitlementStatus.pastDueKept);
      expect(promoPriceLine('group_license', pct, locale)).toBe(
        c.promoPrice(c.price.year(formatUsd(locale, 122.4, { cents: true })), 'HOYA20', '20% off', true, planPrice('group_license', locale)),
      );
    }
  });

  it('reads the billing date in UTC whatever the device time zone', () => {
    expect(statusLine(ent({ expiresAt: '2026-10-21T00:30:00.000Z' }), now)).toBe('active · renews Oct 21, 2026');
    expect(statusLine(ent({ expiresAt: '2026-10-21T23:30:00.000Z' }), now)).toBe('active · renews Oct 21, 2026');
  });
});

describe('billing page words per locale (F-I18N-001 PR 10b)', () => {
  const PSEUDO = 'en-XA' as UiLocale;
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('keeps the English plan names and includes lines', () => {
    expect((['free', 'family_lifetime', 'group_license', 'school_seat'] as const).map((k) => planTitle(k))).toEqual(['Free', 'Family Lifetime', 'Group License', 'School Contract']);
    expect(planTitle('group_license')).toBe('Group License');
    expect(planIncludes('free')).toBe('Stage 1, local progress, Rescue Code, file backup; classes up to 20 students');
    expect(planIncludes('family_lifetime')).toBe('Every Stage, now and later, for one family: up to 5 learners, cloud sync, grown-up dashboard and plans');
    expect(planIncludes('group_license')).toBe('A class or school: every student premium while enrolled, no 20-student cap; a school holds up to 10 teachers / 300 students');
    expect(planIncludes('school_seat')).toBe('Beyond 300 students or 10 teachers — seats by contract');
    expect(currentPlanCards([ent({ subjectKind: 'account', subjectId: 'me' })], now)[0]?.subject).toBe('your account');
    expect(freePlanLine()).toBe('Stage 1, local progress, Rescue Code, file backup. Classes hold up to 20 students.');
  });

  it('takes the free-class cap from content-schema, never a number typed into the copy', () => {
    for (const locale of ['en', 'es', 'ko'] as const) {
      const b = getMessages(locale).console.billing;
      expect(planIncludes('free', locale)).toBe(b.includes.free(FREE_CLASS_STUDENT_CAP));
      expect(planIncludes('group_license', locale)).toBe(b.includes.group_license(10, 300, FREE_CLASS_STUDENT_CAP));
      expect(freePlanLine(locale)).toBe(b.current.freeLine(FREE_CLASS_STUDENT_CAP));
    }
  });

  it('words cards, rows, sources and notes from the dictionary in every locale', () => {
    for (const locale of ['en', 'es', 'ko'] as const) {
      const b = getMessages(locale).console.billing;
      const [card] = currentPlanCards([ent({ subjectKind: 'account', subjectId: 'me' })], now, locale);
      expect(card).toMatchObject({ title: b.planTitle.group_license, subject: b.yourAccount, status: statusLine(ent({}), now, locale) });
      const rows = planRowsFor('me', [space('space:sch', 'school')], [], now, locale);
      expect(rows.map((r) => [r.title, r.includes, r.price])).toEqual([
        [b.planTitle.free, b.includes.free(FREE_CLASS_STUDENT_CAP), formatUsd(locale, 0)],
        [b.planTitle.group_license, b.includes.group_license(10, 300, FREE_CLASS_STUDENT_CAP), planPrice('group_license', locale)],
        [b.planTitle.school_seat, b.includes.school_seat(300, 10), b.contactPrice],
      ]);
      expect(sourceLine({ provider: 'apple', promoCode: 'X1' }, locale)).toBe(b.source('apple', 'X1'));
      expect(billingNoteText('portalFailed', locale)).toBe(b.portalFailed);
    }
  });

  it('leaves no English in the pseudo-locale', () => {
    vi.stubEnv('NEXT_PUBLIC_PSEUDO_LOCALE', '1');
    const bracketed = /^\[.*\]$/;
    // No expiry date: the formatters take UI locales only, and en-XA is a dictionary test locale.
    const [card] = currentPlanCards([ent({ subjectKind: 'account', subjectId: 'me', expiresAt: null })], now, PSEUDO);
    expect(card?.title).toMatch(bracketed);
    expect(card?.subject).toMatch(bracketed);
    for (const row of planRowsFor('me', [space('space:fam', 'family'), space('space:sch', 'school')], [], now, PSEUDO)) {
      expect(row.title).toMatch(bracketed);
      expect(row.includes).toMatch(bracketed);
    }
    expect(rowPrice('school_seat', PSEUDO)).toMatch(bracketed);
    expect(sourceLine({ provider: 'manual', promoCode: null }, PSEUDO)).toMatch(bracketed);
    expect(freePlanLine(PSEUDO)).toMatch(bracketed);
    for (const note of ['success', 'cancelled', 'notConfigured', 'checkoutFailed', 'portalFailed'] as const) expect(billingNoteText(note, PSEUDO)).toMatch(bracketed);
    for (const kind of ['tooMany', 'notConfigured', 'invalid'] as const) expect(promoNoteText({ kind }, PSEUDO)).toMatch(bracketed);
    expect(promoNoteText({ kind: 'applied', code: 'HOYA20', name: null }, PSEUDO)).toMatch(bracketed);
  });
});

import { PLAN_PRICING } from '@hangul-route/content-schema';
import { formatDate, formatUsd, getMessages, type UiLocale } from '@hangul-route/i18n';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { EntitlementView } from '../api';
import { isActive, planPrice, planTitle, promoNoteText, promoPriceLine, statusLine } from '../billing';

const now = new Date('2026-09-21T12:00:00.000Z');
const ent = (over: Partial<EntitlementView>): EntitlementView => ({ id: 'ent:1', subjectKind: 'space', subjectId: 'space:fam', planKey: 'group_license', status: 'active', provider: 'stripe', providerRef: 'sub_1', customerRef: 'cus', seats: null, expiresAt: '2026-10-21T00:00:00.000Z', promoCode: null, updatedAt: '2026-09-20T00:00:00.000Z', subjectName: 'Kim family', ...over });
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
    // The Family Plan renews yearly like a licence (BY-D9); a legacy one-time sandbox row has no date (BY-D2).
    expect(statusLine(ent({ planKey: 'family_lifetime' }), now)).toBe('active · renews Oct 21, 2026');
    expect(statusLine(ent({ planKey: 'family_lifetime', status: 'cancelled' }), now)).toBe('cancelled · ends Oct 21, 2026');
    expect(statusLine(ent({ planKey: 'family_lifetime', expiresAt: null, providerRef: 'pi_1' }), now)).toBe('active');
    expect(isActive(ent({ planKey: 'family_lifetime', expiresAt: '2026-09-01T00:00:00.000Z' }), now)).toBe(false); // a year that ran out
    expect(isActive(ent({ planKey: 'family_lifetime', expiresAt: null, providerRef: 'pi_1' }), new Date('2099-01-01T00:00:00.000Z'))).toBe(true); // legacy row stays readable
    expect(statusLine(ent({ status: 'past_due' }), now)).toContain('kept for a week');
    expect(statusLine(ent({ status: 'past_due', updatedAt: '2026-09-01T00:00:00.000Z' }), now)).toContain('paused');
    expect(statusLine(ent({ status: 'cancelled' }), now)).toBe('cancelled · ends Oct 21, 2026');
    expect(statusLine(ent({ status: 'cancelled', expiresAt: null }), now)).toBe('cancelled');
    expect(statusLine(ent({ status: 'expired' }), now)).toBe('ended Oct 21, 2026');
    expect(statusLine(ent({ status: 'expired', expiresAt: null }), now)).toBe('ended');
  });

  it('prices a plan with a promo code (F-ENT-002)', () => {
    const pct = { id: 'promo_1', code: 'HOYA20', name: 'Launch', percentOff: 20, amountOffCents: null, duration: 'once' as const };
    expect(promoPriceLine('family_lifetime', pct)).toBe('$12.24 / year with HOYA20 (20% off, first year), was $15.30 / year');
    expect(promoPriceLine('family_lifetime', { ...pct, duration: 'forever' })).toBe('$12.24 / year with HOYA20 (20% off), was $15.30 / year');
    expect(promoPriceLine('group_license', pct)).toBe('$122.40 / year with HOYA20 (20% off, first year), was $153 / year');
    expect(promoPriceLine('group_license', { ...pct, duration: 'forever', percentOff: null, amountOffCents: 300 })).toBe('$150.00 / year with HOYA20 ($3.00 off), was $153 / year');
    expect(promoPriceLine('school_seat', pct)).toBeNull();
    expect(promoPriceLine('free', pct)).toBeNull();
    expect(promoPriceLine('family_lifetime', null)).toBeNull();
  });

  it('words the promo note from data', () => {
    expect(promoNoteText({ kind: 'applied', code: 'HOYA20', name: null })).toBe('HOYA20 applied.');
    expect(promoNoteText({ kind: 'applied', code: 'HOYA20', name: 'Launch' })).toBe('HOYA20 applied · Launch.');
    expect(promoNoteText({ kind: 'tooMany' })).toBe('Too many tries — wait a minute and try again.');
    expect(promoNoteText({ kind: 'notConfigured' })).toBe('Codes are not set up on this deployment yet.');
    expect(promoNoteText({ kind: 'invalid' })).toBe("That code can't be used right now — check the spelling or the date.");
  });
});

describe('billing words and prices per locale (F-I18N-001 PR 9)', () => {
  it('prices plans from PLAN_PRICING amounts through formatUsd, never the English label (F-I18N-001 §3.1)', () => {
    expect(planPrice('family_lifetime')).toBe('$15.30 / year');
    expect(planPrice('group_license')).toBe('$153 / year');
    for (const locale of ['en', 'es', 'ko'] as const) {
      const price = getMessages(locale).console.price;
      expect(planPrice('family_lifetime', locale)).toBe(price.year(formatUsd(locale, PLAN_PRICING.family_lifetime.amountUsd)));
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

  it('keeps the English plan names', () => {
    expect((['free', 'family_lifetime', 'group_license', 'school_seat'] as const).map((k) => planTitle(k))).toEqual(['Free', 'Family Plan', 'Group License', 'School Contract']);
    for (const locale of ['en', 'es', 'ko'] as const) expect(planTitle('group_license', locale)).toBe(getMessages(locale).console.billing.planTitle.group_license);
  });

  it('leaves no English in the pseudo-locale', () => {
    vi.stubEnv('NEXT_PUBLIC_PSEUDO_LOCALE', '1');
    const bracketed = /^\[.*\]$/;
    expect(planTitle('family_lifetime', PSEUDO)).toMatch(bracketed);
    for (const kind of ['tooMany', 'notConfigured', 'invalid'] as const) expect(promoNoteText({ kind }, PSEUDO)).toMatch(bracketed);
    expect(promoNoteText({ kind: 'applied', code: 'HOYA20', name: null }, PSEUDO)).toMatch(bracketed);
  });
});

/** [SA] AMENDMENTS-SEATS-ADMINS section 3.6: the school view's licence is an allow-list; the status line must still read it. */
describe('[SA] status line from the school licence allow-list', () => {
  it('reads a past-due school licence inside its grace week as kept, not paused', () => {
    const now = new Date('2026-10-20T12:00:00.000Z');
    const allowListed = { planKey: 'group_license', status: 'past_due', seats: null, expiresAt: '2027-10-20T00:00:00.000Z', updatedAt: '2026-10-18T12:00:00.000Z', active: true, subjectName: 'Seoul Hangul School' } as unknown as EntitlementView;
    expect(statusLine(allowListed, now)).toBe(getMessages('en').console.entitlementStatus.pastDueKept);
    expect(statusLine({ ...allowListed, updatedAt: '2026-10-01T12:00:00.000Z' }, now)).toBe(getMessages('en').console.entitlementStatus.pastDuePaused);
  });
});

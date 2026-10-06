import { describe, expect, it } from 'vitest';
import type { EntitlementView, SpaceListItem } from '../api';
import { checkoutReturnNotice, currentPlanCards, isActive, planRowsFor, promoPriceLine, statusLine } from '../billing';

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

  it('maps the checkout return parameter', () => {
    expect(checkoutReturnNotice('success')).toContain('active');
    expect(checkoutReturnNotice('cancel')).toContain('Nothing was charged');
    expect(checkoutReturnNotice(null)).toBeNull();
    expect(checkoutReturnNotice('weird')).toBeNull();
  });
});

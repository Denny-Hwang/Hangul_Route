import { describe, expect, it } from 'vitest';
import type { EntitlementView, SpaceListItem } from '../api';
import { checkoutReturnNotice, currentPlanCards, isActive, planRowsFor, statusLine } from '../billing';

const now = new Date('2026-09-21T12:00:00.000Z');
const ent = (over: Partial<EntitlementView>): EntitlementView => ({ id: 'ent:1', subjectKind: 'space', subjectId: 'space:fam', planKey: 'family_premium', status: 'active', provider: 'stripe', providerRef: 'sub', customerRef: 'cus', seats: null, expiresAt: '2026-10-21T00:00:00.000Z', updatedAt: '2026-09-20T00:00:00.000Z', subjectName: 'Kim family', ...over });
const space = (id: string, kind: SpaceListItem['space']['kind'], role: SpaceListItem['role'] = 'owner', archivedAt: string | null = null): SpaceListItem => ({
  space: { id, kind, name: id, parentSpaceId: null, settings: { consentMode: 'parent', anonymizeRoster: false }, archivedAt, createdAt: 't' },
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
    expect(statusLine(ent({ status: 'past_due' }), now)).toContain('kept for a week');
    expect(statusLine(ent({ status: 'past_due', updatedAt: '2026-09-01T00:00:00.000Z' }), now)).toContain('paused');
    expect(statusLine(ent({ status: 'cancelled' }), now)).toBe('cancelled · ends Oct 21, 2026');
    expect(statusLine(ent({ status: 'cancelled', expiresAt: null }), now)).toBe('cancelled');
    expect(statusLine(ent({ status: 'expired' }), now)).toBe('ended Oct 21, 2026');
    expect(statusLine(ent({ status: 'expired', expiresAt: null }), now)).toBe('ended');
  });

  it('builds current-plan cards and role-aware plan rows with one recommendation', () => {
    const cards = currentPlanCards([ent({}), ent({ id: 'ent:2', subjectKind: 'account', subjectId: 'me', planKey: 'teacher_pro', provider: 'apple', customerRef: null, subjectName: null })], now);
    expect(cards[0]).toMatchObject({ title: 'Family Premium', subject: 'Kim family', active: true, canManage: true });
    expect(cards[1]).toMatchObject({ title: 'Teacher Pro', subject: 'your account', canManage: false });

    const rows = planRowsFor('me', [space('space:fam', 'family'), space('space:cls', 'class'), space('space:sch', 'school'), space('space:old', 'family', 'owner', 'a'), space('space:other', 'family', 'caregiver')], [], now);
    expect(rows.map((r) => [r.planKey, r.action, r.recommended])).toEqual([
      ['free', 'current', false],
      ['family_premium', 'choose', true],
      ['teacher_pro', 'choose', false],
      ['school_license', 'choose', false],
      ['school_seat', 'contact', false],
    ]);
    const withPro = planRowsFor('me', [space('space:cls', 'class')], [ent({ subjectKind: 'account', subjectId: 'me', planKey: 'teacher_pro' })], now);
    expect(withPro.map((r) => [r.planKey, r.action])).toEqual([['free', 'none'], ['teacher_pro', 'current']]);
    expect(planRowsFor('me', [], [], now).map((r) => r.planKey)).toEqual(['free']);
    expect(planRowsFor('me', [space('space:sch', 'school')], [ent({ subjectId: 'space:sch', planKey: 'school_seat', seats: 300 })], now).find((r) => r.planKey === 'school_license')?.action).toBe('current');
  });

  it('maps the checkout return parameter', () => {
    expect(checkoutReturnNotice('success')).toContain('active');
    expect(checkoutReturnNotice('cancel')).toContain('Nothing was charged');
    expect(checkoutReturnNotice(null)).toBeNull();
    expect(checkoutReturnNotice('weird')).toBeNull();
  });
});

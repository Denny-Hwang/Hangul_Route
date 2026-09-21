import type { Membership, Space } from '@hangul-route/content-schema';
import { describe, expect, it } from 'vitest';
import { allowedOnSpace, can, type Action, type Actor } from '../can';

const space = (id: string, kind: Space['kind'], owner: string, parentSpaceId: string | null = null): Space => ({
  id,
  kind,
  name: id,
  parentSpaceId,
  ownerAccountId: owner,
  joinCode: null,
  joinCodeExpiresAt: null,
  settings: { consentMode: 'parent', anonymizeRoster: false },
  archivedAt: null,
  createdAt: 't',
});
const member = (spaceId: string, memberId: string, role: Membership['role'], memberKind: Membership['memberKind'] = 'account'): Membership => ({
  spaceId,
  memberKind,
  memberId,
  role,
  joinedAt: 't',
});
const account = (accountId: string, memberships: Membership[]): Actor => ({ kind: 'account', accountId, memberships });

const family = space('space:fam', 'family', 'mom');
const school = space('space:sch', 'school', 'principal');
const klass = space('space:cls', 'class', 'teacher', 'space:sch');
const ALL: Action[] = ['snapshot.read', 'snapshot.write', 'summary.read', 'plan.write', 'roster.manage', 'space.manage', 'class.create', 'teacher.invite', 'entitlement.manage'];

describe('can() — F-SPACE-001 §3.4', () => {
  it('a learner may only read and write its own snapshot', () => {
    const me: Actor = { kind: 'learner', learnerId: 'profile:a' };
    expect(can(me, 'snapshot.read', { kind: 'learner', learnerId: 'profile:a', spaces: [] })).toBe(true);
    expect(can(me, 'snapshot.write', { kind: 'learner', learnerId: 'profile:a', spaces: [] })).toBe(true);
    expect(can(me, 'summary.read', { kind: 'learner', learnerId: 'profile:a', spaces: [] })).toBe(false);
    expect(can(me, 'snapshot.read', { kind: 'learner', learnerId: 'profile:b', spaces: [] })).toBe(false);
    expect(can(me, 'space.manage', { kind: 'space', ctx: { space: family, parent: null } })).toBe(false);
  });

  it('family owner and caregiver read summary + payload, write plans; only the owner manages', () => {
    const mom = account('mom', [member('space:fam', 'mom', 'owner')]);
    const dad = account('dad', [member('space:fam', 'dad', 'caregiver')]);
    const ctx = { space: family, parent: null };
    expect([...allowedOnSpace(mom as never, ctx)].sort()).toEqual(['plan.write', 'roster.manage', 'snapshot.read', 'space.manage', 'summary.read']);
    expect([...allowedOnSpace(dad as never, ctx)].sort()).toEqual(['plan.write', 'roster.manage', 'snapshot.read', 'summary.read']);
    expect(can(dad, 'snapshot.read', { kind: 'learner', learnerId: 'profile:a', spaces: [ctx] })).toBe(true);
    expect(can(dad, 'space.manage', { kind: 'space', ctx })).toBe(false);
  });

  it('a class teacher reads summary only — snapshot.read does not exist for class roles', () => {
    const teacher = account('teacher', [member('space:cls', 'teacher', 'owner')]);
    const ctx = { space: klass, parent: school };
    expect(can(teacher, 'summary.read', { kind: 'space', ctx })).toBe(true);
    expect(can(teacher, 'plan.write', { kind: 'space', ctx })).toBe(true);
    expect(can(teacher, 'roster.manage', { kind: 'space', ctx })).toBe(true);
    expect(can(teacher, 'space.manage', { kind: 'space', ctx })).toBe(true);
    expect(can(teacher, 'snapshot.read', { kind: 'learner', learnerId: 'profile:a', spaces: [ctx] })).toBe(false);
    expect(can(teacher, 'entitlement.manage', { kind: 'space', ctx })).toBe(false);
  });

  it('school admins manage the school and see child-class summaries; invited teachers may only create classes', () => {
    const principal = account('principal', [member('space:sch', 'principal', 'owner')]);
    const admin = account('admin', [member('space:sch', 'admin', 'admin')]);
    const invited = account('t2', [member('space:sch', 't2', 'teacher')]);
    const schoolCtx = { space: school, parent: null };
    const classCtx = { space: klass, parent: school };
    for (const actor of [principal, admin]) {
      expect(can(actor, 'teacher.invite', { kind: 'space', ctx: schoolCtx })).toBe(true);
      expect(can(actor, 'entitlement.manage', { kind: 'space', ctx: schoolCtx })).toBe(true);
      expect(can(actor, 'space.manage', { kind: 'space', ctx: schoolCtx })).toBe(true);
      expect(can(actor, 'class.create', { kind: 'space', ctx: schoolCtx })).toBe(true);
      expect(can(actor, 'summary.read', { kind: 'space', ctx: classCtx })).toBe(true);
      expect(can(actor, 'roster.manage', { kind: 'space', ctx: classCtx })).toBe(true);
      expect(can(actor, 'plan.write', { kind: 'space', ctx: classCtx })).toBe(false);
      expect(can(actor, 'snapshot.read', { kind: 'learner', learnerId: 'profile:a', spaces: [classCtx] })).toBe(false);
    }
    expect([...allowedOnSpace(invited as never, schoolCtx)]).toEqual(['class.create']);
    expect(can(invited, 'summary.read', { kind: 'space', ctx: classCtx })).toBe(false);
  });

  it('outsiders and learner-kind memberships grant nothing to an account', () => {
    const stranger = account('x', [member('space:other', 'x', 'owner')]);
    const impostor = account('profile:a', [member('space:fam', 'profile:a', 'student', 'learner')]);
    for (const action of ALL) {
      expect(can(stranger, action, { kind: 'space', ctx: { space: family, parent: null } })).toBe(false);
      expect(can(impostor, action, { kind: 'space', ctx: { space: family, parent: null } })).toBe(false);
    }
    expect(can(stranger, 'summary.read', { kind: 'learner', learnerId: 'profile:a', spaces: [] })).toBe(false);
  });
});

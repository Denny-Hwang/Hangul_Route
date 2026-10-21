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
    expect([...allowedOnSpace(mom as never, ctx)].sort()).toEqual([
      'admin.manage',
      'billing.manage',
      'feedback.oversee',
      'feedback.send',
      'learner.delete',
      'plan.write',
      'roster.manage',
      'snapshot.read',
      'space.archive',
      'space.manage',
      'space.rename',
      'space.settings',
      'summary.read',
    ]);
    expect([...allowedOnSpace(dad as never, ctx)].sort()).toEqual(['feedback.oversee', 'learner.delete', 'plan.write', 'roster.manage', 'snapshot.read', 'summary.read']);
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

describe('learner.delete (F-TCH-001 §10.3)', () => {
  it('caregivers always, teachers only under school consent, admins never through the school', () => {
    const mom = account('mom', [member('space:fam', 'mom', 'owner')]);
    const dad = account('dad', [member('space:fam', 'dad', 'caregiver')]);
    const teacher = account('teacher', [member('space:cls', 'teacher', 'owner')]);
    const principal = account('principal', [member('space:sch', 'principal', 'owner')]);
    expect(can(mom, 'learner.delete', { kind: 'space', ctx: { space: family, parent: null } })).toBe(true);
    expect(can(dad, 'learner.delete', { kind: 'space', ctx: { space: family, parent: null } })).toBe(true);
    expect(can(teacher, 'learner.delete', { kind: 'space', ctx: { space: klass, parent: school } })).toBe(false);
    const schoolConsent = { ...klass, settings: { consentMode: 'school' as const, anonymizeRoster: false } };
    expect(can(teacher, 'learner.delete', { kind: 'space', ctx: { space: schoolConsent, parent: school } })).toBe(true);
    expect(can(principal, 'learner.delete', { kind: 'space', ctx: { space: schoolConsent, parent: school } })).toBe(false);
  });
});

describe('learner.transfer (F-SPACE-002 §4.5, T10)', () => {
  const classCtx = { space: klass, parent: school };
  const familyCtx = { space: family, parent: null };
  const schoolCtx = { space: school, parent: null };
  const onClass = { kind: 'space' as const, ctx: classCtx };

  it('class owner and teacher yes; school owner and admin on a child class yes', () => {
    const owner = account('teacher', [member('space:cls', 'teacher', 'owner')]);
    const coTeacher = account('t2', [member('space:cls', 't2', 'teacher')]);
    const principal = account('principal', [member('space:sch', 'principal', 'owner')]);
    const admin = account('admin', [member('space:sch', 'admin', 'admin')]);
    for (const actor of [owner, coTeacher, principal, admin]) expect(can(actor, 'learner.transfer', onClass)).toBe(true);
  });

  it('family roles, a school-level teacher, outsiders and learners never', () => {
    const mom = account('mom', [member('space:fam', 'mom', 'owner')]);
    const dad = account('dad', [member('space:fam', 'dad', 'caregiver')]);
    const schoolTeacher = account('t3', [member('space:sch', 't3', 'teacher')]);
    const student = account('profile:a', [member('space:cls', 'profile:a', 'student', 'learner')]);
    const learner: Actor = { kind: 'learner', learnerId: 'profile:a' };
    for (const actor of [mom, dad]) {
      expect(can(actor, 'learner.transfer', { kind: 'space', ctx: familyCtx })).toBe(false);
      expect(can(actor, 'learner.transfer', onClass)).toBe(false);
    }
    for (const actor of [schoolTeacher, student, learner]) expect(can(actor, 'learner.transfer', onClass)).toBe(false);
    expect(can(learner, 'learner.transfer', { kind: 'learner', learnerId: 'profile:a', spaces: [classCtx] })).toBe(false);
  });

  it('is granted on classes only: a school admin does not hold it on the school itself', () => {
    const principal = account('principal', [member('space:sch', 'principal', 'owner')]);
    expect(can(principal, 'learner.transfer', { kind: 'space', ctx: schoolCtx })).toBe(false);
  });

  it('no teacher role ever holds snapshot.read, with or without learner.transfer', () => {
    const owner = account('teacher', [member('space:cls', 'teacher', 'owner')]);
    const coTeacher = account('t2', [member('space:cls', 't2', 'teacher')]);
    const schoolTeacher = account('t3', [member('space:sch', 't3', 'teacher')]);
    const admin = account('admin', [member('space:sch', 'admin', 'admin')]);
    const learnerTarget = { kind: 'learner' as const, learnerId: 'profile:a', spaces: [classCtx, schoolCtx] };
    for (const actor of [owner, coTeacher, schoolTeacher, admin]) expect(can(actor, 'snapshot.read', learnerTarget)).toBe(false);
  });

  it('is not implied by roster.manage: a family caregiver holds roster.manage but not learner.transfer', () => {
    const dad = account('dad', [member('space:fam', 'dad', 'caregiver')]);
    const granted = allowedOnSpace(dad as never, familyCtx);
    expect(granted.has('roster.manage')).toBe(true);
    expect(granted.has('learner.transfer')).toBe(false);
  });
});

describe('feedback.send and feedback.oversee (F-FEEDBACK-001 section 6.1)', () => {
  const famCtx = { space: family, parent: null };
  const classCtx = { space: klass, parent: school };
  const onSpace = (actor: Actor, action: Action, ctx: { space: Space; parent: Space | null; sendGrant?: boolean }) => can(actor, action, { kind: 'space', ctx });

  it("the family owner sends and oversees; a caregiver oversees, and sends only with the owner's grant", () => {
    const mom = account('mom', [member('space:fam', 'mom', 'owner')]);
    const dad = account('dad', [member('space:fam', 'dad', 'caregiver')]);
    expect(onSpace(mom, 'feedback.send', famCtx)).toBe(true);
    expect(onSpace(mom, 'feedback.oversee', famCtx)).toBe(true);
    expect(onSpace(dad, 'feedback.send', famCtx)).toBe(false);
    expect(onSpace(dad, 'feedback.send', { ...famCtx, sendGrant: false })).toBe(false);
    expect(onSpace(dad, 'feedback.send', { ...famCtx, sendGrant: true })).toBe(true);
    expect(onSpace(dad, 'feedback.oversee', famCtx)).toBe(true);
    expect(onSpace(dad, 'feedback.oversee', { ...famCtx, sendGrant: true })).toBe(true);
  });

  it('a class teacher and the class owner send; nobody oversees a class', () => {
    const owner = account('teacher', [member('space:cls', 'teacher', 'owner')]);
    const co = account('co', [member('space:cls', 'co', 'teacher')]);
    for (const actor of [owner, co]) {
      expect(onSpace(actor, 'feedback.send', classCtx)).toBe(true);
      expect(onSpace(actor, 'feedback.oversee', classCtx)).toBe(false);
    }
  });

  it('school admins and school-level teachers never send to a class, and a grant means nothing outside a family (OD-6)', () => {
    const principal = account('principal', [member('space:sch', 'principal', 'owner')]);
    const admin = account('admin', [member('space:sch', 'admin', 'admin')]);
    const schoolTeacher = account('t2', [member('space:sch', 't2', 'teacher')]);
    for (const actor of [principal, admin, schoolTeacher]) {
      expect(onSpace(actor, 'feedback.send', { ...classCtx, sendGrant: true })).toBe(false);
      expect(onSpace(actor, 'feedback.send', { space: school, parent: null, sendGrant: true })).toBe(false);
      expect(onSpace(actor, 'feedback.oversee', classCtx)).toBe(false);
    }
  });

  it('a student membership, an outsider and a class caregiver row grant neither', () => {
    const impostor = account('profile:a', [member('space:fam', 'profile:a', 'student', 'learner')]);
    const stranger = account('x', [member('space:other', 'x', 'owner')]);
    const odd = account('odd', [member('space:cls', 'odd', 'caregiver')]);
    for (const action of ['feedback.send', 'feedback.oversee'] as const) {
      expect(onSpace(impostor, action, { ...famCtx, sendGrant: true })).toBe(false);
      expect(onSpace(stranger, action, { ...famCtx, sendGrant: true })).toBe(false);
      expect(onSpace(odd, action, { ...classCtx, sendGrant: true })).toBe(false);
    }
  });
});

/** [SA] AMENDMENTS-SEATS-ADMINS sections 5.1 and 6.5: rename, and the owner-only actions. */
describe('can() — [SA] space.rename and the owner-only actions', () => {
  const OWNER_ONLY: Action[] = ['billing.manage', 'admin.manage', 'space.settings', 'space.archive'];
  const standalone = space('space:solo', 'class', 'solo-teacher');
  const famCtx = { space: family, parent: null };
  const schoolCtx = { space: school, parent: null };
  const classCtx = { space: klass, parent: school };
  const soloCtx = { space: standalone, parent: null };
  const at = (actor: Actor, action: Action, ctx: { space: Space; parent: Space | null }): boolean => can(actor, action, { kind: 'space', ctx });

  it('a family: the owner renames and holds every owner-only action; a caregiver none', () => {
    const mom = account('mom', [member('space:fam', 'mom', 'owner')]);
    const dad = account('dad', [member('space:fam', 'dad', 'caregiver')]);
    for (const action of ['space.rename', ...OWNER_ONLY] as Action[]) {
      expect(at(mom, action, famCtx), action).toBe(true);
      expect(at(dad, action, famCtx), action).toBe(false);
    }
  });

  it('a stand-alone class: the owner and a teacher member rename; only the owner holds the owner-only actions', () => {
    const owner = account('solo-teacher', [member('space:solo', 'solo-teacher', 'owner')]);
    const co = account('co', [member('space:solo', 'co', 'teacher')]);
    expect(at(owner, 'space.rename', soloCtx)).toBe(true);
    expect(at(co, 'space.rename', soloCtx)).toBe(true);
    for (const action of OWNER_ONLY) {
      expect(at(owner, action, soloCtx), action).toBe(true);
      expect(at(co, action, soloCtx), action).toBe(false);
    }
  });

  it('a school: the owner and an admin rename it; a teacher does not; only the owner holds the owner-only actions', () => {
    const principal = account('principal', [member('space:sch', 'principal', 'owner')]);
    const dean = account('dean', [member('space:sch', 'dean', 'admin')]);
    const teacher = account('ms-park', [member('space:sch', 'ms-park', 'teacher')]);
    expect([at(principal, 'space.rename', schoolCtx), at(dean, 'space.rename', schoolCtx), at(teacher, 'space.rename', schoolCtx)]).toEqual([true, true, false]);
    for (const action of OWNER_ONLY) {
      expect(at(principal, action, schoolCtx), action).toBe(true);
      expect(at(dean, action, schoolCtx), action).toBe(false);
      expect(at(teacher, action, schoolCtx), action).toBe(false);
    }
    // an admin still runs the school page and its invite code (space.manage stays)
    expect(at(dean, 'space.manage', schoolCtx)).toBe(true);
  });

  it('a class of a school: its owner, its teachers and the school owner and admins rename it; other teachers of the school do not', () => {
    const classOwner = account('teacher', [member('space:cls', 'teacher', 'owner')]);
    const classTeacher = account('helper', [member('space:cls', 'helper', 'teacher')]);
    const principal = account('principal', [member('space:sch', 'principal', 'owner')]);
    const dean = account('dean', [member('space:sch', 'dean', 'admin')]);
    const other = account('mr-lee', [member('space:sch', 'mr-lee', 'teacher')]);
    expect([classOwner, classTeacher, principal, dean, other].map((a) => at(a, 'space.rename', classCtx))).toEqual([true, true, true, true, false]);
    // the cascade never carries the owner-only actions to the school's owner or admins
    for (const action of OWNER_ONLY) {
      expect(at(principal, action, classCtx), action).toBe(false);
      expect(at(dean, action, classCtx), action).toBe(false);
      expect(at(classOwner, action, classCtx), action).toBe(true);
    }
  });

  it('a learner never renames or manages a space', () => {
    const me: Actor = { kind: 'learner', learnerId: 'profile:a' };
    for (const action of ['space.rename', ...OWNER_ONLY] as Action[]) expect(at(me, action, famCtx), action).toBe(false);
  });
});

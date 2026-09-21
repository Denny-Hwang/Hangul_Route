import { describe, expect, it } from 'vitest';
import {
  FREE_CLASS_STUDENT_CAP,
  JOIN_CODE_ALPHABET,
  LEARNER_CLASS_CAP,
  LearnerMembershipSchema,
  MembershipSchema,
  ProfileRoleSchema,
  SpaceCreateSchema,
  SpaceJoinSchema,
  SpaceLookupSchema,
  SpaceSchema,
  SpaceSettingsSchema,
  SyncInboxSchema,
  normalizeJoinCode,
} from '../index';

describe('join code (F-SPACE-001 §3.2)', () => {
  it('uses base32 without confusable characters', () => {
    expect(JOIN_CODE_ALPHABET).toHaveLength(32);
    for (const ch of 'IO01') expect(JOIN_CODE_ALPHABET).not.toContain(ch);
  });

  it('normalizes case and separators, never maps confusables', () => {
    expect(normalizeJoinCode('k7m2x9')).toBe('K7M2X9');
    expect(normalizeJoinCode(' k7m-2x 9 ')).toBe('K7M2X9');
    expect(normalizeJoinCode('K7M2X')).toBeNull();
    expect(normalizeJoinCode('K7M2X99')).toBeNull();
    expect(normalizeJoinCode('K7M2XO')).toBeNull(); // O is not in the alphabet
    expect(normalizeJoinCode('K7M2X1')).toBeNull();
  });

  it('lookup and join bodies carry the normalized code', () => {
    expect(SpaceLookupSchema.parse({ code: 'k7m2x9' }).code).toBe('K7M2X9');
    expect(SpaceLookupSchema.safeParse({ code: 'nope' }).success).toBe(false);
    expect(SpaceJoinSchema.parse({ code: 'K7M2X9', displayName: '  Suni ' })).toEqual({ code: 'K7M2X9', displayName: 'Suni' });
    expect(SpaceJoinSchema.safeParse({ code: 'K7M2X9', displayName: '' }).success).toBe(false);
    expect(SpaceJoinSchema.parse({ code: 'K7M2X9', learnerId: 'profile:suni' }).learnerId).toBe('profile:suni');
    expect(SpaceJoinSchema.safeParse({ code: 'K7M2X9', learnerId: 'nope' }).success).toBe(false);
  });
});

describe('space schemas (F-SPACE-001 §3.1)', () => {
  const space = {
    id: 'space:abc123',
    kind: 'class',
    name: 'Sunday Class A',
    parentSpaceId: null,
    ownerAccountId: 'user_1',
    joinCode: 'K7M2X9',
    joinCodeExpiresAt: '2026-10-21T00:00:00.000Z',
    settings: {},
    archivedAt: null,
    createdAt: '2026-09-21T00:00:00.000Z',
  };

  it('parses a space with settings defaults', () => {
    const parsed = SpaceSchema.parse(space);
    expect(parsed.settings).toEqual({ consentMode: 'parent', anonymizeRoster: false });
    expect(SpaceSettingsSchema.parse({ consentMode: 'school', anonymizeRoster: true }).consentMode).toBe('school');
    expect(SpaceSchema.safeParse({ ...space, joinCode: 'K7M2X0' }).success).toBe(false);
    expect(SpaceSchema.safeParse({ ...space, kind: 'club' }).success).toBe(false);
  });

  it('validates create bodies', () => {
    expect(SpaceCreateSchema.parse({ kind: 'family', name: ' Kim family ' }).name).toBe('Kim family');
    expect(SpaceCreateSchema.safeParse({ kind: 'class', name: '' }).success).toBe(false);
    expect(SpaceCreateSchema.safeParse({ kind: 'class', name: 'A', parentSpaceId: 'nope' }).success).toBe(false);
    expect(SpaceCreateSchema.safeParse({ kind: 'school', name: 'S', email: 'not-an-email' }).success).toBe(false);
  });

  it('parses memberships and the learner inbox rows', () => {
    const m = { spaceId: 'space:abc123', memberKind: 'learner', memberId: 'profile:suni', role: 'student', joinedAt: 't' };
    expect(MembershipSchema.parse(m).role).toBe('student');
    expect(MembershipSchema.safeParse({ ...m, role: 'boss' }).success).toBe(false);
    const row = { spaceId: 'space:abc123', kind: 'class', name: 'Sunday Class A', role: 'student', joinedAt: 't' };
    expect(LearnerMembershipSchema.parse(row).kind).toBe('class');
    const inbox = SyncInboxSchema.parse({ rev: 1, plans: [], memberships: [row], tier: 'free', serverTime: 't' });
    expect(inbox.memberships[0]?.name).toBe('Sunday Class A');
    expect(SyncInboxSchema.safeParse({ rev: 1, plans: [], memberships: [{ spaceId: 'x' }], tier: 'free', serverTime: 't' }).success).toBe(false);
  });

  it('reserves console roles on profiles and exposes the caps', () => {
    expect(ProfileRoleSchema.parse('teacher')).toBe('teacher');
    expect(ProfileRoleSchema.parse('admin')).toBe('admin');
    expect(ProfileRoleSchema.parse(undefined)).toBe('learner');
    expect(LEARNER_CLASS_CAP).toBe(3);
    expect(FREE_CLASS_STUDENT_CAP).toBe(20);
  });
});

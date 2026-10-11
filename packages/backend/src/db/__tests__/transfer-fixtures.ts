import { expect } from 'vitest';
import { TRANSFER_COOLING_OFF_MS, TRANSFER_WINDOW_MS, type Space } from '@hangul-route/content-schema';
import type { Learner } from '../../store';
import type { Db } from '../types';
import type { LearnerConsentRecord, StoredTransfer } from '../transfer-types';

/** Test world for the class-transfer Db tests (F-SPACE-002 T-3b). */
export const T0 = '2026-10-11T00:00:00.000Z';
export const at = (ms: number): Date => new Date(Date.parse(T0) + ms);
export const iso = (ms: number): string => at(ms).toISOString();
export const HOUR = 60 * 60 * 1000;
export const DAY = 24 * HOUR;

export const LEARNER = 'profile:suni';
export const SOURCE = 'space:class-a';
export const DEST = 'space:class-b';
export const FAMILY = 'space:family';

const space = (id: string, kind: Space['kind'], owner: string): Space => ({
  id,
  kind,
  name: id,
  parentSpaceId: null,
  ownerAccountId: owner,
  joinCode: null,
  joinCodeExpiresAt: null,
  settings: { consentMode: 'parent', anonymizeRoster: false },
  archivedAt: null,
  createdAt: T0,
});

export const learner = (id: string): Learner => ({ id, displayName: id, ageGroup: '8-9', avatar: 'hoya-orange', recoveryHash: null, createdAt: T0, lastActiveAt: T0 });

/**
 * Accounts `teacher-a` (owns class A), `teacher-b` (owns class B), `mom`
 * (owns the family); classes C, D, E owned by `teacher-c`; learner Suni in
 * class A and the family.
 */
export async function seedWorld(db: Db): Promise<void> {
  for (const accountId of ['teacher-a', 'teacher-b', 'teacher-c', 'mom']) await db.putAccount({ id: accountId, email: null, displayName: null, consent: null, createdAt: T0 });
  await db.putSpace(space(SOURCE, 'class', 'teacher-a'));
  await db.putSpace(space(DEST, 'class', 'teacher-b'));
  await db.putSpace(space(FAMILY, 'family', 'mom'));
  for (const id of ['space:class-c', 'space:class-d', 'space:class-e']) await db.putSpace(space(id, 'class', 'teacher-c'));
  await db.putLearner(learner(LEARNER));
  await db.addMembership({ spaceId: SOURCE, memberKind: 'account', memberId: 'teacher-a', role: 'owner', joinedAt: T0 });
  await db.addMembership({ spaceId: DEST, memberKind: 'account', memberId: 'teacher-b', role: 'owner', joinedAt: T0 });
  await db.addMembership({ spaceId: FAMILY, memberKind: 'account', memberId: 'mom', role: 'owner', joinedAt: T0 });
  await db.addMembership({ spaceId: SOURCE, memberKind: 'learner', memberId: LEARNER, role: 'student', joinedAt: T0 });
  await db.addMembership({ spaceId: FAMILY, memberKind: 'learner', memberId: LEARNER, role: 'student', joinedAt: T0 });
}

/** Adds `count` other learners to a class (fills seats). */
export async function fillClass(db: Db, spaceId: string, count: number): Promise<void> {
  for (let i = 0; i < count; i += 1) {
    const id = `profile:${spaceId.slice(6)}-${i}`;
    await db.putLearner(learner(id));
    await db.addMembership({ spaceId, memberKind: 'learner', memberId: id, role: 'student', joinedAt: T0 });
  }
}

export const consentRecord = (over: Partial<LearnerConsentRecord> = {}): LearnerConsentRecord => ({
  basis: 'caregiver',
  attest: null,
  evidence: 'mom',
  role: 'owner',
  textVersion: 'transfer-2026-10',
  locale: 'en',
  shown: { lineIds: ['moving', 'new_teacher', 'old_teacher'], flags: { premiumChange: 'none', relinkAffected: false } },
  terms: { destNameHash: 'a'.repeat(64), destConsentMode: 'parent', destAnonymize: false, destOwnerId: 'teacher-b', sourceNameHash: 'b'.repeat(64), premiumChange: 'none' },
  ...over,
});

/** A learner-side request created at T0 by `mom`: learner slot consented, both teacher slots pending. */
export function learnerSideRow(over: Partial<StoredTransfer> = {}): StoredTransfer {
  const record = consentRecord();
  return {
    id: 'transfer:0001',
    learnerId: LEARNER,
    sourceSpaceId: SOURCE,
    destSpaceId: DEST,
    initiator: 'learner_side',
    initiatorAccountId: 'mom',
    status: 'requested',
    endReason: null,
    endActor: null,
    blockReason: null,
    introduce: false,
    rev: 0,
    learner: { state: 'consented', at: T0, basis: record.basis, attest: record.attest, evidence: record.evidence, role: record.role, textVersion: record.textVersion, locale: record.locale, shown: record.shown, terms: record.terms },
    source: { state: 'pending', at: null, accountId: null, via: null },
    destination: { state: 'pending', at: null, accountId: null, via: null },
    createdAt: T0,
    updatedAt: T0,
    expiresAt: iso(TRANSFER_WINDOW_MS),
    approvedAt: null,
    executeAfter: iso(TRANSFER_COOLING_OFF_MS),
    endedAt: null,
    executedAt: null,
    ...over,
  };
}

/** A source-started request created at T0 by `teacher-a`: source consented, learner and destination pending. */
export function sourceRow(over: Partial<StoredTransfer> = {}): StoredTransfer {
  return learnerSideRow({
    initiator: 'source',
    initiatorAccountId: 'teacher-a',
    learner: { state: 'pending', at: null, basis: null, attest: null, evidence: null, role: null, textVersion: null, locale: null, shown: null, terms: null },
    source: { state: 'consented', at: T0, accountId: 'teacher-a', via: 'owner' },
    executeAfter: null,
    ...over,
  });
}

export const created = { at: T0, actorKind: 'account' as const, actorRef: 'mom', event: 'created' as const, slot: null, detail: null };

/** Creates a learner-side request and brings it to `approved` (both teachers in), as of `now`. */
export async function approvedRequest(db: Db, now: Date = at(HOUR), over: Partial<StoredTransfer> = {}): Promise<StoredTransfer> {
  const row = learnerSideRow(over);
  expect(await db.createTransfer(row, created)).toBe('created');
  expect(await db.consentSlot(row.id, { kind: 'teacher', slots: ['source'], accountId: 'teacher-a', via: 'owner' }, now)).toBe(1);
  expect(await db.consentSlot(row.id, { kind: 'teacher', slots: ['destination'], accountId: 'teacher-b', via: 'owner' }, now)).toBe(1);
  expect(await db.promoteTransfer(row.id, now)).toBe(1);
  const read = await db.getTransfer(row.id);
  if (!read) throw new Error('approvedRequest: row vanished');
  return read;
}

export const executeInput = (now: Date, over: Partial<{ destCap: number; learnerCap: number; id: string; learnerId: string }> = {}) => ({
  id: 'transfer:0001',
  learnerId: LEARNER,
  sourceSpaceId: SOURCE,
  destSpaceId: DEST,
  now,
  destCap: 20,
  learnerCap: 3,
  ...over,
});

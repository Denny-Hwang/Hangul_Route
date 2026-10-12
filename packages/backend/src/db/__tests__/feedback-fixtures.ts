import type { Membership, Space } from '@hangul-route/content-schema';
import type { NewNote, StoredNoteReport } from '../feedback-types';
import type { Db } from '../types';

/*
 * A small world for the notes persistence tests (F-FEEDBACK-001 FB-2): one
 * family, two classes, two learners and their adults.
 */

export const T0 = Date.parse('2026-10-12T00:00:00.000Z');
export const HOUR = 60 * 60 * 1000;
export const DAY = 24 * HOUR;
export const at = (offsetMs: number): Date => new Date(T0 + offsetMs);
export const iso = (offsetMs: number): string => at(offsetMs).toISOString();

export const FAMILY = 'space:family';
export const CLASS = 'space:class';
export const CLASS_B = 'space:class-b';
export const SUNI = 'profile:suni';
export const MIN = 'profile:min';

/** mom owns the family; dad and grandma are caregivers (grandma gets a send grant in tests that need it). */
export const MOM = 'acct-mom';
export const DAD = 'acct-dad';
export const GRANDMA = 'acct-grandma';
/** teacher owns the class; coteacher teaches in it; teacherB owns class B. */
export const TEACHER = 'acct-teacher';
export const COTEACHER = 'acct-coteacher';
export const TEACHER_B = 'acct-teacher-b';

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
  createdAt: iso(-400 * DAY),
});

const member = (spaceId: string, memberKind: Membership['memberKind'], memberId: string, role: Membership['role']): Membership => ({ spaceId, memberKind, memberId, role, joinedAt: iso(-400 * DAY) });

export const learnerRow = (learnerId: string) => ({ id: learnerId, displayName: learnerId, ageGroup: '8-9' as const, avatar: 'hoya-orange', recoveryHash: null, createdAt: iso(-400 * DAY), lastActiveAt: iso(-400 * DAY) });

export async function seedNotesWorld(db: Db): Promise<void> {
  for (const accountId of [MOM, DAD, GRANDMA, TEACHER, COTEACHER, TEACHER_B]) await db.putAccount({ id: accountId, email: null, displayName: accountId, consent: null, createdAt: iso(-400 * DAY) });
  await db.putSpace(space(FAMILY, 'family', MOM));
  await db.putSpace(space(CLASS, 'class', TEACHER));
  await db.putSpace(space(CLASS_B, 'class', TEACHER_B));
  for (const learnerId of [SUNI, MIN]) await db.putLearner(learnerRow(learnerId));
  const rows = [
    member(FAMILY, 'account', MOM, 'owner'),
    member(FAMILY, 'account', DAD, 'caregiver'),
    member(FAMILY, 'account', GRANDMA, 'caregiver'),
    member(FAMILY, 'learner', SUNI, 'student'),
    member(CLASS, 'account', TEACHER, 'owner'),
    member(CLASS, 'account', COTEACHER, 'teacher'),
    member(CLASS, 'learner', SUNI, 'student'),
    member(CLASS, 'learner', MIN, 'student'),
    member(CLASS_B, 'account', TEACHER_B, 'owner'),
    member(CLASS_B, 'learner', SUNI, 'student'),
  ];
  for (const m of rows) await db.addMembership(m);
}

let seq = 0;
/** A unique note id in the shape `note:<8-64 of [a-z0-9-]>`. */
export const noteId = (): string => {
  seq += 1;
  return `note:${String(seq).padStart(8, '0')}`;
};

/** A teacher's note in the class to Suni, one hour before T0, unless overridden. */
export function classNote(over: Partial<NewNote> = {}): NewNote {
  return {
    id: noteId(),
    learnerId: SUNI,
    spaceId: CLASS,
    senderAccountId: TEACHER,
    senderRole: 'teacher',
    senderLabel: null,
    batchId: 'batch:class-1',
    batchKind: 'learners',
    presetId: 'progress_reading',
    body: 'Loved your work today',
    bodyLocale: 'en',
    suggest: null,
    createdAt: iso(-HOUR),
    ...over,
  };
}

/** Mom's note in the family to Suni, signed "Mom". */
export function familyNote(over: Partial<NewNote> = {}): NewNote {
  return classNote({ spaceId: FAMILY, senderAccountId: MOM, senderRole: 'family', senderLabel: 'mom', batchId: 'batch:family-1', presetId: 'warm_learning_together', body: 'See you at dinner', ...over });
}

export function report(noteIdValue: string, over: Partial<StoredNoteReport> = {}): StoredNoteReport {
  return {
    id: `notereport:${noteIdValue.slice(5)}`,
    noteId: noteIdValue,
    learnerId: SUNI,
    senderAccountId: TEACHER,
    reason: 'unkind',
    via: 'family',
    evidence: MOM,
    reporterKey: `family:${FAMILY}`,
    attest: null,
    createdAt: iso(0),
    reviewedAt: null,
    outcome: null,
    ...over,
  };
}

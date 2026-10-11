import {
  LEARNER_CLASS_CAP,
  TRANSFER_BLOCKED_VALID_MS,
  TRANSFER_COOLDOWN_MS,
  TRANSFER_COOLING_OFF_MS,
  TRANSFER_REFUSAL_COOLDOWN_MS,
  TRANSFER_WINDOW_MS,
  TransferIdSchema,
  type Space,
} from '@hangul-route/content-schema';
import { beforeEach, describe, expect, it } from 'vitest';
import { testDb as db } from '../../__tests__/helpers/db';
import { DAY, DEST, FAMILY, fillClass, HOUR, LEARNER, SOURCE, T0, at, seedWorld } from '../../db/__tests__/transfer-fixtures';
import type { LearnerConsentRecord, StoredTransfer } from '../../db';
import type { AccountActor, SpaceContext } from '../can';
import {
  classTransferEnabled,
  consentFreshness,
  consentTermsFor,
  executeTransfer,
  familyGuardianRole,
  guardianOf,
  learnerSideCooldown,
  nameHash,
  newRequest,
  newTransferId,
  partiesOf,
  planTeacherConsent,
  premiumChangeFor,
  settle,
  sourceRequestRefused,
  teacherVia,
  transferDeviceConsentEnabled,
} from '../transfer';

/**
 * `lib/transfer.ts` — F-SPACE-002 §4.1, §4.2, §4.6, §4.9 (PR T-4b): the rules
 * over the Db compare-and-set methods. Runs on the in-memory Db and, with
 * HR_TEST_DB=sqlite, on D1 over the real migrations.
 */

const ON = { CLASS_TRANSFER: 'enabled' };
const OFF = {};
/** The world's memberships are from T0; a guardian counts from T0 + 24 h. */
const CREATED = at(2 * DAY);
const DUE = new Date(CREATED.getTime() + TRANSFER_COOLING_OFF_MS);
const AFTER_DUE = new Date(DUE.getTime() + HOUR);

async function space(id: string): Promise<Space> {
  const s = await db.getSpace(id);
  if (!s) throw new Error(`no space ${id}`);
  return s;
}
async function putSpace(id: string, over: Partial<Space>): Promise<void> {
  await db.putSpace({ ...(await space(id)), ...over });
}
async function row(id: string): Promise<StoredTransfer> {
  const t = await db.getTransfer(id);
  if (!t) throw new Error(`no transfer ${id}`);
  return t;
}
const join = (spaceId: string, memberKind: 'learner' | 'account', memberId: string, role: 'student' | 'owner' | 'caregiver' | 'teacher' | 'admin', joinedAt = T0) =>
  db.addMembership({ spaceId, memberKind, memberId, role, joinedAt });
async function actor(accountId: string): Promise<AccountActor> {
  return { kind: 'account', accountId, memberships: await db.membershipsOf('account', accountId) };
}
async function ctx(spaceId: string): Promise<SpaceContext> {
  const s = await space(spaceId);
  return { space: s, parent: s.parentSpaceId ? await db.getSpace(s.parentSpaceId) : null };
}

/** The learner-side consent `mom` gives at `now`, with the live terms. */
async function momConsent(now: Date): Promise<LearnerConsentRecord> {
  return {
    basis: 'caregiver',
    attest: null,
    evidence: 'mom',
    role: 'owner',
    textVersion: 'transfer-2026-10',
    locale: 'en',
    shown: { lineIds: ['moving', 'new_teacher', 'old_teacher'], flags: {} },
    terms: await consentTermsFor(db, LEARNER, await space(SOURCE), await space(DEST), now),
  };
}

/** A guardian-started request (mom), created at `now`. */
async function learnerSide(now: Date = CREATED, id = 'transfer:ls'): Promise<StoredTransfer> {
  const request = newRequest({ id, learnerId: LEARNER, sourceSpaceId: SOURCE, destSpaceId: DEST, introduce: false, now, initiator: 'learner_side', initiatorAccountId: 'mom', consent: await momConsent(now) });
  expect(await db.createTransfer(request, { at: now.toISOString(), actorKind: 'account', actorRef: 'mom', event: 'created', slot: null, detail: null })).toBe('created');
  return row(id);
}

/** A guardian-started request with both teachers in (still `requested` until settled). */
async function allAgreed(now: Date = CREATED): Promise<StoredTransfer> {
  const t = await learnerSide(now);
  expect(await db.consentSlot(t.id, { kind: 'teacher', slots: ['source'], accountId: 'teacher-a', via: 'owner' }, now)).toBe(1);
  expect(await db.consentSlot(t.id, { kind: 'teacher', slots: ['destination'], accountId: 'teacher-b', via: 'owner' }, now)).toBe(1);
  return row(t.id);
}

/** Settled at `now` into `approved`. */
async function approved(now: Date = CREATED): Promise<StoredTransfer> {
  const t = await allAgreed(now);
  const result = await settle(db, t, now, ON);
  expect(result.request?.status).toBe('approved');
  return row(t.id);
}

const learnerSpaces = async (): Promise<string[]> => (await db.membershipsOf('learner', LEARNER)).map((m) => m.spaceId).sort();
const events = async (id: string): Promise<string[]> => (await db.transferEvents(id)).map((e) => e.event);

beforeEach(async () => {
  await db.reset();
  await seedWorld(db);
});

describe('release flags (T15)', () => {
  it('only the exact value "enabled" opens either lock', () => {
    expect(classTransferEnabled(ON)).toBe(true);
    expect(classTransferEnabled({ CLASS_TRANSFER: 'true' })).toBe(false);
    expect(classTransferEnabled(OFF)).toBe(false);
    expect(classTransferEnabled(undefined)).toBe(false);
    expect(transferDeviceConsentEnabled({ CLASS_TRANSFER_DEVICE_CONSENT: 'enabled' })).toBe(true);
    expect(transferDeviceConsentEnabled(ON)).toBe(false);
    expect(transferDeviceConsentEnabled(undefined)).toBe(false);
  });
});

describe('newTransferId / newRequest (§4.1 initiator table)', () => {
  it('ids are transfer:<uuid> and never repeat', () => {
    const a = newTransferId();
    expect(TransferIdSchema.safeParse(a).success).toBe(true);
    expect(a).toMatch(/^transfer:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
    expect(newTransferId()).not.toBe(a);
  });

  it('learner_side: learner consented, both teacher slots pending, execute_after = consent + 48 h', async () => {
    const consent = await momConsent(CREATED);
    const r = newRequest({ id: 'transfer:x', learnerId: LEARNER, sourceSpaceId: SOURCE, destSpaceId: DEST, introduce: true, now: CREATED, initiator: 'learner_side', initiatorAccountId: 'mom', consent });
    expect(r).toMatchObject({
      status: 'requested',
      initiator: 'learner_side',
      initiatorAccountId: 'mom',
      introduce: true,
      rev: 0,
      learner: { state: 'consented', at: CREATED.toISOString(), basis: 'caregiver', evidence: 'mom', role: 'owner', textVersion: 'transfer-2026-10', locale: 'en', terms: consent.terms },
      source: { state: 'pending', at: null, accountId: null, via: null },
      destination: { state: 'pending', at: null, accountId: null, via: null },
      createdAt: CREATED.toISOString(),
      updatedAt: CREATED.toISOString(),
      expiresAt: new Date(CREATED.getTime() + TRANSFER_WINDOW_MS).toISOString(),
      executeAfter: new Date(CREATED.getTime() + TRANSFER_COOLING_OFF_MS).toISOString(),
      approvedAt: null,
      endedAt: null,
      executedAt: null,
      endReason: null,
      endActor: null,
      blockReason: null,
    });
    expect(await db.createTransfer(r, { at: CREATED.toISOString(), actorKind: 'account', actorRef: 'mom', event: 'created', slot: null, detail: null })).toBe('created');
    expect(await db.getTransfer('transfer:x')).toEqual(r);
  });

  it('a device consent records its claim and no initiator account', () => {
    const r = newRequest({
      id: 'transfer:d',
      learnerId: LEARNER,
      sourceSpaceId: SOURCE,
      destSpaceId: DEST,
      introduce: false,
      now: CREATED,
      initiator: 'learner_side',
      initiatorAccountId: null,
      consent: { basis: 'device_attested', attest: 'self', evidence: 'device-1', role: null, textVersion: 'transfer-2026-10', locale: 'ko', shown: { lineIds: [], flags: {} }, terms: { destNameHash: 'x', destConsentMode: 'parent', destAnonymize: false, destOwnerId: 'teacher-b', sourceNameHash: 'y', premiumChange: 'none' } },
    });
    expect(r.initiatorAccountId).toBeNull();
    expect(r.learner).toMatchObject({ basis: 'device_attested', attest: 'self', evidence: 'device-1', role: null, locale: 'ko' });
  });

  it('source: source consented by the teacher, learner and destination pending, no execute_after', async () => {
    const r = newRequest({ id: 'transfer:s', learnerId: LEARNER, sourceSpaceId: SOURCE, destSpaceId: DEST, introduce: false, now: CREATED, initiator: 'source', initiatorAccountId: 'teacher-a', via: 'owner' });
    expect(r).toMatchObject({
      initiator: 'source',
      initiatorAccountId: 'teacher-a',
      learner: { state: 'pending', at: null, basis: null, attest: null, evidence: null, role: null, textVersion: null, locale: null, shown: null, terms: null },
      source: { state: 'consented', at: CREATED.toISOString(), accountId: 'teacher-a', via: 'owner' },
      destination: { state: 'pending', at: null, accountId: null, via: null },
      executeAfter: null,
    });
    expect(await db.createTransfer(r, { at: CREATED.toISOString(), actorKind: 'account', actorRef: 'teacher-a', event: 'created', slot: null, detail: null })).toBe('created');
  });
});

describe('consent-time terms (§4.11)', () => {
  it('nameHash is SHA-256 hex', async () => {
    expect(await nameHash('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  });

  it('records the destination mode, anonymity, owner and both name hashes; never a name', async () => {
    const terms = await consentTermsFor(db, LEARNER, await space(SOURCE), await space(DEST), CREATED);
    expect(terms).toEqual({
      destNameHash: await nameHash(DEST),
      destConsentMode: 'parent',
      destAnonymize: false,
      destOwnerId: 'teacher-b',
      sourceNameHash: await nameHash(SOURCE),
      premiumChange: 'none',
    });
    expect(JSON.stringify(terms)).not.toContain(DEST);
  });

  it('premiumChange is may_change only when the computed tier differs (behaviour 12)', async () => {
    expect(await premiumChangeFor(db, LEARNER, SOURCE, DEST, CREATED)).toBe('none');
    await db.applyEntitlement({ subjectKind: 'space', subjectId: SOURCE, planKey: 'group_license', status: 'active', provider: 'manual' }, CREATED);
    expect(await premiumChangeFor(db, LEARNER, SOURCE, DEST, CREATED)).toBe('may_change');
    await db.applyEntitlement({ subjectKind: 'space', subjectId: FAMILY, planKey: 'family_lifetime', status: 'active', provider: 'stripe' }, CREATED);
    expect(await premiumChangeFor(db, LEARNER, SOURCE, DEST, CREATED)).toBe('none');
  });
});

describe('teacher slots (T10, T11)', () => {
  beforeEach(async () => {
    await db.putAccount({ id: 'principal', email: null, displayName: null, consent: null, createdAt: T0 });
    await db.putAccount({ id: 'co', email: null, displayName: null, consent: null, createdAt: T0 });
    await db.putSpace({ ...(await space(SOURCE)), id: 'space:school', kind: 'school', ownerAccountId: 'principal' });
    await join('space:school', 'account', 'principal', 'owner');
    await putSpace(SOURCE, { parentSpaceId: 'space:school' });
    await putSpace(DEST, { parentSpaceId: 'space:school' });
  });

  it('teacherVia: owner, teacher, school_admin through the cascade, null otherwise', async () => {
    await join(DEST, 'account', 'co', 'teacher');
    expect(teacherVia(await actor('teacher-a'), await ctx(SOURCE))).toBe('owner');
    expect(teacherVia(await actor('co'), await ctx(DEST))).toBe('teacher');
    expect(teacherVia(await actor('principal'), await ctx(DEST))).toBe('school_admin');
    expect(teacherVia(await actor('teacher-a'), await ctx(DEST))).toBeNull();
    expect(teacherVia(await actor('mom'), await ctx(FAMILY))).toBeNull();
    expect(teacherVia(await actor('principal'), await ctx('space:school'))).toBeNull();
  });

  it('one slot: the actor fills it with its own via; repeated names count once', async () => {
    const t = await learnerSide();
    const plan = planTeacherConsent(await actor('teacher-a'), t, ['source', 'source'], { source: await ctx(SOURCE), destination: await ctx(DEST) });
    expect(plan).toEqual({ kind: 'consent', consent: { kind: 'teacher', slots: ['source'], accountId: 'teacher-a', via: 'owner' } });
  });

  it('both slots in one click only for a direct owner/teacher of both classes', async () => {
    await join(DEST, 'account', 'teacher-a', 'teacher');
    const t = await learnerSide();
    const plan = planTeacherConsent(await actor('teacher-a'), t, ['source', 'destination'], { source: await ctx(SOURCE), destination: await ctx(DEST) });
    // Owner of one, teacher of the other: the single UPDATE records the working role.
    expect(plan).toEqual({ kind: 'consent', consent: { kind: 'teacher', slots: ['source', 'destination'], accountId: 'teacher-a', via: 'teacher' } });
    expect(await db.consentSlot(t.id, (plan as { consent: Parameters<typeof db.consentSlot>[1] }).consent, CREATED)).toBe(1);
    expect(await row(t.id)).toMatchObject({ source: { state: 'consented', via: 'teacher' }, destination: { state: 'consented', via: 'teacher' } });
  });

  it('owner of both classes records via owner', async () => {
    await putSpace(DEST, { ownerAccountId: 'teacher-a' });
    await join(DEST, 'account', 'teacher-a', 'owner');
    const t = await learnerSide();
    expect(planTeacherConsent(await actor('teacher-a'), t, ['destination', 'source'], { source: await ctx(SOURCE), destination: await ctx(DEST) })).toEqual({
      kind: 'consent',
      consent: { kind: 'teacher', slots: ['source', 'destination'], accountId: 'teacher-a', via: 'owner' },
    });
  });

  it('a school admin fills one slot per action, recorded school_admin', async () => {
    const t = await learnerSide();
    const both = planTeacherConsent(await actor('principal'), t, ['source', 'destination'], { source: await ctx(SOURCE), destination: await ctx(DEST) });
    expect(both).toEqual({ kind: 'refused', error: 'one_slot_per_action' });
    const one = planTeacherConsent(await actor('principal'), t, ['destination'], { source: await ctx(SOURCE), destination: await ctx(DEST) });
    expect(one).toEqual({ kind: 'consent', consent: { kind: 'teacher', slots: ['destination'], accountId: 'principal', via: 'school_admin' } });
  });

  it('refuses a slot the actor does not manage (not_found), destination before learner (awaiting_learner), an ended request (not_open)', async () => {
    const t = await learnerSide();
    const ctxs = { source: await ctx(SOURCE), destination: await ctx(DEST) };
    expect(planTeacherConsent(await actor('teacher-b'), t, ['source'], ctxs)).toEqual({ kind: 'refused', error: 'not_found' });
    expect(planTeacherConsent(await actor('teacher-a'), t, [], ctxs)).toEqual({ kind: 'refused', error: 'not_found' });
    const fromTeacher = newRequest({ id: 'transfer:s', learnerId: LEARNER, sourceSpaceId: SOURCE, destSpaceId: DEST, introduce: false, now: CREATED, initiator: 'source', initiatorAccountId: 'teacher-a', via: 'owner' });
    expect(planTeacherConsent(await actor('teacher-b'), fromTeacher, ['destination'], ctxs)).toEqual({ kind: 'refused', error: 'awaiting_learner' });
    expect(planTeacherConsent(await actor('teacher-b'), { ...t, status: 'declined' }, ['destination'], ctxs)).toEqual({ kind: 'refused', error: 'not_open' });
  });

  it('a slot already in is left out; nothing left to fill is unchanged (idempotent approve)', async () => {
    await join(DEST, 'account', 'teacher-a', 'teacher');
    const t = await allAgreed();
    const ctxs = { source: await ctx(SOURCE), destination: await ctx(DEST) };
    expect(planTeacherConsent(await actor('teacher-a'), t, ['source', 'destination'], ctxs)).toEqual({ kind: 'unchanged' });
    const half = { ...t, destination: { state: 'pending' as const, at: null, accountId: null, via: null } };
    expect(planTeacherConsent(await actor('teacher-a'), half, ['source', 'destination'], ctxs)).toEqual({
      kind: 'consent',
      consent: { kind: 'teacher', slots: ['destination'], accountId: 'teacher-a', via: 'teacher' },
    });
    const notRequired = { ...t, source: { ...t.source, state: 'not_required' as const } };
    expect(planTeacherConsent(await actor('teacher-a'), notRequired, ['source'], ctxs)).toEqual({ kind: 'unchanged' });
  });
});

describe('guardian predicate (§4.2 guard 9)', () => {
  const parties = { sourceSpaceId: SOURCE, destSpaceId: DEST };

  it('(a) an aged owner or caregiver of a live family the learner is in', async () => {
    expect(await guardianOf(db, 'mom', LEARNER, parties, CREATED)).toEqual({ ok: true, role: 'owner', familyId: FAMILY });
    await db.putAccount({ id: 'dad', email: null, displayName: null, consent: null, createdAt: T0 });
    await join(FAMILY, 'account', 'dad', 'caregiver');
    expect(await guardianOf(db, 'dad', LEARNER, parties, CREATED)).toEqual({ ok: true, role: 'caregiver', familyId: FAMILY });
  });

  it('(a) refuses strangers, archived families, another family, and class roles', async () => {
    expect(await guardianOf(db, 'teacher-c', LEARNER, parties, CREATED)).toEqual({ ok: false, error: 'not_guardian' });
    expect(await guardianOf(db, 'mom', LEARNER, { ...parties }, CREATED, { familyId: 'space:other' })).toEqual({ ok: false, error: 'not_guardian' });
    await putSpace(FAMILY, { archivedAt: CREATED.toISOString() });
    expect(await guardianOf(db, 'mom', LEARNER, parties, CREATED)).toEqual({ ok: false, error: 'not_guardian' });
    expect(await familyGuardianRole(db, 'mom', LEARNER)).toBeNull();
  });

  it('(b) both memberships must be at least 24 hours old', async () => {
    expect(await guardianOf(db, 'mom', LEARNER, parties, at(23 * HOUR))).toEqual({ ok: false, error: 'family_too_new' });
    expect(await guardianOf(db, 'mom', LEARNER, parties, at(DAY))).toMatchObject({ ok: true });
    await db.removeMembership(FAMILY, 'learner', LEARNER);
    await join(FAMILY, 'learner', LEARNER, 'student', at(DAY + HOUR).toISOString());
    expect(await guardianOf(db, 'mom', LEARNER, parties, CREATED)).toEqual({ ok: false, error: 'family_too_new' });
    expect(await guardianOf(db, 'mom', LEARNER, parties, at(2 * DAY + 2 * HOUR))).toMatchObject({ ok: true });
  });

  it('(c) behaviour 5: a teacher who builds a family is refused on day one, then by separation of duties', async () => {
    await db.putSpace({ ...(await space(FAMILY)), id: 'space:fake-family', ownerAccountId: 'teacher-a' });
    await join('space:fake-family', 'account', 'teacher-a', 'owner', CREATED.toISOString());
    await join('space:fake-family', 'learner', LEARNER, 'student', CREATED.toISOString());
    expect(await guardianOf(db, 'teacher-a', LEARNER, parties, new Date(CREATED.getTime() + HOUR))).toEqual({ ok: false, error: 'family_too_new' });
    expect(await guardianOf(db, 'teacher-a', LEARNER, parties, new Date(CREATED.getTime() + 2 * DAY))).toEqual({ ok: false, error: 'conflicted_guardian' });
    // The safe direction needs only (a): the same account may still veto.
    expect(await familyGuardianRole(db, 'teacher-a', LEARNER)).toBe('owner');
  });

  it('(c) any account role in either class or the school above, or class ownership, conflicts', async () => {
    await db.putAccount({ id: 'principal', email: null, displayName: null, consent: null, createdAt: T0 });
    await db.putSpace({ ...(await space(SOURCE)), id: 'space:school', kind: 'school', ownerAccountId: 'principal' });
    await putSpace(DEST, { parentSpaceId: 'space:school' });
    await join(FAMILY, 'account', 'principal', 'caregiver');
    expect(await guardianOf(db, 'principal', LEARNER, parties, CREATED)).toEqual({ ok: false, error: 'conflicted_guardian' });

    await db.putAccount({ id: 'dad', email: null, displayName: null, consent: null, createdAt: T0 });
    await join(FAMILY, 'account', 'dad', 'caregiver');
    await putSpace(DEST, { ownerAccountId: 'dad' }); // owner column, no membership row
    expect(await guardianOf(db, 'dad', LEARNER, parties, CREATED)).toEqual({ ok: false, error: 'conflicted_guardian' });
  });

  it('(c) not the teacher who started the request or either class consenter; a guardian who started it is fine', async () => {
    await db.putAccount({ id: 'dad', email: null, displayName: null, consent: null, createdAt: T0 });
    await join(FAMILY, 'account', 'dad', 'caregiver');
    const ok = await guardianOf(db, 'dad', LEARNER, partiesOf(await learnerSide()), CREATED);
    expect(ok).toMatchObject({ ok: true });
    expect(await guardianOf(db, 'mom', LEARNER, partiesOf(await row('transfer:ls')), CREATED)).toMatchObject({ ok: true });
    const t = await row('transfer:ls');
    expect(await guardianOf(db, 'dad', LEARNER, { ...partiesOf(t), sourceAccountId: 'dad' }, CREATED)).toEqual({ ok: false, error: 'conflicted_guardian' });
    expect(await guardianOf(db, 'dad', LEARNER, { ...partiesOf(t), destAccountId: 'dad' }, CREATED)).toEqual({ ok: false, error: 'conflicted_guardian' });
    expect(await guardianOf(db, 'dad', LEARNER, { ...partiesOf(t), initiator: 'source', initiatorAccountId: 'dad' }, CREATED)).toEqual({ ok: false, error: 'conflicted_guardian' });
  });

  it('partiesOf reads the request', async () => {
    const t = await allAgreed();
    expect(partiesOf(t)).toEqual({ sourceSpaceId: SOURCE, destSpaceId: DEST, initiator: 'learner_side', initiatorAccountId: 'mom', sourceAccountId: 'teacher-a', destAccountId: 'teacher-b' });
  });

  it('familyGuardianRole (veto) ignores age and separation, honours the family filter', async () => {
    expect(await familyGuardianRole(db, 'mom', LEARNER)).toBe('owner');
    expect(await familyGuardianRole(db, 'mom', LEARNER, FAMILY)).toBe('owner');
    expect(await familyGuardianRole(db, 'mom', LEARNER, SOURCE)).toBeNull();
    expect(await familyGuardianRole(db, 'teacher-a', LEARNER)).toBeNull();
  });
});

describe('cooldown rules (§4.9)', () => {
  it('learner side: 7 days after another side declined its request to that destination', async () => {
    const t = await learnerSide();
    await db.declineSlot(t.id, 'destination', 'declined_destination', 'destination', CREATED);
    const wait = await learnerSideCooldown(db, LEARNER, DEST, new Date(CREATED.getTime() + DAY));
    expect(wait).toBe((TRANSFER_COOLDOWN_MS - DAY) / 1000);
    expect(await learnerSideCooldown(db, LEARNER, 'space:class-c', new Date(CREATED.getTime() + DAY))).toBeNull();
    expect(await learnerSideCooldown(db, LEARNER, DEST, new Date(CREATED.getTime() + TRANSFER_COOLDOWN_MS))).toBeNull();
  });

  it("learner side: the initiator's own cancel is not a cooldown", async () => {
    const t = await learnerSide();
    await db.cancelTransfer(t.id, 'withdrawn_learner', 'family', CREATED);
    expect(await learnerSideCooldown(db, LEARNER, DEST, CREATED)).toBeNull();
  });

  it('source: refused for blockTeacherRequests, selfManaged, or a learner-side refusal within 30 days', async () => {
    expect(await sourceRequestRefused(db, LEARNER, CREATED)).toBe(false);
    await db.setTransferPref(LEARNER, 'blockTeacherRequests', true, CREATED);
    expect(await sourceRequestRefused(db, LEARNER, CREATED)).toBe(true);
    await db.setTransferPref(LEARNER, 'blockTeacherRequests', false, CREATED);
    await db.setTransferPref(LEARNER, 'selfManaged', true, CREATED);
    expect(await sourceRequestRefused(db, LEARNER, CREATED)).toBe(true);
    await db.setTransferPref(LEARNER, 'selfManaged', false, CREATED);

    const fromTeacher = newRequest({ id: 'transfer:s', learnerId: LEARNER, sourceSpaceId: SOURCE, destSpaceId: DEST, introduce: false, now: CREATED, initiator: 'source', initiatorAccountId: 'teacher-a', via: 'owner' });
    await db.createTransfer(fromTeacher, { at: CREATED.toISOString(), actorKind: 'account', actorRef: 'teacher-a', event: 'created', slot: null, detail: null });
    await db.declineSlot('transfer:s', 'learner', 'declined_learner', 'family', CREATED);
    expect(await sourceRequestRefused(db, LEARNER, new Date(CREATED.getTime() + DAY))).toBe(true);
    expect(await sourceRequestRefused(db, LEARNER, new Date(CREATED.getTime() + TRANSFER_REFUSAL_COOLDOWN_MS + 1))).toBe(false);
  });
});

describe('settle (§4.6)', () => {
  it('step 1: with the lock off nothing is read or written, even when the move is due (behaviour 13)', async () => {
    const t = await approved();
    const before = await db.transferEvents(t.id);
    const result = await settle(db, t, AFTER_DUE, OFF);
    expect(result).toEqual({ request: t, reset: null, execution: null });
    expect(await row(t.id)).toEqual(t);
    expect(await db.transferEvents(t.id)).toEqual(before);
    expect(await learnerSpaces()).toEqual([FAMILY, SOURCE].sort());
  });

  it('a terminal row is returned as it is', async () => {
    const t = await learnerSide();
    await db.cancelTransfer(t.id, 'withdrawn_learner', 'family', CREATED);
    const cancelled = await row(t.id);
    expect(await settle(db, cancelled, AFTER_DUE, ON)).toEqual({ request: cancelled, reset: null, execution: null });
  });

  it('step 2: expires at expires_at, before anything else applies', async () => {
    const t = await allAgreed();
    await putSpace(DEST, { archivedAt: CREATED.toISOString() });
    const result = await settle(db, t, new Date(CREATED.getTime() + TRANSFER_WINDOW_MS), ON);
    expect(result.request).toMatchObject({ status: 'expired', endReason: 'expired', endActor: 'system' });
    expect(await learnerSpaces()).toEqual([FAMILY, SOURCE].sort());
  });

  it('step 3: an archived destination cancels (destination_archived)', async () => {
    const t = await learnerSide();
    await putSpace(DEST, { archivedAt: CREATED.toISOString() });
    expect((await settle(db, t, CREATED, ON)).request).toMatchObject({ status: 'cancelled', endReason: 'destination_archived', endActor: 'system' });
  });

  it('step 3: a learner who left the source cancels (learner_left_source)', async () => {
    const t = await learnerSide();
    await db.removeMembership(SOURCE, 'learner', LEARNER);
    expect((await settle(db, t, CREATED, ON)).request).toMatchObject({ status: 'cancelled', endReason: 'learner_left_source', endActor: 'system' });
  });

  it('step 3: an archived source makes a pending source slot not_required and the move proceeds (behaviour 23)', async () => {
    const t = await learnerSide();
    await db.consentSlot(t.id, { kind: 'teacher', slots: ['destination'], accountId: 'teacher-b', via: 'owner' }, CREATED);
    await putSpace(SOURCE, { archivedAt: CREATED.toISOString() });
    const result = await settle(db, t, CREATED, ON);
    expect(result.request).toMatchObject({ status: 'approved', source: { state: 'not_required' } });
    const done = await settle(db, await row(t.id), AFTER_DUE, ON);
    expect(done.execution?.executed).toBe(true);
    expect(await learnerSpaces()).toEqual([DEST, FAMILY].sort());
  });

  it('step 3: an archived source leaves an already consented source slot as it is', async () => {
    const t = await allAgreed();
    await putSpace(SOURCE, { archivedAt: CREATED.toISOString() });
    expect((await settle(db, t, CREATED, ON)).request).toMatchObject({ status: 'approved', source: { state: 'consented' } });
  });

  it('a request still waiting for a slot is left alone', async () => {
    const t = await learnerSide();
    expect(await settle(db, t, AFTER_DUE, ON)).toEqual({ request: t, reset: null, execution: null });
  });

  it('step 4 then 6: approved with nothing moved before the cooling-off; executed on the first settle after it (behaviour 2)', async () => {
    const t = await allAgreed();
    const early = await settle(db, t, CREATED, ON);
    expect(early.request).toMatchObject({ status: 'approved', approvedAt: CREATED.toISOString(), executeAfter: DUE.toISOString() });
    expect(early.execution).toBeNull();
    expect(await settle(db, await row(t.id), new Date(DUE.getTime() - 1), ON)).toMatchObject({ execution: null });
    expect(await learnerSpaces()).toEqual([FAMILY, SOURCE].sort());

    const done = await settle(db, await row(t.id), DUE, ON);
    expect(done.execution).toMatchObject({ executed: true, blockReason: null });
    expect(done.request).toMatchObject({ status: 'executed', executedAt: DUE.toISOString(), blockReason: null });
    expect(await learnerSpaces()).toEqual([DEST, FAMILY].sort());
    expect(await db.membership(DEST, 'learner', LEARNER)).toMatchObject({ role: 'student', joinedAt: DUE.toISOString() });
    expect(await events(t.id)).toEqual(['created', 'executed']);
  });

  it('promotes and executes in one settle when the last slot comes in after the cooling-off', async () => {
    const t = await allAgreed();
    const result = await settle(db, t, AFTER_DUE, ON);
    expect(result.request?.status).toBe('executed');
    expect(await learnerSpaces()).toEqual([DEST, FAMILY].sort());
  });

  it('settles a stale copy of the row by what is stored now', async () => {
    const stale = await allAgreed();
    await db.cancelTransfer(stale.id, 'withdrawn_learner', 'family', CREATED);
    const result = await settle(db, stale, AFTER_DUE, ON);
    expect(result.request?.status).toBe('cancelled');
    expect(await learnerSpaces()).toEqual([FAMILY, SOURCE].sort());
  });

  it('a request that vanished (learner erased) settles to null', async () => {
    const t = await learnerSide();
    await db.deleteLearner(LEARNER);
    expect(await settle(db, t, CREATED, ON)).toEqual({ request: null, reset: null, execution: null });
  });

  describe('step 5: the learner consent must still match what was shown (behaviours 16, 17)', () => {
    const changes: Array<[string, () => Promise<void>]> = [
      ['the destination switches to school consent', () => putSpace(DEST, { settings: { consentMode: 'school', anonymizeRoster: false } })],
      ['the destination turns anonymity on', () => putSpace(DEST, { settings: { consentMode: 'parent', anonymizeRoster: true } })],
      ['the destination is renamed', () => putSpace(DEST, { name: 'Saturday Class B' })],
      ['the destination changes owner', () => putSpace(DEST, { ownerAccountId: 'teacher-c' })],
      ['the source is renamed', () => putSpace(SOURCE, { name: 'Sunday Class A' })],
      ['the premium outlook changes', async () => void (await db.applyEntitlement({ subjectKind: 'space', subjectId: SOURCE, planKey: 'group_license', status: 'active', provider: 'manual' }, CREATED))],
    ];
    for (const [name, change] of changes) {
      it(`terms_changed when ${name}, before promotion`, async () => {
        const t = await allAgreed();
        await change();
        const result = await settle(db, t, CREATED, ON);
        expect(result.reset).toBe('terms_changed');
        expect(result.request).toMatchObject({ status: 'requested', approvedAt: null, executeAfter: null, learner: { state: 'pending', terms: null } });
        expect(await events(t.id)).toEqual(['created', 'consent_reset']);
        expect((await db.transferEvents(t.id))[1]).toMatchObject({ actorKind: 'system', slot: 'learner', detail: { why: 'terms_changed' } });
      });
    }

    it('terms_changed before execution: nothing moves until the guardian confirms again', async () => {
      const t = await approved();
      await putSpace(DEST, { settings: { consentMode: 'school', anonymizeRoster: false } });
      const result = await settle(db, t, AFTER_DUE, ON);
      expect(result).toMatchObject({ reset: 'terms_changed', execution: null, request: { status: 'requested' } });
      expect(await learnerSpaces()).toEqual([FAMILY, SOURCE].sort());
    });

    it('is not checked while nothing is about to be promoted or executed', async () => {
      const t = await approved();
      await putSpace(DEST, { name: 'Renamed' });
      expect(await settle(db, t, new Date(DUE.getTime() - 1), ON)).toEqual({ request: t, reset: null, execution: null });
    });

    it('guardian_changed when the guardian leaves the family', async () => {
      const t = await allAgreed();
      await db.removeMembership(FAMILY, 'account', 'mom');
      expect(await settle(db, t, CREATED, ON)).toMatchObject({ reset: 'guardian_changed', request: { status: 'requested', learner: { state: 'pending' } } });
    });

    it('guardian_changed when the learner leaves the family before execution', async () => {
      const t = await approved();
      await db.removeMembership(FAMILY, 'learner', LEARNER);
      expect(await settle(db, t, AFTER_DUE, ON)).toMatchObject({ reset: 'guardian_changed', execution: null });
      expect(await learnerSpaces()).toEqual([SOURCE]);
    });

    it('guardian_changed when the guardian took a role in a class of this move', async () => {
      const t = await approved();
      await join(DEST, 'account', 'mom', 'teacher');
      expect((await settle(db, t, AFTER_DUE, ON)).reset).toBe('guardian_changed');
    });

    it('device basis: the device must still be bound with full scope', async () => {
      const t = await learnerSide();
      await db.cancelTransfer(t.id, 'withdrawn_learner', 'device', CREATED);
      const consent = { ...(await momConsent(CREATED)), basis: 'device_attested' as const, attest: 'self' as const, evidence: 'phone-1', role: null };
      const request = newRequest({ id: 'transfer:dev', learnerId: LEARNER, sourceSpaceId: SOURCE, destSpaceId: DEST, introduce: false, now: CREATED, initiator: 'learner_side', initiatorAccountId: null, consent });
      await db.createTransfer(request, { at: CREATED.toISOString(), actorKind: 'device', actorRef: 'phone-1', event: 'created', slot: null, detail: null });
      await db.consentSlot(request.id, { kind: 'teacher', slots: ['source'], accountId: 'teacher-a', via: 'owner' }, CREATED);
      await db.consentSlot(request.id, { kind: 'teacher', slots: ['destination'], accountId: 'teacher-b', via: 'owner' }, CREATED);
      const device = { learnerId: LEARNER, deviceId: 'phone-1', secretHash: 'h', scope: 'full' as const, createdAt: T0, lastSeenAt: T0 };
      await db.putDevice(device);
      expect(await consentFreshness(db, await row(request.id), CREATED)).toBeNull();
      await db.putDevice({ ...device, scope: 'class' });
      expect((await settle(db, await row(request.id), CREATED, ON)).reset).toBe('guardian_changed');
      expect(await consentFreshness(db, { ...(await row(request.id)), learner: { ...request.learner } }, CREATED)).toBe('guardian_changed');
      const unbound = { ...request, learner: { ...request.learner, evidence: 'phone-unknown' } };
      expect(await consentFreshness(db, unbound, CREATED)).toBe('guardian_changed');
    });

    it('lapsed when approved and blocked for 72 hours after the move fell due', async () => {
      await fillClass(db, DEST, 20);
      const t = await approved();
      const blocked = await settle(db, t, DUE, ON);
      expect(blocked.request).toMatchObject({ status: 'approved', blockReason: 'cap_class' });
      const stillValid = await settle(db, await row(t.id), new Date(DUE.getTime() + TRANSFER_BLOCKED_VALID_MS - 1), ON);
      expect(stillValid.reset).toBeNull();
      const lapsed = await settle(db, await row(t.id), new Date(DUE.getTime() + TRANSFER_BLOCKED_VALID_MS), ON);
      expect(lapsed).toMatchObject({ reset: 'lapsed', request: { status: 'requested', blockReason: null } });
      expect(await learnerSpaces()).toEqual([FAMILY, SOURCE].sort());
    });

    it('a consented learner slot whose terms are missing is treated as changed', async () => {
      const t = await allAgreed();
      expect(await consentFreshness(db, { ...t, learner: { ...t.learner, terms: null } }, CREATED)).toBe('terms_changed');
    });

    it('a pending learner slot has nothing to compare', async () => {
      const fromTeacher = newRequest({ id: 'transfer:s', learnerId: LEARNER, sourceSpaceId: SOURCE, destSpaceId: DEST, introduce: false, now: CREATED, initiator: 'source', initiatorAccountId: 'teacher-a', via: 'owner' });
      expect(await consentFreshness(db, fromTeacher, CREATED)).toBeNull();
    });
  });
});

describe('executeTransfer (§4.6 over the Db)', () => {
  it('does nothing for a request that is not approved', async () => {
    const t = await allAgreed();
    expect(await executeTransfer(db, t, AFTER_DUE)).toEqual({ executed: false, request: t, blockReason: null, devicesRevoked: 0, relinksClosed: 0 });
    expect(await learnerSpaces()).toEqual([FAMILY, SOURCE].sort());
    expect(await events(t.id)).toEqual(['created']);
  });

  it('does nothing before the cooling-off ends, and records no block', async () => {
    const t = await approved();
    expect(await executeTransfer(db, t, new Date(DUE.getTime() - 1))).toMatchObject({ executed: false, blockReason: null });
    expect(await events(t.id)).toEqual(['created']);
  });

  it('a full destination blocks with cap_class, once; the source membership stays; Try again executes (behaviour 4)', async () => {
    await fillClass(db, DEST, 20);
    const t = await approved();
    const first = await executeTransfer(db, t, DUE);
    expect(first).toMatchObject({ executed: false, blockReason: 'cap_class', request: { status: 'approved', blockReason: 'cap_class' } });
    await executeTransfer(db, await row(t.id), AFTER_DUE);
    expect(await events(t.id)).toEqual(['created', 'blocked']);
    expect((await db.transferEvents(t.id))[1]).toMatchObject({ actorKind: 'system', actorRef: null, detail: { reason: 'cap_class' } });
    expect(await learnerSpaces()).toEqual([FAMILY, SOURCE].sort());

    await db.removeMembership(DEST, 'learner', 'profile:class-b-0');
    const retry = await executeTransfer(db, await row(t.id), AFTER_DUE);
    expect(retry).toMatchObject({ executed: true, request: { status: 'executed', blockReason: null } });
    expect(await learnerSpaces()).toEqual([DEST, FAMILY].sort());
  });

  it('a learner in three classes swaps one (behaviour 6); a fourth live class blocks with cap_learner', async () => {
    await join('space:class-c', 'learner', LEARNER, 'student');
    await join('space:class-d', 'learner', LEARNER, 'student');
    const t = await approved();
    expect((await executeTransfer(db, t, DUE)).executed).toBe(true);
    expect(await learnerSpaces()).toEqual([DEST, FAMILY, 'space:class-c', 'space:class-d'].sort());
    expect(LEARNER_CLASS_CAP).toBe(3);
  });

  it('cap_learner when the learner already holds the cap without the source', async () => {
    for (const c of ['space:class-c', 'space:class-d', 'space:class-e']) await join(c, 'learner', LEARNER, 'student');
    const t = await approved();
    expect(await executeTransfer(db, t, DUE)).toMatchObject({ executed: false, blockReason: 'cap_learner' });
    expect(await db.membership(SOURCE, 'learner', LEARNER)).not.toBeNull();
  });

  it('a learner who joined a full destination meanwhile: only the source goes (behaviour 25)', async () => {
    await fillClass(db, DEST, 19);
    const t = await approved();
    await join(DEST, 'learner', LEARNER, 'student');
    const result = await executeTransfer(db, t, DUE);
    expect(result.executed).toBe(true);
    expect(await learnerSpaces()).toEqual([DEST, FAMILY].sort());
    expect((await db.membersOf(DEST)).filter((m) => m.memberKind === 'learner')).toHaveLength(20);
    expect(await db.membership(DEST, 'learner', LEARNER)).toMatchObject({ joinedAt: T0 });
  });

  it('an unlimited (pro) destination takes the learner whatever its size', async () => {
    await fillClass(db, DEST, 25);
    await db.applyEntitlement({ subjectKind: 'space', subjectId: DEST, planKey: 'group_license', status: 'active', provider: 'manual' }, CREATED);
    await db.applyEntitlement({ subjectKind: 'space', subjectId: SOURCE, planKey: 'group_license', status: 'active', provider: 'manual' }, CREATED);
    const t = await approved();
    expect((await executeTransfer(db, t, DUE)).executed).toBe(true);
  });

  describe('school seats', () => {
    beforeEach(async () => {
      await db.putAccount({ id: 'principal', email: null, displayName: null, consent: null, createdAt: T0 });
      await db.putSpace({ ...(await space(DEST)), id: 'space:school', kind: 'school', ownerAccountId: 'principal' });
      await putSpace(DEST, { parentSpaceId: 'space:school' });
      await db.applyEntitlement({ subjectKind: 'space', subjectId: 'space:school', planKey: 'school_seat', status: 'active', provider: 'manual', seats: 3 }, at(0));
      await fillClass(db, DEST, 3);
    });

    it('a full licensed school blocks a move from outside with cap_school, before the batch', async () => {
      const t = await approved();
      expect(await executeTransfer(db, t, DUE)).toMatchObject({ executed: false, blockReason: 'cap_school', request: { status: 'approved', blockReason: 'cap_school' } });
      expect(await learnerSpaces()).toEqual([FAMILY, SOURCE].sort());
      expect(await events(t.id)).toEqual(['created', 'blocked']);
    });

    it('a move between two live classes of the same school takes no new seat', async () => {
      await putSpace(SOURCE, { parentSpaceId: 'space:school' });
      await db.applyEntitlement({ subjectKind: 'space', subjectId: 'space:school', planKey: 'school_seat', status: 'active', provider: 'manual', seats: 4 }, at(0));
      const t = await approved();
      expect((await executeTransfer(db, t, DUE)).executed).toBe(true);
    });
  });

  it('cards and stars stay: the snapshot, the name and the family membership are untouched', async () => {
    expect(await db.putSnapshot({ learnerId: LEARNER, rev: 1, schemaVer: 1, contentVer: 'c1', deviceId: 'phone', summary: { cardsUnlocked: 4 }, payload: { cards: ['c1'], stars: 9 }, updatedAt: T0 }, 0)).toBe(true);
    const snapshot = await db.getSnapshot(LEARNER);
    const learnerRow = await db.getLearner(LEARNER);
    const family = await db.membership(FAMILY, 'learner', LEARNER);
    const t = await approved();
    expect((await executeTransfer(db, t, DUE)).executed).toBe(true);
    expect(await db.getSnapshot(LEARNER)).toEqual(snapshot);
    expect(await db.getLearner(LEARNER)).toEqual(learnerRow);
    expect(await db.membership(FAMILY, 'learner', LEARNER)).toEqual(family);
  });

  it('revocation: source re-link devices and pending re-links are closed and audited by count (behaviour 8)', async () => {
    const relink = (id: string, deviceId: string, status: 'pending' | 'approved') => ({ id, spaceId: SOURCE, learnerId: LEARNER, deviceId, platform: null, requestedAt: T0, expiresAt: at(HOUR).toISOString(), status, decidedAt: status === 'approved' ? T0 : null, secret: null });
    await db.putRelink(relink('relink:a', 'tablet-a', 'approved'));
    await db.putDevice({ learnerId: LEARNER, deviceId: 'tablet-a', secretHash: 'h', scope: 'class', createdAt: T0, lastSeenAt: T0 });
    await db.putRelink(relink('relink:p', 'tablet-p', 'pending'));
    const t = await approved();
    expect(await executeTransfer(db, t, DUE)).toMatchObject({ executed: true, devicesRevoked: 1, relinksClosed: 1 });
    expect(await db.getDevice(LEARNER, 'tablet-a')).toBeNull();
    expect((await db.getRelink('relink:p'))?.status).toBe('denied');
    const audit = await db.transferEvents(t.id);
    expect(audit.map((e) => [e.event, e.detail])).toEqual([
      ['created', null],
      ['executed', null],
      ['devices_revoked', { count: 1 }],
      ['relinks_closed', { count: 1 }],
    ]);
  });

  it('old_space_still_has_access: a source manager who still sees the learner through a family is counted, never named', async () => {
    await join(FAMILY, 'account', 'teacher-a', 'caregiver');
    const t = await approved();
    expect((await executeTransfer(db, t, DUE)).executed).toBe(true);
    const audit = await db.transferEvents(t.id);
    const access = audit.find((e) => e.event === 'old_space_still_has_access');
    expect(access).toMatchObject({ actorKind: 'system', actorRef: null, slot: null, detail: { count: 1 } });
    expect(JSON.stringify(access)).not.toContain('teacher-a');
  });

  it('old_space_still_has_access is not written when nobody keeps access', async () => {
    const t = await approved();
    expect((await executeTransfer(db, t, DUE)).executed).toBe(true);
    expect(await events(t.id)).toEqual(['created', 'executed']);
  });

  it('a school admin of the source who is also a caregiver is counted', async () => {
    await db.putAccount({ id: 'principal', email: null, displayName: null, consent: null, createdAt: T0 });
    await db.putSpace({ ...(await space(SOURCE)), id: 'space:school', kind: 'school', ownerAccountId: 'principal' });
    await join('space:school', 'account', 'principal', 'owner');
    await putSpace(SOURCE, { parentSpaceId: 'space:school' });
    await join(FAMILY, 'account', 'principal', 'caregiver');
    await join(FAMILY, 'account', 'teacher-a', 'caregiver');
    const t = await approved();
    expect((await executeTransfer(db, t, DUE)).executed).toBe(true);
    expect((await db.transferEvents(t.id)).find((e) => e.event === 'old_space_still_has_access')?.detail).toEqual({ count: 2 });
  });

  it('a cancel that lands first wins: the gate changes nothing (behaviour 15)', async () => {
    const t = await approved();
    await db.cancelTransfer(t.id, 'withdrawn_learner', 'family', DUE);
    const result = await executeTransfer(db, t, DUE);
    expect(result).toMatchObject({ executed: false, blockReason: null, request: { status: 'cancelled' } });
    expect(await learnerSpaces()).toEqual([FAMILY, SOURCE].sort());
  });

  it('a second execute is a no-op', async () => {
    const t = await approved();
    expect((await executeTransfer(db, t, DUE)).executed).toBe(true);
    expect(await executeTransfer(db, t, DUE)).toMatchObject({ executed: false, request: { status: 'executed' } });
    expect((await events(t.id)).filter((e) => e === 'executed')).toHaveLength(1);
  });

  it('an erased learner leaves nothing to execute', async () => {
    const t = await approved();
    await db.deleteLearner(LEARNER);
    expect(await executeTransfer(db, t, DUE)).toEqual({ executed: false, request: null, blockReason: null, devicesRevoked: 0, relinksClosed: 0 });
  });

  it('an audit write that fails after the move does not report the move as failed', async () => {
    await join(FAMILY, 'account', 'teacher-a', 'caregiver');
    const t = await approved();
    const flaky = new Proxy(db, {
      get(target, prop, receiver) {
        if (prop === 'addTransferEvent') return async () => Promise.reject(new Error('D1 hiccup'));
        const value: unknown = Reflect.get(target, prop, receiver);
        return typeof value === 'function' ? value.bind(target) : value;
      },
    });
    expect(await executeTransfer(flaky, t, DUE)).toMatchObject({ executed: true, request: { status: 'executed' } });
    expect(await learnerSpaces()).toEqual([DEST, FAMILY].sort());
  });
});

describe('races through settle (§4.7)', () => {
  /** Runs `competitor` against the real Db just before the wrapped Db's first call named `method`. */
  function before(method: keyof typeof db, competitor: () => Promise<unknown>) {
    let fired = false;
    const wrapped = new Proxy(db, {
      get(target, prop, receiver) {
        const value: unknown = Reflect.get(target, prop, receiver);
        if (typeof value !== 'function') return value;
        return async (...args: unknown[]) => {
          if (prop === method && !fired) {
            fired = true;
            await competitor();
          }
          return (value as (...a: unknown[]) => Promise<unknown>).apply(target, args);
        };
      },
    });
    return { wrapped, fired: () => fired };
  }

  it('a cancel between settle\'s reads and the batch wins: nothing moves (behaviour 15)', async () => {
    const t = await approved();
    const race = before('executeTransfer', () => db.cancelTransfer(t.id, 'withdrawn_learner', 'family', DUE));
    const result = await settle(race.wrapped, t, DUE, ON);
    expect(race.fired()).toBe(true);
    expect(result).toMatchObject({ request: { status: 'cancelled' }, execution: { executed: false, blockReason: null } });
    expect(await learnerSpaces()).toEqual([FAMILY, SOURCE].sort());
  });

  it('two settles at once: one move, one executed event', async () => {
    const t = await approved();
    const race = before('executeTransfer', () => settle(db, t, DUE, ON));
    const result = await settle(race.wrapped, t, DUE, ON);
    expect(result).toMatchObject({ request: { status: 'executed' }, execution: { executed: false } });
    expect((await events(t.id)).filter((e) => e === 'executed')).toHaveLength(1);
    expect(await learnerSpaces()).toEqual([DEST, FAMILY].sort());
  });

  it('a decline racing the promotion ends declined, never approved', async () => {
    const t = await allAgreed();
    const race = before('promoteTransfer', () => db.declineSlot(t.id, 'destination', 'declined_destination', 'destination', CREATED));
    const result = await settle(race.wrapped, t, CREATED, ON);
    expect(result.request).toMatchObject({ status: 'declined', approvedAt: null });
  });

  it('a reset that lost its race reports no reset', async () => {
    const t = await allAgreed();
    await putSpace(DEST, { name: 'Renamed' });
    const race = before('resetLearnerConsent', () => db.cancelTransfer(t.id, 'withdrawn_learner', 'family', CREATED));
    expect(await settle(race.wrapped, t, CREATED, ON)).toMatchObject({ reset: null, request: { status: 'cancelled' } });
  });
});


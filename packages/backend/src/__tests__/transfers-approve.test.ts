import { TRANSFER_CONSENT_TEXT_VERSION } from '@hangul-route/content-schema';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { hashSecret } from '../lib/device-auth';
import { transferClientLimiter } from '../routes/transfers';
import app from '../index';
import { testDb as db } from './helpers/db';
import {
  A,
  ahead,
  approve,
  B,
  base,
  C,
  call,
  cancel,
  countDbCalls,
  classCreate,
  CODE_B,
  consent,
  create,
  DAY,
  E,
  FAMILY,
  FAMILY2,
  familyCreate,
  filler,
  HOUR,
  json,
  list,
  LOCKED,
  member,
  NOW,
  requestOf,
  requestsOf,
  retry,
  SCHOOL,
  seed,
  space,
  SUNI,
  type View,
} from './helpers/transfer-world';

/*
 * Class transfer routes with execution — F-SPACE-002 section 4.4, PR T-5b:
 * approve (per slot, all-or-nothing, idempotent), the move itself through
 * `settle` (promote, cooling-off, the self-guarding batch), retry with the
 * capacity block, the revocation of the source's class devices and re-links,
 * the audit rows, and the freshness resets of the learner consent. Runs in
 * memory and, with HR_TEST_DB=sqlite, against migration 0005 through the shim.
 */

const at = (ms: number): Date => new Date(NOW.getTime() + ms);
const travel = (ms: number): void => {
  vi.setSystemTime(at(ms));
};
/** Past the 48-hour cooling-off of a consent given at NOW. */
const AFTER_COOLING_OFF = 49 * HOUR;

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
  await db.reset();
  transferClientLimiter.reset();
  await seed();
});
afterEach(() => vi.useRealTimers());

async function inClass(spaceId: string, learnerId = SUNI): Promise<boolean> {
  return (await db.membership(spaceId, 'learner', learnerId)) !== null;
}

/** A guardian-started request A -> B with both teachers in: `approved`, due 48 hours after NOW. */
async function agreedFamilyMove(): Promise<View> {
  const created = requestOf(await create(FAMILY, 'mom', familyCreate()));
  expect((await approve(A, 'teacher-a', created.id, { slots: ['source'] })).status).toBe(200);
  expect((await approve(B, 'teacher-b', created.id, { slots: ['destination'] })).status).toBe(200);
  expect((await db.getTransfer(created.id))?.status).toBe('approved');
  return created;
}

/** Fills class B up to its free cap of 20. */
async function fillB(count = 20): Promise<void> {
  for (let i = 0; i < count; i += 1) await filler(`profile:fill-${String(i).padStart(2, '0')}`, B);
}

/** The digest of the sheet the learner side sees for an open request (family list). */
async function familyDigest(tid: string): Promise<string> {
  const view = requestsOf(await list(FAMILY, 'mom')).find((r) => r.id === tid);
  expect(view?.termsDigest).toMatch(/^[0-9a-f]{64}$/);
  return view?.termsDigest as string;
}

describe('the release lock (T15)', () => {
  it('approve and retry answer 422 transfers_locked while CLASS_TRANSFER is unset, before auth or body checks', async () => {
    const tid = 'transfer:00000000-0000-4000-8000-000000000000';
    for (const path of [`${base(A)}/${tid}/approve`, `${base(A)}/${tid}/retry`]) {
      for (const env of [LOCKED, { CLASS_TRANSFER: 'true' }, { CLASS_TRANSFER_DEVICE_CONSENT: 'enabled' }] as Array<Record<string, string> | typeof LOCKED>) {
        const r = await call('POST', path, json, { junk: 1 }, env);
        expect([r.status, r.body.error?.code], path).toEqual([422, 'transfers_locked']);
      }
    }
  });

  it('unsetting the lock after everyone agreed stops the scheduled move (behaviour 13)', async () => {
    const created = await agreedFamilyMove();
    travel(AFTER_COOLING_OFF);
    const r = await call('POST', `${base(B)}/${created.id}/retry`, json, {}, LOCKED);
    expect(r.body.error?.code).toBe('transfers_locked');
    expect(await inClass(A)).toBe(true);
    expect(await inClass(B)).toBe(false);
    expect((await db.getTransfer(created.id))?.status).toBe('approved');
  });
});

describe('approve: teacher slots', () => {
  it('both teachers agree, then the cooling-off, then the first read moves the learner (behaviour 2)', async () => {
    const created = requestOf(await create(FAMILY, 'mom', familyCreate()));
    const src = await approve(A, 'teacher-a', created.id, { slots: ['source'] });
    expect(src.status).toBe(200);
    expect(requestOf(src)).toMatchObject({ role: 'source', status: 'requested', steps: { learner: 'yes', source: 'yes', destination: 'waiting' } });

    travel(HOUR);
    const dst = await approve(B, 'teacher-b', created.id, { slots: ['destination'] });
    expect(dst.status).toBe(200);
    expect(requestOf(dst)).toMatchObject({ role: 'destination', status: 'approved', scheduledFor: ahead(48 * HOUR), learner: { name: 'S. K.' } });
    expect(await db.getTransfer(created.id)).toMatchObject({ status: 'approved', approvedAt: at(HOUR).toISOString(), executeAfter: ahead(48 * HOUR) });
    // nothing has moved during the cooling-off
    expect(await inClass(A)).toBe(true);
    expect(await inClass(B)).toBe(false);
    expect(requestsOf(await list(FAMILY, 'mom'))[0]).toMatchObject({ status: 'approved', executeAfter: ahead(48 * HOUR) });
    expect(await inClass(B)).toBe(false);

    const events = await db.transferEvents(created.id);
    expect(events).toContainEqual(expect.objectContaining({ event: 'consented', slot: 'source', actorKind: 'account', actorRef: 'teacher-a', detail: { via: 'owner' } }));
    expect(events).toContainEqual(expect.objectContaining({ event: 'consented', slot: 'destination', actorKind: 'account', actorRef: 'teacher-b', detail: { via: 'owner' } }));

    travel(AFTER_COOLING_OFF);
    const [fam] = requestsOf(await list(FAMILY, 'mom'));
    expect(fam).toMatchObject({ status: 'executed', executedAt: at(AFTER_COOLING_OFF).toISOString() });
    expect(await inClass(A)).toBe(false);
    expect(await db.membership(B, 'learner', SUNI)).toMatchObject({ role: 'student', joinedAt: at(AFTER_COOLING_OFF).toISOString() });
    // family membership and the learner row are untouched
    expect(await inClass(FAMILY)).toBe(true);
    expect((await db.getLearner(SUNI))?.displayName).toBe('Suni Kim');
    expect(await db.transferEvents(created.id)).toContainEqual(expect.objectContaining({ event: 'executed', actorKind: 'system', actorRef: null }));
    // the source keeps one nameless line; the destination now sees the learner as a member
    const [srcView] = requestsOf(await list(A, 'teacher-a'));
    expect(srcView).toMatchObject({ status: 'executed', learner: null, learnerId: null, destination: null });
    const [dstView] = requestsOf(await list(B, 'teacher-b'));
    expect(dstView).toMatchObject({ status: 'executed', learner: { name: 'Suni Kim' } });
    expect(JSON.stringify(dstView)).not.toContain(SUNI);
  });

  it('the last approval after the cooling-off moves the learner in the same call', async () => {
    const created = requestOf(await create(FAMILY, 'mom', familyCreate()));
    await approve(A, 'teacher-a', created.id, { slots: ['source'] });
    travel(3 * DAY);
    const r = await approve(B, 'teacher-b', created.id, { slots: ['destination'] });
    expect(r.status).toBe(200);
    expect(requestOf(r)).toMatchObject({ role: 'destination', status: 'executed', learner: { name: 'Suni Kim' } });
    expect(await inClass(B)).toBe(true);
    expect(await inClass(A)).toBe(false);
  });

  it('stays idempotent after the move: the last approval sent twice answers 200 executed both times', async () => {
    const created = requestOf(await create(FAMILY, 'mom', familyCreate()));
    await approve(A, 'teacher-a', created.id, { slots: ['source'] });
    travel(3 * DAY);
    const first = await approve(B, 'teacher-b', created.id, { slots: ['destination'] });
    expect(requestOf(first)).toMatchObject({ role: 'destination', status: 'executed' });
    const resent = await approve(B, 'teacher-b', created.id, { slots: ['destination'] });
    expect(resent.status).toBe(200);
    expect(requestOf(resent)).toMatchObject({ role: 'destination', status: 'executed', learner: { name: 'Suni Kim' } });
    expect((await db.transferEvents(created.id)).filter((e) => e.event === 'executed')).toHaveLength(1);
    // the source and the guardian re-sending their own answers get the same 200
    expect(requestOf(await approve(A, 'teacher-a', created.id, { slots: ['source'] }))).toMatchObject({ role: 'source', status: 'executed' });
    expect(requestOf(await approve(FAMILY, 'mom', created.id, { slots: ['learner'], consent }))).toMatchObject({ role: 'learner_side', status: 'executed' });
    // a slot that is not the caller's is still 404 after the move
    expect((await approve(A, 'teacher-a', created.id, { slots: ['destination'] })).status).toBe(404);
  });

  it('a re-click of a filled slot on a due request runs the move and answers 200 executed, not 409', async () => {
    const created = await agreedFamilyMove();
    travel(AFTER_COOLING_OFF);
    const r = await approve(A, 'teacher-a', created.id, { slots: ['source'] });
    expect(r.status).toBe(200);
    expect(requestOf(r)).toMatchObject({ role: 'source', status: 'executed' });
    expect(await inClass(B)).toBe(true);
  });

  it('a declined request still answers 409 not_open to an approve of a slot already in', async () => {
    const created = requestOf(await create(FAMILY, 'mom', familyCreate()));
    await approve(A, 'teacher-a', created.id, { slots: ['source'] });
    expect((await call('POST', `${base(B)}/${created.id}/decline`, { ...json, authorization: 'Bearer teacher-b' }, { slot: 'destination' })).status).toBe(200);
    const r = await approve(A, 'teacher-a', created.id, { slots: ['source'] });
    expect([r.status, r.body.error?.code]).toEqual([409, 'not_open']);
  });

  it('is idempotent: a slot already in answers 200 and writes nothing', async () => {
    const created = requestOf(await create(FAMILY, 'mom', familyCreate()));
    await approve(A, 'teacher-a', created.id, { slots: ['source'] });
    const before = await db.getTransfer(created.id);
    const again = await approve(A, 'teacher-a', created.id, { slots: ['source'] });
    expect(again.status).toBe(200);
    expect(await db.getTransfer(created.id)).toEqual(before);
    expect((await db.transferEvents(created.id)).filter((e) => e.event === 'consented')).toHaveLength(1);
  });

  it('one click for both teacher slots only for a direct teacher of both classes (T11); the via is recorded', async () => {
    await member(B, 'account', 'teacher-a', 'teacher');
    const created = requestOf(await create(FAMILY, 'mom', familyCreate()));
    const r = await approve(A, 'teacher-a', created.id, { slots: ['source', 'destination'] });
    expect(r.status).toBe(200);
    expect(requestOf(r)).toMatchObject({ role: 'source', status: 'approved' });
    expect(await db.getTransfer(created.id)).toMatchObject({ source: { state: 'consented', accountId: 'teacher-a', via: 'teacher' }, destination: { state: 'consented', accountId: 'teacher-a', via: 'teacher' } });
    const consented = (await db.transferEvents(created.id)).filter((e) => e.event === 'consented');
    expect(consented.map((e) => e.slot).sort()).toEqual(['destination', 'source']);
    expect(consented.every((e) => e.actorRef === 'teacher-a' && (e.detail as { via: string }).via === 'teacher')).toBe(true);
  });

  it('a school admin acting through the cascade fills one slot per action (409 one_slot_per_action); both class pages say so', async () => {
    await db.putSpace(space(SCHOOL, 'school', 'admin'));
    await member(SCHOOL, 'account', 'admin', 'owner');
    const a = await db.getSpace(A);
    const b = await db.getSpace(B);
    await db.putSpace({ ...a!, parentSpaceId: SCHOOL });
    await db.putSpace({ ...b!, parentSpaceId: SCHOOL });
    const created = requestOf(await create(FAMILY, 'mom', familyCreate()));
    const both = await approve(A, 'admin', created.id, { slots: ['source', 'destination'] });
    expect([both.status, both.body.error?.code]).toEqual([409, 'one_slot_per_action']);
    expect((await db.transferEvents(created.id)).some((e) => e.event === 'consented')).toBe(false);

    expect((await approve(A, 'admin', created.id, { slots: ['source'] })).status).toBe(200);
    // with the source in, naming both again leaves the source out: one pending slot, one action
    const second = await approve(A, 'admin', created.id, { slots: ['source', 'destination'] });
    expect(second.status).toBe(200);
    expect(requestOf(second)).toMatchObject({ status: 'approved', agreedBySchoolAdmin: true });
    expect(requestsOf(await list(B, 'teacher-b'))[0]).toMatchObject({ agreedBySchoolAdmin: true });
    expect(await db.transferEvents(created.id)).toContainEqual(expect.objectContaining({ event: 'consented', slot: 'source', actorRef: 'admin', detail: { via: 'school_admin' } }));
  });

  it('the destination slot waits for the learner side (409 awaiting_learner); the destination cannot even see it (404)', async () => {
    await member(B, 'account', 'teacher-a', 'teacher');
    const created = requestOf(await create(A, 'teacher-a', classCreate()));
    const early = await approve(A, 'teacher-a', created.id, { slots: ['destination'] });
    expect([early.status, early.body.error?.code]).toEqual([409, 'awaiting_learner']);
    expect((await approve(B, 'teacher-b', created.id, { slots: ['destination'] })).status).toBe(404);
    expect((await db.getTransfer(created.id))?.destination.state).toBe('pending');
  });

  it('IDOR: only a manager of the slot\'s own class can approve it; everyone else gets 404 and nothing changes', async () => {
    const created = requestOf(await create(FAMILY, 'mom', familyCreate()));
    const cases: Array<[string, string, Record<string, unknown>]> = [
      [B, 'teacher-b', { slots: ['source'] }], // class B on slot source
      [A, 'teacher-a', { slots: ['destination'] }], // class A has no right on B
      [A, 'teacher-a', { slots: ['learner'], consent }], // a class never fills the learner slot
      [C, 'teacher-c', { slots: ['destination'] }], // a foreign :id
      [C, 'teacher-c', { slots: ['source'] }],
      [FAMILY, 'mom', { slots: ['source'] }], // a guardian cannot fill a class slot
      [FAMILY, 'mom', { slots: ['learner', 'source'], consent }],
      [A, 'stranger', { slots: ['source'] }],
    ];
    for (const [spaceId, user, body] of cases) {
      const r = await approve(spaceId, user, created.id, body);
      expect(r.status, `${spaceId} ${user} ${JSON.stringify(body)}`).toBe(404);
    }
    expect((await approve(A, 'teacher-a', 'transfer:unknown', { slots: ['source'] })).status).toBe(404);
    // a body only the learner side may send is judged after ownership: a stranger learns nothing from a 422
    for (const [spaceId, user, body] of [
      [A, 'stranger', { slots: ['source'], consent }],
      [C, 'teacher-c', { slots: ['source'], consent }],
      [C, 'teacher-c', { slots: ['destination'], introduce: true }],
    ] as const) {
      const r = await approve(spaceId, user, created.id, body);
      expect([r.status, r.body.error?.code], `${spaceId} ${user} ${JSON.stringify(body)}`).toEqual([404, 'not_found']);
    }
    const row = await db.getTransfer(created.id);
    expect([row?.source.state, row?.destination.state]).toEqual(['pending', 'pending']);
  });

  it('an archived class cannot approve; an ended or expired request answers 409', async () => {
    const created = requestOf(await create(FAMILY, 'mom', familyCreate()));
    const b = await db.getSpace(B);
    await db.putSpace({ ...b!, archivedAt: NOW.toISOString() });
    expect((await approve(B, 'teacher-b', created.id, { slots: ['destination'] })).status).toBe(404);
    await db.putSpace(b!);

    await cancel(FAMILY, 'mom', created.id);
    const ended = await approve(A, 'teacher-a', created.id, { slots: ['source'] });
    expect([ended.status, ended.body.error?.code]).toEqual([409, 'not_open']);

    await db.reset();
    await seed();
    const later = requestOf(await create(FAMILY, 'mom', familyCreate()));
    travel(15 * DAY);
    const expired = await approve(A, 'teacher-a', later.id, { slots: ['source'] });
    expect([expired.status, expired.body.error?.code]).toEqual([409, 'expired']);
  });

  it('rejects bad bodies: unknown keys, empty or repeated slots, the learner slot without consent, introduce from a class', async () => {
    const created = requestOf(await create(A, 'teacher-a', classCreate()));
    for (const body of [{ slots: ['source'], junk: 1 }, { slots: [] }, { slots: ['source', 'source'] }, { slots: ['learner'] }, {}]) {
      const r = await approve(A, 'teacher-a', created.id, body);
      expect([r.status, r.body.error?.code], JSON.stringify(body)).toEqual([422, 'bad_request']);
    }
    const intro = await approve(A, 'teacher-a', created.id, { slots: ['source'], introduce: true });
    expect([intro.status, intro.body.error?.code]).toEqual([422, 'bad_request']);
    const consentFromClass = await approve(A, 'teacher-a', created.id, { slots: ['source'], consent });
    expect([consentFromClass.status, consentFromClass.body.error?.code]).toEqual([422, 'bad_request']);
  });
});

describe('approve: the learner slot of a teacher-started request (caregiver route)', () => {
  it('a guardian consents on the family route; the destination then sees an initials card (behaviour 3)', async () => {
    const created = requestOf(await create(A, 'teacher-a', classCreate()));
    expect(requestsOf(await list(B, 'teacher-b'))).toEqual([]);
    const digest = await familyDigest(created.id);
    travel(HOUR);
    const r = await approve(FAMILY, 'dad', created.id, { slots: ['learner'], consent: { ...consent, termsDigest: digest }, introduce: true });
    expect(r.status).toBe(200);
    expect(requestOf(r)).toMatchObject({ role: 'learner_side', status: 'requested', learnerState: 'consented', sourceState: 'yes', destinationState: 'waiting', introduce: true, executeAfter: at(49 * HOUR).toISOString() });
    const row = await db.getTransfer(created.id);
    expect(row).toMatchObject({
      introduce: true,
      executeAfter: at(49 * HOUR).toISOString(),
      learner: { state: 'consented', basis: 'caregiver', attest: null, evidence: 'dad', role: 'caregiver', textVersion: TRANSFER_CONSENT_TEXT_VERSION, locale: 'en' },
    });
    expect(row?.learner.shown?.lineIds).toContain('from_teacher');
    expect(row?.learner.terms).toMatchObject({ destOwnerId: 'teacher-b', destConsentMode: 'parent', premiumChange: 'none' });
    expect(await db.transferEvents(created.id)).toContainEqual(expect.objectContaining({ event: 'consented', slot: 'learner', actorRef: 'dad', detail: { basis: 'caregiver' } }));

    const [card] = requestsOf(await list(B, 'teacher-b'));
    expect(card).toMatchObject({ role: 'destination', status: 'requested', learner: { name: 'S. K.', avatar: 'hoya-orange', level: '8-9' }, comingFrom: { name: 'Sunday Class A' } });
    expect(JSON.stringify(card)).not.toContain('Suni');
    expect(JSON.stringify(card)).not.toContain(SUNI);
    // the second guardian's approve finds the slot in: 200, unchanged
    const again = await approve(FAMILY, 'mom', created.id, { slots: ['learner'], consent });
    expect(again.status).toBe(200);
    expect((await db.getTransfer(created.id))?.learner.evidence).toBe('dad');

    // then the destination accepts and the cooling-off runs from the learner-side consent
    expect(requestOf(await approve(B, 'teacher-b', created.id, { slots: ['destination'] }))).toMatchObject({ status: 'approved', scheduledFor: at(49 * HOUR).toISOString() });
    travel(50 * HOUR);
    expect(requestOf(await retry(B, 'teacher-b', created.id))).toMatchObject({ status: 'executed' });
    expect(await inClass(B)).toBe(true);
  });

  it('the learner-side view carries the terms digest of an open request whose learner slot waits, and only then', async () => {
    const teacher = requestOf(await create(A, 'teacher-a', classCreate()));
    await familyDigest(teacher.id);
    await approve(FAMILY, 'mom', teacher.id, { slots: ['learner'], consent });
    expect(requestsOf(await list(FAMILY, 'mom'))[0]?.termsDigest).toBeNull();
  });

  it('binds the consent to the sheet: a digest that no longer matches answers 409 terms_changed and records nothing', async () => {
    const created = requestOf(await create(A, 'teacher-a', classCreate()));
    const digest = await familyDigest(created.id);
    const b = await db.getSpace(B);
    await db.putSpace({ ...b!, name: 'Renamed Class B' });
    const r = await approve(FAMILY, 'mom', created.id, { slots: ['learner'], consent: { ...consent, termsDigest: digest } });
    expect([r.status, r.body.error?.code]).toEqual([409, 'terms_changed']);
    expect((await db.getTransfer(created.id))?.learner.state).toBe('pending');
    expect((await approve(FAMILY, 'mom', created.id, { slots: ['learner'], consent: { ...consent, termsDigest: await familyDigest(created.id) } })).status).toBe(200);
  });

  it('checks the consent text: stale version 422 with current, unreviewed locale 422', async () => {
    const created = requestOf(await create(A, 'teacher-a', classCreate()));
    const stale = await approve(FAMILY, 'mom', created.id, { slots: ['learner'], consent: { ...consent, textVersion: 'transfer-1999-01' } });
    expect([stale.status, stale.body.error?.code, stale.body.error?.details]).toEqual([422, 'consent_text_stale', { current: TRANSFER_CONSENT_TEXT_VERSION }]);
    const locale = await approve(FAMILY, 'mom', created.id, { slots: ['learner'], consent: { ...consent, locale: 'ko' } });
    expect([locale.status, locale.body.error?.code]).toEqual([422, 'consent_locale_unavailable']);
    expect((await db.getTransfer(created.id))?.learner.state).toBe('pending');
  });

  it('guard 9 at consent: a new family member (family_too_new), a teacher of either class (conflicted_guardian), a self-managed learner', async () => {
    const created = requestOf(await create(A, 'teacher-a', classCreate()));
    await db.putAccount({ id: 'grandma', email: 'grandma@example.test', displayName: null, consent: null, createdAt: NOW.toISOString() });
    await member(FAMILY, 'account', 'grandma', 'caregiver', NOW.toISOString());
    const young = await approve(FAMILY, 'grandma', created.id, { slots: ['learner'], consent });
    expect([young.status, young.body.error?.code]).toEqual([422, 'family_too_new']);

    await member(FAMILY, 'account', 'teacher-b', 'caregiver', new Date(NOW.getTime() - 5 * DAY).toISOString());
    const teacher = await approve(FAMILY, 'teacher-b', created.id, { slots: ['learner'], consent });
    expect([teacher.status, teacher.body.error?.code]).toEqual([409, 'conflicted_guardian']);

    await db.setTransferPref(SUNI, 'selfManaged', true, NOW);
    const own = await approve(FAMILY, 'mom', created.id, { slots: ['learner'], consent });
    expect([own.status, own.body.error?.code]).toEqual([409, 'learner_manages_own']);
    expect((await db.getTransfer(created.id))?.learner.state).toBe('pending');
  });

  it('guard 9 comes first: an account that passes only 9a learns nothing about the learner\'s own switch or the consent text', async () => {
    const created = requestOf(await create(A, 'teacher-a', classCreate()));
    await db.setTransferPref(SUNI, 'selfManaged', true, NOW);
    await db.putAccount({ id: 'grandma', email: 'grandma@example.test', displayName: null, consent: null, createdAt: NOW.toISOString() });
    await member(FAMILY, 'account', 'grandma', 'caregiver', NOW.toISOString());
    const young = await approve(FAMILY, 'grandma', created.id, { slots: ['learner'], consent: { ...consent, textVersion: 'transfer-1999-01' } });
    expect([young.status, young.body.error?.code]).toEqual([422, 'family_too_new']);
    await member(FAMILY, 'account', 'teacher-b', 'caregiver', new Date(NOW.getTime() - 5 * DAY).toISOString());
    const conflicted = await approve(FAMILY, 'teacher-b', created.id, { slots: ['learner'], consent });
    expect([conflicted.status, conflicted.body.error?.code]).toEqual([409, 'conflicted_guardian']);
  });

  it('IDOR: a guardian of another learner, or of a family the learner is not in, gets 404', async () => {
    const created = requestOf(await create(A, 'teacher-a', classCreate()));
    expect((await approve(FAMILY2, 'aunt', created.id, { slots: ['learner'], consent })).status).toBe(404);
    expect((await approve(FAMILY, 'stranger', created.id, { slots: ['learner'], consent })).status).toBe(404);
    expect((await approve(FAMILY, 'aunt', created.id, { slots: ['learner'], consent })).status).toBe(404);
  });
});

describe('retry and the capacity block', () => {
  it('a full destination blocks the move; nothing changes; Try again moves the learner once a seat is free (behaviour 4)', async () => {
    const created = await agreedFamilyMove();
    await fillB();
    travel(AFTER_COOLING_OFF);
    const blocked = await retry(B, 'teacher-b', created.id);
    expect(blocked.status).toBe(200);
    expect(requestOf(blocked)).toMatchObject({ role: 'destination', status: 'approved', blockReason: 'cap_class' });
    expect(await inClass(A)).toBe(true);
    expect(await inClass(B)).toBe(false);
    expect(await db.transferEvents(created.id)).toContainEqual(expect.objectContaining({ event: 'blocked', actorKind: 'system', detail: { reason: 'cap_class' } }));
    // the family and the source see the wait, never who is full
    expect(requestsOf(await list(FAMILY, 'mom'))[0]).toMatchObject({ status: 'approved', blockReason: 'cap_class' });

    await db.removeMembership(B, 'learner', 'profile:fill-00');
    const moved = await retry(B, 'teacher-b', created.id);
    expect(requestOf(moved)).toMatchObject({ status: 'executed', blockReason: null });
    expect(await inClass(B)).toBe(true);
    expect(await inClass(A)).toBe(false);
  });

  it('a block that lasts 72 hours lets the learner consent lapse (409 consent_outdated); the guardian is asked again', async () => {
    const created = await agreedFamilyMove();
    await fillB();
    travel(AFTER_COOLING_OFF);
    expect(requestOf(await retry(B, 'teacher-b', created.id)).blockReason).toBe('cap_class');
    travel(AFTER_COOLING_OFF + 73 * HOUR);
    const lapsed = await retry(B, 'teacher-b', created.id);
    expect([lapsed.status, lapsed.body.error?.code]).toEqual([409, 'consent_outdated']);
    expect(await db.getTransfer(created.id)).toMatchObject({ status: 'requested', learner: { state: 'pending' }, approvedAt: null, executeAfter: null });
    expect(await db.transferEvents(created.id)).toContainEqual(expect.objectContaining({ event: 'consent_reset', detail: { why: 'lapsed' } }));
    expect(await inClass(A)).toBe(true);
  });

  it('who may retry: the destination manager, or a source manager who also manages the destination; others 404', async () => {
    const created = await agreedFamilyMove();
    travel(AFTER_COOLING_OFF);
    expect((await retry(A, 'teacher-a', created.id)).status).toBe(404);
    expect((await retry(C, 'teacher-c', created.id)).status).toBe(404);
    expect((await retry(FAMILY, 'mom', created.id)).status).toBe(404);
    expect((await retry(B, 'teacher-a', created.id)).status).toBe(404);
    expect((await retry(B, 'teacher-b', 'transfer:unknown')).status).toBe(404);
    expect(await inClass(A)).toBe(true);
    await member(B, 'account', 'teacher-a', 'teacher');
    expect(requestOf(await retry(A, 'teacher-a', created.id))).toMatchObject({ role: 'source', status: 'executed' });
  });

  it('answers 409 not_approved for a request still waiting for a yes, 409 not_open once it ended, and needs an empty body', async () => {
    const created = requestOf(await create(FAMILY, 'mom', familyCreate()));
    await approve(A, 'teacher-a', created.id, { slots: ['source'] });
    const waiting = await retry(B, 'teacher-b', created.id);
    expect([waiting.status, waiting.body.error?.code]).toEqual([409, 'not_approved']);
    expect((await retry(B, 'teacher-b', created.id, { junk: 1 })).body.error?.code).toBe('bad_request');
    await cancel(FAMILY, 'mom', created.id);
    const ended = await retry(B, 'teacher-b', created.id);
    expect([ended.status, ended.body.error?.code]).toEqual([409, 'not_open']);
  });

  it('answers 409 expired for a request past its 14 days, and the expiry is audited once', async () => {
    const created = await agreedFamilyMove();
    await fillB();
    travel(15 * DAY);
    const r = await retry(B, 'teacher-b', created.id);
    expect([r.status, r.body.error?.code]).toEqual([409, 'expired']);
    expect((await db.transferEvents(created.id)).filter((e) => e.event === 'expired')).toEqual([expect.objectContaining({ actorKind: 'system', actorRef: null })]);
    expect(await inClass(A)).toBe(true);
  });

  it('a scheduled move during the cooling-off stays scheduled on retry', async () => {
    const created = await agreedFamilyMove();
    travel(HOUR);
    expect(requestOf(await retry(B, 'teacher-b', created.id))).toMatchObject({ status: 'approved', scheduledFor: ahead(48 * HOUR), blockReason: null });
    expect(await inClass(B)).toBe(false);
  });

  it('a withdrawal that lands between settle\'s reads and the batch wins at the route: 409 not_open, both memberships stay (behaviour 15)', async () => {
    const created = await agreedFamilyMove();
    travel(AFTER_COOLING_OFF);
    const real = db.executeTransfer.bind(db);
    const spy = vi.spyOn(db, 'executeTransfer').mockImplementationOnce(async (input) => {
      expect(await db.cancelTransfer(created.id, 'withdrawn_learner', 'family', at(AFTER_COOLING_OFF))).toBe(1);
      return real(input);
    });
    try {
      const r = await retry(B, 'teacher-b', created.id);
      expect([r.status, r.body.error?.code]).toEqual([409, 'not_open']);
    } finally {
      spy.mockRestore();
    }
    expect(await inClass(A)).toBe(true);
    expect(await inClass(B)).toBe(false);
    expect((await db.transferEvents(created.id)).some((e) => e.event === 'executed')).toBe(false);
  });

  it('a withdrawal during the cooling-off wins: both memberships stay (behaviour 15)', async () => {
    const created = await agreedFamilyMove();
    travel(HOUR);
    expect((await cancel(FAMILY, 'dad', created.id)).status).toBe(200);
    travel(AFTER_COOLING_OFF);
    expect((await retry(B, 'teacher-b', created.id)).body.error?.code).toBe('not_open');
    expect(await inClass(A)).toBe(true);
    expect(await inClass(B)).toBe(false);
  });
});

describe('freshness of the learner consent (section 4.6 step 5)', () => {
  it('a destination that turns on school consent mode before the move asks the guardian again (behaviour 16)', async () => {
    const created = await agreedFamilyMove();
    const b = await db.getSpace(B);
    await db.putSpace({ ...b!, settings: { ...b!.settings, consentMode: 'school' } });
    travel(AFTER_COOLING_OFF);
    const r = await retry(B, 'teacher-b', created.id);
    expect([r.status, r.body.error?.code]).toEqual([409, 'consent_outdated']);
    expect(await db.getTransfer(created.id)).toMatchObject({ status: 'requested', learner: { state: 'pending' }, source: { state: 'consented' }, destination: { state: 'consented' } });
    expect(await db.transferEvents(created.id)).toContainEqual(expect.objectContaining({ event: 'consent_reset', detail: { why: 'terms_changed' } }));
    expect(await inClass(A)).toBe(true);

    // the guardian agrees again on the new terms; every slot is in, so it is approved with a new cooling-off
    const view = requestsOf(await list(FAMILY, 'mom'))[0];
    expect(view).toMatchObject({ learnerState: 'pending', destinationConsentMode: 'school' });
    const again = await approve(FAMILY, 'mom', created.id, { slots: ['learner'], consent: { ...consent, termsDigest: view?.termsDigest } });
    expect(again.status).toBe(200);
    expect(requestOf(again)).toMatchObject({ status: 'approved', executeAfter: at(AFTER_COOLING_OFF + 48 * HOUR).toISOString() });
    expect((await db.getTransfer(created.id))?.learner.shown?.lineIds).toContain('school_delete');
    travel(AFTER_COOLING_OFF + 49 * HOUR);
    expect(requestOf(await retry(B, 'teacher-b', created.id)).status).toBe('executed');
  });

  it('a guardian who left the family before the move: the consent resets (behaviour 17)', async () => {
    const created = await agreedFamilyMove();
    await db.removeMembership(FAMILY, 'account', 'mom');
    travel(AFTER_COOLING_OFF);
    const r = await retry(B, 'teacher-b', created.id);
    expect([r.status, r.body.error?.code]).toEqual([409, 'consent_outdated']);
    expect(await db.transferEvents(created.id)).toContainEqual(expect.objectContaining({ event: 'consent_reset', detail: { why: 'guardian_changed' } }));
    expect(await inClass(A)).toBe(true);
  });

  it('a destination that turns on anonymizeRoster before the move asks the guardian again (behaviour 16)', async () => {
    const created = await agreedFamilyMove();
    const b = await db.getSpace(B);
    await db.putSpace({ ...b!, settings: { ...b!.settings, anonymizeRoster: true } });
    travel(AFTER_COOLING_OFF);
    const r = await retry(B, 'teacher-b', created.id);
    expect([r.status, r.body.error?.code]).toEqual([409, 'consent_outdated']);
    expect(await db.transferEvents(created.id)).toContainEqual(expect.objectContaining({ event: 'consent_reset', detail: { why: 'terms_changed' } }));
    expect(await inClass(A)).toBe(true);
    expect(await inClass(B)).toBe(false);
  });

  it('a learner taken out of the family before the move: the consent resets (behaviour 17)', async () => {
    const created = await agreedFamilyMove();
    await db.removeMembership(FAMILY, 'learner', SUNI);
    travel(AFTER_COOLING_OFF);
    const r = await retry(B, 'teacher-b', created.id);
    expect([r.status, r.body.error?.code]).toEqual([409, 'consent_outdated']);
    expect(await db.transferEvents(created.id)).toContainEqual(expect.objectContaining({ event: 'consent_reset', detail: { why: 'guardian_changed' } }));
    expect(await inClass(A)).toBe(true);
  });

  it('a reset found by an earlier read: the destination that said yes still sees the card, and Try again answers consent_outdated', async () => {
    const created = await agreedFamilyMove();
    await db.removeMembership(FAMILY, 'account', 'mom');
    travel(AFTER_COOLING_OFF);
    // the second guardian's page settles first and finds the consent outdated
    expect(requestsOf(await list(FAMILY, 'dad'))[0]).toMatchObject({ status: 'requested', learnerState: 'pending', termsDigest: expect.stringMatching(/^[0-9a-f]{64}$/) });
    expect(requestsOf(await list(B, 'teacher-b'))[0]).toMatchObject({ role: 'destination', status: 'requested', steps: { learner: 'waiting', source: 'yes', destination: 'yes' }, learner: { name: 'S. K.' } });
    const r = await retry(B, 'teacher-b', created.id);
    expect([r.status, r.body.error?.code]).toEqual([409, 'consent_outdated']);
    // the second guardian agrees again; the cooling-off starts over from that consent
    const again = await approve(FAMILY, 'dad', created.id, { slots: ['learner'], consent });
    expect(requestOf(again)).toMatchObject({ status: 'approved', executeAfter: at(AFTER_COOLING_OFF + 48 * HOUR).toISOString() });
    expect(await inClass(A)).toBe(true);
  });

  it('a renamed destination before the last approval: approve answers 200 with the request back at the learner side', async () => {
    const created = requestOf(await create(FAMILY, 'mom', familyCreate()));
    await approve(A, 'teacher-a', created.id, { slots: ['source'] });
    const b = await db.getSpace(B);
    await db.putSpace({ ...b!, name: 'Renamed Class B' });
    const r = await approve(B, 'teacher-b', created.id, { slots: ['destination'] });
    expect(r.status).toBe(200);
    expect(requestOf(r)).toMatchObject({ status: 'requested', steps: { learner: 'waiting', source: 'yes', destination: 'yes' } });
    expect(await db.getTransfer(created.id)).toMatchObject({ status: 'requested', learner: { state: 'pending' }, destination: { state: 'consented' } });
  });
});

describe('the move (sections 4.6, 4.10, 4.13)', () => {
  it('revokes the source\'s class devices and closes its pending re-links (behaviour 8)', async () => {
    const secret = 'class-tablet-secret';
    await db.putDevice({ learnerId: SUNI, deviceId: 'device-tablet01', secretHash: await hashSecret(secret), scope: 'class', createdAt: NOW.toISOString(), lastSeenAt: NOW.toISOString() });
    await db.putDevice({ learnerId: SUNI, deviceId: 'device-phone001', secretHash: await hashSecret('phone'), scope: 'full', createdAt: NOW.toISOString(), lastSeenAt: NOW.toISOString() });
    const relink = { spaceId: A, learnerId: SUNI, platform: null, requestedAt: NOW.toISOString(), expiresAt: ahead(DAY), secret: null };
    await db.putRelink({ ...relink, id: 'relink:approved-1', deviceId: 'device-tablet01', status: 'approved', decidedAt: NOW.toISOString() });
    await db.putRelink({ ...relink, id: 'relink:pending-1', deviceId: 'device-tablet02', status: 'pending', decidedAt: null });
    const inbox = () => app.request(`/api/sync/learners/${SUNI}/inbox`, { headers: { authorization: `Device device-tablet01:${secret}` } }, { CLASS_TRANSFER: 'enabled' });
    expect((await inbox()).status).toBe(200);

    const created = await agreedFamilyMove();
    travel(AFTER_COOLING_OFF);
    expect(requestOf(await retry(B, 'teacher-b', created.id)).status).toBe('executed');
    expect((await inbox()).status).toBe(401);
    expect(await db.getDevice(SUNI, 'device-tablet01')).toBeNull();
    expect(await db.getDevice(SUNI, 'device-phone001')).not.toBeNull();
    expect((await db.relinksOf(A)).find((r) => r.id === 'relink:pending-1')).toMatchObject({ status: 'denied', decidedAt: at(AFTER_COOLING_OFF).toISOString() });
    const events = await db.transferEvents(created.id);
    expect(events).toContainEqual(expect.objectContaining({ event: 'devices_revoked', detail: { count: 1 } }));
    expect(events).toContainEqual(expect.objectContaining({ event: 'relinks_closed', detail: { count: 1 } }));
  });

  it('audits a source teacher who can still see the learner through a family (old_space_still_has_access, counts only)', async () => {
    await member(FAMILY2, 'learner', SUNI, 'student');
    await member(FAMILY2, 'account', 'teacher-a', 'caregiver');
    const created = await agreedFamilyMove();
    travel(AFTER_COOLING_OFF);
    expect(requestOf(await retry(B, 'teacher-b', created.id)).status).toBe('executed');
    expect(await db.transferEvents(created.id)).toContainEqual(expect.objectContaining({ event: 'old_space_still_has_access', actorKind: 'system', detail: { count: 1 } }));
  });

  it('a learner in three classes swaps one for another (behaviour 6)', async () => {
    await member(C, 'learner', SUNI, 'student');
    await member(E, 'learner', SUNI, 'student');
    const created = await agreedFamilyMove();
    travel(AFTER_COOLING_OFF);
    expect(requestOf(await retry(B, 'teacher-b', created.id)).status).toBe('executed');
    expect([await inClass(A), await inClass(B), await inClass(C), await inClass(E)]).toEqual([false, true, true, true]);
  });

  it('a learner who joined a full destination meanwhile: only the source is removed (behaviour 25)', async () => {
    const created = await agreedFamilyMove();
    await fillB(19);
    await member(B, 'learner', SUNI, 'student', NOW.toISOString());
    travel(AFTER_COOLING_OFF);
    expect(requestOf(await retry(B, 'teacher-b', created.id)).status).toBe('executed');
    expect(await inClass(A)).toBe(false);
    expect(await db.membership(B, 'learner', SUNI)).toMatchObject({ joinedAt: NOW.toISOString() });
  });

  it('archiving the source is not a veto: its slot is no longer needed and the move goes ahead (behaviour 23)', async () => {
    const created = requestOf(await create(FAMILY, 'mom', familyCreate()));
    expect((await approve(B, 'teacher-b', created.id, { slots: ['destination'] })).status).toBe(200);
    const a = await db.getSpace(A);
    await db.putSpace({ ...a!, archivedAt: NOW.toISOString() });
    travel(AFTER_COOLING_OFF);
    expect(requestOf(await retry(B, 'teacher-b', created.id))).toMatchObject({ status: 'executed' });
    expect(await db.getTransfer(created.id)).toMatchObject({ status: 'executed', source: { state: 'not_required' } });
    expect(await inClass(B)).toBe(true);
  });

  it('cards, stars and the snapshot stay with the learner', async () => {
    expect(await db.putSnapshot({ learnerId: SUNI, rev: 1, schemaVer: 2, contentVer: 'c1', deviceId: 'device-phone001', payload: { cards: ['card:a'], stars: 7 }, summary: null, updatedAt: NOW.toISOString() }, 0)).toBe(true);
    const before = await db.getSnapshot(SUNI);
    const created = await agreedFamilyMove();
    travel(AFTER_COOLING_OFF);
    await retry(B, 'teacher-b', created.id);
    expect(await db.getSnapshot(SUNI)).toEqual(before);
  });
});

describe('races at the route (the compare-and-set decides; section 4.7)', () => {
  it('two teacher clicks: a both-slot approve that loses the destination slot to the other teacher fills the source only', async () => {
    await member(B, 'account', 'teacher-a', 'teacher');
    const created = requestOf(await create(FAMILY, 'mom', familyCreate()));
    const real = db.consentSlot.bind(db);
    const spy = vi.spyOn(db, 'consentSlot').mockImplementationOnce(async (...args) => {
      expect(await real(created.id, { kind: 'teacher', slots: ['destination'], accountId: 'teacher-b', via: 'owner' }, NOW)).toBe(1);
      return real(...args);
    });
    try {
      const r = await approve(A, 'teacher-a', created.id, { slots: ['source', 'destination'] });
      expect(r.status).toBe(200);
      expect(requestOf(r)).toMatchObject({ status: 'approved' });
    } finally {
      spy.mockRestore();
    }
    // re-planned on the fresh row: one slot left, written with the via of that slot alone (owner of A)
    expect(await db.getTransfer(created.id)).toMatchObject({ source: { accountId: 'teacher-a', via: 'owner' }, destination: { accountId: 'teacher-b', via: 'owner' } });
    const consented = (await db.transferEvents(created.id)).filter((e) => e.event === 'consented');
    expect(consented).toEqual([expect.objectContaining({ slot: 'source', actorRef: 'teacher-a' })]);
  });

  it('a lost race whose re-plan finds every named slot in answers with the settled request (promoted), not the stale row', async () => {
    const created = requestOf(await create(FAMILY, 'mom', familyCreate()));
    expect((await approve(B, 'teacher-b', created.id, { slots: ['destination'] })).status).toBe(200);
    const real = db.consentSlot.bind(db);
    const spy = vi.spyOn(db, 'consentSlot').mockImplementationOnce(async (...args) => {
      // another click of the same source lands first: every slot is now in, but nobody has promoted it yet
      expect(await real(...args)).toBe(1);
      return 0;
    });
    try {
      const r = await approve(A, 'teacher-a', created.id, { slots: ['source'] });
      expect(r.status).toBe(200);
      expect(requestOf(r)).toMatchObject({ role: 'source', status: 'approved', scheduledFor: ahead(48 * HOUR) });
    } finally {
      spy.mockRestore();
    }
    expect((await db.getTransfer(created.id))?.status).toBe('approved');
  });

  it('a request that keeps changing under the click answers 409 request_changed (still open), never not_open', async () => {
    const created = requestOf(await create(FAMILY, 'mom', familyCreate()));
    const spy = vi.spyOn(db, 'consentSlot').mockResolvedValue(0);
    try {
      const r = await approve(A, 'teacher-a', created.id, { slots: ['source'] });
      expect([r.status, r.body.error?.code]).toEqual([409, 'request_changed']);
      expect(spy).toHaveBeenCalledTimes(3);
    } finally {
      spy.mockRestore();
    }
    expect(await db.getTransfer(created.id)).toMatchObject({ status: 'requested', source: { state: 'pending' } });
  });

  it('two guardians at once: the first wins, the second gets 200 and writes no event', async () => {
    const created = requestOf(await create(A, 'teacher-a', classCreate()));
    const real = db.consentSlot.bind(db);
    const spy = vi.spyOn(db, 'consentSlot').mockImplementationOnce(async (id, slot, at, events) => {
      // dad's consent lands first, with the same record but his own evidence
      if (slot.kind !== 'learner') throw new Error('expected the learner slot');
      expect(await real(id, { ...slot, record: { ...slot.record, evidence: 'dad', role: 'caregiver' } }, at)).toBe(1);
      return real(id, slot, at, events);
    });
    try {
      const r = await approve(FAMILY, 'mom', created.id, { slots: ['learner'], consent });
      expect(r.status).toBe(200);
      expect(requestOf(r)).toMatchObject({ learnerState: 'consented' });
    } finally {
      spy.mockRestore();
    }
    expect((await db.getTransfer(created.id))?.learner.evidence).toBe('dad');
    expect((await db.transferEvents(created.id)).filter((e) => e.event === 'consented')).toEqual([]);
  });

  it('a cancel that lands just before an approve wins: 409 not_open, no consent, no event', async () => {
    const real = db.consentSlot.bind(db);
    for (const [spaceId, user, body] of [
      [A, 'teacher-a', { slots: ['source'] }],
      [FAMILY, 'dad', { slots: ['learner'], consent }],
    ] as const) {
      await db.reset();
      await seed();
      const created = spaceId === A ? requestOf(await create(FAMILY, 'mom', familyCreate())) : requestOf(await create(A, 'teacher-a', classCreate()));
      const spy = vi.spyOn(db, 'consentSlot').mockImplementationOnce(async (...args) => {
        expect(await db.cancelTransfer(created.id, 'withdrawn_learner', 'family', NOW)).toBe(1);
        return real(...args);
      });
      try {
        const r = await approve(spaceId, user, created.id, body);
        expect([r.status, r.body.error?.code], spaceId).toEqual([409, 'not_open']);
      } finally {
        spy.mockRestore();
      }
      expect((await db.transferEvents(created.id)).some((e) => e.event === 'consented')).toBe(false);
    }
  });
});

/*
 * Measured Db calls of the executing paths with a school parent (one call can be several statements; a batch
 * counts each). The Free plan allows 50 D1 statements per invocation: these paths are still over it on the
 * sqlite shim (executing approve 51 statements, 66 with a school parent), so bringing them under it is flip
 * gate G7 of the spec. Until then these ceilings only stop the cost from growing, and the school size must
 * never change it (the old-space audit used to read every school member's memberships one by one).
 */
const EXECUTING_APPROVE_DB_CALLS = 58;
const EXECUTING_RETRY_DB_CALLS = 49;

describe('query budget of the executing paths (D1 per-invocation limit)', () => {
  /** Puts both classes under a school with `teachers` extra teacher accounts, so a per-account read would show. */
  async function schoolWith(teachers: number): Promise<void> {
    await db.putSpace(space(SCHOOL, 'school', 'admin'));
    await member(SCHOOL, 'account', 'admin', 'owner');
    for (let i = 0; i < teachers; i += 1) await member(SCHOOL, 'account', `teacher-${String(i).padStart(3, '0')}`, 'teacher');
    const a = await db.getSpace(A);
    const b = await db.getSpace(B);
    await db.putSpace({ ...a!, parentSpaceId: SCHOOL });
    await db.putSpace({ ...b!, parentSpaceId: SCHOOL });
  }

  async function executingApprove(): Promise<number> {
    const created = requestOf(await create(FAMILY, 'mom', familyCreate()));
    await approve(A, 'teacher-a', created.id, { slots: ['source'] });
    travel(3 * DAY);
    let status = '';
    const n = await countDbCalls(async () => {
      status = requestOf(await approve(B, 'teacher-b', created.id, { slots: ['destination'] })).status;
    });
    expect(status).toBe('executed');
    return n;
  }

  async function executingRetry(): Promise<number> {
    const created = await agreedFamilyMove();
    travel(AFTER_COOLING_OFF);
    let status = '';
    const n = await countDbCalls(async () => {
      status = requestOf(await retry(B, 'teacher-b', created.id)).status;
    });
    expect(status).toBe('executed');
    return n;
  }

  it('an executing approve and an executing retry cost the same however many teachers the school has, and no more than measured', async () => {
    await schoolWith(5);
    const approveSmall = await executingApprove();
    await db.reset();
    await seed();
    vi.setSystemTime(NOW);
    await schoolWith(60);
    const approveLarge = await executingApprove();
    expect(approveLarge).toBe(approveSmall);
    expect(approveLarge).toBeLessThanOrEqual(EXECUTING_APPROVE_DB_CALLS);

    await db.reset();
    await seed();
    vi.setSystemTime(NOW);
    await schoolWith(5);
    const retrySmall = await executingRetry();
    await db.reset();
    await seed();
    vi.setSystemTime(NOW);
    await schoolWith(60);
    const retryLarge = await executingRetry();
    expect(retryLarge).toBe(retrySmall);
    expect(retryLarge).toBeLessThanOrEqual(EXECUTING_RETRY_DB_CALLS);
  });
});

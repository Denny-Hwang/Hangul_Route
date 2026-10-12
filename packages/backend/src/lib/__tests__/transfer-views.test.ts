import { describe, expect, it } from 'vitest';
import { MemoryDb } from '../../db';
import { DAY, DEST, FAMILY, LEARNER, SOURCE, T0, at, iso, learnerSideRow, seedWorld } from '../../db/__tests__/transfer-fixtures';
import type { StoredTransfer } from '../../db';
import { ageBucket, destinationView, hasCaregiverRoute, learnerRouteFor, learnerSideView, sourceView, viewLookups, viewStatus } from '../transfer-views';

/* Class-transfer views — F-SPACE-002 section 4.2 "Views" (PR T-5a). */

const executed = (row: StoredTransfer): StoredTransfer => ({
  ...row,
  status: 'executed',
  source: { state: 'consented', at: iso(DAY), accountId: 'teacher-a', via: 'owner' },
  destination: { state: 'consented', at: iso(DAY), accountId: 'teacher-b', via: 'school_admin' },
  approvedAt: iso(DAY),
  executedAt: iso(3 * DAY),
});

describe('ageBucket', () => {
  it('buckets a class age coarsely and answers null for a bad date', () => {
    const now = at(400 * DAY);
    expect(ageBucket(iso(399 * DAY), now)).toBe('days');
    expect(ageBucket(iso(380 * DAY), now)).toBe('weeks');
    expect(ageBucket(iso(200 * DAY), now)).toBe('months');
    expect(ageBucket(T0, now)).toBe('years');
    expect(ageBucket('not a date', now)).toBeNull();
  });
});

describe('learnerRouteFor', () => {
  it('caregiver unless self-managed or no caregiver; device only for a learner-started request while device consent is on', () => {
    expect(learnerRouteFor({ initiator: 'source', selfManaged: false, caregiverRoute: true, deviceConsent: false })).toBe('caregiver');
    expect(learnerRouteFor({ initiator: 'source', selfManaged: true, caregiverRoute: true, deviceConsent: true })).toBe('none');
    expect(learnerRouteFor({ initiator: 'learner_side', selfManaged: true, caregiverRoute: true, deviceConsent: true })).toBe('device');
    expect(learnerRouteFor({ initiator: 'learner_side', selfManaged: false, caregiverRoute: false, deviceConsent: false })).toBe('none');
  });
});

describe('viewStatus', () => {
  it('collapses every ending into `ended`', () => {
    for (const status of ['declined', 'cancelled', 'expired'] as const) expect(viewStatus({ status })).toBe('ended');
    for (const status of ['requested', 'approved', 'executed'] as const) expect(viewStatus({ status })).toBe(status);
  });
});

describe('class views after the move', () => {
  it('the source keeps one nameless line; the destination sees the roster name per its own setting', async () => {
    const db = new MemoryDb();
    await seedWorld(db);
    const dest = await db.getSpace(DEST);
    if (!dest) throw new Error('seed');
    await db.putSpace({ ...dest, settings: { ...dest.settings, anonymizeRoster: true } });
    await db.putLearner({ ...(await db.getLearner(LEARNER))!, displayName: 'Suni Kim' });
    const row = executed(learnerSideRow());
    const look = await viewLookups(db, [row]);
    expect(sourceView(row, look)).toMatchObject({ status: 'executed', learner: null, learnerId: null, steps: { learner: 'yes', source: 'yes', destination: 'yes' }, agreedBySchoolAdmin: true, executedAt: iso(3 * DAY), scheduledFor: null });
    expect(destinationView(row, look)).toMatchObject({ status: 'executed', learner: { name: 'S. K.', avatar: 'hoya-orange' } });
    await db.putSpace({ ...dest, settings: { ...dest.settings, anonymizeRoster: false } });
    expect(destinationView(row, await viewLookups(db, [row])).learner?.name).toBe('Suni Kim');
  });

  it('an approved, blocked request shows the date and the reason; a vanished learner shows no card details', async () => {
    const db = new MemoryDb();
    await seedWorld(db);
    const approved: StoredTransfer = { ...executed(learnerSideRow()), status: 'approved', executedAt: null, executeAfter: iso(2 * DAY), blockReason: 'cap_class' };
    const look = await viewLookups(db, [approved]);
    expect(destinationView(approved, look)).toMatchObject({ status: 'approved', scheduledFor: iso(2 * DAY), blockReason: 'cap_class' });
    const empty = { learners: new Map(), spaces: new Map(), facts: new Map() };
    expect(destinationView(approved, empty).learner).toBeNull();
    expect(sourceView(approved, empty)).toMatchObject({ learner: null, destination: null });
  });
});

describe('learnerSideView', () => {
  it('an ended or executed request carries neutral terms; unknown names read as ?', async () => {
    const db = new MemoryDb();
    await seedWorld(db);
    const ctx = { family: await db.getSpace(FAMILY), selfManaged: false, caregiverRoute: true, deviceConsent: false, now: at(3 * DAY) };
    const done = executed(learnerSideRow());
    const view = await learnerSideView(db, done, await viewLookups(db, [done]), ctx);
    expect(view).toMatchObject({ status: 'executed', premiumChange: 'none', relinkAffected: false, sourcePlansAffected: false, visibleToday: [], endedFrom: null, executeAfter: done.executeAfter });
    const ended: StoredTransfer = { ...learnerSideRow(), status: 'cancelled', endReason: 'withdrawn_learner', endActor: 'device', endedAt: iso(DAY) };
    const lonely = await learnerSideView(db, ended, { learners: new Map(), spaces: new Map(), facts: new Map() }, { ...ctx, family: null });
    expect(lonely).toMatchObject({ status: 'ended', endedFrom: 'device', executeAfter: null, learner: { id: LEARNER, name: '?' }, from: { spaceId: SOURCE, name: '?' }, to: { name: '?', ownerName: null, learnerCount: 0 }, destinationConsentMode: 'parent' });
  });
});

describe('hasCaregiverRoute', () => {
  it('needs a live family with an owner or caregiver account', async () => {
    const db = new MemoryDb();
    await seedWorld(db);
    expect(await hasCaregiverRoute(db, LEARNER)).toBe(true);
    const family = await db.getSpace(FAMILY);
    await db.putSpace({ ...family!, archivedAt: T0 });
    expect(await hasCaregiverRoute(db, LEARNER)).toBe(false);
  });
});

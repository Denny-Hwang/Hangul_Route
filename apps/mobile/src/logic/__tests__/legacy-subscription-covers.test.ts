import { FAMILY_LIFETIME_LEARNERS, type Profile } from '@hangul-route/content-schema';
import { describe, expect, it } from 'vitest';
import {
  isLearnerProfile,
  legacyCovers,
  mergeCovers,
  subscriptionCoversFor,
  subscriptionCoversOf,
  withNewerCovered,
  type SubscriptionCovers,
} from '../legacy-subscription-covers';

type Row = Pick<Profile, 'id' | 'role'>;
const learner = (n: number): Row => ({ id: `profile:l${n}`, role: 'learner' });
const grownUp: Row = { id: 'profile:me', role: 'parent' };
const record = (ids: string[], added: string[] = []): SubscriptionCovers => ({ v: 1, ids, added, at: '2026-10-21T00:00:00.000Z' });

describe('legacy subscription covers (AMENDMENTS-ONE-ACCOUNT-MANY-USERS OA-D15, section 10.5)', () => {
  it('the cap is the family cap of 4 learners (SA-D1)', () => {
    expect(FAMILY_LIFETIME_LEARNERS).toBe(4);
  });

  it('reads back only a v1 record (a record without `added` reads as none added); anything else is no record', () => {
    expect(subscriptionCoversOf({ v: 1, ids: ['profile:a'], at: 't' })).toEqual({ v: 1, ids: ['profile:a'], added: [], at: 't' });
    expect(subscriptionCoversOf({ v: 1, ids: ['profile:a'], added: ['profile:b'], at: 't' })).toEqual({ v: 1, ids: ['profile:a'], added: ['profile:b'], at: 't' });
    for (const bad of [
      null,
      undefined,
      'x',
      3,
      [],
      { v: 2, ids: [], at: 't' },
      { v: 1, ids: 'profile:a', at: 't' },
      { v: 1, ids: [1], at: 't' },
      { v: 1, ids: [] },
      { v: 1, ids: [], added: 'profile:b', at: 't' },
      { v: 1, ids: [], added: [2], at: 't' },
    ]) {
      expect(subscriptionCoversOf(bad)).toBeNull();
    }
  });

  it('a stored profile without a role is a learner; a grown-up profile is not', () => {
    expect(isLearnerProfile({ role: 'learner' })).toBe(true);
    expect(isLearnerProfile({} as Pick<Profile, 'role'>)).toBe(true);
    expect(isLearnerProfile({ role: 'parent' })).toBe(false);
  });

  it('records every learner profile on the device now, in device order, and no grown-up', () => {
    const now = new Date('2026-10-21T08:00:00.000Z');
    expect(subscriptionCoversFor([learner(2), grownUp, learner(1), learner(2)], now)).toEqual({ v: 1, ids: ['profile:l2', 'profile:l1'], added: [], at: now.toISOString() });
  });

  it('before the record exists, every profile is covered, as before', () => {
    expect(legacyCovers(null, [], 'profile:any')).toBe(true);
    expect(legacyCovers(null, [1, 2, 3, 4, 5, 6].map(learner), 'profile:l6')).toBe(true);
  });

  it('every grandfathered learner stays covered, even past the cap and after others are removed (SA-D7)', () => {
    const six = [1, 2, 3, 4, 5, 6].map(learner);
    const covers = record(six.map((p) => p.id));
    for (const p of six) expect(legacyCovers(covers, six, p.id)).toBe(true);
    expect(legacyCovers(covers, [learner(6)], 'profile:l6')).toBe(true);
  });

  it('newer learners are covered while the recorded learners plus the newer ones before them are below 4, in creation order', () => {
    const covers = record(['profile:l1', 'profile:l2']);
    const profiles = [1, 2, 3, 4, 5].map(learner);
    expect(profiles.map((p) => legacyCovers(covers, profiles, p.id))).toEqual([true, true, true, true, false]);
  });

  it('a 5th new profile after 4 recorded learners is not covered; nor any newer one after 4 or more', () => {
    const four = [1, 2, 3, 4].map(learner);
    expect(legacyCovers(record(four.map((p) => p.id)), [...four, learner(5)], 'profile:l5')).toBe(false);
    const five = [1, 2, 3, 4, 5].map(learner);
    expect(legacyCovers(record(five.map((p) => p.id)), [...five, learner(6)], 'profile:l6')).toBe(false);
  });

  it('a covered newer learner keeps its cover when a later one is added or an earlier one is removed', () => {
    const covers = record(['profile:l1', 'profile:l2', 'profile:l3']);
    const withFour = [1, 2, 3, 4].map(learner);
    expect(legacyCovers(covers, withFour, 'profile:l4')).toBe(true);
    expect(legacyCovers(covers, [...withFour, learner(5)], 'profile:l4')).toBe(true);
    expect(legacyCovers(covers, [...withFour, learner(5)], 'profile:l5')).toBe(false);
    // A recorded learner removed from the device still counts: its place is not handed on.
    expect(legacyCovers(covers, [learner(2), learner(3), learner(4), learner(5)], 'profile:l5')).toBe(false);
  });

  it('a grown-up profile takes no place and stays covered; an id that is no profile here is not covered', () => {
    const four = [1, 2, 3, 4].map(learner);
    const covers = record(four.map((p) => p.id));
    expect(legacyCovers(covers, [...four, grownUp], grownUp.id)).toBe(true);
    const two = record(['profile:l1', 'profile:l2']);
    expect(legacyCovers(two, [learner(1), learner(2), grownUp, learner(3), learner(4)], 'profile:l4')).toBe(true);
    expect(legacyCovers(two, [learner(1)], 'profile:gone')).toBe(false);
    expect(legacyCovers(two, [learner(1)], '')).toBe(false);
  });

  it('a remembered newer learner stays covered and keeps its place after it is removed', () => {
    const covers = record(['profile:l1', 'profile:l2'], ['profile:l3']);
    // l3 is removed: its place is not handed on, so only one more newer learner is covered.
    expect([4, 5].map((n) => legacyCovers(covers, [learner(1), learner(2), learner(4), learner(5)], `profile:l${n}`))).toEqual([true, false]);
    // Restored at the end of the list, it is covered again.
    expect(legacyCovers(covers, [learner(1), learner(2), learner(4), learner(5), learner(3)], 'profile:l3')).toBe(true);
  });

  it('remembers the newer learners it covers, in device order, up to the cap, and nothing past it', () => {
    const covers = record(['profile:l1', 'profile:l2']);
    const profiles = [learner(1), grownUp, learner(2), learner(3), learner(3), learner(4), learner(5)];
    const next = withNewerCovered(covers, profiles);
    expect(next.added).toEqual(['profile:l3', 'profile:l4']);
    expect(withNewerCovered(next, [...profiles, learner(6)])).toBe(next);
    expect(withNewerCovered(record([1, 2, 3, 4].map((n) => `profile:l${n}`)), [learner(5)]).added).toEqual([]);
  });

  it('remove, add, restore: a covered newer learner keeps premium (OA-D15: nobody who had premium loses it)', () => {
    let covers = record(['profile:a', 'profile:b']);
    const row = (x: string): Row => ({ id: `profile:${x}`, role: 'learner' });
    const [a, b, c, d, e] = [row('a'), row('b'), row('c'), row('d'), row('e')] as const;
    let profiles = [a, b, c, d];
    covers = withNewerCovered(covers, profiles);
    expect(profiles.map((p) => legacyCovers(covers, profiles, p.id))).toEqual([true, true, true, true]);
    profiles = [a, b, d]; // C removed from this device
    covers = withNewerCovered(covers, profiles);
    profiles = [a, b, d, e]; // E made
    covers = withNewerCovered(covers, profiles);
    expect(legacyCovers(covers, profiles, e.id)).toBe(false);
    profiles = [a, b, d, e, c]; // C restored with its Rescue Code, at the end
    covers = withNewerCovered(covers, profiles);
    expect(legacyCovers(covers, profiles, c.id)).toBe(true);
    expect(legacyCovers(covers, profiles, d.id)).toBe(true);
    expect(covers.added).toEqual(['profile:c', 'profile:d']);
  });

  it('merging two records keeps every id either covers', () => {
    const stored = record(['profile:a'], ['profile:b']);
    expect(mergeCovers(stored, record(['profile:a'], ['profile:b']))).toBe(stored);
    expect(mergeCovers(stored, record(['profile:a', 'profile:z'], ['profile:c', 'profile:b']))).toEqual(record(['profile:a'], ['profile:b', 'profile:z', 'profile:c']));
  });
});

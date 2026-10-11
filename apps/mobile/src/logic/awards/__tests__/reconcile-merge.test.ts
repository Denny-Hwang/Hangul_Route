import type { ProgressSnapshot } from '@hangul-route/content-schema';
import { describe, expect, it } from 'vitest';
import { seededRandom } from '../../listen-pick';
import { mergeSnapshots } from '../../sync/merge';
import { applyAwards } from '../apply';
import { derivedAwards, missingAwards } from '../derive';
import { done, NOW, owned, PROFILE, QUESTS, snapshot, T1, T2, T3, T4, WORLD } from './fixtures';

/**
 * F-STORY-006 §3.6 M5: reconcile runs after a merge, never before, and is a
 * monotone function of the snapshot. Together with the card union of the
 * merge that gives reconcile(merge(a, b)) ⊇ merge(reconcile(a), reconcile(b)).
 * Seeded, so a failure names a reproducible seed.
 */
const TIMES = [T1, T2, T3, T4];
const CARD_IDS = WORLD.cards.map((c) => c.id);
const RUNS = 300;
const MERGE = { now: new Date(NOW) };

const pick = <T,>(rand: () => number, from: readonly T[]): T => from[Math.floor(rand() * from.length)] as T;

function randomSnapshot(rand: () => number): ProgressSnapshot {
  const quests = QUESTS.filter(() => rand() < 0.6).map((q) => done(q.id, pick(rand, [0, 1, 2, 3] as const), rand() < 0.8 ? pick(rand, TIMES) : null));
  const cards = CARD_IDS.filter(() => rand() < 0.2).map((id) => owned(id, pick(rand, TIMES), rand() < 0.5));
  return snapshot({ quests, cards });
}

const reconcile = (s: ProgressSnapshot): ProgressSnapshot => applyAwards(s, missingAwards(WORLD, s, PROFILE), NOW);
const cardIds = (s: ProgressSnapshot): Set<string> => new Set(s.cards.map((c) => c.cardId));

describe('reconcile and merge (F-STORY-006 §3.6 M5)', () => {
  it('reconcile(merge(a, b)) holds every card of merge(reconcile(a), reconcile(b))', () => {
    for (let seed = 1; seed <= RUNS; seed += 1) {
      const rand = seededRandom(seed);
      const a = randomSnapshot(rand);
      const b = randomSnapshot(rand);
      const left = cardIds(reconcile(mergeSnapshots(a, b, MERGE)));
      const right = cardIds(mergeSnapshots(reconcile(a), reconcile(b), MERGE));
      for (const id of right) expect(left.has(id), `seed ${seed}: ${id}`).toBe(true);
    }
  });

  it('reconcile is monotone: a snapshot with more finished quests derives a superset of cards', () => {
    for (let seed = 1; seed <= RUNS; seed += 1) {
      const rand = seededRandom(seed);
      const a = randomSnapshot(rand);
      const more = mergeSnapshots(a, randomSnapshot(rand), MERGE);
      const small = new Set(derivedAwards(WORLD, a, PROFILE).map((x) => x.cardId));
      const big = new Set(derivedAwards(WORLD, more, PROFILE).map((x) => x.cardId));
      for (const id of small) expect(big.has(id), `seed ${seed}: ${id}`).toBe(true);
    }
  });

  it('reconcile never removes a card and is idempotent', () => {
    for (let seed = 1; seed <= RUNS; seed += 1) {
      const s = randomSnapshot(seededRandom(seed));
      const once = reconcile(s);
      for (const c of s.cards) expect(once.cards, `seed ${seed}`).toContainEqual(c);
      expect(reconcile(once), `seed ${seed}`).toBe(once);
    }
  });

  it('two devices that reconcile the same progress merge to one entry per card with the same time', () => {
    for (let seed = 1; seed <= RUNS; seed += 1) {
      const s = randomSnapshot(seededRandom(seed));
      const a = reconcile({ ...s, profileId: 'device:a' });
      const b = reconcile({ ...s, profileId: 'device:b' });
      const merged = mergeSnapshots(a, b, MERGE);
      expect(merged.cards.length, `seed ${seed}`).toBe(new Set(merged.cards.map((c) => c.cardId)).size);
      expect(merged.cards, `seed ${seed}`).toEqual([...a.cards].sort((x, y) => x.cardId.localeCompare(y.cardId)));
    }
  });
});

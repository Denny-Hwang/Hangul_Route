import { describe, expect, it } from 'vitest';
import { tallyAnswer, EMPTY_TALLY } from '../../first-try';
import { shouldUnlockCard } from '../../reward';
import { accuracy, starsForAccuracy } from '../../score';

/**
 * Fairness table of F-STORY-003 §3.2. A story quest scores one round per
 * check, one per sequence slot (4) and one per reader checkpoint; the star
 * thresholds are the global ones and a card needs 2 stars.
 */
const SLOTS = 4;
const MIN_CHECKS = 3;
const MIN_ROUNDS = MIN_CHECKS + SLOTS;

const starsWithMisses = (rounds: number, misses: number): 0 | 1 | 2 | 3 =>
  starsForAccuracy(rounds - misses, rounds);

describe('story quest scoring (F-STORY-003 §3.2)', () => {
  it('a story quest scores at least 7 rounds (3 checks + 4 slots)', () => {
    expect(MIN_ROUNDS).toBe(7);
  });

  it.each([
    // [rounds, most first-try misses that still keep the card]
    [7, 2],
    [9, 3], // 2 checkpoints
    [10, 4],
  ])('%i rounds: %i first-try misses still keep the card, one more does not', (rounds, allowed) => {
    expect(shouldUnlockCard(starsWithMisses(rounds, allowed))).toBe(true);
    expect(accuracy(rounds - allowed, rounds)).toBeGreaterThanOrEqual(0.6);
    expect(shouldUnlockCard(starsWithMisses(rounds, allowed + 1))).toBe(false);
  });

  it('3 stars needs no first-try miss while there are fewer than 20 rounds', () => {
    for (let rounds = MIN_ROUNDS; rounds < 20; rounds += 1) {
      expect(starsWithMisses(rounds, 0), String(rounds)).toBe(3);
      expect(starsWithMisses(rounds, 1), String(rounds)).toBe(2);
    }
    expect(starsWithMisses(20, 1)).toBe(3);
  });

  it('one slip in the smallest quest still yields 2 stars and the card', () => {
    const stars = starsWithMisses(MIN_ROUNDS, 1);
    expect(stars).toBe(2);
    expect(shouldUnlockCard(stars)).toBe(true);
  });

  it('retries never change the score: tapping three options on one item loses at most that round', () => {
    let tally = EMPTY_TALLY;
    for (const correct of [false, false, false, true]) tally = tallyAnswer(tally, '1:check:c1', correct);
    for (let i = 0; i < MIN_ROUNDS - 1; i += 1) tally = tallyAnswer(tally, `k${i}`, true);
    expect(tally.total).toBe(MIN_ROUNDS);
    expect(tally.correct).toBe(MIN_ROUNDS - 1);
    expect(tally.retries).toBe(3);
    expect(shouldUnlockCard(starsForAccuracy(tally.correct, tally.total))).toBe(true);
  });
});

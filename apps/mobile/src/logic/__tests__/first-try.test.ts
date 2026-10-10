import { describe, expect, it } from 'vitest';
import { EMPTY_TALLY, tallyAnswer, type RoundTally } from '../first-try';
import { starsForAccuracy } from '../score';
import { shouldUnlockCard } from '../reward';

const play = (answers: Array<[string, boolean]>): RoundTally =>
  answers.reduce((t, [key, correct]) => tallyAnswer(t, key, correct), EMPTY_TALLY);

describe('tallyAnswer — first-try round scoring (F-001 §3.2, F-003 §3.2)', () => {
  it('starts empty', () => {
    expect(EMPTY_TALLY).toEqual({ correct: 0, total: 0, retries: 0, scored: [] });
  });

  it('a right first answer scores one correct round', () => {
    expect(play([['r0', true]])).toEqual({ correct: 1, total: 1, retries: 0, scored: ['r0'] });
  });

  it('a wrong first answer scores one missed round', () => {
    expect(play([['r0', false]])).toEqual({ correct: 0, total: 1, retries: 0, scored: ['r0'] });
  });

  it('wrong-then-right is one missed round plus one retry, never two rounds', () => {
    expect(play([['r0', false], ['r0', true]])).toEqual({
      correct: 0,
      total: 1,
      retries: 1,
      scored: ['r0'],
    });
  });

  it('extra wrong taps in a round only add retries, never rounds', () => {
    const t = play([
      ['r0', false],
      ['r0', false],
      ['r0', false],
      ['r0', false],
      ['r0', true],
    ]);
    expect(t.total).toBe(1);
    expect(t.correct).toBe(0);
    expect(t.retries).toBe(4);
  });

  it('rounds can be answered out of order (card-match pairs)', () => {
    const t = play([
      ['pair-0', false],
      ['pair-1', true],
      ['pair-0', true],
      ['pair-2', true],
    ]);
    expect(t).toEqual({ correct: 2, total: 3, retries: 1, scored: ['pair-0', 'pair-1', 'pair-2'] });
  });

  it('does not mutate the tally it is given', () => {
    const before = play([['r0', true]]);
    const snapshot = JSON.parse(JSON.stringify(before)) as RoundTally;
    tallyAnswer(before, 'r1', false);
    tallyAnswer(before, 'r0', false);
    expect(before).toEqual(snapshot);
  });

  // Audit UX-02: four mis-taps used to sink a 4-round game to 4/8 → 1 star → no card.
  it('a single shaky round no longer costs the card', () => {
    const t = play([
      ['r0', true],
      ['r1', false],
      ['r1', false],
      ['r1', false],
      ['r1', false],
      ['r1', true],
      ['r2', true],
      ['r3', true],
    ]);
    expect(t.correct).toBe(3);
    expect(t.total).toBe(4);
    const stars = starsForAccuracy(t.correct, t.total);
    expect(stars).toBe(2);
    expect(shouldUnlockCard(stars)).toBe(true);
  });

  it('a perfect first-try run stays three stars whatever the retries elsewhere', () => {
    const t = play([
      ['r0', true],
      ['r1', true],
      ['r2', true],
      ['r3', true],
      ['r4', true],
    ]);
    expect(starsForAccuracy(t.correct, t.total)).toBe(3);
  });
});

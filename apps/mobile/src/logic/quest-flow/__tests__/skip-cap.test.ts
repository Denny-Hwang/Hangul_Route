import { describe, expect, it } from 'vitest';
import { questOutcome } from '../../quest-outcome';
import { skipStarCap, skippableGameSteps } from '../skip-cap';

/** [AU] AMENDMENTS-AUDIT-2026-11 row AU-9: skipping a game caps the stars. */
const steps = [
  { kind: 'intro' },
  { kind: 'discover' },
  { kind: 'practice', minigameKind: 'listen-pick', minigameRef: 'minigame:a' },
  { kind: 'apply', minigameKind: 'build-letter', minigameRef: 'minigame:b' },
  { kind: 'check', minigameKind: 'listen-pick', minigameRef: 'minigame:c' },
  { kind: 'reward' },
] as const;

describe('skippableGameSteps', () => {
  it('names every game step but the Check (the Check has no Skip)', () => {
    expect(skippableGameSteps(steps)).toEqual([2, 3]);
  });

  it('the story reader is not a game (F-STORY-002 D3: no score on reading): skipping it never caps', () => {
    const story = [
      { kind: 'intro' },
      { kind: 'practice', minigameKind: 'story-read', minigameRef: 'minigame:read' },
      { kind: 'practice', minigameKind: 'story-check', minigameRef: 'minigame:check' },
      { kind: 'apply', minigameKind: 'story-sequence', minigameRef: 'minigame:order' },
      { kind: 'reward' },
    ] as const;
    expect(skippableGameSteps(story)).toEqual([2, 3]);
    expect(skipStarCap(story, [1])).toBe(3);
    expect(skipStarCap(story, [1, 2])).toBe(2);
    expect(skipStarCap(story, [1, 2, 3])).toBe(1);
  });

  it('a step with no game is not a game step', () => {
    expect(skippableGameSteps([{ kind: 'practice' }, { kind: 'practice', minigameKind: 'listen-pick' }])).toEqual([]);
  });
});

describe('a contrast step (AMENDMENTS-MINIMAL-PAIRS section 3.8, row MP-2b)', () => {
  const withContrast = [
    { kind: 'intro' },
    { kind: 'discover' },
    { kind: 'practice', minigameKind: 'match-sound', minigameRef: 'minigame:a' },
    { kind: 'practice', minigameKind: 'listen-pick', minigameRef: 'minigame:pairs', contrast: true },
    { kind: 'apply', minigameKind: 'culture-quiz', minigameRef: 'minigame:b' },
    { kind: 'check', minigameKind: 'listen-pick', minigameRef: 'minigame:c' },
    { kind: 'reward' },
  ] as const;

  it('is not a skippable game step: only the practice and the apply game are', () => {
    expect(skippableGameSteps(withContrast)).toEqual([2, 4]);
  });

  it('skipping it never caps the stars; skipping both scored games caps at 1, one of them at 2', () => {
    expect(skipStarCap(withContrast, [3])).toBe(3);
    expect(skipStarCap(withContrast, [2])).toBe(2);
    expect(skipStarCap(withContrast, [2, 3])).toBe(2);
    expect(skipStarCap(withContrast, [2, 3, 4])).toBe(1);
    expect(skipStarCap(withContrast, [2, 4])).toBe(1);
  });
});

describe('skipStarCap', () => {
  it('no skip: no cap', () => {
    expect(skipStarCap(steps, [])).toBe(3);
  });

  it('any game step skipped: at most 2 stars', () => {
    expect(skipStarCap(steps, [2])).toBe(2);
    expect(skipStarCap(steps, [3])).toBe(2);
  });

  it('every game step skipped: at most 1 star', () => {
    expect(skipStarCap(steps, [2, 3])).toBe(1);
    expect(skipStarCap(steps, [3, 2, 3])).toBe(1);
  });

  it("an index that is not one of the quest's game steps never caps (the Check, a narrative step, a stale index)", () => {
    expect(skipStarCap(steps, [0, 4, 5, 9])).toBe(3);
    expect(skipStarCap(steps, [4, 2])).toBe(2);
  });

  it('a quest with one game step: skipping it is skipping them all', () => {
    const one = [
      { kind: 'practice', minigameKind: 'card-match', minigameRef: 'minigame:x' },
      { kind: 'check', minigameKind: 'listen-pick', minigameRef: 'minigame:y' },
    ] as const;
    expect(skipStarCap(one, [0])).toBe(1);
  });
});

describe('questOutcome with a cap', () => {
  it('a perfect run with one skip is 2 stars, with every game skipped 1 star', () => {
    expect(questOutcome(6, 6, 2)).toEqual({ stars: 2, correct: 6, total: 6, played: true });
    expect(questOutcome(2, 2, 1)).toEqual({ stars: 1, correct: 2, total: 2, played: true });
  });

  it('the cap never raises stars, and a run that played nothing stays 0 / 0', () => {
    expect(questOutcome(1, 5, 2).stars).toBe(1);
    expect(questOutcome(0, 2, 1).stars).toBe(0);
    expect(questOutcome(0, 0, 1)).toEqual({ stars: 0, correct: 0, total: 0, played: false });
  });
});

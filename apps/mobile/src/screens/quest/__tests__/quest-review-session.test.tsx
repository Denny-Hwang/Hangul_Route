import { getMessages } from '@hangul-route/i18n';
import React from 'react';
import { act, type ReactTestInstance } from 'react-test-renderer';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PickRound, QuestReviewPlan } from '../../../logic/reviews/quest-review-session';
import { useProgressStore } from '../../../store/progress-store';
import { buttonsNamed, byTestId, press, render, screenTexts } from '../../../test-support/render';
import { QuestReviewSession, TryAgainOffer } from '../quest-review-chunk';

/**
 * F-CURR-002 section 4.5 (row CM-15): the warm-up and Try these again sessions. Pick rounds with the amber nudge
 * on a first-try miss (never red, never a count), the warm-up's soft "Warmed up" with nothing scored, Try these
 * again's stars; the answers go to the memory store, one `reviews[]` entry a day, `review.start` and
 * `review.complete` with counts only.
 */

(globalThis as { __DEV__?: boolean }).__DEV__ = false;

const calls = vi.hoisted(() => ({ recorded: [] as Array<{ profileId: string; answers: unknown[] }>, events: [] as Array<{ name: string; payload?: unknown }>, played: [] as string[] }));
vi.mock('../../../logic/memory/boot', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  questReviewPlanner: async () => ({ credited: (_plan: unknown, answers: unknown[]) => answers }),
  recordAnswers: async (profileId: string, answers: unknown[]) => {
    calls.recorded.push({ profileId, answers });
  },
}));
vi.mock('../../../platform/telemetry', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  track: vi.fn(async (event: { name: string; payload?: unknown }) => {
    calls.events.push(event);
  }),
}));
vi.mock('../../../platform/audio', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  playPrompt: vi.fn(async (spec: { text: string }) => {
    calls.played.push(spec.text);
    return 'played';
  }),
  stop: vi.fn(),
}));

const M = getMessages('en');
const A11Y = M.a11y.minigame.option;
const PROFILE = 'profile:mina';
const TODAY = '2026-11-10';

const seeMeaning: PickRound = {
  key: 'warmup:0:lex:mul',
  itemId: 'lex:mul',
  rung: 'read',
  instruction: 'seeMeaning',
  mode: 'see',
  ko: '물',
  romanization: 'mul',
  showRomanization: true,
  options: [
    { id: 'lex:bap', label: 'rice' },
    { id: 'lex:mul', label: 'water' },
    { id: 'lex:cha', label: 'tea' },
  ],
  answerId: 'lex:mul',
};
const hearPick: PickRound = {
  key: 'warmup:1:lex:bae',
  itemId: 'lex:bae',
  rung: 'recognize',
  instruction: 'hearPick',
  mode: 'hear',
  ko: '배',
  romanization: 'bae',
  showRomanization: false,
  options: [
    { id: 'lex:bae', ko: '배', romanization: 'bae' },
    { id: 'lex:bam', ko: '밤', romanization: 'bam' },
    { id: 'lex:bal', ko: '발', romanization: 'bal' },
  ],
  answerId: 'lex:bae',
};

const planOf = (kind: QuestReviewPlan['kind'], rounds: PickRound[]): QuestReviewPlan => ({
  kind,
  rounds,
  soundNotice: false,
  ctx: { index: { items: [], byId: new Map(), retired: new Set() }, states: {}, today: TODAY, voice: true },
});

const settle = async (ms = 0): Promise<void> => {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, ms));
  });
};
const tappable = (root: ReactTestInstance, id: string): ReactTestInstance => {
  const node = byTestId(root, id).find((n) => typeof n.props.onClick === 'function');
  if (!node) throw new Error(`no pressable ${id}`);
  return node;
};
const label = (root: ReactTestInstance, id: string): string => String(tappable(root, id).props['aria-label']);

/**
 * Nothing on a review screen reads as a score: no percentage, no "n of m", no "n / m". The shipped star row's own
 * name ("3 of 3 stars earned") is the stars, which F-RVW-001 section 3.1 shows on every result.
 */
function expectNoScore(root: ReactTestInstance): void {
  for (const text of screenTexts(root)) {
    if (/stars? earned$/.test(text)) continue;
    expect(text).not.toMatch(/%|\d+\s*\/\s*\d+|\bof\s+\d+\b/);
  }
}

beforeEach(() => {
  calls.recorded.length = 0;
  calls.events.length = 0;
  calls.played.length = 0;
  useProgressStore.setState({ byProfile: {} });
});

describe('the warm-up session', () => {
  it('a first-try miss is the amber nudge with the right one shown; the round stays open until it is tapped', async () => {
    const r = await render(<QuestReviewSession plan={planOf('warmup', [seeMeaning, hearPick])} profileId={PROFILE} onDone={() => undefined} />);
    expect(screenTexts(r.root)).toContain(M.learner.warmUp.intro);
    expect(screenTexts(r.root)).toContain(M.learner.warmUp.pill);
    expect(screenTexts(r.root)).toContain(M.learner.minigame.cultureQuiz.heading);
    expectNoScore(r.root);
    await press(tappable(r.root, 'quest-review-option-lex:bap'));
    expect(label(r.root, 'quest-review-option-lex:bap')).toBe(A11Y.wrong('rice'));
    expect(label(r.root, 'quest-review-option-lex:mul')).toBe(A11Y.hint('water'));
    expect(screenTexts(r.root)).toContain(M.learner.minigame.picWord.missHoya);
    expectNoScore(r.root);
    await press(tappable(r.root, 'quest-review-option-lex:mul'));
    expect(label(r.root, 'quest-review-option-lex:mul')).toBe(A11Y.correct('water'));
    await settle(400);
    // Round 2 is heard: a speaker and Hear it again, and the Korean is not printed while it is asked.
    expect(byTestId(r.root, 'quest-review-speaker')).not.toHaveLength(0);
    expect(byTestId(r.root, 'quest-review-prompt-text')).toHaveLength(0);
    expect(screenTexts(r.root)).toContain(M.learner.placement.instruction.hearPickWritten);
  });

  it('ends on a soft Warmed up with nothing scored, records the first tries, one entry for the day and review.complete', async () => {
    const done = vi.fn();
    const r = await render(<QuestReviewSession plan={planOf('warmup', [seeMeaning, hearPick])} profileId={PROFILE} onDone={done} />);
    expect(calls.events).toEqual([{ name: 'review.start', profileId: PROFILE, payload: { kind: 'warmup', items: 2 } }]);
    await press(tappable(r.root, 'quest-review-option-lex:cha'));
    await press(tappable(r.root, 'quest-review-option-lex:mul'));
    await settle(400);
    await press(tappable(r.root, 'quest-review-option-lex:bae'));
    await settle(400);
    expect(byTestId(r.root, 'quest-warmup-done')).not.toHaveLength(0);
    expect(screenTexts(r.root)).toContain(M.learner.warmUp.done);
    // Nothing scored: no stars on the warm-up.
    expect(screenTexts(r.root).some((t) => /star/i.test(t))).toBe(false);
    await settle();
    expect(calls.recorded).toEqual([
      {
        profileId: PROFILE,
        answers: [
          { itemId: 'lex:mul', correct: false, rung: 'read' },
          { itemId: 'lex:bae', correct: true, rung: 'recognize' },
        ],
      },
    ]);
    expect(useProgressStore.getState().byProfile[PROFILE]?.reviews).toEqual([
      expect.objectContaining({ id: `warmup:${TODAY}`, kind: 'warmup', scope: TODAY, itemIds: ['lex:mul', 'lex:bae'] }),
    ]);
    expect(useProgressStore.getState().byProfile[PROFILE]?.reviews[0]).not.toHaveProperty('resultStars');
    expect(calls.events.at(-1)).toEqual({ name: 'review.complete', profileId: PROFILE, payload: { kind: 'warmup', items: 2, retries: 1 } });
    await press(tappable(r.root, 'quest-review-done'));
    expect(done).toHaveBeenCalledTimes(1);
  });

  it('Skip warm-up keeps what was answered, writes no entry and sends no review.complete', async () => {
    const done = vi.fn();
    const r = await render(<QuestReviewSession plan={planOf('warmup', [seeMeaning, hearPick])} profileId={PROFILE} onDone={done} />);
    await press(tappable(r.root, 'quest-review-option-lex:mul'));
    await press(tappable(r.root, 'quest-review-leave'));
    await settle();
    expect(done).toHaveBeenCalledTimes(1);
    expect(calls.recorded).toEqual([{ profileId: PROFILE, answers: [{ itemId: 'lex:mul', correct: true, rung: 'read' }] }]);
    expect(useProgressStore.getState().byProfile[PROFILE]?.reviews ?? []).toEqual([]);
    expect(calls.events.map((e) => e.name)).toEqual(['review.start']);
  });
});

describe('Try these again', () => {
  it('ends on stars only, as `feedback` for the day, and See results goes on', async () => {
    const done = vi.fn();
    const again = planOf('again', [{ ...seeMeaning, key: 'again:0:lex:mul' }]);
    const r = await render(<QuestReviewSession plan={again} profileId={PROFILE} onDone={done} />);
    expect(screenTexts(r.root)).toContain(M.learner.tryAgain.intro);
    expect(screenTexts(r.root)).toContain(M.learner.quest.seeResults.cta);
    await press(tappable(r.root, 'quest-review-option-lex:mul'));
    await settle(400);
    expect(byTestId(r.root, 'quest-try-again-done')).not.toHaveLength(0);
    expect(screenTexts(r.root)).toContain(M.learner.stageReview.result.headline.three);
    expect(screenTexts(r.root)).toContain(M.a11y.stars(3));
    expectNoScore(r.root);
    expect(useProgressStore.getState().byProfile[PROFILE]?.reviews).toEqual([
      expect.objectContaining({ id: `feedback:${TODAY}`, kind: 'feedback', resultStars: 3, missedItemIds: [] }),
    ]);
    expect(calls.events.at(-1)).toEqual({ name: 'review.complete', profileId: PROFILE, payload: { kind: 'feedback', items: 1, retries: 0, stars: 3 } });
    await press(tappable(r.root, 'quest-review-done'));
    expect(done).toHaveBeenCalledTimes(1);
  });

  it('a miss still ends on at least one star, never zero', async () => {
    const again = planOf('again', [{ ...seeMeaning, key: 'again:0:lex:mul' }]);
    const r = await render(<QuestReviewSession plan={again} profileId={PROFILE} onDone={() => undefined} />);
    await press(tappable(r.root, 'quest-review-option-lex:cha'));
    await press(tappable(r.root, 'quest-review-option-lex:mul'));
    await settle(400);
    expect(screenTexts(r.root)).toContain(M.a11y.stars(1));
    expect(screenTexts(r.root)).toContain(M.learner.stageReview.result.headline.one);
  });
});

describe('the reward step offer', () => {
  it('Try these again is the one primary and See results stays right under it', async () => {
    const onTry = vi.fn();
    const onSeeResults = vi.fn();
    const r = await render(<TryAgainOffer onTry={onTry} onSeeResults={onSeeResults} />);
    expect(screenTexts(r.root)).toContain(M.learner.tryAgain.intro);
    await press(buttonsNamed(r.root, M.learner.tryAgain.cta)[0]!);
    await press(buttonsNamed(r.root, M.learner.quest.seeResults.cta)[0]!);
    expect(onTry).toHaveBeenCalledTimes(1);
    expect(onSeeResults).toHaveBeenCalledTimes(1);
  });
});


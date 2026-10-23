import { CATALOG, CURR_TELEMETRY_PAYLOADS, ReviewEntrySchema } from '@hangul-route/content-schema';
import { lintReviewMessages } from '@hangul-route/content-schema/lint';
import { FORMAT_RUNG } from '@hangul-route/content-schema/review-items';
import { bannedWordsFor, getMessages } from '@hangul-route/i18n';
import { describe, expect, it } from 'vitest';
import { INDEX } from '../../memory/__tests__/fixtures';
import {
  CELL_CHECK_MIN_ROUNDS,
  CELL_CHECK_SIZE,
  cellCheckCompleteEvent,
  cellCheckEntry,
  cellCheckItemIds,
  cellCheckStartEvent,
  checkAnswers,
  checkLatch,
  checkResult,
  planCellCheck,
  testOutFinishedEvent,
} from '../cell-check';
import type { RoundAnswer } from '../daily-review';
import { MAX_FORMAT_RUN, type EngineContext } from '../engine';
import { glossFrom, surfaceIndex } from '../review-rounds';

/**
 * F-CURR-002 sections 4.4, 4.5 and 11.3 (row CM-21): the Cell Check's plan from the shipped review items (8-10 rounds of
 * the cell's own items, at least 30% at produce, interleaved), its result (stars only; 80% first try passes), the
 * entry, the latches and the telemetry.
 */

const TODAY = '2026-10-22';
const ctx = (voice = true, states: EngineContext['states'] = {}): EngineContext => ({ index: surfaceIndex(INDEX), states, today: TODAY, voice, seed: 'p1|2026-10-22' });
const rounds = { gloss: glossFrom(undefined), seed: 's' };
const answersOf = (n: number, right: number): Map<number, RoundAnswer> => new Map(Array.from({ length: n }, (_, i) => [i, { correct: i < right }]));

describe('the plan: the cell items, at least 30% at produce, interleaved', () => {
  const lessonCells = CATALOG.cells.filter((c) => /^episode:stage[1-7]-/.test(c.episodeId)).map((c) => c.episodeId);

  it('every cell with enough playable items gets 5 to 10 rounds, all from the cell, with ceil(0.3 x rounds) at produce where the cell allows it', () => {
    let planned = 0;
    for (const cellId of lessonCells) {
      for (const voice of [true, false]) {
        const plan = planCellCheck(ctx(voice), cellId, 'check', rounds);
        if (plan === null) continue;
        planned += 1;
        expect(plan.rounds.length, cellId).toBeGreaterThanOrEqual(CELL_CHECK_MIN_ROUNDS);
        expect(plan.rounds.length, cellId).toBeLessThanOrEqual(CELL_CHECK_SIZE);
        const ids = new Set(cellCheckItemIds(ctx().index, cellId));
        for (const r of plan.rounds) expect(ids.has(r.question.itemId), `${cellId} ${r.question.itemId}`).toBe(true);
        // No item twice.
        expect(new Set(plan.rounds.map((r) => r.question.itemId)).size).toBe(plan.rounds.length);
        const produce = plan.rounds.filter((r) => r.question.rung === 'produce').length;
        const canProduce = [...ids].filter((id) => ctx(voice).index.byId.get(id)?.formats.some((f) => FORMAT_RUNG[f] === 'produce')).length;
        expect(produce, cellId).toBeGreaterThanOrEqual(Math.min(Math.ceil(0.3 * plan.rounds.length), canProduce));
        // Interleaving: no more than 3 in a row of one format while the pool allows it (the theme cap is off: one
        // theme). A longer run is only the tail, once every round left can be asked that one way only.
        let run = 1;
        for (let i = 1; i < plan.rounds.length; i += 1) {
          const format = plan.rounds[i]?.question.format;
          run = format === plan.rounds[i - 1]?.question.format ? run + 1 : 1;
          if (run > MAX_FORMAT_RUN) expect(plan.rounds.slice(i).every((r) => r.question.format === format), `${cellId} format run`).toBe(true);
        }
      }
    }
    expect(planned).toBeGreaterThan(30);
  });

  it('10 rounds on a cell with many items; a cell whose items cannot make 5 rounds has no Check (Stage 5 books teach none)', () => {
    expect(planCellCheck(ctx(), 'episode:stage2-letters', 'check', rounds)?.rounds).toHaveLength(10);
    expect(planCellCheck(ctx(), 'episode:stage5-life', 'testout', rounds)).toBeNull();
    // A cell whose items are mostly topic words asks them too (12 of Stage 2 Nature's 14).
    expect(planCellCheck(ctx(), 'episode:stage2-nature', 'testout', rounds)?.rounds.some((r) => r.question.itemId.startsWith('vocab:'))).toBe(true);
  });

  it('a test-out asks unmet items (no state at all); the same seed gives the same plan', () => {
    const a = planCellCheck(ctx(), 'episode:stage3-life', 'testout', rounds);
    const b = planCellCheck(ctx(), 'episode:stage3-life', 'testout', rounds);
    expect(a).not.toBeNull();
    expect(a?.mode).toBe('testout');
    expect(a?.rounds.map((r) => r.question.itemId)).toEqual(b?.rounds.map((r) => r.question.itemId));
  });

  it('box first: an item at box 1 is asked before one held at box 4', () => {
    const ids = cellCheckItemIds(ctx().index, 'episode:stage3-life');
    const st = (b: number) => ({ st: { b, d: '2026-11-01', c: 1, r: 1, n: 2, f: '2026-10-01', s: b, at: '2026-10-01T00:00:00.000Z' } });
    const states = Object.fromEntries(ids.map((id, i) => [id, st(i === ids.length - 1 ? 1 : 4)]));
    const plan = planCellCheck(ctx(true, states), 'episode:stage3-life', 'check', rounds);
    expect(plan?.rounds.map((r) => r.question.itemId)).toContain(ids[ids.length - 1]);
  });

  it('an item that cannot be played is left out from the start (`exclude`)', () => {
    const plan = planCellCheck(ctx(), 'episode:stage3-life', 'check', rounds) ;
    const first = plan?.rounds[0]?.question.itemId as string;
    const again = planCellCheck(ctx(), 'episode:stage3-life', 'check', rounds, new Set([first]));
    expect(again?.rounds.map((r) => r.question.itemId)).not.toContain(first);
  });
});

describe('the result: stars only, 80% first try passes', () => {
  const plan = planCellCheck(ctx(), 'episode:stage2-letters', 'check', rounds);
  const rs = plan?.rounds ?? [];

  it('8 of 10 right first try is 3 stars and a pass; 7 is 2 stars and not; a hinted answer is not right', () => {
    expect(checkResult(rs, answersOf(10, 8))).toMatchObject({ stars: 3, passed: true, firstTryCorrect: 8 });
    expect(checkResult(rs, answersOf(10, 7))).toMatchObject({ stars: 2, passed: false, firstTryCorrect: 7 });
    expect(checkResult(rs, answersOf(10, 4))).toMatchObject({ stars: 1, passed: false });
    const hinted = answersOf(10, 10);
    hinted.set(0, { correct: true, hinted: true });
    hinted.set(1, { correct: true, hinted: true });
    hinted.set(2, { correct: true, hinted: true });
    expect(checkResult(rs, hinted)).toMatchObject({ stars: 2, passed: false, firstTryCorrect: 7 });
  });

  it('a Check not finished (a round unanswered) never passes', () => {
    const partial = answersOf(9, 9);
    expect(checkResult(rs, partial)).toMatchObject({ stars: 3, passed: false });
  });

  it('the answers in round order, as the memory store records them', () => {
    const answers = checkAnswers(rs, answersOf(10, 8));
    expect(answers).toHaveLength(10);
    expect(answers[0]).toEqual({ itemId: rs[0]?.question.itemId, rung: rs[0]?.question.rung, correct: true });
    expect(answers[9]?.correct).toBe(false);
  });

  it('the latch: a passed Cell Check latches cellCheckAt; a passed test-out testedOut only; anything else nothing', () => {
    expect(checkLatch('check', { passed: true })).toBe('cellCheckAt');
    expect(checkLatch('testout', { passed: true })).toBe('testedOut');
    expect(checkLatch('check', { passed: false })).toBeNull();
    expect(checkLatch('testout', { passed: false })).toBeNull();
  });
});

describe('the entry and the telemetry (section 11.3)', () => {
  const result = { stars: 3 as const, itemIds: ['lex:a', 'lex:b'], missedItemIds: ['lex:b'], firstTryCorrect: 1, passed: false };

  it('one cell-check entry, scope the cell, a random id with no profile id, that parses', () => {
    const entry = cellCheckEntry({ cellId: 'episode:stage2-life', result, day: TODAY, now: new Date('2026-10-22T10:00:00.000Z'), nonce: 'k3' });
    expect(entry).toEqual({ id: 'cell-check:2026-10-22:k3', kind: 'cell-check', generatedAt: '2026-10-22T10:00:00.000Z', scope: 'episode:stage2-life', itemIds: ['lex:a', 'lex:b'], resultStars: 3, missedItemIds: ['lex:b'] });
    expect(ReviewEntrySchema.parse(entry)).toEqual(entry);
  });

  it('review.start and review.complete carry the kind and the stars only; testout.finished parses', () => {
    expect(cellCheckStartEvent('p1')).toEqual({ name: 'review.start', profileId: 'p1', payload: { kind: 'cell-check' } });
    expect(cellCheckCompleteEvent('p1', 2)).toEqual({ name: 'review.complete', profileId: 'p1', payload: { kind: 'cell-check', stars: 2 } });
    const finished = testOutFinishedEvent('p1', 'episode:stage2-life', { passed: true, itemIds: Array.from({ length: 10 }, (_, i) => `lex:${i}`), firstTryCorrect: 9 });
    expect(finished).toEqual({ name: 'testout.finished', profileId: 'p1', payload: { cellId: 'episode:stage2-life', passed: true, items: 10, firstTryCorrect: 9 } });
    expect(CURR_TELEMETRY_PAYLOADS['testout.finished'].safeParse(finished?.payload).success).toBe(true);
    // A cell id the schema does not take is never sent.
    expect(testOutFinishedEvent('p1', 'episode:pack-numbers-s2', result)).toBeNull();
  });
});

describe('the strings (section 7.7, section 9.3 review-copy)', () => {
  it.each(['en', 'es', 'ko'] as const)('%s: pass review-copy and the anti-shame list: no score, no exam framing, no failure word', (locale) => {
    const m = getMessages(locale);
    expect(lintReviewMessages(m.learner, ['cellCheck', 'testOut'], locale)).toEqual([]);
    const texts = [...Object.values(m.learner.cellCheck).flatMap((v) => (typeof v === 'string' ? [v] : Object.values(v))), ...Object.values(m.learner.testOut)];
    // 21 from CM-21, and the stage header's tested-out caption from CM-22 (`testOut.stageHint`).
    expect(texts.length).toBe(22);
    for (const text of texts) {
      expect(text.trim().length, text).toBeGreaterThan(0);
      expect(text, text).not.toMatch(/%|\bexam|\bquiz|\bscore|\bpass(ed)?\b|\bfail|examen|prueba|puntaje|시험|점수|통과|실패|탈락/i);
      for (const word of bannedWordsFor(locale, 'learner')) expect(text.toLowerCase(), `${text} has ${word}`).not.toContain(word.toLowerCase());
    }
    // "Test out" is the spec's name for the way in (section 4.5); no other string frames the check as a test.
    expect(texts.filter((t) => /\btest/i.test(t))).toEqual(
      locale === 'en' ? ['Test out', 'You tested out!', 'Tested out', 'Play the quests you tested out of to finish this stage.'] : [],
    );
  });
});

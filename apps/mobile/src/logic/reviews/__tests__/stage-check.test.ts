import { ReviewEntrySchema, type StageKey } from '@hangul-route/content-schema';
import { lintReviewMessages } from '@hangul-route/content-schema/lint';
import { FORMAT_RUNG } from '@hangul-route/content-schema/review-items';
import { bannedWordsFor, getMessages } from '@hangul-route/i18n';
import { describe, expect, it } from 'vitest';
import { episodesAll } from '../../../content';
import { INDEX } from '../../memory/__tests__/fixtures';
import { gridEpisodesOf } from '../../my-route/order';
import type { RoundAnswer } from '../daily-review';
import { MAX_THEME_RUN, type EngineContext } from '../engine';
import { glossFrom, surfaceIndex } from '../review-rounds';
import {
  STAGE_CHECK_MIN_ITEMS,
  STAGE_CHECK_SIZE,
  pauseAfter,
  pauseNumber,
  planStageCheck,
  shares,
  stageCheckCompleteEvent,
  stageCheckEntry,
  stageCheckItemIds,
  stageCheckResult,
  stageCheckStartEvent,
} from '../stage-check';

/**
 * F-CURR-002 sections 4.5, 7.3 and 11.3 (row CM-22): the Stage Check's plan from the shipped review items (about 20
 * rounds from every cell of the stage, at least 30% at produce, interleaved), its parts and pauses, its result (stars
 * only), the `stage-certificate` entry and the telemetry.
 */

const TODAY = '2026-10-22';
const ctx = (voice = true, states: EngineContext['states'] = {}): EngineContext => ({ index: surfaceIndex(INDEX), states, today: TODAY, voice, seed: 'p1|2026-10-22' });
const rounds = { gloss: glossFrom(undefined), seed: 's' };
const cellsOf = (stage: StageKey): string[] => gridEpisodesOf(episodesAll).filter((e) => e.stage === stage).map((e) => e.id);
const UPPER: StageKey[] = ['stage2', 'stage3', 'stage4', 'stage5', 'stage6', 'stage7'];
const answersOf = (n: number, right: number): Map<number, RoundAnswer> => new Map(Array.from({ length: n }, (_, i) => [i, { correct: i < right }]));
const themeOf = (cell: string): string => episodesAll.find((e) => e.id === cell)?.theme ?? '';

describe('shares: fair places over the cells', () => {
  it('splits 20 places evenly over five full cells, and gives a short cell its all, the rest to the others', () => {
    expect(shares([30, 30, 30, 30, 30], 20)).toEqual([4, 4, 4, 4, 4]);
    expect(shares([1, 30, 30, 30, 30], 20)).toEqual([1, 5, 5, 5, 4]);
    expect(shares([0, 2, 0, 3, 0], 20)).toEqual([0, 2, 0, 3, 0]);
    expect(shares([], 20)).toEqual([]);
  });
});

describe('the plan: items from all five themes, at least 30% at produce, interleaved', () => {
  it('every stage with enough playable items gets 10 to 20 rounds, from its own cells, each theme that teaches items in it', () => {
    let planned = 0;
    for (const stage of UPPER) {
      for (const voice of [true, false]) {
        const cells = cellsOf(stage);
        const plan = planStageCheck(ctx(voice), stage, cells, rounds);
        if (plan === null) continue;
        planned += 1;
        expect(plan.stage).toBe(stage);
        expect(plan.rounds.length, stage).toBeGreaterThanOrEqual(STAGE_CHECK_MIN_ITEMS);
        expect(plan.rounds.length, stage).toBeLessThanOrEqual(STAGE_CHECK_SIZE);
        const byCell = stageCheckItemIds(ctx().index, cells);
        const cellOfItem = new Map(byCell.flatMap((ids, i) => ids.map((id) => [id, cells[i] as string] as const)));
        for (const r of plan.rounds) expect(cellOfItem.has(r.question.itemId), `${stage} ${r.question.itemId}`).toBe(true);
        expect(new Set(plan.rounds.map((r) => r.question.itemId)).size).toBe(plan.rounds.length);
        // Every theme of the stage is in the check (each of the five cells teaches items).
        expect(new Set(plan.rounds.map((r) => themeOf(cellOfItem.get(r.question.itemId) as string))).size, stage).toBe(5);
        const produce = plan.rounds.filter((r) => r.question.rung === 'produce').length;
        const canProduce = plan.rounds.filter((r) => ctx(voice).index.byId.get(r.question.itemId)?.formats.some((f) => FORMAT_RUNG[f] === 'produce')).length;
        // Section 4.5: at least 30% at produce. Every stage that has a check reaches it with and without a device voice,
        // so the bound is pinned (6 of 20), never weakened by how many items can be produced.
        expect(canProduce, stage).toBeGreaterThanOrEqual(Math.ceil(0.3 * plan.rounds.length));
        expect(produce, stage).toBeGreaterThanOrEqual(Math.ceil(0.3 * plan.rounds.length));
        if (plan.rounds.length === STAGE_CHECK_SIZE) expect(produce, stage).toBeGreaterThanOrEqual(6);
      }
    }
    // Stages 2, 3, 4, 6 and 7, with and without a device voice; Stage 5 (the books) teaches no review items.
    expect(planned).toBe(10);
    expect(planStageCheck(ctx(), 'stage5', cellsOf('stage5'), rounds)).toBeNull();
  });

  it('Stage 2 asks 20 rounds from all five themes, no more than 2 in a row from one theme where the pool allows it', () => {
    const plan = planStageCheck(ctx(), 'stage2', cellsOf('stage2'), rounds);
    expect(plan?.rounds).toHaveLength(20);
    const themes = (plan?.rounds ?? []).map((r) => r.question.theme);
    expect(new Set(themes).size).toBe(5);
    let run = 1;
    for (let i = 1; i < themes.length; i += 1) {
      run = themes[i] === themes[i - 1] ? run + 1 : 1;
      if (run > MAX_THEME_RUN) expect(themes.slice(i).every((t) => t === themes[i]), 'a longer run is only the tail').toBe(true);
    }
  });

  it('the same seed gives the same plan; an item that cannot load is left out from the start', () => {
    const a = planStageCheck(ctx(), 'stage3', cellsOf('stage3'), rounds);
    const b = planStageCheck(ctx(), 'stage3', cellsOf('stage3'), rounds);
    expect(a?.rounds.map((r) => r.question.itemId)).toEqual(b?.rounds.map((r) => r.question.itemId));
    const first = a?.rounds[0]?.question.itemId as string;
    expect(planStageCheck(ctx(), 'stage3', cellsOf('stage3'), rounds, new Set([first]))?.rounds.map((r) => r.question.itemId)).not.toContain(first);
  });

  it('a stage whose cells teach fewer than 10 playable items offers no Stage Check', () => {
    expect(planStageCheck(ctx(), 'stage2', [], rounds)).toBeNull();
    expect(planStageCheck(ctx(), 'stage2', cellsOf('stage5').slice(0, 1), rounds)).toBeNull();
  });
});

describe('parts and pauses (stage-check.md E, E2)', () => {
  it('20 rounds: 4 parts of 5, a pause after rounds 5, 10 and 15, none after the last', () => {
    const after = Array.from({ length: 20 }, (_, i) => i).filter((i) => pauseAfter(i, 20));
    expect(after).toEqual([4, 9, 14]);
    expect(pauseNumber(4, 20)).toEqual({ n: 0, last: false });
    expect(pauseNumber(14, 20)).toEqual({ n: 2, last: true });
    expect(pauseNumber(19, 20)).toBeNull();
  });

  it('a shorter check keeps parts of 5 with the last part shorter', () => {
    expect(Array.from({ length: 12 }, (_, i) => i).filter((i) => pauseAfter(i, 12))).toEqual([4, 9]);
    expect(pauseNumber(9, 12)).toEqual({ n: 1, last: true });
    expect(Array.from({ length: 10 }, (_, i) => i).filter((i) => pauseAfter(i, 10))).toEqual([4]);
  });
});

describe('the result: stars only, the 3-star tier latches', () => {
  const rs = planStageCheck(ctx(), 'stage2', cellsOf('stage2'), rounds)?.rounds ?? [];

  it('16 of 20 right first try is 3 stars and latches; 15 is 2 stars and does not; an unfinished check never latches', () => {
    expect(stageCheckResult(rs, answersOf(20, 16))).toMatchObject({ stars: 3, passed: true });
    expect(stageCheckResult(rs, answersOf(20, 15))).toMatchObject({ stars: 2, passed: false });
    expect(stageCheckResult(rs, answersOf(19, 19))).toMatchObject({ passed: false });
  });
});

describe('the entry and the telemetry (section 11.3)', () => {
  const result = { stars: 2 as const, itemIds: ['lex:a', 'lex:b'], missedItemIds: ['lex:b'], firstTryCorrect: 1, passed: false };

  it('one stage-certificate entry per stage, scope the stage, an id with no profile id, that parses', () => {
    const entry = stageCheckEntry({ stage: 'stage2', result, at: '2026-10-22T10:00:00.000Z' });
    expect(entry).toEqual({
      id: 'stage-check:stage2',
      kind: 'stage-certificate',
      generatedAt: '2026-10-22T10:00:00.000Z',
      scope: 'stage2',
      itemIds: ['lex:a', 'lex:b'],
      resultStars: 2,
      missedItemIds: ['lex:b'],
    });
    expect(ReviewEntrySchema.parse(entry)).toEqual(entry);
  });

  it('review.start and review.complete carry the kind, the stage and the stars only: no item, no count, no score', () => {
    expect(stageCheckStartEvent('p1', 'stage2', true)).toEqual({ name: 'review.start', profileId: 'p1', payload: { kind: 'stage-certificate', stageKey: 'stage2', hideRomanization: true } });
    expect(stageCheckCompleteEvent('p1', 'stage3', 3)).toEqual({ name: 'review.complete', profileId: 'p1', payload: { kind: 'stage-certificate', stageKey: 'stage3', stars: 3 } });
  });
});

describe('the strings (section 7.7, section 9.3 review-copy, OD-1)', () => {
  it.each(['en', 'es', 'ko'] as const)('%s: pass review-copy and the anti-shame list: no score, no percentage, no exam, test or certificate word, no age', (locale) => {
    const m = getMessages(locale);
    expect(lintReviewMessages(m.learner, ['stageCheck', 'upperStageComplete'], locale)).toEqual([]);
    const sc = m.learner.stageCheck;
    const texts = [
      sc.title,
      sc.offer.cta,
      sc.offer.body,
      sc.intro,
      sc.pause,
      sc.best,
      sc.notReady,
      ...[[2], [2, 3], [2, 3, 4, 6, 7]].map((stages) => sc.retro.title(stages)),
      sc.retro.body,
      sc.retro.bodyNoCards,
      ...[2, 7].map((n) => m.learner.upperStageComplete.title(n)),
      m.learner.upperStageComplete.cheer,
      m.learner.upperStageComplete.cardTitle,
      ...[2, 7].map((n) => m.learner.results.upperStagePrize.cta(n)),
      ...[1, 2, 3].map((n) => m.a11y.stageCheck.best(n)),
    ];
    for (const text of texts) {
      expect(text.trim().length, text).toBeGreaterThan(0);
      expect(text, text).not.toMatch(/%|\d+\s*\/\s*\d+|\bexam|\btest|\bquiz|\bscore|\bpass(ed)?\b|\bfail|certific|examen|prueba|puntaje|certificado|시험|테스트|점수|통과|실패|탈락|인증|자격/i);
      expect(text, text).not.toMatch(/\bages?\b|\byears? old\b|\bkids?\b|\bchild(ren)?\b|niñ[oa]s?|edad|어린이|아이|살\b|세\b/i);
      for (const word of bannedWordsFor(locale, 'learner')) expect(text.toLowerCase(), `${text} has ${word}`).not.toContain(word.toLowerCase());
    }
  });

  it('the summary title joins the stage numbers in each language, never with Intl.ListFormat', () => {
    expect(getMessages('en').learner.stageCheck.retro.title([2])).toBe('You finished Stage 2 earlier');
    expect(getMessages('en').learner.stageCheck.retro.title([2, 3])).toBe('You finished Stages 2 and 3 earlier');
    expect(getMessages('en').learner.stageCheck.retro.title([2, 3, 4])).toBe('You finished Stages 2, 3 and 4 earlier');
    expect(getMessages('es').learner.stageCheck.retro.title([2, 3, 4])).toBe('Ya terminaste las Etapas 2, 3 y 4');
    expect(getMessages('ko').learner.stageCheck.retro.title([2, 3])).toBe('2단계와 3단계를 이미 끝냈어요');
    expect(getMessages('ko').learner.stageCheck.retro.title([2, 3, 4])).toBe('2단계, 3단계와 4단계를 이미 끝냈어요');
    expect(getMessages('ko').learner.stageCheck.retro.title([5])).toBe('5단계를 이미 끝냈어요');
  });
});

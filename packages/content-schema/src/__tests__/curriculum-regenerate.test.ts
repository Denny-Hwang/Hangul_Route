import { describe, expect, it } from 'vitest';
import {
  StageKeySchema,
  generateCurriculum,
  regenerateFrom,
  toMeta,
  toPlanItems,
  type CurriculumDraft,
  type CurriculumMeta,
  type CurriculumParamsInput,
  type PlanItem,
  type StageKey,
} from '..';
import { CATALOG_2026_10 } from './fixtures/catalog-2026-10';

/** F-PLAN-002 section 3.3 `regenerateFrom` and section 3.7 re-pacing (`shift`, `requeue`). */

const q = (id: string): string => `quest:stage1-${id}`;
const story = (slug: string): string => `quest:story-${slug}-listen`;

const CLASS_A: CurriculumParamsInput = {
  audience: 'class',
  level: { stage: 'stage1', band: 0 },
  startDate: '2026-10-18',
  weeks: 12,
  sessionsPerWeek: 2,
  sessionDays: ['sun', 'wed'],
  minutesPerSession: 10,
  goals: { focus: 'balanced', motivation: 'heritage' },
  daysOff: [{ from: '2026-11-22', to: '2026-11-28' }],
  unlockedStages: StageKeySchema.options as StageKey[],
  reviewEvery: 4,
};
const SELF_B: CurriculumParamsInput = {
  audience: 'self',
  level: { stage: 'stage1', band: 3 },
  startDate: '2026-10-12',
  weeks: 26,
  sessionsPerWeek: 3,
  sessionDays: ['mon', 'wed', 'fri'],
  minutesPerSession: 15,
  goals: { focus: 'balanced', motivation: 'kculture' },
  unlockedStages: ['stage1'],
  reviewEvery: 4,
};

interface StoredPlan {
  meta: CurriculumMeta;
  items: PlanItem[];
}
const planOf = (draft: CurriculumDraft): StoredPlan => ({ meta: toMeta(draft), items: toPlanItems(draft) });
const A = generateCurriculum(CLASS_A, CATALOG_2026_10);
const B = generateCurriculum(SELF_B, CATALOG_2026_10);
const dated = (draft: CurriculumDraft): Array<[string | undefined, string]> => draft.items.map((item) => [item.targetDate, item.id]);
const withParams = (plan: StoredPlan, patch: Partial<CurriculumMeta['params']>): StoredPlan => ({
  ...plan,
  meta: { ...plan.meta, params: { ...plan.meta.params, ...patch } },
});

describe('regenerateFrom: idempotence', () => {
  it('re-paces a fresh plan on its start day to the same plan, in both modes', () => {
    for (const draft of [A, B]) {
      for (const mode of ['shift', 'requeue'] as const) {
        const again = regenerateFrom(planOf(draft), draft.params.startDate, CATALOG_2026_10, { mode });
        expect(toPlanItems(again)).toEqual(toPlanItems(draft));
        expect(again.weeks).toEqual(draft.weeks);
      }
    }
  });

  it('changes nothing when an unchanged plan is shifted in the middle (counters rebuilt from the weeks)', () => {
    for (const today of ['2026-11-29', '2026-12-13', '2026-12-30']) {
      const again = regenerateFrom(planOf(A), today, CATALOG_2026_10, { mode: 'shift' });
      expect(toPlanItems(again)).toEqual(toPlanItems(A));
      expect(again.weeks).toEqual(A.weeks);
      expect(again.stats).toEqual(A.stats);
    }
    for (const today of ['2026-11-09', '2027-01-04', '2027-02-03']) {
      const again = regenerateFrom(planOf(B), today, CATALOG_2026_10, { mode: 'shift' });
      expect(toPlanItems(again)).toEqual(toPlanItems(B));
      expect(again.weeks).toEqual(B.weeks);
    }
  });

  it('keeps the end date and params, and leaves the stored plan untouched', () => {
    const plan = planOf(A);
    const before = structuredClone(plan);
    const again = regenerateFrom(plan, '2026-12-13', CATALOG_2026_10, { mode: 'shift' });
    expect(again.weeks.at(-1)?.startDate).toBe(A.weeks.at(-1)?.startDate);
    expect(again.params).toEqual({ ...A.params, completedQuestIds: [] });
    expect(plan).toEqual(before);
    again.weeks[0]?.extras.push({ kind: 'hangul-check' });
    expect(plan.meta.weeks[0]?.extras).toEqual([]);
  });
});

describe('regenerateFrom: shift (the console re-pace)', () => {
  it('freezes history and lays the remaining items, in order, on the remaining sessions', () => {
    // Two weeks off from 13 December: every item from today moves on by the sessions lost.
    const plan = withParams(planOf(A), { daysOff: [...A.params.daysOff, { from: '2026-12-13', to: '2026-12-26' }] });
    const again = regenerateFrom(plan, '2026-12-13', CATALOG_2026_10, { mode: 'shift' });
    const history = dated(A).filter(([date]) => (date as string) < '2026-12-13');
    expect(dated(again).slice(0, history.length)).toEqual(history);
    expect(again.weeks.slice(0, 8)).toEqual(A.weeks.slice(0, 8));
    expect(again.weeks.map((week) => week.kind).slice(8)).toEqual(['break', 'break', 'learn', 'learn']);
    expect(dated(again).slice(history.length)).toEqual([
      ['2026-12-27', q('nature-q1')],
      ['2026-12-30', q('nature-q2')],
      ['2027-01-03', q('nature-q3')],
      ['2027-01-06', q('crafts-q1')],
    ]);
    expect(again.items.slice(history.length).map((item) => item.week)).toEqual([11, 11, 12, 12]);
    // The story and three lessons fell off the tail; the Hangul Check waits (Stage 1 is not all in the plan).
    expect(again.warnings).toEqual([{ code: 'fewer-sessions-than-units', count: 4 }]);
    expect(again.weeks.flatMap((week) => week.extras)).toEqual([]);
  });

  it('keeps an anchor story in its festival week when the festival is still ahead', () => {
    const plan = withParams(planOf(B), { daysOff: [{ from: '2026-11-16', to: '2026-11-29' }] });
    const again = regenerateFrom(plan, '2026-11-16', CATALOG_2026_10, { mode: 'shift' });
    const seollal = again.items.find((item) => item.id === story('seollal-new-year'));
    expect(seollal?.targetDate).toBe('2027-02-01');
    expect(again.weeks[16]?.focus.festival).toBe('seollal');
  });

  it('carries notes and items the catalogue does not know as lessons', () => {
    const plan = planOf(A);
    plan.items = plan.items.map((item): PlanItem => {
      if (item.targetDate === '2026-12-13') return { kind: 'quest', id: 'quest:hand-picked', targetDate: item.targetDate, note: 'Bring a pencil' };
      if (item.targetDate === '2026-12-16') return { kind: 'episode', id: 'episode:stage2-life', targetDate: item.targetDate };
      return item;
    });
    const again = regenerateFrom(plan, '2026-12-10', CATALOG_2026_10, { mode: 'shift' });
    expect(again.items.find((item) => item.id === 'quest:hand-picked')).toEqual({
      kind: 'quest', id: 'quest:hand-picked', targetDate: '2026-12-13', week: 9, note: 'Bring a pencil',
    });
    expect(again.items.find((item) => item.id === 'episode:stage2-life')?.targetDate).toBe('2026-12-16');
    expect(again.warnings).toEqual([]);
    // A ready episode counts as a lesson with its cell's minutes; an unknown quest as a lesson of 0 minutes.
    expect(again.stats.lessons).toBe(A.stats.lessons);
    expect(again.stats.minutesPlanned).toBe(A.stats.minutesPlanned - 4 - 4 + 6);
    expect(again.stats.endsAtStage).toBe('stage2');
  });

  it('puts the Hangul Check where the last Stage 1 lesson lands, and never twice', () => {
    const plan = withParams(planOf(A), { weeks: 14 });
    // With 14 weeks, week 12 is no longer the last, so it becomes a review and Stage 1 ends in week 13.
    const later = regenerateFrom(plan, '2027-01-03', CATALOG_2026_10, { mode: 'shift' });
    expect(later.weeks[11]?.kind).toBe('review');
    expect(later.weeks.findIndex((week) => week.extras.some((extra) => extra.kind === 'hangul-check'))).toBe(12);
    expect(later.weeks.flatMap((week) => week.extras).filter((extra) => extra.kind === 'hangul-check')).toHaveLength(1);
    const after = regenerateFrom(plan, '2027-01-10', CATALOG_2026_10, { mode: 'shift' });
    expect(after.weeks.flatMap((week) => week.extras).filter((extra) => extra.kind === 'hangul-check')).toHaveLength(1);
  });

  it('keeps history on a day that is now off, and freezes everything after the end', () => {
    const plan = withParams(planOf(A), { daysOff: [{ from: '2026-10-18', to: '2026-10-24' }, ...A.params.daysOff] });
    const again = regenerateFrom(plan, '2026-10-25', CATALOG_2026_10, { mode: 'shift' });
    expect(dated(again).slice(0, 2)).toEqual([['2026-10-18', q('letters-q1')], ['2026-10-21', q('letters-q2')]]);
    const ended = regenerateFrom(planOf(A), '2027-03-01', CATALOG_2026_10, { mode: 'shift' });
    expect(toPlanItems(ended)).toEqual(toPlanItems(A));
    expect(ended.weeks).toEqual(A.weeks);
  });

  it('rebuilds a week the stored metadata lacks', () => {
    const plan = planOf(A);
    plan.meta = { ...plan.meta, weeks: plan.meta.weeks.filter((week) => week.index !== 2 && week.index !== 6) };
    const again = regenerateFrom(plan, '2026-12-13', CATALOG_2026_10, { mode: 'shift' });
    expect(again.weeks[1]).toEqual({ ...A.weeks[1], extras: [] });
    expect(again.weeks[5]?.kind).toBe('break');
  });

  it('never turns the current week into a review when it already holds items', () => {
    const plan = planOf(A);
    plan.meta = { ...plan.meta, weeks: plan.meta.weeks.map((week) => (week.index === 4 ? { ...week, kind: 'learn' } : week)) };
    plan.items = [...plan.items, { kind: 'quest', id: q('extra'), targetDate: '2026-12-06' }];
    const again = regenerateFrom(plan, '2026-12-09', CATALOG_2026_10, { mode: 'shift' });
    expect(again.weeks[7]?.kind).not.toBe('review');
    expect(again.items.find((item) => item.id === q('extra'))?.week).toBe(8);
  });
});

describe('regenerateFrom: requeue (the device re-pace)', () => {
  it('returns unfinished past items to the front and keeps finished ones on their dates', () => {
    const again = regenerateFrom(planOf(A), '2026-10-28', CATALOG_2026_10, {
      mode: 'requeue',
      completedQuestIds: [q('letters-q1')],
    });
    expect(dated(again).slice(0, 4)).toEqual([
      ['2026-10-18', q('letters-q1')],
      ['2026-10-28', q('letters-q2')],
      ['2026-11-01', q('letters-q3')],
      ['2026-11-04', q('life-q1')],
    ]);
    // The two past sessions it left are open; "content runs out" only looks from today on.
    expect(again.stats.openSessions).toBe(2);
    expect(again.warnings).toEqual([{ code: 'fewer-sessions-than-units', count: 4 }]);
  });

  it('skips what the learner has already done and says how many', () => {
    const again = regenerateFrom(planOf(A), '2026-10-25', CATALOG_2026_10, {
      mode: 'requeue',
      completedQuestIds: [q('letters-q1'), q('letters-q2'), q('life-q1')],
    });
    expect(dated(again).slice(0, 4)).toEqual([
      ['2026-10-18', q('letters-q1')],
      ['2026-10-21', q('letters-q2')],
      ['2026-10-25', q('letters-q3')],
      ['2026-10-28', q('life-q2')],
    ]);
    expect(again.warnings).toContainEqual({ code: 'already-done-skipped', count: 1 });
  });

  it('keeps weeks before the current week and re-decides the rest', () => {
    const again = regenerateFrom(planOf(B), '2026-11-11', CATALOG_2026_10, {
      mode: 'requeue',
      completedQuestIds: [q('nature-q2'), q('nature-q3'), q('crafts-q1'), q('crafts-q2'), q('crafts-q3')],
    });
    // Weeks 1-4 are frozen; week 5 lost its only past item, so it is re-decided and refilled.
    expect(again.weeks.slice(0, 4)).toEqual(B.weeks.slice(0, 4));
    expect(again.weeks[4]?.kind).toBe('culture');
    expect(again.items.filter((item) => (item.targetDate as string) < '2026-11-11').map((item) => item.id)).toEqual([
      q('nature-q2'), q('nature-q3'), q('crafts-q1'), q('crafts-q2'), q('crafts-q3'),
    ]);
    expect(again.items.find((item) => (item.targetDate as string) >= '2026-11-11')?.id).toBe(story('chuseok-ganggangsullae'));
  });
});

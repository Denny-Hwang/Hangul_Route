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

  it('shifts a plan cut short to the same plan: Stage 1 lessons it never scheduled still hold the check back', () => {
    // 4 weeks at 3 sessions hold 12 of the 15 Stage 1 lessons, so the plan has no Hangul Check.
    const short = generateCurriculum({ ...SELF_B, level: { stage: 'stage1', band: 0 }, weeks: 4, sessionDays: undefined, reviewEvery: undefined, goals: { focus: 'words' } }, CATALOG_2026_10);
    expect(short.weeks.flatMap((week) => week.extras)).toEqual([]);
    for (const today of ['2026-10-12', '2026-10-21', '2026-11-02', '2026-11-08']) {
      const again = regenerateFrom(planOf(short), today, CATALOG_2026_10, { mode: 'shift' });
      expect(toPlanItems(again)).toEqual(toPlanItems(short));
      expect(again.weeks).toEqual(short.weeks);
    }
  });

  it('checks today and the freeze day are real day keys', () => {
    expect(() => regenerateFrom(planOf(A), '2026-1-5', CATALOG_2026_10, { mode: 'shift' })).toThrow();
    expect(() => regenerateFrom(planOf(A), '2026-02-30', CATALOG_2026_10, { mode: 'requeue' })).toThrow();
    expect(() => generateCurriculum(CLASS_A, CATALOG_2026_10, { freezeBefore: '2026-13-01' })).toThrow();
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

  it('settles for a caught-up learner: past coming-soon items stay on their dates', () => {
    for (const today of ['2027-01-09', '2027-01-16', '2027-02-10']) {
      const done = B.items.filter((item) => (item.targetDate as string) < today && item.kind === 'quest').map((item) => item.id);
      const again = regenerateFrom(planOf(B), today, CATALOG_2026_10, { mode: 'requeue', completedQuestIds: done });
      expect(toPlanItems(again)).toEqual(toPlanItems(B));
      expect(again.weeks).toEqual(B.weeks);
      // "Content runs out" looks from today on, and the learner's completions are reported as skipped.
      const steady = (warnings: CurriculumDraft['warnings']) => warnings.filter((w) => w.code !== 'already-done-skipped' && w.code !== 'content-runs-out');
      expect(steady(again.warnings)).toEqual(steady(B.warnings));
      expect(new Set(again.items.map((item) => item.id)).size).toBe(again.items.length);
    }
  });

  it('never queues a placeholder twice, even when its episode id arrives as done', () => {
    const done = B.items.filter((item) => (item.targetDate as string) < '2027-01-12').map((item) => item.id);
    expect(done).toContain('episode:stage2-rites');
    const again = regenerateFrom(planOf(B), '2027-01-12', CATALOG_2026_10, { mode: 'requeue', completedQuestIds: done });
    const ids = again.items.map((item) => item.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.filter((id) => id.startsWith('episode:'))).toHaveLength(5);
  });

  it('moves the Hangul Check with a Stage 1 lesson it returns, so the check never comes first', () => {
    // B closes Stage 1 in week 2 (crafts-q3 on 21 October); the learner has not done crafts-q3.
    expect(B.weeks[1]?.extras).toEqual([{ kind: 'hangul-check' }]);
    const again = regenerateFrom(planOf(B), '2026-10-26', CATALOG_2026_10, {
      mode: 'requeue',
      completedQuestIds: [q('nature-q2'), q('nature-q3'), q('crafts-q1'), q('crafts-q2')],
    });
    expect(again.items.find((item) => item.id === q('crafts-q3'))).toMatchObject({ targetDate: '2026-10-26', week: 3 });
    expect(again.weeks[1]?.extras).toEqual([{ kind: 'hangul-check' }]);
    expect(again.weeks[2]?.extras).toContainEqual({ kind: 'hangul-check' });
    // Done on time, the check stays where it was and is not given again.
    const onTime = regenerateFrom(planOf(B), '2026-10-26', CATALOG_2026_10, {
      mode: 'requeue',
      completedQuestIds: [q('nature-q2'), q('nature-q3'), q('crafts-q1'), q('crafts-q2'), q('crafts-q3')],
    });
    expect(onTime.weeks.filter((week) => week.extras.some((extra) => extra.kind === 'hangul-check')).map((week) => week.index)).toEqual([2]);
  });

  it('keeps the kind of a week already under way, even when none of its past items was done', () => {
    const plan = planOf(B);
    plan.meta = { ...plan.meta, weeks: plan.meta.weeks.map((week) => (week.index === 3 ? { ...week, kind: 'culture' } : week)) };
    const done = B.items.filter((item) => (item.targetDate as string) < '2026-10-26').map((item) => item.id);
    const again = regenerateFrom(plan, '2026-10-28', CATALOG_2026_10, { mode: 'requeue', completedQuestIds: done });
    expect(again.weeks[2]?.kind).toBe('culture');
  });

  it('changes nothing once no session is left: unfinished past items keep their dates', () => {
    for (const today of ['2027-04-10', '2027-06-01']) {
      const again = regenerateFrom(planOf(B), today, CATALOG_2026_10, { mode: 'requeue', completedQuestIds: [] });
      expect(toPlanItems(again)).toEqual(toPlanItems(B));
      expect(again.weeks).toEqual(B.weeks);
    }
  });

  it('keeps weeks before the current week and re-decides the rest', () => {
    const again = regenerateFrom(planOf(B), '2026-11-11', CATALOG_2026_10, {
      mode: 'requeue',
      completedQuestIds: [q('nature-q2'), q('nature-q3'), q('crafts-q1'), q('crafts-q2'), q('crafts-q3')],
    });
    // Weeks 1-4 are frozen; week 5 is under way, so it keeps its kind and its unfinished item is refilled.
    expect(again.weeks.slice(0, 4)).toEqual(B.weeks.slice(0, 4));
    expect(again.weeks[4]?.kind).toBe('culture');
    expect(again.items.filter((item) => (item.targetDate as string) < '2026-11-11').map((item) => item.id)).toEqual([
      q('nature-q2'), q('nature-q3'), q('crafts-q1'), q('crafts-q2'), q('crafts-q3'),
    ]);
    expect(again.items.find((item) => (item.targetDate as string) >= '2026-11-11')?.id).toBe(story('chuseok-ganggangsullae'));
  });
});

describe('regenerateFrom: reseed (after a retake or an override, FP-B4)', () => {
  const SELF_0: CurriculumParamsInput = { ...SELF_B, level: { stage: 'stage1', band: 0 }, weeks: 12 };
  const S = generateCurriculum(SELF_0, CATALOG_2026_10);
  const band3 = { stage: 'stage1', band: 3 } as const;
  const placedAtBand3 = [
    q('letters-q1'), q('letters-q2'), q('letters-q3'), q('life-q1'), q('life-q2'), q('life-q3'),
    q('rites-q1'), q('rites-q2'), q('rites-q3'), q('nature-q1'),
  ];
  const future = (draft: CurriculumDraft, today: string): string[] =>
    draft.items.filter((item) => (item.targetDate as string) >= today).map((item) => item.id);
  const past = (draft: CurriculumDraft, today: string): Array<[string | undefined, string]> =>
    dated(draft).filter(([date]) => (date as string) < today);

  it('re-seeds a fresh plan on its start day with the same start to the same plan', () => {
    const sameA = regenerateFrom(planOf(A), A.params.startDate, CATALOG_2026_10, {
      mode: 'reseed',
      paramsPatch: { level: { stage: 'stage1', band: 0 } },
    });
    expect(toPlanItems(sameA)).toEqual(toPlanItems(A));
    expect(sameA.weeks).toEqual(A.weeks);
    const sameB = regenerateFrom(planOf(B), B.params.startDate, CATALOG_2026_10, { mode: 'reseed', paramsPatch: { level: band3 } });
    expect(toPlanItems(sameB)).toEqual(toPlanItems(B));
    expect(sameB.weeks).toEqual(B.weeks);
  });

  it('equals shift with an empty patch', () => {
    const plan = withParams(planOf(A), { daysOff: [...A.params.daysOff, { from: '2026-12-13', to: '2026-12-26' }] });
    for (const paramsPatch of [undefined, {}, { level: undefined }]) {
      const reseeded = regenerateFrom(plan, '2026-12-13', CATALOG_2026_10, { mode: 'reseed', paramsPatch });
      expect(reseeded).toEqual(regenerateFrom(plan, '2026-12-13', CATALOG_2026_10, { mode: 'shift' }));
    }
  });

  it('moves the future ahead after a higher level: history frozen, placed-out quests gone, same end date', () => {
    const today = '2026-10-26';
    const again = regenerateFrom(planOf(S), today, CATALOG_2026_10, { mode: 'reseed', paramsPatch: { level: band3 } });
    expect(past(again, today)).toEqual(past(S, today));
    expect(again.params.level).toEqual(band3);
    expect(again.weeks).toHaveLength(S.weeks.length);
    expect(again.weeks.at(-1)?.startDate).toBe(S.weeks.at(-1)?.startDate);
    const ahead = future(again, today);
    expect(ahead[0]).toBe(q('nature-q2'));
    for (const id of placedAtBand3) {
      if (!past(S, today).some(([, done]) => done === id)) expect(ahead).not.toContain(id);
    }
  });

  it('never lowers the stored level', () => {
    const today = '2026-11-02';
    const lower = regenerateFrom(planOf(B), today, CATALOG_2026_10, { mode: 'reseed', paramsPatch: { level: { stage: 'stage1', band: 0 } } });
    expect(lower.params.level).toEqual(band3);
    expect(toPlanItems(lower)).toEqual(toPlanItems(B));
    const higher = regenerateFrom(planOf(B), today, CATALOG_2026_10, { mode: 'reseed', paramsPatch: { level: { stage: 'stage2', band: 0 } } });
    expect(higher.params.level).toEqual({ stage: 'stage2', band: 0 });
  });

  it('drops a grown placed-out set from the future, and puts back what an override removed', () => {
    const today = '2026-10-19';
    const grown = regenerateFrom(planOf(S), today, CATALOG_2026_10, {
      mode: 'reseed',
      paramsPatch: { placedOutQuestIds: placedAtBand3 },
    });
    expect(grown.params.placedOutQuestIds).toEqual(placedAtBand3);
    expect(future(grown, today)[0]).toBe(q('nature-q2'));

    const placed = generateCurriculum({ ...SELF_0, placedOutQuestIds: placedAtBand3 }, CATALOG_2026_10);
    const override = placedAtBand3.slice(0, 6);
    const back = regenerateFrom(planOf(placed), today, CATALOG_2026_10, { mode: 'reseed', paramsPatch: { placedOutQuestIds: override } });
    expect(past(back, today)).toEqual(past(placed, today));
    const ahead = future(back, today);
    for (const id of placedAtBand3.slice(6)) expect(ahead).toContain(id);
    // The put-back quests come first, in canonical order, before what the plan had next.
    expect(ahead.slice(0, 4)).toEqual(placedAtBand3.slice(6));
    expect(ahead[4]).toBe(future(placed, today)[0]);
  });

  it('moves the start after a raised level alone on a plan that stores an exact set', () => {
    const today = '2026-10-19';
    const exact = generateCurriculum({ ...SELF_0, placedOutQuestIds: [q('letters-q1')] }, CATALOG_2026_10);
    const raised = regenerateFrom(planOf(exact), today, CATALOG_2026_10, { mode: 'reseed', paramsPatch: { level: band3 } });
    expect(raised.params.level).toEqual(band3);
    expect(new Set(raised.params.placedOutQuestIds)).toEqual(new Set(placedAtBand3));
    expect(past(raised, today)).toEqual(past(exact, today));
    expect(future(raised, today)[0]).toBe(q('nature-q2'));
    // A lower level alone keeps the stored set as it is.
    const lower = regenerateFrom(planOf(exact), today, CATALOG_2026_10, { mode: 'reseed', paramsPatch: { level: { stage: 'stage1', band: 0 } } });
    expect(lower.params.placedOutQuestIds).toEqual([q('letters-q1')]);
  });

  it('never re-queues an item dated before today, done or not', () => {
    const today = '2026-10-26';
    const again = regenerateFrom(planOf(S), today, CATALOG_2026_10, { mode: 'reseed', completedQuestIds: [], paramsPatch: { level: { stage: 'stage1', band: 1 } } });
    const before = past(S, today).map(([, id]) => id);
    expect(past(again, today).map(([, id]) => id)).toEqual(before);
    for (const id of before) expect(future(again, today)).not.toContain(id);
  });

  it('skips future items the learner already finished and says how many', () => {
    const today = '2026-10-19';
    const ahead = future(S, today);
    const again = regenerateFrom(planOf(S), today, CATALOG_2026_10, {
      mode: 'reseed',
      completedQuestIds: [ahead[0] as string],
      paramsPatch: { level: { stage: 'stage1', band: 0 } },
    });
    expect(future(again, today)).not.toContain(ahead[0]);
    expect(future(again, today)[0]).toBe(ahead[1]);
    expect(again.warnings).toContainEqual({ code: 'already-done-skipped', count: 1 });
  });

  it('takes new goals from the patch', () => {
    const goals = { focus: 'culture' as const, motivation: 'heritage' as const };
    const again = regenerateFrom(planOf(S), '2026-10-19', CATALOG_2026_10, { mode: 'reseed', paramsPatch: { goals } });
    expect(again.params.goals).toEqual(goals);
    expect(again.weeks.slice(2).some((week) => week.kind === 'culture')).toBe(true);
  });
});

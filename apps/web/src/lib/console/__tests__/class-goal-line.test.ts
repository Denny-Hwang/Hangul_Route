import { getMessages, type UiLocale } from '@hangul-route/i18n';
import { describe, expect, it, vi } from 'vitest';
import * as lineModule from '../class-goal-line';
import { classGoalLine, type ClassGoalLineInput } from '../class-goal-line';
import { ROUTE_CATALOG, TODAY, meta, plan, quest, stageTitle } from './fixtures/learning-route';

/**
 * The class plan goal line on the class roster header (Learning Route amendment section 6.3,
 * LR-OD-10; wireframe console/learning-route.md T1): one sentence about the newest whole-class
 * plan, computed from the plan alone. It says nothing about the learners.
 */

const PSEUDO = 'en-XA' as UiLocale;
// The formatters take UI locales only: under en-XA the console draws dates in English (as console-placement-parts.test.tsx).
vi.mock('@hangul-route/i18n', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@hangul-route/i18n')>();
  return { ...actual, formatDate: (locale: UiLocale, ...rest: Parameters<typeof actual.formatDate> extends [UiLocale, ...infer R] ? R : never) => actual.formatDate(locale === PSEUDO ? 'en' : locale, ...rest) };
});

const input = (over: Partial<ClassGoalLineInput> = {}): ClassGoalLineInput => ({
  kind: 'class',
  plans: [plan({ id: 'plan:c' })],
  today: TODAY,
  stageTitle,
  catalog: ROUTE_CATALOG,
  ...over,
});

describe('classGoalLine (section 6.3)', () => {
  it("words the stage the newest whole-class plan reaches, with the plan's end", () => {
    expect(classGoalLine(input())).toEqual({ stage: 'stage2', line: "Your class's weekly plan reaches Stage 2 · Words", planEnds: 'Plan ends Nov 1' });
  });

  it('takes the stage from the plan alone: the highest lesson stage, never a story, else the level stage', () => {
    expect(classGoalLine(input({ plans: [plan({ id: 'plan:c', items: [quest('quest:stage1-life-q1'), quest('quest:stage4-rites-q1')] })] }))?.stage).toBe('stage4');
    expect(classGoalLine(input({ plans: [plan({ id: 'plan:c', items: [quest('quest:story-moon')] })] }))?.stage).toBe('stage1');
    expect(classGoalLine(input({ plans: [plan({ id: 'plan:c', items: [] })] }))?.line).toBe("Your class's weekly plan reaches Stage 1 · Hangul");
  });

  it('draws no line for a family or a school space (the family line lives on each learner card)', () => {
    expect(classGoalLine(input({ kind: 'family' }))).toBeNull();
    expect(classGoalLine(input({ kind: 'school' }))).toBeNull();
    expect(classGoalLine(input({ kind: 'district' }))).toBeNull();
  });

  it('counts whole-class plans only: a plan targeted at some students never produces the line', () => {
    expect(classGoalLine(input({ plans: [plan({ id: 'plan:some', targetLearnerIds: ['learner:sam'] })] }))).toBeNull();
    expect(classGoalLine(input({ plans: [plan({ id: 'plan:none', targetLearnerIds: [] })] }))).toBeNull();
    // A newer targeted plan does not hide the whole-class one.
    const whole = plan({ id: 'plan:whole', items: [quest('quest:stage1-life-q1')], publishedAt: '2026-10-01T09:00:00.000Z' });
    const some = plan({ id: 'plan:some', targetLearnerIds: ['learner:sam'], items: [quest('quest:stage4-rites-q1')], publishedAt: '2026-10-09T09:00:00.000Z' });
    expect(classGoalLine(input({ plans: [some, whole] }))?.stage).toBe('stage1');
  });

  it('a draft, an archived plan, a classic plan or a finished plan gives no line', () => {
    for (const p of [
      plan({ id: 'plan:draft', publishedAt: null }),
      plan({ id: 'plan:archived', archivedAt: '2026-10-08T00:00:00.000Z' }),
      plan({ id: 'plan:classic', meta: null }),
      plan({ id: 'plan:none', meta: undefined }),
      // Four weeks from Sep 1: the last day is Sep 28, before today. A finished plan sets no goal anywhere (section 4.1 rule 1).
      plan({ id: 'plan:done', meta: meta('2026-09-01') }),
    ]) {
      expect(classGoalLine(input({ plans: [p] })), p.id).toBeNull();
    }
    expect(classGoalLine(input({ plans: [] }))).toBeNull();
  });

  it('keeps a plan on its last day, and a plan that starts later', () => {
    expect(classGoalLine(input({ plans: [plan({ id: 'plan:last', meta: meta('2026-09-14') })] }))?.planEnds).toBe('Plan ends Oct 11');
    expect(classGoalLine(input({ plans: [plan({ id: 'plan:next', meta: meta('2026-12-28', 4) })] }))?.planEnds).toBe('Plan ends Jan 24, 2027');
  });

  it('takes the newest publishedAt among live whole-class plans, whatever their order', () => {
    const older = plan({ id: 'plan:old', items: [quest('quest:stage4-rites-q1')], publishedAt: '2026-10-01T09:00:00.000Z' });
    const newer = plan({ id: 'plan:new', items: [quest('quest:stage1-life-q1')], publishedAt: '2026-10-09T09:00:00.000Z' });
    expect(classGoalLine(input({ plans: [older, newer] }))?.stage).toBe('stage1');
    expect(classGoalLine(input({ plans: [newer, older] }))?.stage).toBe('stage1');
    // A finished newer plan leaves the older live one.
    const finished = plan({ id: 'plan:z', items: [quest('quest:stage1-life-q1')], publishedAt: '2026-10-10T09:00:00.000Z', meta: meta('2026-09-01') });
    expect(classGoalLine(input({ plans: [finished, older] }))?.stage).toBe('stage4');
  });

  it('says nothing about the learners: no count, no share, no list, only the plan line and its end', () => {
    const line = classGoalLine(input());
    expect(Object.keys(line ?? {}).sort()).toEqual(['line', 'planEnds', 'stage']);
    expect(Object.keys(lineModule).sort()).toEqual(['classGoalLine']);
    for (const text of [line?.line, line?.planEnds]) expect(text).not.toMatch(/\d+ ?\/ ?\d+|%|student|learner|reached/i);
  });

  it('reads the shipped catalogue when the page passes none', () => {
    const { catalog: _omitted, ...rest } = input({ plans: [plan({ id: 'plan:c', items: [quest('quest:not-in-any-catalogue')] })] });
    expect(classGoalLine(rest)).toEqual({ stage: 'stage1', line: "Your class's weekly plan reaches Stage 1 · Hangul", planEnds: 'Plan ends Nov 1' });
  });

  it('reads its words from the locale it is given', () => {
    vi.stubEnv('NEXT_PUBLIC_PSEUDO_LOCALE', '1');
    const line = classGoalLine(input({ locale: PSEUDO }));
    expect(line?.line).toBe(getMessages(PSEUDO).console.learningRoute.planReaches.class(2, 'Words'));
    expect(line?.line).toMatch(/^\[.*\]$/);
    vi.unstubAllEnvs();
  });
});

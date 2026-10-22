import { describe, expect, it } from 'vitest';
import { en } from '../messages/en';
import { es } from '../messages/es';
import { ko } from '../messages/ko';

/*
 * The goals copy of row CM-17 (F-CURR-002 sections 7.4 and 7.7; design/wireframes/home/goal-ring-weekly-dots.md):
 * positive nudges only, never loss framing, no number of points, no percentage, no "n of m"; and "Steady" is
 * never bare, so es and ko give the daily tier, the plan pace and the steady week three distinct renderings
 * (the glossary entry of F-I18N-001 section 3.10 this row adds).
 */

const LOCALES = { en, es, ko } as const;
type Dict = (typeof LOCALES)[keyof typeof LOCALES];

/** Every rendered string of `learner.goals` and `a11y.goals`, with sample arguments for each function. */
function outputs(dict: Dict): string[] {
  const g = dict.learner.goals;
  const a = dict.a11y.goals;
  const strip = [
    a.strip({ days: 'Mon', steadyWeeks: g.steadyWeeks(4), streak: dict.learner.home.streak.pill(5), goal: a.state.more }),
    a.strip({ days: 'Mon', steadyWeeks: g.firstWeek, streak: null, goal: null }),
  ];
  return [
    ...[0, 1, 2, 12].flatMap((n) => [g.steadyWeeks(n), g.newRun(n), g.banner.weekMet(n), g.sheet.fromPlan(n), g.weekly.days(n)]),
    g.firstWeek,
    g.today.met,
    g.today.more,
    g.daily.light,
    g.daily.steady,
    g.daily.strong,
    ...Object.values(g.daily.time),
    g.daily.label(g.daily.light, g.daily.time.light),
    g.sheet.title,
    g.sheet.everyDay,
    g.sheet.everyWeek,
    g.sheet.steadyHelp,
    g.sheet.restHelp,
    g.sheet.seePlan.cta,
    g.sheet.done.cta,
    g.first.title,
    g.first.later.cta,
    g.banner.dayMet,
    ...strip,
    a.day.learned('Mon'),
    a.day.learnedToday('Mon'),
    a.day.rest('Mon'),
    a.day.today('Mon'),
    ...Object.values(a.state),
    a.close,
  ];
}

const LOSS: Readonly<Record<keyof typeof LOCALES, RegExp>> = {
  en: /\b(lost|lose|missed|miss|broken|break|behind|late|overdue|keep it alive|don't lose|fail)/i,
  es: /(perd|rot[oa]|atrasad|tarde|fall|no pierdas)/i,
  ko: /(잃|놓쳤|놓친|끊|실패|늦)/,
};

describe('goals copy (F-CURR-002 row CM-17)', () => {
  it.each(Object.keys(LOCALES) as (keyof typeof LOCALES)[])('%s: no loss framing, no percentage, no "n of m", no points', (locale) => {
    for (const text of outputs(LOCALES[locale])) {
      expect(LOSS[locale].test(text), text).toBe(false);
      expect(/[%％]/.test(text), text).toBe(false);
      expect(/\d+\s*(of|de|\/|중)\s*\d+/.test(text), text).toBe(false);
      expect(/\b(points?|puntos?)\b|점수/i.test(text), text).toBe(false);
    }
  });

  it('a run that ended keeps its best run and starts a new one ("Start a new run", never "lost")', () => {
    expect(en.learner.goals.newRun(12)).toBe('Start a new run! Best run: 12 days');
    expect(en.learner.goals.newRun(1)).toBe('Start a new run! Best run: 1 day');
    expect(es.learner.goals.newRun(1)).toBe('¡Empieza una racha nueva! Mejor racha: 1 día');
    expect(es.learner.goals.newRun(12)).toBe('¡Empieza una racha nueva! Mejor racha: 12 días');
    expect(ko.learner.goals.newRun(12)).toBe('새 연속 기록을 시작해요! 최고 기록: 12일');
  });

  it('agrees with a count of 1 and of 2 (plural, never "1 semanas")', () => {
    expect([en.learner.goals.steadyWeeks(1), en.learner.goals.steadyWeeks(2)]).toEqual(['1 steady week', '2 steady weeks']);
    expect([es.learner.goals.steadyWeeks(1), es.learner.goals.steadyWeeks(2)]).toEqual(['1 semana cumplida', '2 semanas cumplidas']);
    expect(es.learner.goals.banner.weekMet(1)).toContain('1 semana cumplida.');
    expect(es.learner.goals.sheet.fromPlan(1)).toBe('1 día, según tu plan semanal');
    expect(en.learner.goals.weekly.days(1)).toBe('1 day');
  });

  it('glossary: the daily tier, the plan pace and the steady week read three different ways in es and ko', () => {
    for (const dict of [es, ko]) {
      const tier = dict.learner.goals.daily.steady;
      const pace = dict.learner.weeklyPlan.proposal.pace.steady;
      const week = dict.learner.goals.steadyWeeks(1);
      expect(new Set([tier, pace]).size).toBe(2);
      expect(week.includes(tier) || week.includes(pace), week).toBe(false);
    }
    // The three daily tiers are three words in every locale.
    for (const dict of [en, es, ko]) expect(new Set([dict.learner.goals.daily.light, dict.learner.goals.daily.steady, dict.learner.goals.daily.strong]).size).toBe(3);
  });

  it('the strip label leaves out a part with nothing to say, with its full stop', () => {
    const parts = { days: 'Monday today, Tuesday', steadyWeeks: 'Your first steady week starts here', streak: null, goal: null };
    expect(en.a11y.goals.strip(parts)).toBe('This week: Monday today, Tuesday. Your first steady week starts here. Change goals.');
    expect(
      en.a11y.goals.strip({ days: 'Monday learned', steadyWeeks: '4 steady weeks', streak: 'Streak 5 days', goal: 'Light, about 5 minutes, a little more to go' }),
    ).toBe('This week: Monday learned. 4 steady weeks. Streak 5 days. Daily goal: Light, about 5 minutes, a little more to go. Change goals.');
    expect(ko.a11y.goals.strip(parts)).toBe('이번 주: Monday today, Tuesday. Your first steady week starts here. 목표 바꾸기.');
  });
});

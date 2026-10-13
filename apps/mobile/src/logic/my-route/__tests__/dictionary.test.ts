import { describe, expect, it } from 'vitest';
import type { UiLocale } from '@hangul-route/content-schema';
import { getMessages } from '@hangul-route/i18n';
import { myRouteMessages } from '../view';
import { copyViolations, type Surface } from './copy-rules';
import { DRAFT_EN } from './fixtures/messages-draft';

/**
 * F-ROUTE-001 section 5, `copy.test.ts` split (R-3 part): the copy rules and
 * the length budget on the real `learner.myRoute` / `a11y.myRoute`
 * dictionary (and the grown-up slice the read-only page reads) in en / es /
 * ko. The es (F-I18N-001 PR 15) and ko (PR 16) overlays are filled, so the
 * rules run on the translations unchanged.
 */

const LOCALES: readonly UiLocale[] = ['en', 'es', 'ko'];
const N = [0, 1, 2, 7];
const NAMES = ['Sam', 'Alex'];
const TITLES: Array<[number, string]> = [
  [1, 'Hangul'],
  [4, 'Dialogue'],
  [7, 'Self-expression'],
];
const QUEST_TITLES = ['Family at the Table', 'Meet the First Letters'];
const WORDS = ['Open', 'Complete', 'Coming later'];
const SAMPLES: Record<string, unknown[][]> = {
  'learner.myRoute.hero.here': TITLES,
  'learner.myRoute.hero.next': QUEST_TITLES.map((t) => [t]),
  'learner.myRoute.caption.played': N.filter((n) => n > 0).map((n) => [n]),
  'learner.myRoute.laterGroup': [
    [5, 7],
    [2, 3],
  ],
  'learner.myRoute.newQuests': N.filter((n) => n > 0).map((n) => [n, 1]),
  'learner.myRoute.skill.quests': N.filter((n) => n > 0).map((n) => [n]),
  'learner.myRoute.games.title': [['Read'], ['Listen'], ['Write']],
  'caregiver.journey.here': NAMES.flatMap((name) => TITLES.map(([n, t]) => [name, n, t])),
  'caregiver.journey.next': QUEST_TITLES.map((t) => [t]),
  'caregiver.journey.canDoLead': NAMES.map((n) => [n]),
  'caregiver.journey.started': NAMES.map((n) => [n]),
  'caregiver.journey.known': NAMES.map((n) => [n]),
  'caregiver.journey.quests': NAMES.flatMap((name) => [1, 4].map((n) => [name, n])),
  'caregiver.journey.viewing': NAMES.map((n) => [n]),
  'caregiver.journey.tiles': [[1], [2]],
  'caregiver.journey.start': NAMES.map((n) => [n]),
  'caregiver.journey.rest': NAMES.map((n) => [n]),
  'caregiver.journey.beyond': NAMES.map((n) => [n]),
  'caregiver.journey.hereTag': NAMES.map((n) => [n]),
  'caregiver.journey.ready': NAMES.map((n) => [n]),
  'caregiver.journey.explored': NAMES.map((n) => [n]),
  'caregiver.journey.skillsTitle': NAMES.map((n) => [n]),
  'caregiver.journey.row.now': TITLES,
  'caregiver.journey.row.goal': TITLES,
  'caregiver.journey.row.started': [
    [1, 'Letters and sounds', 'Oct 9'],
    [2, 'Some reading', 'Dec 20'],
  ],
  'a11y.myRoute.stage': TITLES.flatMap(([n, t]) => WORDS.map((w, i) => [n, t, w, i === 0, i === 1, N[i]])),
  'a11y.myRoute.stageGrownup': TITLES.flatMap(([n, t]) => WORDS.map((w, i) => ['Sam', n, t, w, i === 0, i === 1, N[i]])),
  'a11y.myRoute.later': [['Stages 5 to 7', 'Coming later']],
  'a11y.myRoute.cell': [['Letters and Books', 'Meet the Letters', 'Complete']],
  'a11y.myRoute.cellInPlan': [['Letters and Books: Meet the Letters. Open.', 'In your plan']],
  'a11y.myRoute.skill': [['Read', 'In 4 quests you finished']],
  'a11y.myRoute.gain': [['Stars', 9]],
  'learner.myRoute.home.strip.goal': TITLES,
  'learner.myRoute.home.strip.week': [[1], [3], [12]],
  'a11y.myRoute.homeStrip': [
    ['Learning Route', 'You are on Stage 1: Hangul.', [], null, null],
    ['Learning Route', 'You are on Stage 1: Hangul.', ['4 quests played', 'New quests joined'], 'Goal: Stage 2, Words', 'Week 3 of your weekly plan'],
  ],
  'a11y.myRoute.homeStripGoal': TITLES,
  'a11y.myRoute.rowGoal': TITLES,
  'a11y.myRoute.rowStarted': [[1, 'Letters and sounds', 'Oct 9']],
  // The route card (AMENDMENTS-ROUTE-LEARNING-ROUTE section 11.1, LR-3b).
  'learner.myRoute.goal.stage': TITLES,
  'learner.myRoute.goal.inGoal': TITLES,
  'learner.myRoute.goal.explore': TITLES,
  'learner.myRoute.goal.exploreInGoal': TITLES,
  'learner.myRoute.goal.reachedStage': TITLES,
  'learner.myRoute.goal.keepGoing': QUEST_TITLES.map((t) => [t]),
  'caregiver.journey.goal.inGoal': NAMES.flatMap((name) => TITLES.map(([n, t]) => [name, n, t])),
  'caregiver.journey.goal.exploreInGoal': NAMES.flatMap((name) => TITLES.map(([n, t]) => [name, n, t])),
  'caregiver.journey.goal.reached': NAMES.flatMap((name) => TITLES.map(([n, t]) => [name, n, t])),
  'caregiver.journey.goal.from.self': NAMES.map((n) => [n]),
  'caregiver.journey.planEnds': [['Dec 20'], ['Oct 9']],
  'caregiver.journey.goalTag': NAMES.map((n) => [n]),
  'caregiver.journey.endOfRoad': NAMES.map((n) => [n]),
  'caregiver.journey.error': NAMES.map((n) => [n]),
  'a11y.myRoute.routeCard': [
    [null, 'Now: Stage 1 · Hangul', 'Goal: Stage 2 · Words', "From your class's weekly plan", null, 'Some quests done, more are ready', 'Next: Family at the Table'],
    ['Your Learning Route starts here.', 'Stage 1 · Hangul: you are in your goal stage', null, "Hoya's suggestion", null, 'Ready when you are', null],
    [null, 'Stage 1 · Hangul: Sam is in the goal stage', null, "From the class's weekly plan", 'Plan ends Dec 20', 'Some quests done', null],
  ],
  'a11y.myRoute.labelled': [['Now', 'Stage 1 · Hangul'], ['Goal', 'Explore Stage 2 · Words']],
  'a11y.myRoute.letter': [
    ['ㅏ', 'a', 'Met in a quest'],
    ['ㄱ', 'g/k', 'Coming up in a quest'],
    ['ㄴ', 'n, at the end', 'Already known'],
  ],
};

type Rendered = { path: string; text: string; surface: Surface; args: unknown[] };

function render(node: unknown, path: string, surface: Surface, out: Rendered[], unsampled: string[]): void {
  if (typeof node === 'string') out.push({ path, text: node, surface, args: [] });
  else if (typeof node === 'function') {
    const samples = SAMPLES[path];
    if (samples === undefined) unsampled.push(path);
    for (const args of samples ?? []) out.push({ path, text: (node as (...a: unknown[]) => string)(...args), surface, args });
  } else if (node !== null && typeof node === 'object') for (const [k, v] of Object.entries(node)) render(v, `${path}.${k}`, surface, out, unsampled);
}

function renderLocale(locale: UiLocale): { rendered: Rendered[]; unsampled: string[] } {
  const m = getMessages(locale);
  const rendered: Rendered[] = [];
  const unsampled: string[] = [];
  render(m.learner.myRoute, 'learner.myRoute', 'learner', rendered, unsampled);
  render(m.caregiver.journey, 'caregiver.journey', 'caregiver', rendered, unsampled);
  render(m.caregiver.skillsNote, 'caregiver.skillsNote', 'caregiver', rendered, unsampled);
  render(m.a11y.myRoute, 'a11y.myRoute', 'a11y', rendered, unsampled);
  // F-ENT-003's access words the route page shows (LR-5b): the same copy rules and CTA budget.
  render(m.learner.access, 'learner.access', 'learner', rendered, unsampled);
  return { rendered, unsampled };
}

/** The pill and button words (F-I18N-001 budgets: pill 24, cta 28). */
const PILL_PATHS = /^learner\.myRoute\.(state|tag|cell)\./;
const CTA_PATHS = /^learner\.(myRoute\.(open\.cta|hero\.cta\.|cta\.)|access\.practiceWords\.cta)/;

describe('the real My route dictionary keeps the copy rules (F-ROUTE-001 section 3.13)', () => {
  for (const locale of LOCALES) {
    const { rendered, unsampled } = renderLocale(locale);

    it(`${locale}: every message renders with realistic samples`, () => {
      expect(unsampled).toEqual([]);
      expect(rendered.length).toBeGreaterThan(90);
    });

    it(`${locale}: no banned, speaking, ratio, percent, emoji-capable or stray-digit text`, () => {
      const bad = rendered.flatMap((r) => copyViolations(r.text, locale, r.surface, r.args).map((v) => `${r.path} "${r.text}": ${v}`));
      expect(bad).toEqual([]);
    });

    it(`${locale}: pills fit 24 and buttons 28 characters`, () => {
      for (const r of rendered.filter((x) => PILL_PATHS.test(x.path))) expect(r.text.length, r.text).toBeLessThanOrEqual(24);
      for (const r of rendered.filter((x) => CTA_PATHS.test(x.path))) expect(r.text.length, r.text).toBeLessThanOrEqual(28);
    });

    it(`${locale}: the grown-up slice never speaks to the child`, () => {
      for (const r of rendered.filter((x) => x.path.startsWith('caregiver.') || x.path === 'a11y.myRoute.stageGrownup'))
        expect(r.text, r.path).not.toMatch(/\byou(r|rs|rself|'re|'ve|'ll)?\b/i);
    });
  }

  it('the dashboard row (R-9b) uses the Learning Route names of amendment section 7.2', () => {
    const row = getMessages('en').caregiver.journey.row;
    expect(row.title).toBe('Learning Route');
    expect(row.cta).toBe('See Learning Route');
    expect(row.now(1, 'Hangul')).toBe('Now: Stage 1 · Hangul');
    expect(row.goal(2, 'Words')).toBe('Goal: Stage 2 · Words');
    expect(row.started(1, 'Letters and sounds', 'Oct 9')).toBe('Started: Stage 1 · Letters and sounds · Oct 9');
    for (const text of [row.title, row.cta]) expect(text).not.toMatch(/my route|journey/i);
  });

  it('the English dictionary is the Appendix B copy the selectors were written against', () => {
    const real = myRouteMessages(getMessages('en'));
    const draft: Rendered[] = [];
    const final: Rendered[] = [];
    render(DRAFT_EN.learner, 'learner.myRoute', 'learner', draft, []);
    render(DRAFT_EN.grownup, 'caregiver.journey', 'caregiver', draft, []);
    render(DRAFT_EN.skillsNote, 'caregiver.skillsNote', 'caregiver', draft, []);
    render(DRAFT_EN.a11y, 'a11y.myRoute', 'a11y', draft, []);
    render(real.learner, 'learner.myRoute', 'learner', final, []);
    render(real.grownup, 'caregiver.journey', 'caregiver', final, []);
    render(real.skillsNote, 'caregiver.skillsNote', 'caregiver', final, []);
    render(real.a11y, 'a11y.myRoute', 'a11y', final, []);
    const byKey = new Map(final.map((r) => [`${r.path}|${JSON.stringify(r.args)}`, r.text]));
    for (const d of draft) expect(byKey.get(`${d.path}|${JSON.stringify(d.args)}`), d.path).toBe(d.text);
  });
});

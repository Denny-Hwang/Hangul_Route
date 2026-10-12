import { StageKeySchema, pickGoal, routeCatalogOf, stageAvailabilityOf, type StageKey } from '@hangul-route/content-schema';
import { getMessages, type UiLocale } from '@hangul-route/i18n';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PlanView, RosterLearner } from '../api';
import * as viewModule from '../learning-route-view';
import { goalSourcesOf, learningRouteView, planEndText, type LearningRouteInput, type LearningRouteReady, type LearningRouteRow, type LearningRouteStageRow } from '../learning-route-view';
import { ROUTES } from '../routing';
import { ROUTE_CATALOG, TODAY, journey, journeyRows, learner, meta, placement, plan, quest, stageTitle, summary } from './fixtures/learning-route';

/**
 * The grown-up Learning Route view model (amendment section 6.1, LR-7; wireframes
 * console/learning-route.md T3 and parent/learning-route.md L2). Built from the roster row and
 * the space's own plans only; never a list of learners, never a comparison.
 */

const PSEUDO = 'en-XA' as UiLocale;
// The formatters take UI locales only: under en-XA the console draws dates in English (as console-placement-parts.test.tsx).
vi.mock('@hangul-route/i18n', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@hangul-route/i18n')>();
  return { ...actual, formatDate: (locale: UiLocale, ...rest: Parameters<typeof actual.formatDate> extends [UiLocale, ...infer R] ? R : never) => actual.formatDate(locale === PSEUDO ? 'en' : locale, ...rest) };
});

// Pin the browser time zone: "Updated {date}" is read in the viewer's zone, so every test names the zone it runs in
// (UTC unless it says otherwise). Stubs are undone after each test, also when an assertion fails.
beforeEach(() => {
  vi.stubEnv('TZ', 'UTC');
});
afterEach(() => {
  vi.unstubAllEnvs();
});

const en = getMessages('en');
const lr = en.console.learningRoute;
const canDo = en.learner.myRoute.stage.canDo;

const input = (over: Partial<LearningRouteInput> = {}): LearningRouteInput => ({
  space: { id: 'space:fam', kind: 'family' },
  learners: [learner()],
  learnerId: 'learner:sam',
  plans: [],
  today: TODAY,
  stageTitle,
  catalog: ROUTE_CATALOG,
  ...over,
});

const ready = (over: Partial<LearningRouteInput> = {}): LearningRouteReady => {
  const view = learningRouteView(input(over));
  if (view?.status !== 'ready') throw new Error(`expected a ready view, got ${view?.status ?? 'null'}`);
  return view;
};

const withSummary = (over: Record<string, unknown>, rest: Partial<RosterLearner> = {}): RosterLearner[] => [learner({ summary: summary(over), ...rest })];
const stageRow = (rows: LearningRouteRow[], stage: StageKey): LearningRouteStageRow => {
  const row = rows.find((r): r is LearningRouteStageRow => r.kind === 'stage' && r.stage === stage);
  if (!row) throw new Error(`no stage row for ${stage}`);
  return row;
};
const tagsOf = (view: LearningRouteReady, stage: StageKey): string[] => stageRow(view.stages, stage).tags.map((t) => t.text);

/** Every sentence a view carries, for the copy rules. */
const textsOf = (value: unknown): string[] => {
  if (typeof value === 'string') return [value];
  if (Array.isArray(value)) return value.flatMap(textsOf);
  if (value !== null && typeof value === 'object') return Object.entries(value).flatMap(([key, v]) => (key === 'href' || key === 'stage' || key === 'stages' || key === 'kind' || key === 'state' || key === 'availability' || key === 'status' ? [] : textsOf(v)));
  return [];
};

describe('learningRouteView: which space and which learner (section 6.1)', () => {
  it('draws nothing for a school space or a kind this bundle does not know (a school has no roster)', () => {
    expect(learningRouteView(input({ space: { id: 'space:s', kind: 'school' } }))).toBeNull();
    expect(learningRouteView(input({ space: { id: 'space:d', kind: 'district' } }))).toBeNull();
  });

  it('says it could not find a learner who is not in this space, with a way back and nobody else on the page', () => {
    const other = learner({ id: 'learner:mina', displayName: 'Mina' });
    for (const kind of ['class', 'family'] as const) {
      const view = learningRouteView(input({ space: { id: 'space:x', kind }, learners: [other], learnerId: 'learner:gone' }));
      expect(view).toEqual({
        status: 'notFound',
        message: 'We could not find this learner in this space.',
        back: { href: ROUTES.space('space:x'), text: kind === 'class' ? 'Back to the class' : 'Back to the family' },
      });
      expect(JSON.stringify(view)).not.toContain('Mina');
      expect(JSON.stringify(view)).not.toContain('learner:mina');
    }
  });

  it("titles the page with the roster's name (initials when the class anonymizes it) and the last sync date", () => {
    const view = ready();
    expect(view.title).toBe("Sam's Learning Route");
    expect(view.updated).toBe('Updated Oct 11');
    expect(ready({ learners: [learner({ displayName: 'S. K.' })] }).title).toBe("S. K.'s Learning Route");
    // Half a year or more from today: with the year. Around New Year, a recent sync never gains or loses it.
    expect(ready({ learners: [learner({ lastSyncedAt: '2025-12-30T15:00:00.000Z' })] }).updated).toBe('Updated Dec 30, 2025');
    expect(ready({ today: '2027-01-01', learners: [learner({ lastSyncedAt: '2026-12-31T20:00:00.000Z' })] }).updated).toBe('Updated Dec 31');
    expect(ready({ today: '2026-12-31', learners: [learner({ lastSyncedAt: '2027-01-01T01:00:00.000Z' })] }).updated).toBe('Updated Jan 1');
    expect(ready({ learners: [learner({ lastSyncedAt: null })] }).updated).toBeNull();
    expect(ready({ learners: [learner({ lastSyncedAt: 'not a date' })] }).updated).toBeNull();
  });

  it("words the sync date in the viewer's time zone, the year rule alike in every zone", () => {
    // 15:00 UTC on Oct 11 is already Oct 12 in Seoul and still Oct 11 in Los Angeles.
    vi.stubEnv('TZ', 'Asia/Seoul');
    expect(ready().updated).toBe('Updated Oct 12');
    expect(ready({ today: '2027-01-01', learners: [learner({ lastSyncedAt: '2026-12-31T12:00:00.000Z' })] }).updated).toBe('Updated Dec 31');
    vi.stubEnv('TZ', 'America/Los_Angeles');
    expect(ready().updated).toBe('Updated Oct 11');
    expect(ready({ today: '2026-12-31', learners: [learner({ lastSyncedAt: '2027-01-01T12:00:00.000Z' })] }).updated).toBe('Updated Jan 1');
    expect(ready({ learners: [learner({ lastSyncedAt: '2025-12-30T15:00:00.000Z' })] }).updated).toBe('Updated Dec 30, 2025');
  });

  it('goes back to the report once F-REPORT-001 gives its address, else to the class or the family', () => {
    expect(ready().back).toEqual({ href: '/teach/space?id=space%3Afam', text: 'Back to the family' });
    expect(ready({ space: { id: 'space:c', kind: 'class' } }).back).toEqual({ href: '/teach/space?id=space%3Ac', text: 'Back to the class' });
    expect(ready({ reportHref: '/teach/space/learner?id=space%3Ac&learner=learner%3Asam' }).back).toEqual({
      href: '/teach/space/learner?id=space%3Ac&learner=learner%3Asam',
      text: 'Back to the report',
    });
  });

  it('reads only the learner the URL names, whoever else is on the roster', () => {
    const mina = learner({ id: 'learner:mina', displayName: 'Mina', summary: summary({ journey: journey(journeyRows({ stage1: { state: 'complete', done: 8, known: 0 } }), 'stage2') }) });
    const view = ready({ space: { id: 'space:c', kind: 'class' }, learners: [mina, learner()] });
    expect(view.title).toBe("Sam's Learning Route");
    expect(view.card.now).toBe('Sam is on Stage 1: Hangul.');
    expect(JSON.stringify(view)).not.toContain('Mina');
  });
});

describe('learningRouteView: before the first readable journey (section 6.1 "No summary journey yet")', () => {
  it('words the next sync, never "no progress", and hides the card and the stages', () => {
    const cases: RosterLearner[] = [
      learner({ summary: null }),
      learner({ summary: summary({ journey: undefined }) }),
      learner({ summary: summary({ journey: { v: 2, here: 'stage1', stages: journeyRows() } }) }),
      learner({ summary: summary({ journey: { v: 1, here: 'stage1', stages: 'nope' } }) }),
      learner({ summary: summary({ journey: journey([{ stage: 'stage9', state: 'open', done: 1, known: 0, total: 1 }, { stage: 'stage1', state: 'locked', done: 1, known: 0, total: 1 }]) }) }),
    ];
    for (const row of cases) {
      const view = learningRouteView(input({ learners: [row] }));
      expect(view).toEqual({
        status: 'notSynced',
        title: "Sam's Learning Route",
        updated: 'Updated Oct 11',
        message: "The Learning Route appears after Sam's next sync on the newest app.",
        back: { href: '/teach/space?id=space%3Afam', text: 'Back to the family' },
      });
      expect(JSON.stringify(view).toLowerCase()).not.toContain('no progress');
    }
  });
});

describe('learningRouteView: the stage list (section 6.1 "The stage list page")', () => {
  it('lists the stages from summary.journey in order, with the state word, the title and the can-do line', () => {
    const rows = ready().stages;
    expect(rows.map((r) => (r.kind === 'stage' ? r.stage : `${r.from}-${r.to}`))).toEqual(['stage1', 'stage2', 'stage3', 'stage4', '5-7']);
    expect(stageRow(rows, 'stage1')).toEqual({
      kind: 'stage',
      stage: 'stage1',
      order: 1,
      state: 'open',
      title: 'Hangul',
      availability: 'open',
      stateWord: 'Open',
      canDo: canDo[1],
      line: '4 known from the level check, 2 quests done',
      tags: [{ kind: 'here', text: 'Sam is here' }],
    });
    expect(stageRow(rows, 'stage4')).toMatchObject({ title: 'Dialogue', availability: 'taste', stateWord: 'A taste', canDo: canDo[4], line: '1 quest done' });
  });

  it('words an open taste stage "A taste", the learner page word, and every other state with its console word', () => {
    const rows = ready().stages;
    // Stage 2 and Stage 4 are tastes in the October 2026 catalogue (wireframes parent/learning-route.md and console/learning-route.md).
    expect(stageRow(rows, 'stage2')).toMatchObject({ state: 'open', availability: 'taste', stateWord: en.learner.myRoute.state.taste });
    expect(stageRow(rows, 'stage2').stateWord).toBe('A taste');
    expect(stageRow(rows, 'stage1')).toMatchObject({ state: 'open', availability: 'open', stateWord: 'Open' });
    expect(stageRow(rows, 'stage3')).toMatchObject({ state: 'later', availability: 'soon', stateWord: 'Coming later' });
    const done = ready({ learners: withSummary({ journey: journey(journeyRows({ stage1: { state: 'known' }, stage2: { state: 'explored' }, stage4: { state: 'complete' } }), null) }) }).stages;
    expect(stageRow(done, 'stage1').stateWord).toBe('Known from the level check');
    expect(stageRow(done, 'stage2')).toMatchObject({ availability: 'taste', stateWord: 'Explored' });
    expect(stageRow(done, 'stage4')).toMatchObject({ availability: 'taste', stateWord: 'Complete' });
  });

  it('reads the taste word in the locale it is given', () => {
    vi.stubEnv('NEXT_PUBLIC_PSEUDO_LOCALE', '1');
    expect(stageRow(ready({ locale: PSEUDO }).stages, 'stage2').stateWord).toBe(getMessages(PSEUDO).learner.myRoute.state.taste);
  });

  it('heads the stage list "Stages"', () => {
    expect(ready().stagesTitle).toBe('Stages');
  });

  it('ignores entries with an unknown stage, an unknown state, unreadable counts or a repeated stage, and sorts by stage', () => {
    const rows = [
      { stage: 'stage4', state: 'explored', done: 1, known: 0, total: 1 },
      { stage: 'stage9', state: 'open', done: 3, known: 0, total: 3 },
      { stage: 'stage2', state: 'locked', done: 1, known: 0, total: 2 },
      { stage: 'stage1', state: 'complete', done: 8, known: 0, total: 8 },
      { stage: 'stage1', state: 'open', done: 0, known: 0, total: 8 },
      { stage: 'stage3', state: 'later', done: -1, known: 0, total: 0 },
    ];
    const view = ready({ learners: withSummary({ journey: journey(rows, 'stage4') }) });
    expect(view.stages.map((r) => (r.kind === 'stage' ? `${r.stage}:${r.state}` : 'run'))).toEqual(['stage1:complete', 'stage4:explored']);
  });

  it('leaves out every zero part: the known part only when above 0, the done part only when above 0, no line when both are 0', () => {
    const view = ready({
      learners: withSummary({
        journey: journey(
          journeyRows({ stage1: { known: 8, done: 0, state: 'known' }, stage2: { done: 0, known: 0 }, stage4: { done: 3, known: 0 } }),
          'stage2',
        ),
      }),
    });
    expect(stageRow(view.stages, 'stage1').line).toBe('8 known from the level check');
    expect(stageRow(view.stages, 'stage2').line).toBeNull();
    expect(stageRow(view.stages, 'stage4').line).toBe('3 quests done');
    for (const text of textsOf(view)) {
      expect(text).not.toMatch(/(^|\D)0 /);
      expect(text).not.toMatch(/\d+ ?\/ ?\d+|%/);
    }
  });

  it('never shows a stage total', () => {
    const view = ready({ learners: withSummary({ journey: journey(journeyRows({ stage1: { total: 97, done: 2, known: 0 } })) }) });
    expect(JSON.stringify(view)).not.toContain('97');
  });

  it('merges a run of coming-later stages into one row and keeps a lone one as a titled row with no can-do line', () => {
    const rows = ready().stages;
    expect(rows.at(-1)).toEqual({ kind: 'later', stages: ['stage5', 'stage6', 'stage7'], from: 5, to: 7, stateWord: 'Coming later', text: 'Stages 5 to 7: Coming later' });
    // The design keeps a coming-later row quiet: its name and "Coming later" only (design/screens/learning-route/stage-list.md).
    expect(stageRow(rows, 'stage3')).toEqual({ kind: 'stage', stage: 'stage3', order: 3, state: 'later', availability: 'soon', title: 'Sentences', stateWord: 'Coming later', canDo: null, line: null, tags: [] });
  });

  it('never merges across a stage it could not read, or a coming-later stage that holds a count', () => {
    const rows = journeyRows({ stage5: { state: 'later', done: 1, known: 0 } }).filter((r) => r.stage !== 'stage3');
    const gap = ready({ learners: withSummary({ journey: journey([...rows.slice(0, 2), { stage: 'stage3', state: 'sideways', done: 0, known: 0, total: 0 }, ...rows.slice(2)]) }) });
    expect(gap.stages.map((r) => (r.kind === 'stage' ? r.stage : `${r.from}-${r.to}`))).toEqual(['stage1', 'stage2', 'stage4', 'stage5', '6-7']);
    expect(stageRow(gap.stages, 'stage5')).toMatchObject({ state: 'later', canDo: null, line: '1 quest done' });
    const split = journeyRows().filter((r) => r.stage !== 'stage6');
    expect(ready({ learners: withSummary({ journey: journey(split) }) }).stages.map((r) => (r.kind === 'stage' ? r.stage : `${r.from}-${r.to}`))).toEqual([
      'stage1',
      'stage2',
      'stage3',
      'stage4',
      'stage5',
      'stage7',
    ]);
  });

  it('keeps a tagged coming-later stage as its own row, so its tag is never lost in a run', () => {
    const view = ready({ learners: withSummary({ routeGoal: { stage: 'stage6', from: 'class' }, placement: placement('stage3', 0) }) });
    expect(view.stages.map((r) => (r.kind === 'stage' ? r.stage : `${r.from}-${r.to}`))).toEqual(['stage1', 'stage2', 'stage3', 'stage4', 'stage5', 'stage6', 'stage7']);
    expect(tagsOf(view, 'stage3')).toEqual(['Sam started here']);
    expect(tagsOf(view, 'stage6')).toEqual(["Sam's goal"]);
    expect(stageRow(view.stages, 'stage5').tags).toEqual([]);
  });

  it('tags where the learner is, the goal and where the level check started them, as text, in that order', () => {
    const view = ready({ learners: withSummary({ placement: placement('stage1', 2), routeGoal: { stage: 'stage2', from: 'class' } }) });
    expect(stageRow(view.stages, 'stage1').tags).toEqual([
      { kind: 'here', text: 'Sam is here' },
      { kind: 'start', text: 'Sam started here' },
    ]);
    expect(stageRow(view.stages, 'stage2').tags).toEqual([{ kind: 'goal', text: "Sam's goal" }]);
    // All three on one stage: here, goal, start (section 10 and LR-D: the goal tag sits between the other two).
    const all = ready({ learners: withSummary({ placement: placement('stage1', 2), routeGoal: { stage: 'stage1', from: 'class' } }) });
    expect(stageRow(all.stages, 'stage1').tags.map((t) => t.kind)).toEqual(['here', 'goal', 'start']);
    const plan1 = ready({ space: { id: 'space:c', kind: 'class' }, learners: withSummary({ placement: placement('stage1', 2) }), plans: [plan({ id: 'plan:c', items: [quest('quest:stage1-life-q1')] })] });
    expect(stageRow(plan1.stages, 'stage1').tags.map((t) => t.text)).toEqual(['Sam is here', 'Plan goal', 'Sam started here']);
    // A placement level reaches Stage 2 too.
    expect(tagsOf(ready({ learners: withSummary({ placement: placement('stage2', 0) }) }), 'stage2')).toContain('Sam started here');
  });

  it('shows no start tag without a readable level check', () => {
    // The same rule as the roster card's starting-spot line: a level it can word (Stage 1 to 3) and a readable date.
    for (const p of [undefined, { ...placement(), level: { stage: 'stage5', band: 0 } }, { ...placement(), level: { stage: 'stage1', band: 9 } }, { takenAt: 'x' }, { ...placement(), takenAt: 'garbage' }]) {
      const view = ready({ learners: withSummary({ placement: p }) });
      expect(view.stages.flatMap((r) => (r.kind === 'stage' ? r.tags.map((t) => t.kind) : []))).not.toContain('start');
    }
  });

  it('reads the can-do lines from the shared dictionary entry in the locale it is given', () => {
    vi.stubEnv('NEXT_PUBLIC_PSEUDO_LOCALE', '1');
    const pseudo = PSEUDO;
    const view = ready({ locale: pseudo });
    expect(stageRow(view.stages, 'stage1').canDo).toBe(getMessages(pseudo).learner.myRoute.stage.canDo[1]);
    expect(stageRow(view.stages, 'stage1').canDo).not.toBe(canDo[1]);
    expect(view.title).toMatch(/^\[.*\]$/);
    // The date is drawn inside the pseudo words.
    expect(view.updated).toMatch(/^\[.* 11~*\]$/);
  });
});

describe('the grown-up route card: Now (section 6.1)', () => {
  it('names the here stage from summary.journey', () => {
    expect(ready().card.now).toBe('Sam is on Stage 1: Hangul.');
    expect(ready({ learners: withSummary({ journey: journey(journeyRows(), 'stage4') }) }).card.now).toBe('Sam is on Stage 4: Dialogue.');
  });

  it('has no Now line when the journey names no readable here stage', () => {
    expect(ready({ learners: withSummary({ journey: journey(journeyRows(), null) }) }).card.now).toBeNull();
    expect(ready({ learners: withSummary({ journey: journey(journeyRows(), 'stage9') }) }).card.now).toBeNull();
  });
});

describe('case 1: a family viewer with summary.routeGoal, the goal the learner device shows', () => {
  const view = (routeGoal: unknown, over: Record<string, unknown> = {}, rest: Partial<LearningRouteInput> = {}) =>
    ready({ learners: withSummary({ routeGoal, ...over }), ...rest });

  it("words the learner's goal, its source and its can-do line", () => {
    expect(view({ stage: 'stage2', from: 'class' }).card).toEqual({
      now: 'Sam is on Stage 1: Hangul.',
      goal: {
        case: 1,
        stage: 'stage2',
        line: "Sam's goal: Stage 2 · Words",
        from: "From the class's weekly plan",
        reached: null,
        planEnds: null,
        canDoLead: 'By the end of this stage, Sam can:',
        canDo: canDo[2],
        familyPlan: null,
      },
      endOfRoad: null,
    });
  });

  it('names every source, in the words of section 6.1', () => {
    expect(view({ stage: 'stage1', from: 'school' }).card.goal?.from).toBe("From the school's weekly plan");
    const familyPlan = plan({ id: 'plan:f', items: [quest('quest:stage1-life-q1')] });
    expect(view({ stage: 'stage1', from: 'family' }, {}, { plans: [familyPlan] }).card.goal?.from).toBe("From your family's weekly plan");
    expect(view({ stage: 'stage1', from: 'self' }).card.goal?.from).toBe("From Sam's own weekly plan");
    expect(view({ stage: 'stage1', from: 'default' }).card.goal?.from).toBe("Hoya's suggestion: the next open stage");
  });

  it('says the goal is reached when its stage is complete or known, or explored when it is a taste; a default goal is never reached', () => {
    const at = (state: string, stage: StageKey, from = 'class') =>
      view({ stage, from }, { journey: journey(journeyRows({ [stage]: { state } } as Parameters<typeof journeyRows>[0]), 'stage4') }).card.goal?.line;
    expect(at('complete', 'stage1')).toBe('Sam reached the goal: Stage 1 · Hangul.');
    expect(view({ stage: 'stage1', from: 'class' }, { journey: journey(journeyRows({ stage1: { state: 'complete' } }), 'stage4') }).card.goal).toMatchObject({ canDoLead: null, canDo: null });
    expect(view({ stage: 'stage1', from: 'default' }, { journey: journey(journeyRows({ stage1: { state: 'complete' } }), 'stage4') }).card.goal).toMatchObject({ canDoLead: 'By the end of this stage, Sam can:', canDo: canDo[1] });
    expect(at('known', 'stage1')).toBe('Sam reached the goal: Stage 1 · Hangul.');
    expect(at('explored', 'stage2')).toBe('Sam reached the goal: Stage 2 · Words.');
    expect(at('open', 'stage2')).toBe("Sam's goal: Stage 2 · Words");
    expect(at('complete', 'stage1', 'default')).toBe("Sam's goal: Stage 1 · Hangul");
  });

  it('says reached exactly when pickGoal says a plan goal is reached (section 4.1 rule 6), for every state and availability', () => {
    // stage1 is a full stage in the fixture catalogue, stage2 a taste.
    const planFor: Record<'stage1' | 'stage2', string> = { stage1: 'quest:stage1-life-q1', stage2: 'quest:stage2-life-q1' };
    for (const stage of ['stage1', 'stage2'] as const) {
      for (const state of ['complete', 'known', 'explored', 'open', 'later']) {
        const rows = journeyRows({ [stage]: { state } } as Parameters<typeof journeyRows>[0]);
        const expected = pickGoal({
          sources: [{ id: 'plan:x', kind: 'family', assignedAt: '2026-10-05T09:00:00.000Z', items: [quest(planFor[stage])], meta: meta() }],
          catalog: routeCatalogOf(ROUTE_CATALOG),
          stages: rows.map((r) => ({ stage: r.stage as StageKey, state: r.state as 'open' })),
          availability: (s) => stageAvailabilityOf(ROUTE_CATALOG, s),
          today: TODAY,
        });
        expect(expected?.stage).toBe(stage);
        const line = view({ stage, from: 'class' }, { journey: journey(rows, 'stage4') }).card.goal?.line;
        expect(line?.startsWith('Sam reached the goal'), `${stage} ${state}`).toBe(expected?.reached);
      }
    }
  });

  it("gives the plan end from this family's leading plan or the learner's own plan, never from a plan it cannot see", () => {
    const familyPlan = plan({ id: 'plan:f', items: [quest('quest:stage2-life-q1')] });
    expect(view({ stage: 'stage2', from: 'family' }, {}, { plans: [familyPlan] }).card.goal?.planEnds).toBe('Plan ends Nov 1');
    // The device names a family plan this family does not hold as its leading plan: case 1 gives way (see below).
    expect(view({ stage: 'stage4', from: 'family' }, {}, { plans: [familyPlan] }).card.goal).toMatchObject({ case: 2, stage: 'stage2', planEnds: 'Plan ends Nov 1' });
    expect(view({ stage: 'stage2', from: 'family' }).card.goal).toMatchObject({ case: 3, planEnds: null });
    const selfRoute = { done: 3, total: 9, notReady: 0, weeks: 12, endsOn: '2026-12-20' };
    expect(view({ stage: 'stage1', from: 'self' }, { selfRoute }).card.goal?.planEnds).toBe('Plan ends Dec 20');
    expect(view({ stage: 'stage1', from: 'self' }, { selfRoute: { ...selfRoute, endsOn: '20 Dec' } }).card.goal?.planEnds).toBeNull();
    // A summary from before the own plan ended: no past end is shown (it would read as late) and the goal gives way.
    expect(view({ stage: 'stage1', from: 'self' }, { selfRoute: { ...selfRoute, endsOn: '2026-10-10' } }).card.goal).toMatchObject({ case: 3, planEnds: null });
    expect(view({ stage: 'stage1', from: 'self' }, { selfRoute: { ...selfRoute, endsOn: TODAY } }).card.goal?.planEnds).toBe('Plan ends Oct 11');
    expect(view({ stage: 'stage1', from: 'self' }).card.goal?.planEnds).toBeNull();
    for (const from of ['class', 'school', 'default']) expect(view({ stage: 'stage2', from }, { selfRoute }, { plans: [familyPlan] }).card.goal?.planEnds).toBeNull();
  });

  it("adds the family's own live weekly plan as a second line only when it does not lead", () => {
    const familyPlan = plan({ id: 'plan:f', items: [quest('quest:stage1-life-q1')] });
    expect(view({ stage: 'stage2', from: 'class' }, {}, { plans: [familyPlan] }).card.goal?.familyPlan).toEqual({
      stage: 'stage1',
      line: "Your family's weekly plan reaches Stage 1 · Hangul",
      planEnds: 'Plan ends Nov 1',
    });
    expect(view({ stage: 'stage2', from: 'school' }, {}, { plans: [familyPlan] }).card.goal?.familyPlan?.line).toBe("Your family's weekly plan reaches Stage 1 · Hangul");
    expect(view({ stage: 'stage2', from: 'self' }, {}, { plans: [familyPlan] }).card.goal?.familyPlan?.stage).toBe('stage1');
    // The device names a family source, but this family's live plan reaches another stage: never two claims about the
    // same family plan at once; the family's own plan speaks (case 2).
    const elsewhere = view({ stage: 'stage2', from: 'family' }, {}, { plans: [familyPlan] }).card.goal;
    expect(elsewhere).toMatchObject({ case: 2, stage: 'stage1', line: "Your family's weekly plan reaches Stage 1 · Hangul", planEnds: 'Plan ends Nov 1', familyPlan: null });
    // Hoya's suggestion on the device while the family plan is live (it has not reached the device yet): the plan line shows.
    expect(view({ stage: 'stage2', from: 'default' }, {}, { plans: [familyPlan] }).card.goal?.familyPlan?.line).toBe("Your family's weekly plan reaches Stage 1 · Hangul");
    expect(view({ stage: 'stage1', from: 'family' }, {}, { plans: [familyPlan] }).card.goal?.familyPlan).toBeNull();
    // Only a live curriculum plan that reaches this learner counts.
    for (const p of [
      plan({ id: 'plan:draft', publishedAt: null }),
      plan({ id: 'plan:archived', archivedAt: '2026-10-08T00:00:00.000Z' }),
      plan({ id: 'plan:other', targetLearnerIds: ['learner:mina'] }),
      plan({ id: 'plan:classic', meta: null }),
      plan({ id: 'plan:done', meta: meta('2026-09-01') }),
    ]) {
      expect(view({ stage: 'stage2', from: 'class' }, {}, { plans: [p] }).card.goal?.familyPlan, p.id).toBeNull();
    }
  });

  it('gives way to case 2 or 3 when this page can prove the device goal is older than what it sees', () => {
    const selfRoute = { done: 3, total: 9, notReady: 0, weeks: 12, endsOn: '2026-10-10' };
    const familyPlan = plan({ id: 'plan:f', items: [quest('quest:stage1-life-q1')] });
    // The learner's own plan ended before today: the device now picks another goal.
    expect(view({ stage: 'stage4', from: 'self' }, { selfRoute }).card.goal).toMatchObject({ case: 3, from: null });
    expect(view({ stage: 'stage4', from: 'self' }, { selfRoute }, { plans: [familyPlan] }).card.goal).toMatchObject({ case: 2, stage: 'stage1' });
    expect(tagsOf(view({ stage: 'stage4', from: 'self' }, { selfRoute }), 'stage4')).not.toContain("Sam's goal");
    // The own plan's last day, or an end this build cannot read, proves nothing: case 1 stays.
    expect(view({ stage: 'stage4', from: 'self' }, { selfRoute: { ...selfRoute, endsOn: TODAY } }).card.goal?.case).toBe(1);
    expect(view({ stage: 'stage4', from: 'self' }, { selfRoute: { ...selfRoute, endsOn: '10 Oct' } }).card.goal?.case).toBe(1);
    // "Your family's weekly plan" while this family has no live plan for the learner (archived, finished, or never).
    for (const plans of [[], [plan({ id: 'plan:archived', items: [quest('quest:stage1-life-q1')], archivedAt: '2026-10-08T00:00:00.000Z' })], [plan({ id: 'plan:done', items: [quest('quest:stage1-life-q1')], meta: meta('2026-09-01') })]]) {
      expect(view({ stage: 'stage1', from: 'family' }, {}, { plans }).card.goal?.case).toBe(3);
    }
    // Sources this page cannot check keep case 1.
    for (const from of ['class', 'school', 'default']) expect(view({ stage: 'stage4', from }, { selfRoute }).card.goal?.case).toBe(1);
  });

  it('tags the goal stage "{name}\'s goal"', () => {
    expect(tagsOf(view({ stage: 'stage4', from: 'self' }), 'stage4')).toEqual(["Sam's goal"]);
  });

  it('ignores a goal whose stage this build cannot read, and words case 2 or 3 instead', () => {
    for (const routeGoal of [{ stage: 'stage9', from: 'class' }, { stage: 2, from: 'class' }, { stage: 'stage2', from: 'teacher' }, 'stage2', null]) {
      expect(view(routeGoal).card.goal?.case).toBe(3);
    }
  });
});

describe('case 2: this space has a live curriculum plan for the learner', () => {
  const classView = (plans: PlanView[], over: Record<string, unknown> = {}) => ready({ space: { id: 'space:c', kind: 'class' }, learners: withSummary(over), plans });

  it('words the plan, not the learner, with its end date and the Plan goal tag', () => {
    const view = classView([plan({ id: 'plan:c' })]);
    expect(view.card.goal).toEqual({
      case: 2,
      stage: 'stage2',
      line: "Your class's weekly plan reaches Stage 2 · Words",
      from: null,
      reached: null,
      planEnds: 'Plan ends Nov 1',
      canDoLead: 'By the end of this stage, Sam can:',
      canDo: canDo[2],
      familyPlan: null,
    });
    expect(tagsOf(view, 'stage2')).toEqual(['Plan goal']);
  });

  it('adds "{name} reached this stage." when the plan stage is complete, known, or an explored taste', () => {
    const reached = (state: string, stage: StageKey) =>
      classView([plan({ id: 'plan:c', items: [quest(stage === 'stage1' ? 'quest:stage1-life-q1' : 'quest:stage2-life-q1')] })], {
        journey: journey(journeyRows({ [stage]: { state } } as Parameters<typeof journeyRows>[0]), 'stage4'),
      }).card.goal?.reached;
    expect(reached('complete', 'stage1')).toBe('Sam reached this stage.');
    expect(reached('known', 'stage1')).toBe('Sam reached this stage.');
    expect(reached('explored', 'stage2')).toBe('Sam reached this stage.');
    expect(reached('open', 'stage2')).toBeNull();
  });

  it('drops the can-do line once the plan stage is reached, as the learner card does (section 6.1)', () => {
    const goal = classView([plan({ id: 'plan:c', items: [quest('quest:stage1-life-q1')] })], { journey: journey(journeyRows({ stage1: { state: 'complete' } }), 'stage4') }).card.goal;
    expect(goal).toMatchObject({ reached: 'Sam reached this stage.', canDoLead: null, canDo: null });
  });

  it('a draft, an archived plan, a plan for another learner, a classic plan or a finished plan never sets the goal', () => {
    for (const p of [
      plan({ id: 'plan:draft', publishedAt: null }),
      plan({ id: 'plan:archived', archivedAt: '2026-10-08T00:00:00.000Z' }),
      plan({ id: 'plan:other', targetLearnerIds: ['learner:mina'] }),
      plan({ id: 'plan:classic', meta: null }),
      plan({ id: 'plan:none', meta: undefined }),
      plan({ id: 'plan:done', meta: meta('2026-09-01') }),
    ]) {
      expect(classView([p]).card.goal?.case, p.id).toBe(3);
    }
  });

  it('counts a plan that targets this learner, and keeps a plan on its last day', () => {
    expect(classView([plan({ id: 'plan:me', targetLearnerIds: ['learner:mina', 'learner:sam'] })]).card.goal?.case).toBe(2);
    // Four weeks from Sep 14: the last day is Oct 11, today.
    expect(classView([plan({ id: 'plan:last', meta: meta('2026-09-14') })]).card.goal).toMatchObject({ case: 2, planEnds: 'Plan ends Oct 11' });
    expect(classView([plan({ id: 'plan:over', meta: meta('2026-09-13') })]).card.goal?.case).toBe(3);
  });

  it('takes the newest publishedAt among several live plans', () => {
    const older = plan({ id: 'plan:old', items: [quest('quest:stage4-rites-q1')], publishedAt: '2026-10-01T09:00:00.000Z' });
    const newer = plan({ id: 'plan:new', items: [quest('quest:stage1-life-q1')], publishedAt: '2026-10-09T09:00:00.000Z' });
    expect(classView([older, newer]).card.goal?.stage).toBe('stage1');
    expect(classView([newer, older]).card.goal?.stage).toBe('stage1');
  });

  it("never reads summary.routeGoal or summary.selfRoute for a class, even if they arrive", () => {
    const view = classView([], { routeGoal: { stage: 'stage4', from: 'self' }, selfRoute: { done: 1, total: 2, notReady: 0, weeks: 4, endsOn: '2026-12-20' } });
    expect(view.card.goal).toMatchObject({ case: 3, stage: 'stage1' });
    expect(JSON.stringify(view)).not.toContain('Dec 20');
    expect(textsOf(view).filter((t) => /['’]s goal\b|\bgoal:/i.test(t))).toEqual([]);
  });

  it("words a family viewer's own plan the same way when the device has not sent its goal (an older build)", () => {
    const view = ready({ plans: [plan({ id: 'plan:f', items: [quest('quest:stage4-rites-q1')] })] });
    expect(view.card.goal).toMatchObject({ case: 2, stage: 'stage4', line: "Your family's weekly plan reaches Stage 4 · Dialogue", planEnds: 'Plan ends Nov 1' });
  });
});

describe('case 3: no plan this space holds, so the next open stage', () => {
  it('names the next open stage, asserts nothing about the learner goal and tags nothing', () => {
    const view = ready({ space: { id: 'space:c', kind: 'class' } });
    expect(view.card.goal).toEqual({
      case: 3,
      stage: 'stage1',
      line: 'Next open stage: Stage 1 · Hangul',
      from: null,
      reached: null,
      planEnds: null,
      canDoLead: 'By the end of this stage, Sam can:',
      canDo: canDo[1],
      familyPlan: null,
    });
    expect(view.stages.flatMap((r) => (r.kind === 'stage' ? r.tags.map((t) => t.kind) : []))).toEqual(['here']);
  });

  it('moves on as stages finish, and says the end of the open road when no stage is open', () => {
    const at = (over: Parameters<typeof journeyRows>[0]) => ready({ learners: withSummary({ journey: journey(journeyRows(over), null) }) }).card;
    expect(at({ stage1: { state: 'complete' } }).goal?.line).toBe('Next open stage: Stage 2 · Words');
    expect(at({ stage1: { state: 'complete' }, stage2: { state: 'explored' } }).goal?.line).toBe('Next open stage: Stage 4 · Dialogue');
    expect(at({ stage1: { state: 'known' }, stage2: { state: 'explored' }, stage4: { state: 'explored' } })).toEqual({
      now: null,
      goal: null,
      endOfRoad: 'Sam reached the end of the open road. More is coming.',
    });
  });
});

describe("grown-up honesty and the hard rules (sections 6.1 and 7.3)", () => {
  it("never claims the learner's own goal outside case 1", () => {
    const views = [
      ready({ space: { id: 'space:c', kind: 'class' }, plans: [plan({ id: 'plan:c' })] }),
      ready({ space: { id: 'space:c', kind: 'class' } }),
      ready({ plans: [plan({ id: 'plan:f' })] }),
      ready(),
    ];
    for (const view of views) {
      expect(view.card.goal?.case).not.toBe(1);
      expect(textsOf(view).filter((t) => /['’]s goal\b|\bgoal:/i.test(t))).toEqual([]);
    }
  });

  it('has no ranking, comparison, lateness, price or billing words anywhere in a view', () => {
    const view = ready({ learners: withSummary({ routeGoal: { stage: 'stage2', from: 'family' }, placement: placement() }), plans: [plan({ id: 'plan:f' })] });
    for (const text of textsOf(view)) {
      expect(text.toLowerCase()).not.toMatch(/\b(behind|ahead|average|rank|late|overdue|deadline|days left|to go|premium|billing|price|subscri\w*)\b/);
    }
  });

  it('exports nothing that averages, sorts or compares learners', () => {
    expect(Object.keys(viewModule).sort()).toEqual(['goalSourcesOf', 'learningRouteView', 'planEndText']);
  });
});

describe('goalSourcesOf: the console sources of section 4.1 ("Who passes which sources")', () => {
  it('keeps published, unarchived plans that reach the learner, as sources of the space kind assigned when published', () => {
    const plans = [
      plan({ id: 'plan:all' }),
      plan({ id: 'plan:me', targetLearnerIds: ['learner:sam'], publishedAt: '2026-10-06T09:00:00.000Z' }),
      plan({ id: 'plan:other', targetLearnerIds: ['learner:mina'] }),
      plan({ id: 'plan:draft', publishedAt: null }),
      plan({ id: 'plan:archived', archivedAt: '2026-10-08T00:00:00.000Z' }),
      plan({ id: 'plan:classic', meta: undefined }),
    ];
    const sources = goalSourcesOf(plans, 'class', 'learner:sam');
    expect(sources.map((s) => s.id)).toEqual(['plan:all', 'plan:me', 'plan:classic']);
    expect(sources[0]).toEqual({ id: 'plan:all', kind: 'class', assignedAt: '2026-10-05T09:00:00.000Z', items: plans[0]?.items, meta: plans[0]?.meta });
    expect(sources[2]?.meta).toBeNull();
    expect(goalSourcesOf(plans, 'family', 'learner:sam').every((s) => s.kind === 'family')).toBe(true);
  });

  it('reads a meta it cannot parse as no curriculum, so a malformed plan never throws and sets no goal', () => {
    const broken = [{ kind: 'curriculum', weeks: 'nope' }, { kind: 'curriculum' }, { ...meta(), params: null }, 'meta', 7] as unknown as PlanView['meta'][];
    for (const bad of broken) {
      const p = plan({ id: 'plan:bad', meta: bad });
      expect(goalSourcesOf([p], 'class', 'learner:sam')).toEqual([{ id: 'plan:bad', kind: 'class', assignedAt: p.publishedAt, items: p.items, meta: null }]);
      expect(ready({ space: { id: 'space:c', kind: 'class' }, plans: [p] }).card.goal?.case).toBe(3);
    }
  });

  it('with no learner keeps only the plans for everyone (the class line, section 6.3)', () => {
    const plans = [plan({ id: 'plan:all' }), plan({ id: 'plan:me', targetLearnerIds: ['learner:sam'] }), plan({ id: 'plan:empty', targetLearnerIds: [] })];
    expect(goalSourcesOf(plans, 'class', null).map((s) => s.id)).toEqual(['plan:all']);
  });
});

describe('planEndText: the grown-up plan end (LR-OD-7)', () => {
  it('words a day this year without the year, another year with it, and nothing for a bad day key', () => {
    expect(planEndText('2026-12-20', TODAY)).toBe('Plan ends Dec 20');
    expect(planEndText('2027-01-09', TODAY)).toBe('Plan ends Jan 9, 2027');
    expect(planEndText('not a day', TODAY)).toBeNull();
    expect(planEndText('2026-02-30', TODAY)).toBeNull();
    expect(planEndText(null, TODAY)).toBeNull();
    expect(planEndText(undefined, TODAY)).toBeNull();
  });

  it('reads the date in UTC, so the day never shifts with the browser time zone', () => {
    for (const zone of ['America/Los_Angeles', 'Asia/Seoul']) {
      vi.stubEnv('TZ', zone);
      expect(planEndText('2026-11-01', TODAY), zone).toBe('Plan ends Nov 1');
      expect(planEndText('2027-01-01', TODAY), zone).toBe('Plan ends Jan 1, 2027');
    }
  });
});

describe('the shared catalogue by default', () => {
  it('reads the shipped catalogue when the page passes none', () => {
    const { catalog: _omitted, ...rest } = input({ space: { id: 'space:c', kind: 'class' }, plans: [plan({ id: 'plan:c', items: [quest('quest:not-in-any-catalogue')] })] });
    const view = learningRouteView(rest);
    expect(view?.status).toBe('ready');
    // An unknown quest never moves the plan goal: the plan reaches its level stage.
    expect(view?.status === 'ready' ? view.card.goal : null).toMatchObject({ case: 2, stage: 'stage1', line: "Your class's weekly plan reaches Stage 1 · Hangul" });
  });
});

describe('every stage the journey can name gets a can-do line from the dictionary', () => {
  it('for the seven stages', () => {
    const rows = journeyRows(Object.fromEntries(StageKeySchema.options.map((s) => [s, { state: 'open', done: 1 }])));
    const view = ready({ learners: withSummary({ journey: journey(rows) }) });
    expect(view.stages.map((r) => (r.kind === 'stage' ? r.canDo : null))).toEqual([1, 2, 3, 4, 5, 6, 7].map((n) => canDo[n as keyof typeof canDo]));
  });
});

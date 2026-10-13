import { describe, expect, it } from 'vitest';
import type { StageKey } from '@hangul-route/content-schema';
import {
  canDoCopy,
  cellWord,
  goalPipsWord,
  heroCopy,
  newQuestsCopy,
  routeCardCopy,
  skillCopy,
  skillsNoteCopy,
  skillsTitle,
  stageA11yLabel,
  stageCaptions,
  stageStateWord,
  stageTags,
  tilesCopy,
  trailEntries,
  viewingCopy,
  type CopyContext,
  type MyRouteMessages,
} from '../copy';
import { buildMyRoute } from '../model';
import type { CurriculumMeta, GoalSource } from '@hangul-route/content-schema';
import type { RouteNext } from '../../route-next';
import type { MyRouteInput, MyRouteModel, SeenRecord } from '../types';
import { copyViolations, type Surface } from './copy-rules';
import { BUNDLE_15, BUNDLE_8, STAGE1_8, STAGE_DEFS, THEME_DEFS, catalogOf, snapshotWith, type Bundle } from './fixtures/bundle-2026-10';
import { DRAFT_EN } from './fixtures/messages-draft';
import { seed } from './fixtures/route';

const self: CopyContext = { viewer: 'self', name: 'Sam', m: DRAFT_EN };
const grownup: CopyContext = { viewer: 'grownup', name: 'Sam', m: DRAFT_EN };

const model = (done: string[], over: Partial<MyRouteInput> = {}, bundle: Bundle = BUNDLE_8, extra = {}): MyRouteModel =>
  buildMyRoute({
    snapshot: snapshotWith(done, extra),
    catalog: catalogOf(bundle),
    episodes: bundle.episodes,
    quests: bundle.quests,
    cards: [],
    stages: STAGE_DEFS,
    themes: THEME_DEFS,
    isEntitled: () => true,
    route: null,
    now: new Date('2026-10-11T00:00:00.000Z'),
    ...over,
  });
const row = (m: MyRouteModel, stage: StageKey) => m.stages.find((s) => s.stage === stage) as MyRouteModel['stages'][number];
const APPENDIX_C = ['quest:stage1-letters-q1', 'quest:stage1-letters-q2', 'quest:stage1-letters-q3', 'quest:stage1-life-q1'];
const ALL_8 = BUNDLE_8.quests.map((q) => q.id);

describe('heroCopy (F-ROUTE-001 section 3.5)', () => {
  it('start: the route line, the goal line and Start', () => {
    expect(heroCopy(model([]), self, { nextTitle: 'Meet the First Letters', hasStories: false })).toEqual({
      lines: ['Your Learning Route starts here.', 'Your first goal: read every Hangul letter.'],
      cta: { action: 'quest', label: 'Start' },
    });
  });

  it('continue: the stage line, the next quest and Continue', () => {
    expect(heroCopy(model(APPENDIX_C), self, { nextTitle: 'Family at the Table', hasStories: false })).toEqual({
      lines: ['You are on Stage 1: Hangul.', 'Next: Family at the Table'],
      cta: { action: 'quest', label: 'Continue' },
    });
    expect(heroCopy(model(APPENDIX_C), self, { nextTitle: null, hasStories: false }).lines).toEqual(['You are on Stage 1: Hangul.']);
  });

  it('rest and beyond offer stories when a reviewed story exists, else the Library', () => {
    expect(heroCopy(model(ALL_8), self, { nextTitle: null, hasStories: true })).toEqual({
      lines: ['You did everything that is open right now. More is coming.'],
      cta: { action: 'stories', label: 'Open stories' },
    });
    expect(heroCopy(model(ALL_8, { route: seed([], { beyondContent: true }) }), self, { nextTitle: null, hasStories: false })).toEqual({
      lines: ['You know a lot! More adventures are coming.'],
      cta: { action: 'library', label: 'Open Library' },
    });
  });

  it('read-only (a grown-up viewing a child): third person and no button', () => {
    expect(heroCopy(model([]), grownup, { nextTitle: null, hasStories: true })).toEqual({
      lines: ["Sam's Learning Route starts here.", 'First goal: read every Hangul letter.'],
      cta: null,
    });
    expect(heroCopy(model(APPENDIX_C), grownup, { nextTitle: 'Family at the Table', hasStories: true })).toEqual({
      lines: ['Sam is on Stage 1: Hangul.', 'Next: Family at the Table'],
      cta: null,
    });
    expect(heroCopy(model(ALL_8), grownup, { nextTitle: null, hasStories: true }).lines).toEqual(['Sam did everything that is open right now. More is coming.']);
    expect(heroCopy(model(ALL_8, { route: seed([], { beyondContent: true }) }), grownup, { nextTitle: null, hasStories: true }).lines).toEqual([
      'Sam knows a lot! More adventures are coming.',
    ]);
  });
});

describe('heroCopy: the free-end hero (Learning Route amendment section 4.5, LR-5b)', () => {
  const freeEnd = (): MyRouteModel => model(STAGE1_8, { routeNext: { kind: 'free-end', placedOut: false } });

  it('the calm open-for-you line and Practice words when a free word topic is playable in this build', () => {
    expect(heroCopy(freeEnd(), self, { nextTitle: null, hasStories: true, canPracticeWords: true })).toEqual({
      lines: ['You played every quest that is open for you.'],
      cta: { action: 'practice', label: 'Practice words' },
    });
  });

  it('Open Library when no free word topic is playable, whatever stories exist (never stories, never an ask)', () => {
    expect(heroCopy(freeEnd(), self, { nextTitle: null, hasStories: true })).toEqual({
      lines: ['You played every quest that is open for you.'],
      cta: { action: 'library', label: 'Open Library' },
    });
    expect(heroCopy(freeEnd(), self, { nextTitle: null, hasStories: false, canPracticeWords: false }).cta).toEqual({ action: 'library', label: 'Open Library' });
  });

  it('about a child (read-only): the third-person rest line and no button; never the learner\'s access words', () => {
    expect(heroCopy(freeEnd(), grownup, { nextTitle: null, hasStories: true, canPracticeWords: true })).toEqual({
      lines: ['Sam did everything that is open right now. More is coming.'],
      cta: null,
    });
  });
});

describe('stage words, captions and tags (sections 3.3, 3.11)', () => {
  it('Appendix C: Stage 1 open with "4 quests played", Stage 2 a taste, Stage 3 coming later with its can-do line', () => {
    const m = model(APPENDIX_C);
    expect(stageStateWord(row(m, 'stage1'), self)).toBe('Open');
    expect(stageCaptions(row(m, 'stage1'), self)).toEqual(['4 quests played']);
    expect(stageTags(row(m, 'stage1'), self)).toEqual(['You are here']);
    expect(stageStateWord(row(m, 'stage2'), self)).toBe('A taste');
    expect(stageCaptions(row(m, 'stage2'), self)).toEqual(['Ready when you are']);
    expect(stageStateWord(row(m, 'stage3'), self)).toBe('Coming later');
    expect(stageCaptions(row(m, 'stage3'), self)).toEqual(['Read and build short, simple sentences.', 'Coming later']);
    expect(stageTags(row(m, 'stage3'), self)).toEqual([]);
  });

  it('LR-5b: a stage whose every playable quest is not open reads "Not open yet" as its caption; its pill keeps the stage word', () => {
    const closed = model(['quest:stage1-letters-q1'], { isQuestOpen: (id) => !id.startsWith('quest:stage2-') });
    expect(stageStateWord(row(closed, 'stage2'), self)).toBe('A taste');
    expect(stageCaptions(row(closed, 'stage2'), self)).toEqual(['Not open yet']);
    expect(stageCaptions(row(closed, 'stage2'), grownup)).toEqual(['Not open yet']);
    // Stage 1 is open: its caption is unchanged.
    expect(stageCaptions(row(closed, 'stage1'), self)).toEqual(['1 quest played']);
  });

  it('LR-5b: a full stage whose every quest is not open never reads "Open" beside "Not open yet"', () => {
    const closed = model([], { isQuestOpen: () => false });
    expect(row(closed, 'stage1')).toMatchObject({ state: 'open', availability: 'open' });
    expect(stageStateWord(row(closed, 'stage1'), self)).toBe('Not open yet');
    expect(stageCaptions(row(closed, 'stage1'), self)).toEqual(['Not open yet']);
    for (const ctx of [self, grownup])
      for (const r of closed.stages) {
        const words = [stageStateWord(r, ctx), ...stageCaptions(r, ctx)];
        expect(words.includes('Open') && words.includes('Not open yet'), r.stage).toBe(false);
      }
  });

  it('LR-5b: a kept quest is open, so a stage with one kept quest and the rest not open keeps its played caption', () => {
    const kept = model(['quest:stage2-life-q1'], { isQuestOpen: (id) => !id.startsWith('quest:stage2-') });
    expect(stageCaptions(row(kept, 'stage2'), self)).toEqual(['1 quest played']);
    // Every quest open (subscribers, or the switch off): nothing reads "Not open yet".
    expect(stageCaptions(row(model([]), 'stage2'), self)).toEqual(['Ready when you are']);
  });

  it('complete, latched with new quests: "New quests joined" is added', () => {
    const m = model(STAGE1_8, {}, BUNDLE_15, { stageDoneAt: { stage1: '2026-10-01T00:00:00.000Z' } });
    expect(stageStateWord(row(m, 'stage1'), self)).toBe('Complete');
    expect(stageCaptions(row(m, 'stage1'), self)).toEqual(['8 quests played', 'New quests joined']);
    expect(stageCaptions(row(model(STAGE1_8), 'stage1'), self)).toEqual(['8 quests played']);
  });

  it('known and explored, for the learner and about the child', () => {
    const known = model([], { route: seed(STAGE1_8) });
    expect(stageStateWord(row(known, 'stage1'), self)).toBe('You knew this');
    expect(stageCaptions(row(known, 'stage1'), self)).toEqual(['You knew this']);
    expect(stageStateWord(row(known, 'stage1'), grownup)).toBe('Sam already knew this.');
    const explored = model(['quest:stage2-life-q1', 'quest:stage2-nature-q1']);
    expect(stageStateWord(row(explored, 'stage2'), self)).toBe('Explored');
    expect(stageCaptions(row(explored, 'stage2'), self)).toEqual(['You explored everything that is open right now']);
    expect(stageCaptions(row(explored, 'stage2'), grownup)).toEqual(['Sam explored everything that is open right now']);
    expect(stageCaptions(row(model([]), 'stage1'), grownup)).toEqual(['Ready when Sam is']);
    expect(stageTags(row(model([]), 'stage1'), grownup)).toEqual(['Sam is here']);
  });

  it('the start tag, for the learner and about the child', () => {
    const r = { ...row(model([]), 'stage1'), isStart: true };
    expect(stageTags(r, self)).toEqual(['You are here', 'You started here']);
    expect(stageTags(r, grownup)).toEqual(['Sam is here', 'Sam started here.']);
  });

  it('cell words: Complete, Playing, You knew this, Open, Coming later', () => {
    const m = model(['quest:stage1-letters-q1', 'quest:stage1-letters-q2', 'quest:stage1-letters-q3', 'quest:stage1-life-q1'], { route: seed(['quest:stage1-nature-q1']) });
    expect(row(m, 'stage1').cells.map((c) => cellWord(c, self))).toEqual(['Complete', 'Playing', 'Open', 'You knew this', 'Open']);
    expect(cellWord(row(m, 'stage1').cells[3] as MyRouteModel['stages'][number]['cells'][number], grownup)).toBe('Sam already knew this.');
    expect(row(m, 'stage3').cells.map((c) => cellWord(c, self))).toEqual(Array(5).fill('Coming later'));
  });

  it('the can-do line of the expanded stage, for the learner and about the child', () => {
    expect(canDoCopy(row(model([]), 'stage1'), self)).toEqual({ lead: 'By the end of this stage you can:', line: 'Read any Hangul letter and syllable and know its sound.' });
    expect(canDoCopy(row(model([]), 'stage7'), grownup)).toEqual({ lead: 'By the end of this stage, Sam can:', line: 'Write a few sentences about daily life and favorite things.' });
  });

  it('a stage that is later only because it is not entitled reads "Not open yet", never "Coming later" (OD-4 other branch)', () => {
    const m = model([], { isEntitled: (s) => s === 'stage1' });
    expect(row(m, 'stage2').state).toBe('later');
    expect(stageStateWord(row(m, 'stage2'), self)).toBe('Not open yet');
    expect(stageCaptions(row(m, 'stage2'), self)).toEqual(['Read everyday words and know what they mean.', 'Not open yet']);
    expect(row(m, 'stage2').cells.map((c) => cellWord(c, self))).toEqual(['Coming later', 'Not open yet', 'Coming later', 'Not open yet', 'Coming later']);
    expect(stageStateWord(row(m, 'stage3'), self)).toBe('Coming later');
    expect(stageA11yLabel(row(m, 'stage4'), self)).toBe('Stage 4, Dialogue. Not open yet.');
  });

  it('the row label reads the row for a screen reader', () => {
    expect(stageA11yLabel(row(model(APPENDIX_C), 'stage1'), self)).toBe('Stage 1, Hangul. Open. You are here. 4 quests played.');
    expect(stageA11yLabel(row(model(APPENDIX_C), 'stage1'), grownup)).toBe('Stage 1, Hangul. Open. Sam is here. 4 quests played.');
    expect(stageA11yLabel(row(model(APPENDIX_C), 'stage2'), self)).toBe('Stage 2, Words. A taste.');
  });
});

describe('trailEntries (section 3.11: consecutive coming-later stages merge)', () => {
  it('today: Stage 3 alone, Stages 5 to 7 as one row', () => {
    const entries = trailEntries(model([]), self);
    expect(entries.map((e) => (e.kind === 'stage' ? e.row.stage : `${e.stages.join('+')}: ${e.label}`))).toEqual([
      'stage1',
      'stage2',
      'stage3: Coming later',
      'stage4',
      'stage5+stage6+stage7: Stages 5 to 7',
    ]);
  });

  it('consecutive coming-later stages merge into one row', () => {
    const entries = trailEntries(model([], {}, { episodes: BUNDLE_8.episodes.filter((e) => e.stage !== 'stage2' && e.stage !== 'stage4'), quests: BUNDLE_8.quests }), self);
    expect(entries.map((e) => (e.kind === 'stage' ? e.row.stage : e.label))).toEqual(['stage1', 'Stages 2 to 7']);
  });

  it('a not-open-yet stage keeps its own row and never joins a coming-later run', () => {
    const entries = trailEntries(model([], { isEntitled: (s) => s === 'stage1' }), self);
    expect(entries.map((e) => (e.kind === 'stage' ? e.row.stage : `${e.stages.join('+')}: ${e.label}`))).toEqual([
      'stage1',
      'stage2',
      'stage3: Coming later',
      'stage4',
      'stage5+stage6+stage7: Stages 5 to 7',
    ]);
  });
});

describe('the other lines', () => {
  it('one new-quests line, for the learner only', () => {
    const seen: SeenRecord = { totals: { stage1: 8 }, doneKeys: [], at: 't' };
    const m = model([], { seen }, BUNDLE_15);
    expect(newQuestsCopy(m, self)).toBe('7 new quests joined Stage 1.');
    expect(newQuestsCopy(m, grownup)).toBeNull();
    expect(newQuestsCopy(model([]), self)).toBeNull();
  });

  it('skill rows: the word and an absolute count, or "Ready when you are"', () => {
    const m = model(APPENDIX_C);
    expect(skillsTitle(self)).toBe('What your quests practice');
    expect(skillsTitle(grownup)).toBe("What Sam's quests practice");
    expect(m.skills.map((s) => skillCopy(s, self))).toEqual([
      { label: 'Read', detail: 'In 4 quests you finished' },
      { label: 'Listen', detail: 'In 4 quests you finished' },
      { label: 'Write', detail: 'In 1 quest you finished' },
    ]);
    expect(skillCopy(m.skills[0] as MyRouteModel['skills'][number], grownup)).toEqual({ label: 'Read', detail: 'In 4 quests Sam finished' });
    expect(skillCopy({ skill: 'write', marks: 0, nextReachable: true, quests: 0 }, self)).toEqual({ label: 'Write', detail: 'Ready when you are' });
    expect(skillCopy({ skill: 'listen', marks: 0, nextReachable: true, quests: 0 }, grownup)).toEqual({ label: 'Listen', detail: 'Ready when Sam is' });
  });

  it('grown-up only: the skills note, the tiles line and the viewing line', () => {
    const m = model(APPENDIX_C);
    expect(skillsNoteCopy(self)).toBeNull();
    expect(skillsNoteCopy(grownup)).toBe(DRAFT_EN.skillsNote);
    expect(tilesCopy(m, self)).toBeNull();
    expect(tilesCopy(m, grownup)).toBe('Spelling with tiles: 2 quests');
    expect(tilesCopy(model([]), grownup)).toBeNull();
    expect(viewingCopy(self)).toBeNull();
    expect(viewingCopy(grownup)).toBe("Viewing Sam's Learning Route");
  });
});

type Rendered = { path: string; text: string; surface: Surface; args: unknown[] };

/**
 * Realistic arguments for every message that takes some, keyed by its path:
 * counts in {1, 2, 7}, real stage titles and orders, a real name. A message
 * missing here fails the "every message has samples" test, so a new key must
 * add its own.
 */
const N = [1, 2, 7];
const NAMES = ['Sam', 'Alex'];
const TITLES: Array<[number, string]> = [
  [1, 'Hangul'],
  [2, 'Words'],
  [7, 'Self-expression'],
];
const QUEST_TITLES = ['Family at the Table', 'Meet the First Letters'];
const STATE_WORDS = ['Open', 'Complete', 'Coming later'];
const SAMPLES: Record<string, unknown[][]> = {
  'learner.myRoute.hero.here': TITLES,
  'learner.myRoute.hero.next': QUEST_TITLES.map((t) => [t]),
  'learner.myRoute.caption.played': N.map((n) => [n]),
  'learner.myRoute.laterGroup': [
    [5, 7],
    [2, 3],
  ],
  'learner.myRoute.newQuests': N.map((n) => [n, 1]),
  'learner.myRoute.skill.quests': N.map((n) => [n]),
  'caregiver.journey.here': NAMES.flatMap((name) => TITLES.map(([n, t]) => [name, n, t])),
  'caregiver.journey.next': QUEST_TITLES.map((t) => [t]),
  'caregiver.journey.canDoLead': NAMES.map((n) => [n]),
  'caregiver.journey.started': NAMES.map((n) => [n]),
  'caregiver.journey.known': NAMES.map((n) => [n]),
  'caregiver.journey.quests': NAMES.flatMap((name) => N.map((n) => [name, n])),
  'caregiver.journey.viewing': NAMES.map((n) => [n]),
  'caregiver.journey.tiles': N.map((n) => [n]),
  'caregiver.journey.start': NAMES.map((n) => [n]),
  'caregiver.journey.rest': NAMES.map((n) => [n]),
  'caregiver.journey.beyond': NAMES.map((n) => [n]),
  'caregiver.journey.hereTag': NAMES.map((n) => [n]),
  'caregiver.journey.ready': NAMES.map((n) => [n]),
  'caregiver.journey.explored': NAMES.map((n) => [n]),
  'caregiver.journey.skillsTitle': NAMES.map((n) => [n]),
  'a11y.myRoute.stage': TITLES.flatMap(([n, t]) => STATE_WORDS.map((w, i) => [n, t, w, i === 0, i === 1, N[i]])),
  'a11y.myRoute.stageGrownup': TITLES.flatMap(([n, t]) => STATE_WORDS.map((w, i) => ['Sam', n, t, w, i === 0, i === 1, N[i]])),
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
};

/** Every string the drafts can render, with the realistic arguments it was called with. */
function renderAll(m: MyRouteMessages): { rendered: Rendered[]; unsampled: string[] } {
  const rendered: Rendered[] = [];
  const unsampled: string[] = [];
  const walk = (node: unknown, path: string, surface: Surface): void => {
    if (typeof node === 'string') rendered.push({ path, text: node, surface, args: [] });
    else if (typeof node === 'function') {
      const samples = SAMPLES[path];
      if (samples === undefined) unsampled.push(path);
      for (const args of samples ?? []) rendered.push({ path, text: (node as (...a: unknown[]) => string)(...args), surface, args });
    } else if (node !== null && typeof node === 'object') for (const [k, v] of Object.entries(node)) walk(v, `${path}.${k}`, surface);
  };
  walk(m.learner, 'learner.myRoute', 'learner');
  walk(m.grownup, 'caregiver.journey', 'caregiver');
  walk(m.skillsNote, 'caregiver.skillsNote', 'caregiver');
  walk(m.a11y, 'a11y.myRoute', 'a11y');
  return { rendered, unsampled };
}

/** Second person, in any form. */
const YOU = /\byou(r|rs|rself|'re|'ve|'ll)?\b/i;

describe('copy rules on the Appendix B drafts (section 3.13)', () => {
  const { rendered, unsampled } = renderAll(DRAFT_EN);

  it('renders every string, every message with realistic samples', () => {
    expect(unsampled).toEqual([]);
    expect(rendered.length).toBeGreaterThan(60);
    expect(rendered.find((r) => r.path === 'learner.myRoute.hero.here')?.text).toBe('You are on Stage 1: Hangul.');
  });

  for (const { path, text, surface, args } of rendered) {
    it(`${path} → "${text}" keeps the rules`, () => {
      expect(copyViolations(text, 'en', surface, args)).toEqual([]);
    });
  }

  it('the grown-up dictionary slice is written about the child, never to them', () => {
    for (const { text } of rendered.filter((r) => r.path.startsWith('caregiver.journey') || r.path === 'a11y.myRoute.stageGrownup'))
      expect(text).not.toMatch(YOU);
  });

});

describe('copyViolations catches each rule', () => {
  const cases: Array<[string, Surface, unknown[], string]> = [
    ['You are behind.', 'learner', [], 'banned "behind"'],
    ['3 left', 'learner', [3], 'banned "left"'],
    ['Your level', 'learner', [], 'banned "level"'],
    ['Say it with Hoya', 'learner', [], 'speaking word "say it"'],
    ['You missed one', 'learner', [], 'shared banned "missed"'],
    ['Go ▶', 'learner', [], 'emoji-capable symbol'],
    ['Done 🎉', 'learner', [], 'emoji-capable symbol'],
    ['50% done', 'a11y', [], 'percent'],
    ['4 / 8', 'a11y', [], 'ratio'],
    ['Stage 2', 'learner', [], 'digit not from an argument'],
  ];
  for (const [text, surface, args, rule] of cases)
    it(`${text} -> ${rule}`, () => {
      expect(copyViolations(text, 'en', surface, args)).toContain(rule);
    });

  it('a string argument (a band label, a formatted date) clears only its own digits', () => {
    expect(copyViolations('Started: Stage 1 · Letters · Oct 9', 'en', 'caregiver', [1, 'Letters', 'Oct 9'])).toEqual([]);
    // A digit the template wrote is still caught next to a string argument.
    expect(copyViolations('Started: Stage 2 · Oct 9', 'en', 'caregiver', ['Oct 9'])).toContain('digit not from an argument');
    // A ratio or a percent carried by a string argument is still caught: those rules read the whole text.
    expect(copyViolations('Started: 3/8', 'en', 'caregiver', ['3/8'])).toContain('ratio');
    expect(copyViolations('Started: 40%', 'en', 'caregiver', ['40%'])).toContain('percent');
  });

  it('lets a grown-up name the level check, and a11y carry digits', () => {
    expect(copyViolations('The level check looks at reading.', 'en', 'caregiver')).toEqual([]);
    expect(copyViolations('Stage 2, Words.', 'en', 'a11y')).toEqual([]);
  });

  it('matches es by whole word and ko by substring', () => {
    expect(copyViolations('Te quedan dos', 'es', 'learner')).toContain('banned "quedan"');
    expect(copyViolations('Tu nivel', 'es', 'caregiver')).toEqual([]);
    expect(copyViolations('남은 퀘스트', 'ko', 'learner')).toContain('banned "남은"');
    expect(copyViolations('발음해 보세요', 'ko', 'learner')).toContain('speaking word "발음"');
  });

  it('bans a date or a distance to the goal (AMENDMENTS-ROUTE-LEARNING-ROUTE section 7.3, LR-1)', () => {
    for (const word of ['deadline', 'due', 'overdue', 'days left', 'to go', 'away from']) {
      expect(copyViolations(`Hoya says ${word} here`, 'en', 'learner'), word).toContain(`banned "${word}"`);
      expect(copyViolations(`Sam says ${word} here`, 'en', 'caregiver'), word).toContain(`banned "${word}"`);
    }
    // Whole words only: "Ready to play" and "duet" stay allowed.
    expect(copyViolations('Ready to play', 'en', 'learner')).toEqual([]);
    expect(copyViolations('A duet', 'en', 'learner')).toEqual([]);
    expect(copyViolations('La fecha límite', 'es', 'learner')).toContain('banned "fecha límite"');
    expect(copyViolations('마감까지', 'ko', 'learner')).toContain('banned "마감"');
    expect(copyViolations('기한까지 끝내기', 'ko', 'learner')).toContain('banned "기한까지"');
    // ko matches substrings: 신기한 ("amazing") holds 기한 and must stay allowed.
    expect(copyViolations('신기한 이야기', 'ko', 'learner')).toEqual([]);
  });
});

describe('viewer grownup: every selector output is third person (section 3.12)', () => {
  const ENTITLEMENTS: Array<MyRouteInput['isEntitled']> = [() => true, (s) => s === 'stage1'];
  const latched = { stageDoneAt: { stage1: '2026-10-01T00:00:00.000Z' } };
  const models: MyRouteModel[] = [
    ...ENTITLEMENTS.flatMap((isEntitled) => [
      model([], { isEntitled }),
      model(APPENDIX_C, { isEntitled }),
      model(ALL_8, { isEntitled }),
      model([], { isEntitled, route: seed(STAGE1_8) }),
      model(['quest:stage2-life-q1', 'quest:stage2-nature-q1'], { isEntitled }),
      model(ALL_8, { isEntitled, route: seed([], { beyondContent: true }) }),
      model(STAGE1_8, { isEntitled }, BUNDLE_15, latched),
    ]),
  ];
  const outputs = (m: MyRouteModel): string[] => {
    const out: string[] = [];
    for (const nextTitle of [null, 'Family at the Table'])
      for (const hasStories of [true, false]) {
        const hero = heroCopy(m, grownup, { nextTitle, hasStories });
        out.push(...hero.lines);
        expect(hero.cta).toBeNull();
      }
    for (const r of m.stages) {
      out.push(stageStateWord(r, grownup), ...stageCaptions(r, grownup), ...stageTags({ ...r, isStart: true }, grownup), stageA11yLabel(r, grownup));
      const can = canDoCopy(r, grownup);
      out.push(can.lead, can.line, ...r.cells.map((c) => cellWord(c, grownup)));
    }
    for (const e of trailEntries(m, grownup)) if (e.kind === 'later') out.push(e.label);
    for (const sk of m.skills) {
      const c = skillCopy(sk, grownup);
      out.push(c.label, c.detail);
    }
    out.push(skillsTitle(grownup), skillsNoteCopy(grownup) ?? '', tilesCopy(m, grownup) ?? '', viewingCopy(grownup) ?? '', newQuestsCopy(m, grownup) ?? '');
    // The route card (LR-3b), with the goal tag on its row.
    const ctx = { ...grownup, goalStage: m.goal?.stage ?? null };
    for (const nextTitle of [null, 'Family at the Table']) {
      const card = routeCardCopy(m, ctx, { nextTitle, firstReached: true, formatDay: () => 'Dec 20' });
      const where = card.where === null ? [] : card.where.kind === 'collapsed' ? [card.where.line] : [card.where.now?.line ?? '', card.where.goal.line];
      out.push(card.hoya ?? '', ...where, card.from ?? '', card.planEnds ?? '', card.canDo?.lead ?? '', card.tasteLine ?? '', card.next ?? '', card.a11yLabel);
    }
    for (const r of m.stages) out.push(...stageTags(r, ctx), stageA11yLabel(r, ctx));
    return out;
  };

  it('never says "you" in any form, across heroes, states, entitlements, latches and goals', () => {
    // Plan goals from every source, reached and not, and free-end, on top of the default goals above.
    for (const kind of ['class', 'school', 'family', 'self'] as const) {
      models.push(model(APPENDIX_C, { sources: [goalSource(kind)], routeNext: { kind: 'free-end', placedOut: false } }));
      models.push(model(['quest:stage2-life-q1', 'quest:stage2-nature-q1'], { sources: [goalSource(kind)] }));
      models.push(model(APPENDIX_C, { sources: [goalSource(kind, ['quest:stage1-life-q2'])] }));
    }
    expect(models.some((m) => m.goal?.reached === true) && models.some((m) => m.goal === null) && models.some((m) => m.hero === 'freeEnd')).toBe(true);
    expect(new Set(models.map((m) => m.hero))).toEqual(new Set(['start', 'continue', 'freeEnd', 'rest', 'beyond']));
    const states = new Set(models.flatMap((m) => m.stages.map((r) => r.state)));
    expect(states).toEqual(new Set(['complete', 'known', 'explored', 'open', 'later']));
    for (const m of models) for (const text of outputs(m)) expect(text, text).not.toMatch(YOU);
  });
});

/** A four-week curriculum meta from Oct 5 (live on the fixture's Oct 11). */
const META: CurriculumMeta = {
  kind: 'curriculum',
  generatorVersion: 1,
  catalogVersion: 4,
  params: {
    audience: 'class',
    level: { stage: 'stage1', band: 0 },
    startDate: '2026-10-05',
    weeks: 4,
    sessionsPerWeek: 2,
    minutesPerSession: 10,
    daysOff: [],
    goals: { focus: 'balanced' },
    includeComingSoon: true,
    culturalAnchors: true,
    unlockedStages: ['stage1'],
  },
  weeks: ['2026-10-05', '2026-10-12', '2026-10-19', '2026-10-26'].map((startDate, i) => ({
    index: i + 1,
    startDate,
    kind: 'learn' as const,
    focus: { episodeId: null, storyIds: [], festival: null },
    extras: [],
  })),
  horizonDays: 7,
  repacedAt: null,
};
function goalSource(kind: GoalSource['kind'], questIds: readonly string[] = ['quest:stage2-life-q1']): GoalSource {
  return { id: `plan:${kind}`, kind, assignedAt: '2026-10-05T09:00:00.000Z', items: questIds.map((id) => ({ kind: 'quest' as const, id })), meta: META };
}
const nextQuest = (questId: string, episodeId: string, stage: 'stage1' | 'stage2'): RouteNext => ({ kind: 'quest', questId, episodeId, stage, source: 'class', sourceId: 'plan:class' });
const LIFE_Q2 = nextQuest('quest:stage1-life-q2', 'episode:stage1-life', 'stage1');
const withGoal = (ctx: CopyContext, m: MyRouteModel): CopyContext => ({ ...ctx, goalStage: m.goal?.stage ?? null });
const formatDay = (day: string): string => (day === '2026-11-01' ? 'Nov 1' : day);

describe('routeCardCopy (Learning Route amendment sections 4.3, 6.2 and 10; LR-3b)', () => {
  it('goal ahead of now (a class plan reaching Stage 2): Now over Goal, the source, the goal stage can-do or taste line, Next', () => {
    const m = model(APPENDIX_C, { sources: [goalSource('class')], routeNext: LIFE_Q2 });
    expect(routeCardCopy(m, withGoal(self, m), { nextTitle: 'Family at the Table' })).toEqual({
      hoya: null,
      where: { kind: 'split', now: { label: 'Now', line: 'Stage 1 · Hangul' }, goal: { label: 'Goal', line: 'Explore Stage 2 · Words' } },
      from: "From your class's weekly plan",
      planEnds: null,
      canDo: null,
      tasteLine: 'Try the first quests of this stage.',
      next: 'Next: Family at the Table',
      showPips: true,
      a11yLabel: "Now: Stage 1, Hangul. Goal: Explore Stage 2, Words. From your class's weekly plan. Ready when you are. Next: Family at the Table.",
    });
  });

  it('goal equals now: one collapsed line, the can-do line and the goal pips in words', () => {
    const m = model(APPENDIX_C, { sources: [goalSource('family', ['quest:stage1-life-q2'])], routeNext: LIFE_Q2 });
    const card = routeCardCopy(m, withGoal(self, m), { nextTitle: 'Family at the Table' });
    expect(card.where).toEqual({ kind: 'collapsed', line: 'Stage 1 · Hangul: you are in your goal stage' });
    expect(card.from).toBe("From your family's weekly plan");
    expect(card.canDo).toEqual({ lead: 'By the end of this stage you can:', line: 'Read any Hangul letter and syllable and know its sound.' });
    expect(card.tasteLine).toBeNull();
    expect(card.a11yLabel).toBe(
      "Stage 1, Hangul: you are in your goal stage. From your family's weekly plan. Some quests done, more are ready. Next: Family at the Table.",
    );
  });

  it("the default goal is Hoya's suggestion; a taste stage it collapses into reads Explore", () => {
    const m = model(APPENDIX_C);
    expect(routeCardCopy(m, withGoal(self, m), { nextTitle: 'Family at the Table' }).from).toBe("Hoya's suggestion");
    const taste = model(STAGE1_8, { routeNext: nextQuest('quest:stage2-life-q1', 'episode:stage2-life', 'stage2') }, BUNDLE_8, { stageDoneAt: { stage1: '2026-10-01T00:00:00.000Z' } });
    expect(taste.goal).toMatchObject({ stage: 'stage2', taste: true, from: 'default' });
    const card = routeCardCopy(taste, withGoal(self, taste), { nextTitle: 'Lunch Box Words' });
    expect(card.where).toEqual({ kind: 'collapsed', line: 'Explore Stage 2 · Words: you are in your goal stage' });
    expect(card.tasteLine).toBe('Try the first quests of this stage.');
    expect(card.canDo).toBeNull();
    expect(routeCardCopy(taste, withGoal(grownup, taste), { nextTitle: 'Lunch Box Words' }).where).toEqual({
      kind: 'collapsed',
      line: 'Explore Stage 2 · Words: Sam is in the goal stage',
    });
  });

  it('a new learner: the start line instead of a Now line, the goal, the can-do line, Next', () => {
    const m = model([]);
    const card = routeCardCopy(m, withGoal(self, m), { nextTitle: 'Meet the First Letters' });
    expect(card.hoya).toBe('Your Learning Route starts here.');
    expect(card.where).toEqual({ kind: 'split', now: null, goal: { label: 'Goal', line: 'Stage 1 · Hangul' } });
    expect(card.canDo?.line).toBe('Read any Hangul letter and syllable and know its sound.');
    expect(card.next).toBe('Next: Meet the First Letters');
    expect(card.a11yLabel).toBe("Your Learning Route starts here. Goal: Stage 1, Hangul. Hoya's suggestion. Ready when you are. Next: Meet the First Letters.");
  });

  it('a reached goal: "· reached", the pips all done, Keep going, and the Hoya line only on the first visit', () => {
    const m = model(['quest:stage2-life-q1', 'quest:stage2-nature-q1'], { sources: [goalSource('class')], routeNext: nextQuest('quest:stage1-letters-q1', 'episode:stage1-letters', 'stage1') });
    expect(m.goal?.reached).toBe(true);
    const later = routeCardCopy(m, withGoal(self, m), { nextTitle: 'Meet the First Letters' });
    expect(later.hoya).toBeNull();
    expect(later.where).toEqual({ kind: 'split', now: { label: 'Now', line: 'Stage 1 · Hangul' }, goal: { label: 'Goal', line: 'Stage 2 · Words · reached' } });
    expect(later.canDo).toBeNull();
    expect(later.tasteLine).toBeNull();
    expect(later.next).toBe('Keep going: Meet the First Letters');
    expect(later.a11yLabel).toContain('Every quest here is done.');
    expect(routeCardCopy(m, withGoal(self, m), { nextTitle: 'Meet the First Letters', firstReached: true }).hoya).toBe('You reached your goal. Hoya is proud!');
    // Read-only never celebrates and names the child.
    const g = routeCardCopy(m, withGoal(grownup, m), { nextTitle: 'Meet the First Letters', firstReached: true });
    expect(g.hoya).toBeNull();
    expect(g.where).toEqual({ kind: 'split', now: { label: 'Now', line: 'Sam is on Stage 1: Hangul.' }, goal: { label: null, line: 'Sam reached the goal: Stage 2 · Words.' } });
    expect(g.next).toBe('Next: Meet the First Letters');
  });

  it('the first reached visit says so even when the hero rests, goes beyond or is free-end (LR-5c review)', () => {
    // The moment is used up on this visit (key written, event sent), so its one line must show on it.
    const m = model(['quest:stage2-life-q1', 'quest:stage2-nature-q1'], { sources: [goalSource('class')], routeNext: nextQuest('quest:stage1-letters-q1', 'episode:stage1-letters', 'stage1') });
    expect(m.goal?.reached).toBe(true);
    for (const hero of ['rest', 'beyond', 'freeEnd'] as const) {
      const withHero = { ...m, hero };
      expect(routeCardCopy(withHero, withGoal(self, withHero), { nextTitle: 'Meet the First Letters', firstReached: true }).hoya).toBe('You reached your goal. Hoya is proud!');
      // Later visits keep the hero's own line.
      expect(routeCardCopy(withHero, withGoal(self, withHero), { nextTitle: 'Meet the First Letters' }).hoya).not.toBe('You reached your goal. Hoya is proud!');
      // The grown-up card never celebrates.
      expect(routeCardCopy(withHero, withGoal(grownup, withHero), { nextTitle: 'Meet the First Letters', firstReached: true }).hoya).not.toBe('You reached your goal. Hoya is proud!');
    }
  });

  it('the end of the open road: one sentence, no goal line, no Next', () => {
    const m = model(ALL_8);
    expect(m.goal).toBeNull();
    expect(routeCardCopy(m, withGoal(self, m), { nextTitle: 'Family at the Table' })).toEqual({
      hoya: 'You reached the end of the open road. More is coming.',
      where: null,
      from: null,
      planEnds: null,
      canDo: null,
      tasteLine: null,
      next: null,
      showPips: false,
      a11yLabel: 'You reached the end of the open road. More is coming.',
    });
    expect(routeCardCopy(m, grownup, { nextTitle: null }).hoya).toBe('Sam reached the end of the open road. More is coming.');
  });

  it('no goal left but a quest still next: the card names Next and drops the end-of-road sentence, so it matches its button', () => {
    const m = model(ALL_8, { routeNext: nextQuest('quest:stage1-life-q2', 'episode:stage1-life', 'stage1') });
    expect(m.goal).toBeNull();
    expect(m.nextKind).toBe('quest');
    expect(routeCardCopy(m, withGoal(self, m), { nextTitle: 'Family at the Table' })).toEqual({
      hoya: null,
      where: null,
      from: null,
      planEnds: null,
      canDo: null,
      tasteLine: null,
      next: 'Next: Family at the Table',
      showPips: false,
      a11yLabel: 'Next: Family at the Table.',
    });
    expect(routeCardCopy(m, grownup, { nextTitle: 'Family at the Table' }).next).toBe('Next: Family at the Table');
    expect(routeCardCopy(m, grownup, { nextTitle: 'Family at the Table' }).hoya).toBeNull();
    // Without a title to name, the end-of-road sentence stays.
    expect(routeCardCopy(m, withGoal(self, m), { nextTitle: null }).hoya).toBe('You reached the end of the open road. More is coming.');
  });

  it('free-end: the goal line only (no Now line, never collapsed), no can-do line and no Next', () => {
    const m = model(STAGE1_8, { routeNext: { kind: 'free-end', placedOut: false } }, BUNDLE_8, { stageDoneAt: { stage1: '2026-10-01T00:00:00.000Z' } });
    expect(m.goal?.stage).toBe(m.stages.find((s) => s.here)?.stage);
    const card = routeCardCopy(m, withGoal(self, m), { nextTitle: 'Lunch Box Words' });
    expect(card.where).toEqual({ kind: 'split', now: null, goal: { label: 'Goal', line: 'Explore Stage 2 · Words' } });
    expect(card.canDo).toBeNull();
    expect(card.tasteLine).toBeNull();
    expect(card.next).toBeNull();
  });

  it('LR-5b free-end: the open-for-you line over the goal, no pips, and a summary without a pips word (LR-D state D)', () => {
    const m = model(STAGE1_8, { routeNext: { kind: 'free-end', placedOut: false } }, BUNDLE_8, { stageDoneAt: { stage1: '2026-10-01T00:00:00.000Z' } });
    const card = routeCardCopy(m, withGoal(self, m), { nextTitle: null });
    expect(card.hoya).toBe('You played every quest that is open for you.');
    expect(card.showPips).toBe(false);
    expect(card.a11yLabel).toBe("You played every quest that is open for you. Goal: Explore Stage 2, Words. Hoya's suggestion.");
    // About a child: the third-person rest line, never the learner's access words.
    expect(routeCardCopy(m, withGoal(grownup, m), { nextTitle: null }).hoya).toBe('Sam did everything that is open right now. More is coming.');
  });

  it('LR-5b: every card with a goal and not at free-end shows its goal pips', () => {
    expect(routeCardCopy(model(APPENDIX_C), withGoal(self, model(APPENDIX_C)), { nextTitle: null }).showPips).toBe(true);
    const rest = model(APPENDIX_C, { routeNext: { kind: 'rest' } });
    expect(routeCardCopy(rest, withGoal(self, rest), { nextTitle: null }).showPips).toBe(true);
  });

  it('rest and beyond keep their sentence above the goal', () => {
    const rest = model(APPENDIX_C, { routeNext: { kind: 'rest' } });
    expect(routeCardCopy(rest, self, { nextTitle: null }).hoya).toBe('You did everything that is open right now. More is coming.');
    expect(routeCardCopy(rest, grownup, { nextTitle: null }).hoya).toBe('Sam did everything that is open right now. More is coming.');
    const beyond = model(APPENDIX_C, { routeNext: { kind: 'rest' }, route: seed([], { beyondContent: true, needsStage: null }) });
    expect(routeCardCopy(beyond, self, { nextTitle: null }).hoya).toBe('You know a lot! More adventures are coming.');
    expect(routeCardCopy(beyond, grownup, { nextTitle: null }).hoya).toBe('Sam knows a lot! More adventures are coming.');
  });

  it('the grown-up card: third person, each source, and "Plan ends" only for a grown-up with a plan', () => {
    const sources = { class: "From the class's weekly plan", school: "From the school's weekly plan", family: "From the family's weekly plan", self: "From Sam's own weekly plan" } as const;
    for (const kind of ['class', 'school', 'family', 'self'] as const) {
      const m = model(APPENDIX_C, { sources: [goalSource(kind, ['quest:stage1-life-q2'])], routeNext: LIFE_Q2 });
      const card = routeCardCopy(m, withGoal(grownup, m), { nextTitle: 'Family at the Table', formatDay });
      expect(card.from).toBe(sources[kind]);
      expect(card.planEnds).toBe('Plan ends Nov 1');
      expect(card.where).toEqual({ kind: 'collapsed', line: 'Stage 1 · Hangul: Sam is in the goal stage' });
      expect(card.canDo?.lead).toBe('By the end of this stage, Sam can:');
      expect(card.a11yLabel).toBe(`Stage 1, Hangul: Sam is in the goal stage. ${sources[kind]}. Plan ends Nov 1. Some quests done, more are ready. Next: Family at the Table.`);
      // Never on a learner screen, and never without a formatter.
      expect(routeCardCopy(m, withGoal(self, m), { nextTitle: null, formatDay }).planEnds).toBeNull();
      expect(routeCardCopy(m, withGoal(grownup, m), { nextTitle: null }).planEnds).toBeNull();
    }
    const def = model(APPENDIX_C);
    expect(routeCardCopy(def, withGoal(grownup, def), { nextTitle: null, formatDay }).planEnds).toBeNull();
    expect(routeCardCopy(def, withGoal(grownup, def), { nextTitle: null, formatDay }).from).toBe("Hoya's suggestion");
  });

  it('learner goal strings carry no date, no number to the goal and no digits but the stage order', () => {
    const m = model(APPENDIX_C, { sources: [goalSource('class')], routeNext: LIFE_Q2 });
    const card = routeCardCopy(m, withGoal(self, m), { nextTitle: 'Family at the Table', formatDay });
    const texts = [card.hoya, card.from, card.planEnds, card.tasteLine, card.next, card.a11yLabel].filter((t): t is string => t !== null);
    for (const text of texts) expect(text.replace(/Stage \d/g, '')).not.toMatch(/\d/);
  });
});

describe('the goal tag and the goal pips in words (sections 4.3 and 10, LR-3b)', () => {
  it('tags the goal row after "You are here" and before "You started here", for the learner and about the child', () => {
    const m = model([]);
    const r = { ...row(m, 'stage1'), isStart: true };
    expect(stageTags(r, withGoal(self, m))).toEqual(['You are here', 'Your goal', 'You started here']);
    expect(stageTags(r, withGoal(grownup, m))).toEqual(['Sam is here', "Sam's goal", 'Sam started here.']);
    expect(stageTags(row(m, 'stage2'), withGoal(self, m))).toEqual([]);
    expect(stageTags(r, self)).toEqual(['You are here', 'You started here']);
  });

  it('reads the goal in the row label between the here and start parts', () => {
    const m = model([]);
    const r = { ...row(m, 'stage1'), isStart: true };
    expect(stageA11yLabel(r, withGoal(self, m))).toBe('Stage 1, Hangul. Open. You are here. Your goal. You started here.');
    expect(stageA11yLabel(r, withGoal(grownup, m))).toBe("Stage 1, Hangul. Open. Sam is here. Sam's goal. Sam started here.");
  });

  it('names the goal pips without digits: none, some, every', () => {
    expect(goalPipsWord(row(model([]), 'stage1').pips, self)).toBe('Ready when you are');
    expect(goalPipsWord(row(model(APPENDIX_C), 'stage1').pips, self)).toBe('Some quests done, more are ready');
    expect(goalPipsWord(row(model(STAGE1_8), 'stage1').pips, self)).toBe('Every quest here is done');
    expect(goalPipsWord(row(model([], { route: seed(STAGE1_8) }), 'stage1').pips, self)).toBe('Every quest here is done');
    expect(goalPipsWord(row(model([]), 'stage1').pips, grownup)).toBe('Ready when Sam is');
  });

  it('never says "ready" when nothing is: no quest pips, or no open or new pip left', () => {
    expect(goalPipsWord([], self)).toBeNull();
    expect(goalPipsWord([], grownup)).toBeNull();
    // Some quests done and the rest not open yet (a free learner past the free lessons).
    const closed = model(APPENDIX_C, { isQuestOpen: (id: string) => APPENDIX_C.includes(id) });
    expect(row(closed, 'stage1').pips.some((p) => p.state === 'open' || p.state === 'new')).toBe(false);
    expect(goalPipsWord(row(closed, 'stage1').pips, self)).toBe('Some quests done');
    expect(goalPipsWord(row(closed, 'stage1').pips, grownup)).toBe('Some quests done');
    // Nothing done and nothing open: no pips word at all.
    const none = model([], { isQuestOpen: () => false });
    expect(goalPipsWord(row(none, 'stage1').pips, self)).toBeNull();
    expect(goalPipsWord(row(none, 'stage1').pips, grownup)).toBeNull();
  });
});

import { describe, expect, it } from 'vitest';
import type { StageKey } from '@hangul-route/content-schema';
import {
  canDoCopy,
  cellWord,
  heroCopy,
  newQuestsCopy,
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
    return out;
  };

  it('never says "you" in any form, across heroes, states, entitlements and latches', () => {
    expect(new Set(models.map((m) => m.hero))).toEqual(new Set(['start', 'continue', 'rest', 'beyond']));
    const states = new Set(models.flatMap((m) => m.stages.map((r) => r.state)));
    expect(states).toEqual(new Set(['complete', 'known', 'explored', 'open', 'later']));
    for (const m of models) for (const text of outputs(m)) expect(text, text).not.toMatch(YOU);
  });
});

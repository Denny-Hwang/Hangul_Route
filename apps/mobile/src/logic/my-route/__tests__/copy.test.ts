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
      lines: ['Your Hangul route starts here.', 'Your first goal: read every Hangul letter.'],
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
      lines: ["Sam's Hangul route starts here.", 'First goal: read every Hangul letter.'],
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

  it('the can-do line of the expanded stage', () => {
    expect(canDoCopy(row(model([]), 'stage1'), self)).toEqual({ lead: 'By the end of this stage you can:', line: 'Read any Hangul letter and syllable and know its sound.' });
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

  it('every stage coming later merges into one row', () => {
    const entries = trailEntries(model([], { isEntitled: () => false }), self);
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({ kind: 'later', label: 'Stages 1 to 7' });
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
    expect(viewingCopy(grownup)).toBe("Viewing Sam's journey");
  });
});

/** Every string the drafts can render, with the arguments it was called with. */
function renderAll(m: MyRouteMessages): Array<{ path: string; text: string; surface: Surface; args: unknown[] }> {
  const out: Array<{ path: string; text: string; surface: Surface; args: unknown[] }> = [];
  const walk = (node: unknown, path: string, surface: Surface): void => {
    if (typeof node === 'string') out.push({ path, text: node, surface, args: [] });
    else if (typeof node === 'function') {
      for (const args of SAMPLE_ARGS(node.length)) out.push({ path, text: (node as (...a: unknown[]) => string)(...args), surface, args });
    } else if (node !== null && typeof node === 'object') for (const [k, v] of Object.entries(node)) walk(v, `${path}.${k}`, surface);
  };
  walk(m.learner, 'learner.myRoute', 'learner');
  walk(m.grownup, 'caregiver.journey', 'caregiver');
  walk(m.skillsNote, 'caregiver.skillsNote', 'caregiver');
  walk(m.a11y, 'a11y.myRoute', 'a11y');
  return out;
}
const SAMPLE_ARGS = (arity: number): unknown[][] => {
  const pools: unknown[][] = [
    [1, 'Sam', 'Hangul', 'Open', true, false, 1],
    [7, 'Alex', 'Words', 'Complete', false, true, 4],
    ['Sam', 3, 'Hangul', 'Open', true, true, 0],
  ];
  return pools.map((p) => p.slice(0, Math.max(arity, 1)));
};

describe('copy rules on the Appendix B drafts (section 3.13)', () => {
  const rendered = renderAll(DRAFT_EN);

  it('renders every string', () => {
    expect(rendered.length).toBeGreaterThan(60);
  });

  for (const { path, text, surface, args } of rendered) {
    it(`${path} → "${text}" keeps the rules`, () => {
      expect(copyViolations(text, 'en', surface, args)).toEqual([]);
    });
  }

  it('grown-up copy is written about the child, never to them', () => {
    for (const { text } of rendered.filter((r) => r.path.startsWith('caregiver.journey') || r.path === 'a11y.myRoute.stageGrownup'))
      expect(text).not.toMatch(/\byou(r)?\b/i);
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
});

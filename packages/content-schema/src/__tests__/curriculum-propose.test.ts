import { describe, expect, it } from 'vitest';
import {
  CATALOG,
  DEFAULT_SHORT_MAX,
  DEFAULT_TERM_MAX,
  DURATION_IDS,
  LENGTH_PRESETS,
  PACES,
  PROBE_WEEKS,
  StageKeySchema,
  addDays,
  defaultDurationFor,
  defaultMinutesFor,
  defaultPaceFor,
  effectiveRoute,
  generateCurriculum,
  placementStageNumber,
  proposeRoute,
  questsPlacedOutAtLevel,
  regenerateFrom,
  routeCatalogOf,
  themeOrderFor,
  toMeta,
  toPlanItems,
  type Catalog,
  type CatalogCell,
  type CatalogQuest,
  type CurriculumDraft,
  type DurationId,
  type PaceId,
  type PlacementLevel,
  type PlacementResult,
  type ProposalPreview,
  type ProposeInput,
  type RouteProposal,
  type StageKey,
} from '..';
import { CATALOG_2026_10 } from './fixtures/catalog-2026-10';
import { CATALOG_2026_10_BUNDLE8 } from './fixtures/catalog-2026-10-bundle8';
import { makeResult } from './fixtures/placement-results';

/**
 * F-PLAN-002 section 3.1a `proposeRoute` and AMENDMENTS-PLC-PLAN-HANDOFF section 1
 * (OD-12 length rule, OD-13 pace chips). The section 1.2 table is pinned here: column
 * A on the frozen October 2026 catalogue (after Q-8, stories reviewed), column B on the
 * frozen 8-lesson bundle; the table follows these goldens, never the other way round.
 */

const TODAY = '2026-10-12';
const ALL = StageKeySchema.options as StageKey[];
const FREE: StageKey[] = ['stage1'];
const q = (id: string): string => `quest:stage1-${id}`;

type Seed = NonNullable<ProposeInput['seed']>;
const seedAt = (catalog: Catalog, level: PlacementLevel): Seed => ({
  level,
  oralStage: null,
  placedOutQuestIds: questsPlacedOutAtLevel(level, routeCatalogOf(catalog)),
  themeOrder: themeOrderFor(undefined),
  startQuestId: null,
});
const input = (over: Partial<ProposeInput> = {}): ProposeInput => ({
  audience: 'self',
  seed: null,
  completedQuestIds: [],
  levelOrder: null,
  unlockedStages: FREE,
  catalog: CATALOG_2026_10,
  today: TODAY,
  ...over,
});
const propose = (over: Partial<ProposeInput> = {}): RouteProposal => {
  const proposal = proposeRoute(input(over));
  if (proposal === null) throw new Error('expected a proposal');
  return proposal;
};
const lessonWeek = (draft: CurriculumDraft, catalog: Catalog): number => {
  const lessons = new Set(catalog.quests.filter((quest) => quest.kind === 'lesson').map((quest) => quest.id));
  return draft.items.reduce((top, item) => (item.kind === 'quest' && lessons.has(item.id) ? Math.max(top, item.week) : top), 0);
};
/** The 52-week probe of AMENDMENTS section 1.1, rebuilt from the proposal's params. */
const probeOf = (proposal: RouteProposal, catalog: Catalog): CurriculumDraft =>
  generateCurriculum({ ...proposal.params, weeks: PROBE_WEEKS }, catalog);
const planOf = (draft: CurriculumDraft) => ({ meta: toMeta(draft), items: toPlanItems(draft) });

describe('defaults: pace chips and minutes (OD-13, section 3.1)', () => {
  it('pre-selects Gentle for Pictures first and for classes, Steady otherwise', () => {
    expect(defaultPaceFor('class', null)).toBe('gentle');
    expect(defaultPaceFor('class', 2)).toBe('gentle');
    expect(defaultPaceFor('family', 0)).toBe('gentle');
    expect(defaultPaceFor('self', 0)).toBe('gentle');
    expect(defaultPaceFor('family', 1)).toBe('steady');
    expect(defaultPaceFor('self', null)).toBe('steady');
    expect(defaultPaceFor('self', 2)).toBe('steady');
  });

  it('takes the sessions a week from the chip, the picked one first', () => {
    expect(propose().pace).toBe('steady');
    expect(propose().params.sessionsPerWeek).toBe(PACES.steady);
    expect(propose({ levelOrder: 0 }).params.sessionsPerWeek).toBe(PACES.gentle);
    expect(propose({ audience: 'class' }).pace).toBe('gentle');
    for (const pace of ['gentle', 'steady', 'brisk'] as const) {
      const proposal = propose({ pace, levelOrder: 0 });
      expect(proposal.pace).toBe(pace);
      expect(proposal.params.sessionsPerWeek).toBe(PACES[pace]);
    }
  });

  it('gives 10 minutes for Pictures first (a class: most of its roster), else 15', () => {
    expect(defaultMinutesFor('self', 0)).toBe(10);
    expect(defaultMinutesFor('family', 0)).toBe(10);
    expect(defaultMinutesFor('family', 1)).toBe(15);
    expect(defaultMinutesFor('self', null)).toBe(15);
    expect(defaultMinutesFor('class', 0)).toBe(15);
    expect(defaultMinutesFor('class', null, [0, 0, 1])).toBe(10);
    expect(defaultMinutesFor('class', null, [0, 1])).toBe(15);
    expect(defaultMinutesFor('class', null, [])).toBe(15);
    expect(propose({ audience: 'class', rosterLevelOrders: [0, 0, 2] }).params.minutesPerSession).toBe(10);
    expect(propose({ audience: 'family', levelOrder: 2 }).params.minutesPerSession).toBe(15);
  });
});

describe('params (rule 1)', () => {
  it('starts today at stage1 band 0 with no level check, with no session days and balanced goals', () => {
    const { params } = propose();
    expect(params).toMatchObject({ audience: 'self', level: { stage: 'stage1', band: 0 }, startDate: TODAY, completedQuestIds: [] });
    expect(params.sessionDays).toBeUndefined();
    expect(params.placedOutQuestIds).toBeUndefined();
    expect(params.goals).toEqual({ focus: 'balanced' });
    expect(params.unlockedStages).toEqual(FREE);
  });

  it('takes the level, the exact placed-out set and the goals from the seed', () => {
    const seed = { ...seedAt(CATALOG_2026_10, { stage: 'stage1', band: 2 }), themeOrder: themeOrderFor('kculture') };
    const { params } = propose({ seed, completedQuestIds: [q('nature-q1')] });
    expect(params.level).toEqual({ stage: 'stage1', band: 2 });
    expect(params.placedOutQuestIds).toEqual(seed.placedOutQuestIds);
    expect(params.completedQuestIds).toEqual([q('nature-q1')]);
    expect(params.goals).toEqual({ focus: 'balanced', themes: themeOrderFor('kculture') });
  });

  it('lets a motivation given here win over the seed order, and leaves a canonical order out', () => {
    const seed = { ...seedAt(CATALOG_2026_10, { stage: 'stage1', band: 0 }), themeOrder: themeOrderFor('kculture') };
    expect(propose({ seed, motivation: 'heritage' }).params.goals).toEqual({ focus: 'balanced', motivation: 'heritage' });
    expect(propose({ seed: seedAt(CATALOG_2026_10, { stage: 'stage1', band: 0 }) }).params.goals).toEqual({ focus: 'balanced' });
  });

  it('holds the recommended length; the review rhythm follows it', () => {
    const twelve = propose();
    expect(twelve.defaultId).toBe('12-week');
    expect(twelve.params.weeks).toBe(12);
    expect(twelve.params.reviewEvery).toBeUndefined();
    expect(LENGTH_PRESETS['4-week'].reviewEvery).toBe(0);
    expect(LENGTH_PRESETS['12-week'].reviewEvery).toBe(4);
    expect(propose({ seed: seedAt(CATALOG_2026_10, { stage: 'stage1', band: 3 }) }).params.weeks).toBe(4);
  });
});

describe('defaultId: the length rule (OD-12, AMENDMENTS section 1.1)', () => {
  it('cuts at the last lesson weeks 4 and 16', () => {
    expect([DEFAULT_SHORT_MAX, DEFAULT_TERM_MAX]).toEqual([4, 16]);
    const cases: Array<[number, DurationId]> = [[0, '4-week'], [4, '4-week'], [5, '12-week'], [16, '12-week'], [17, '6-month'], [52, '6-month']];
    for (const [week, id] of cases) expect(defaultDurationFor(week)).toBe(id);
  });

  it('follows the probe of every proposal', () => {
    for (const band of [0, 1, 2, 3] as const) {
      for (const pace of ['gentle', 'steady', 'brisk'] as const) {
        const proposal = propose({ seed: seedAt(CATALOG_2026_10, { stage: 'stage1', band }), pace });
        expect(proposal.defaultId).toBe(defaultDurationFor(lessonWeek(probeOf(proposal, CATALOG_2026_10), CATALOG_2026_10)));
      }
    }
  });

  /** Stage 1 with `perCell` lessons in each of its five cells, nothing else ready. */
  const bigStage1 = (perCell: number): Catalog => {
    const stage1 = CATALOG_2026_10.cells.filter((cell) => cell.stage === 'stage1');
    const quests: CatalogQuest[] = stage1.flatMap((cell) =>
      Array.from({ length: perCell }, (_, i): CatalogQuest => ({
        id: `quest:${cell.stage}-${cell.theme}-q${i + 1}`, episodeId: cell.episodeId, stage: 'stage1', theme: cell.theme, title: 'Lesson', minutes: 4, teaches: [], kind: 'lesson',
      })),
    );
    const cells = CATALOG_2026_10.cells.map((cell): CatalogCell =>
      cell.stage === 'stage1' ? { ...cell, questIds: quests.filter((quest) => quest.episodeId === cell.episodeId).map((quest) => quest.id) } : cell,
    );
    return { ...CATALOG_2026_10, cells, quests, stories: [] };
  };

  it('recommends 6 months once the lessons reach week 17, with no code change', () => {
    // Gentle: 2 lessons a learn week, every 4th week a review: 9 per cell = 45 lessons -> week 30.
    const long = propose({ catalog: bigStage1(9), pace: 'gentle' });
    expect(lessonWeek(probeOf(long, bigStage1(9)), bigStage1(9))).toBeGreaterThanOrEqual(17);
    expect(long.defaultId).toBe('6-month');
    expect(long.params.weeks).toBe(26);
    // 4 a cell = 20 lessons -> week 13: still a term.
    const term = propose({ catalog: bigStage1(4), pace: 'gentle' });
    expect(lessonWeek(probeOf(term, bigStage1(4)), bigStage1(4))).toBe(13);
    expect(term.defaultId).toBe('12-week');
  });
});

/** [defaultId, probe last lesson week, [lastLessonWeek, preview] of the 4-week, 12-week and 6-month cards]. */
type Golden = [DurationId, number, Array<[number, ProposalPreview]>];
const card = (week: number, preview: ProposalPreview): [number, ProposalPreview] => [week, preview];
const same = (week: number, preview: ProposalPreview): Array<[number, ProposalPreview]> => [card(week, preview), card(week, preview), card(week, preview)];

const expectGolden = (proposal: RouteProposal | null, catalog: Catalog, [id, probe, cards]: Golden): void => {
  if (proposal === null) throw new Error('expected a proposal');
  expect(proposal.defaultId).toBe(id);
  expect(lessonWeek(probeOf(proposal, catalog), catalog)).toBe(probe);
  expect(proposal.options.map((option) => [option.lastLessonWeek, option.preview])).toEqual(cards);
};

describe('golden: AMENDMENTS section 1.2, column A (frozen catalogue after Q-8, stories reviewed)', () => {
  const A = CATALOG_2026_10;
  const run = (level: PlacementLevel | null, pace: PaceId, unlockedStages = FREE) =>
    proposeRoute(input({ seed: level === null ? null : seedAt(A, level), pace, unlockedStages, catalog: A }));
  const LS = 'lessons-and-stories' as const;
  const CUT = 'lessons-cut-short' as const;

  it('no check or stage1 band 0: 12 weeks at every pace', () => {
    const rows: Array<[PaceId, Golden]> = [
      ['gentle', ['12-week', 11, [card(11, CUT), card(11, LS), card(11, LS)]]],
      ['steady', ['12-week', 7, [card(7, CUT), card(7, LS), card(7, LS)]]],
      ['brisk', ['12-week', 6, [card(6, CUT), card(6, LS), card(6, LS)]]],
    ];
    for (const [pace, golden] of rows) {
      expectGolden(run(null, pace), A, golden);
      const banded = run({ stage: 'stage1', band: 0 }, pace);
      expect(banded?.options).toEqual(run(null, pace)?.options);
      expect(banded?.defaultId).toBe(golden[0]);
    }
  });

  it('stage1 band 1: 12 / 12 / 4', () => {
    expectGolden(run({ stage: 'stage1', band: 1 }, 'gentle'), A, ['12-week', 9, [card(9, CUT), card(9, LS), card(9, LS)]]);
    expectGolden(run({ stage: 'stage1', band: 1 }, 'steady'), A, ['12-week', 6, [card(6, CUT), card(6, LS), card(6, LS)]]);
    expectGolden(run({ stage: 'stage1', band: 1 }, 'brisk'), A, ['4-week', 3, same(3, LS)]);
  });

  it('stage1 band 2: 12 / 4 / 4', () => {
    expectGolden(run({ stage: 'stage1', band: 2 }, 'gentle'), A, ['12-week', 6, [card(6, CUT), card(6, LS), card(6, LS)]]);
    expectGolden(run({ stage: 'stage1', band: 2 }, 'steady'), A, ['4-week', 3, same(3, LS)]);
    expectGolden(run({ stage: 'stage1', band: 2 }, 'brisk'), A, ['4-week', 3, same(3, LS)]);
  });

  it('stage1 band 3: 4 weeks at every pace', () => {
    expectGolden(run({ stage: 'stage1', band: 3 }, 'gentle'), A, ['4-week', 3, same(3, LS)]);
    expectGolden(run({ stage: 'stage1', band: 3 }, 'steady'), A, ['4-week', 2, same(2, LS)]);
    expectGolden(run({ stage: 'stage1', band: 3 }, 'brisk'), A, ['4-week', 2, same(2, LS)]);
  });

  it('stage2 band 0 on the free tier: 4 weeks of stories and word topics', () => {
    for (const pace of ['gentle', 'steady', 'brisk'] as const) {
      const proposal = run({ stage: 'stage2', band: 0 }, pace);
      expectGolden(proposal, A, ['4-week', 0, same(0, 'stories-and-words')]);
      expect(proposal?.headline).toBe('stories-and-words');
      expect(proposal?.options.every((option) => option.stats.lessons === 0 && option.stats.stories > 0)).toBe(true);
    }
  });

  it('every stage unlocked, band 0: 12 weeks at every pace; Gentle fits every lesson in the 12-week card', () => {
    expectGolden(run({ stage: 'stage1', band: 0 }, 'gentle', ALL), A, ['12-week', 13, [card(13, CUT), card(12, LS), card(13, LS)]]);
    expectGolden(run({ stage: 'stage1', band: 0 }, 'steady', ALL), A, ['12-week', 9, [card(9, CUT), card(9, LS), card(9, LS)]]);
    expectGolden(run({ stage: 'stage1', band: 0 }, 'brisk', ALL), A, ['12-week', 6, [card(6, CUT), card(6, LS), card(6, LS)]]);
    expect(run({ stage: 'stage1', band: 0 }, 'gentle', ALL)?.options[1].warnings).not.toContain('fewer-sessions-than-units');
  });
});

describe('golden: AMENDMENTS section 1.2, column B (frozen 8-lesson bundle, no story ready)', () => {
  const B = CATALOG_2026_10_BUNDLE8;
  const run = (level: PlacementLevel | null, pace: PaceId, unlockedStages = FREE) =>
    proposeRoute(input({ seed: level === null ? null : seedAt(B, level), pace, unlockedStages, catalog: B }));
  const FREE_PRACTICE = 'lessons-then-free-practice' as const;

  it('no check or any stage1 band: 12 / 4 / 4 (nothing is placed out while `teaches` is empty)', () => {
    for (const level of [null, ...([0, 1, 2, 3] as const).map((band): PlacementLevel => ({ stage: 'stage1', band }))]) {
      expectGolden(run(level, 'gentle'), B, ['12-week', 5, [card(4, FREE_PRACTICE), card(5, FREE_PRACTICE), card(5, FREE_PRACTICE)]]);
      expectGolden(run(level, 'steady'), B, ['4-week', 3, same(3, FREE_PRACTICE)]);
      expectGolden(run(level, 'brisk'), B, ['4-week', 2, same(2, FREE_PRACTICE)]);
    }
  });

  it('stage2 band 0 on the free tier: no proposal (no lesson, no story)', () => {
    for (const pace of ['gentle', 'steady', 'brisk'] as const) expect(run({ stage: 'stage2', band: 0 }, pace)).toBeNull();
  });

  it('every stage unlocked, band 0: 12 / 12 / 4', () => {
    expectGolden(run({ stage: 'stage1', band: 0 }, 'gentle', ALL), B, ['12-week', 7, [card(7, 'lessons-cut-short'), card(7, FREE_PRACTICE), card(7, FREE_PRACTICE)]]);
    expectGolden(run({ stage: 'stage1', band: 0 }, 'steady', ALL), B, ['12-week', 5, [card(4, FREE_PRACTICE), card(5, FREE_PRACTICE), card(5, FREE_PRACTICE)]]);
    expectGolden(run({ stage: 'stage1', band: 0 }, 'brisk', ALL), B, ['4-week', 3, same(3, FREE_PRACTICE)]);
  });
});

describe('behaviours (section 3.12, FP-B8)', () => {
  it('band 0 at Steady recommends 12 weeks on the frozen catalogue, band 3 recommends 4', () => {
    expect(propose({ seed: seedAt(CATALOG_2026_10, { stage: 'stage1', band: 0 }) }).defaultId).toBe('12-week');
    expect(propose({ seed: seedAt(CATALOG_2026_10, { stage: 'stage1', band: 3 }) }).defaultId).toBe('4-week');
  });

  it("band 0 at Steady on today's 8-lesson bundle recommends 4 weeks with the free-practice preview", () => {
    const proposal = propose({ seed: seedAt(CATALOG_2026_10_BUNDLE8, { stage: 'stage1', band: 0 }), catalog: CATALOG_2026_10_BUNDLE8 });
    expect(proposal.defaultId).toBe('4-week');
    expect(proposal.options[0].preview).toBe('lessons-then-free-practice');
    expect(proposal.options[0].lastContentWeek).toBe(3);
  });

  it('a 4-week card whose lessons run past week 4 is cut short, never a finish claim', () => {
    const [four] = propose().options;
    expect(four.lastLessonWeek).toBeGreaterThan(4);
    expect(four.preview).toBe('lessons-cut-short');
    expect(four.warnings).toContain('fewer-sessions-than-units');
  });

  it('no card claims a finish its draft does not reach, on any catalogue', () => {
    for (const catalog of [CATALOG_2026_10, CATALOG_2026_10_BUNDLE8, CATALOG]) {
      for (const unlockedStages of [FREE, ALL]) {
        for (const band of [0, 1, 2, 3] as const) {
          for (const pace of ['gentle', 'steady', 'brisk'] as const) {
            const proposal = proposeRoute(input({ seed: seedAt(catalog, { stage: 'stage1', band }), pace, unlockedStages, catalog }));
            for (const option of proposal?.options ?? []) {
              if (option.preview === 'lessons-and-stories' || option.preview === 'lessons-then-free-practice') {
                expect(option.lastLessonWeek).toBeLessThanOrEqual(option.weeks);
                expect(option.warnings).not.toContain('fewer-sessions-than-units');
              }
              if (option.preview === 'lessons-cut-short') expect(option.lastLessonWeek).toBeGreaterThan(option.weeks);
              if (option.preview === 'lessons-and-stories') expect(option.stats.stories).toBeGreaterThan(0);
              expect(option.lastContentWeek).toBeLessThanOrEqual(option.weeks);
            }
          }
        }
      }
    }
  });

  it('gives the console and the app the same default and cards for the same level, pace and tier', () => {
    const seed = seedAt(CATALOG_2026_10, { stage: 'stage1', band: 1 });
    const fromConsole = propose({ audience: 'family', seed, levelOrder: 1, pace: 'steady' });
    const fromApp = propose({ audience: 'family', seed: structuredClone(seed), levelOrder: 1 });
    expect(fromApp.defaultId).toBe(fromConsole.defaultId);
    expect(fromApp.options).toEqual(fromConsole.options);
  });
});

describe('options: three real drafts (rule 3)', () => {
  it('are the 4-week, 12-week and 6-month drafts of the same params, in that order', () => {
    const proposal = propose({ seed: seedAt(CATALOG_2026_10, { stage: 'stage1', band: 1 }) });
    expect(proposal.options.map((option) => [option.id, option.weeks])).toEqual([['4-week', 4], ['12-week', 12], ['6-month', 26]]);
    expect(DURATION_IDS).toEqual(['4-week', '12-week', '6-month']);
    for (const option of proposal.options) {
      const draft = generateCurriculum({ ...proposal.params, weeks: option.weeks }, CATALOG_2026_10);
      const { lessons, stories, comingSoonItems, openSessions, endsAtStage } = draft.stats;
      expect(option.stats).toEqual({ lessons, stories, comingSoonItems, openSessions, endsAtStage });
      expect(option.warnings).toEqual(draft.warnings.map((warning) => warning.code));
    }
  });

  it('measures the last content week over lessons and stories, never placeholders', () => {
    const B = CATALOG_2026_10_BUNDLE8;
    const [, twelve] = propose({ catalog: B }).options;
    expect(twelve.stats.comingSoonItems).toBeGreaterThan(0);
    expect(twelve.lastContentWeek).toBe(3);
    const stories = propose({ seed: seedAt(CATALOG_2026_10, { stage: 'stage2', band: 0 }) });
    expect(stories.options[0].lastContentWeek).toBe(4);
  });
});

describe('headline', () => {
  it('names the start: Stage 1 from its first quest, Stage 1 later on, stories and words, or beyond the content', () => {
    expect(propose().headline).toBe('start-stage1');
    expect(propose({ seed: seedAt(CATALOG_2026_10, { stage: 'stage1', band: 3 }) }).headline).toBe('continue-stage1');
    expect(propose({ completedQuestIds: [q('letters-q1')] }).headline).toBe('continue-stage1');
    expect(propose({ seed: seedAt(CATALOG_2026_10, { stage: 'stage2', band: 0 }) }).headline).toBe('stories-and-words');
    expect(propose({ seed: seedAt(CATALOG_2026_10, { stage: 'stage2', band: 0 }), unlockedStages: ALL }).headline).toBe('stories-and-words');
    expect(propose({ seed: seedAt(CATALOG_2026_10, { stage: 'stage3', band: 0 }) }).headline).toBe('beyond-content');
  });
});

describe('null (rule 5)', () => {
  it('is returned when no ready item can be scheduled and no plan exists', () => {
    expect(proposeRoute(input({ seed: seedAt(CATALOG_2026_10_BUNDLE8, { stage: 'stage3', band: 0 }), catalog: CATALOG_2026_10_BUNDLE8 }))).toBeNull();
    const everything = CATALOG_2026_10_BUNDLE8.quests.filter((quest) => quest.kind === 'lesson').map((quest) => quest.id);
    expect(proposeRoute(input({ catalog: CATALOG_2026_10_BUNDLE8, completedQuestIds: everything, unlockedStages: ALL }))).toBeNull();
  });
});

describe('existing plan: update or unchanged (rule 4)', () => {
  const band0 = seedAt(CATALOG_2026_10, { stage: 'stage1', band: 0 });
  const band3 = seedAt(CATALOG_2026_10, { stage: 'stage1', band: 3 });
  const first = propose({ seed: band0 });
  const plan = planOf(generateCurriculum(first.params, CATALOG_2026_10));
  const later = addDays(TODAY, 14);

  it('is unchanged when the same start re-seeds to the same future', () => {
    const proposal = propose({ seed: band0, existing: plan, today: later });
    expect(proposal.kind).toBe('unchanged');
    expect(proposal.diff).toBeUndefined();
    expect(proposal.params.startDate).toBe(TODAY);
    expect(proposal.params.weeks).toBe(plan.meta.params.weeks);
    expect(propose({ seed: null, existing: plan, today: later }).kind).toBe('unchanged');
  });

  it('never reads a quest finished early as a new place to start', () => {
    const ahead = plan.items.filter((item) => (item.targetDate as string) >= later);
    const proposal = propose({ seed: band0, existing: plan, today: later, completedQuestIds: [ahead[0]?.id as string, ahead[1]?.id as string] });
    expect(proposal.kind).toBe('unchanged');
  });

  it('updates after a retake with a later start, keeping the length and the end date', () => {
    const proposal = propose({ seed: band3, existing: plan, today: later });
    expect(proposal.kind).toBe('update');
    expect(proposal.params.startDate).toBe(TODAY);
    expect(proposal.params.weeks).toBe(plan.meta.params.weeks);
    expect(proposal.params.level).toEqual({ stage: 'stage1', band: 3 });
    expect(proposal.diff?.newStartQuestId).toBe(q('nature-q2'));
    expect(proposal.diff?.itemsRemoved).toBeGreaterThan(0);
    const reseeded = regenerateFrom(plan, later, CATALOG_2026_10, {
      mode: 'reseed',
      paramsPatch: { level: band3.level, placedOutQuestIds: band3.placedOutQuestIds },
    });
    expect(proposal.params).toEqual(reseeded.params);
  });

  it('counts an undated item of the stored plan as future: a re-seed does not keep it', () => {
    const handPicked = { ...plan, items: [...plan.items, { kind: 'quest' as const, id: 'quest:hand-picked' }] };
    const proposal = propose({ seed: band0, existing: handPicked, today: later });
    expect(proposal.kind).toBe('update');
    expect(proposal.diff).toEqual({ itemsRemoved: 1, itemsAdded: 0, newStartQuestId: plan.items.find((item) => (item.targetDate as string) >= later)?.id });
  });

  it('keeps the pace of the stored plan', () => {
    expect(propose({ seed: band3, existing: plan, today: later, pace: 'brisk' }).pace).toBe('steady');
    const custom = planOf(generateCurriculum({ ...first.params, sessionsPerWeek: 5 }, CATALOG_2026_10));
    expect(propose({ seed: band3, existing: custom, today: later, pace: 'brisk' }).pace).toBe('brisk');
  });

  it('is unchanged after a retake whose effective level is lower', () => {
    const routeCatalog = routeCatalogOf(CATALOG_2026_10);
    const opts = { isEntitled: (stage: StageKey) => stage === 'stage1', completedQuestIds: new Set<string>() };
    const high = makeResult({ id: 'placement:a', completedAt: '2026-10-10T10:00:00.000Z', level: band3.level, placedOutQuestIds: band3.placedOutQuestIds });
    const low = makeResult({ id: 'placement:b', completedAt: '2026-10-20T10:00:00.000Z', level: { stage: 'stage1', band: 1 }, placedOutQuestIds: questsPlacedOutAtLevel({ stage: 'stage1', band: 1 }, routeCatalog) });
    const start = effectiveRoute([high], routeCatalog, opts);
    const made = planOf(generateCurriculum(propose({ seed: start }).params, CATALOG_2026_10));
    const retake = effectiveRoute([high, low], routeCatalog, opts);
    expect(propose({ seed: retake, existing: made, today: later }).kind).toBe('unchanged');
    // Even a seed that carries the lower level alone keeps the stored one.
    expect(propose({ seed: { ...band3, level: { stage: 'stage1', band: 1 } }, existing: made, today: later }).params.level).toEqual(band3.level);
  });

  it('puts back what a grown-up override removed and counts it as added', () => {
    const made = planOf(generateCurriculum(propose({ seed: band3 }).params, CATALOG_2026_10));
    const putBack = [q('rites-q1'), q('rites-q2'), q('rites-q3'), q('nature-q1')];
    const override = { ...band3, placedOutQuestIds: band3.placedOutQuestIds.filter((id) => !putBack.includes(id)) };
    const proposal = propose({ seed: override, existing: made, today: later });
    expect(proposal.kind).toBe('update');
    expect(proposal.diff?.itemsAdded).toBeGreaterThanOrEqual(putBack.length);
    expect(proposal.diff?.newStartQuestId).toBe(q('rites-q1'));
    expect(proposal.params.placedOutQuestIds).toEqual(override.placedOutQuestIds);
  });

  it('still proposes for an existing plan when nothing new is left to schedule', () => {
    const everything = CATALOG_2026_10_BUNDLE8.quests.filter((quest) => quest.kind === 'lesson').map((quest) => quest.id);
    const bundlePlan = planOf(generateCurriculum(propose({ catalog: CATALOG_2026_10_BUNDLE8 }).params, CATALOG_2026_10_BUNDLE8));
    const proposal = propose({ catalog: CATALOG_2026_10_BUNDLE8, existing: bundlePlan, today: later, completedQuestIds: everything, unlockedStages: ALL });
    expect(proposal.kind).toBe('unchanged');
    // A retake past every lesson of the bundle: the future holds no lesson, so there is no next one.
    const beyond = propose({ catalog: CATALOG_2026_10_BUNDLE8, existing: bundlePlan, today: later, seed: seedAt(CATALOG_2026_10_BUNDLE8, { stage: 'stage2', band: 0 }) });
    expect(beyond.kind).toBe('update');
    expect(beyond.diff?.newStartQuestId).toBeNull();
    expect(beyond.diff?.itemsRemoved).toBeGreaterThan(0);
  });
});

describe('property: retakes never move the start back; an override puts quests back (FP-B8)', () => {
  const routeCatalog = routeCatalogOf(CATALOG_2026_10);
  const opts = { isEntitled: (stage: StageKey) => stage === 'stage1', completedQuestIds: new Set<string>() };
  const rank = (level: PlacementLevel): number => placementStageNumber(level.stage) * 10 + level.band;
  /** A small deterministic generator (no Math.random in tests that must replay). */
  const lcg = (seed: number) => {
    let state = seed;
    return (n: number): number => {
      state = (state * 1103515245 + 12345) % 2147483648;
      return state % n;
    };
  };
  const levels: PlacementLevel[] = [
    { stage: 'stage1', band: 0 }, { stage: 'stage1', band: 1 }, { stage: 'stage1', band: 2 }, { stage: 'stage1', band: 3 }, { stage: 'stage2', band: 0 },
  ];
  const resultAt = (index: number, level: PlacementLevel, over: Partial<PlacementResult> = {}): PlacementResult =>
    makeResult({
      id: `placement:r${index}`,
      completedAt: `2026-10-${String(10 + index).padStart(2, '0')}T10:00:00.000Z`,
      level,
      placedOutQuestIds: questsPlacedOutAtLevel(level, routeCatalog),
      ...over,
    });

  it('over 60 generated sequences: the level never drops and the placed-out set only grows', () => {
    const next = lcg(20261012);
    for (let run = 0; run < 60; run += 1) {
      const count = 2 + next(3);
      const results = Array.from({ length: count }, (_, i) => resultAt(i, levels[next(levels.length)] as PlacementLevel));
      let seed = effectiveRoute(results.slice(0, 1), routeCatalog, opts);
      let plan = planOf(generateCurriculum(propose({ seed }).params, CATALOG_2026_10));
      for (let k = 2; k <= count; k += 1) {
        const today = addDays(TODAY, 7 * (k - 1));
        const before = plan.meta.params;
        seed = effectiveRoute(results.slice(0, k), routeCatalog, opts);
        const proposal = propose({ seed, existing: plan, today });
        expect(rank(proposal.params.level)).toBeGreaterThanOrEqual(rank(before.level));
        for (const id of before.placedOutQuestIds ?? []) expect(proposal.params.placedOutQuestIds).toContain(id);
        if (proposal.kind === 'update') {
          const reseeded = regenerateFrom(plan, today, CATALOG_2026_10, {
            mode: 'reseed',
            paramsPatch: { level: seed?.level, placedOutQuestIds: seed?.placedOutQuestIds },
          });
          plan = planOf(reseeded);
        }
      }
    }
  });

  it('over generated overrides: the put-back quests return to the front of the future', () => {
    const next = lcg(7);
    const grid = routeCatalog.quests.filter((quest) => quest.grid && quest.stage === 'stage1');
    for (let run = 0; run < 20; run += 1) {
      const first = resultAt(0, { stage: 'stage1', band: 3 });
      const seed = effectiveRoute([first], routeCatalog, opts);
      const plan = planOf(generateCurriculum(propose({ seed }).params, CATALOG_2026_10));
      const chosen = grid[next(10)]?.id as string;
      const override = resultAt(1, { stage: 'stage1', band: 0 }, { override: { by: 'parent', at: '2026-10-11T10:00:00.000Z', startQuestId: chosen } });
      const after = effectiveRoute([first, override], routeCatalog, opts);
      const today = addDays(TODAY, 7);
      const proposal = propose({ seed: after, existing: plan, today });
      const putBack = (seed?.placedOutQuestIds ?? []).filter((id) => !(after?.placedOutQuestIds ?? []).includes(id));
      expect(putBack.length).toBeGreaterThan(0);
      expect(proposal.kind).toBe('update');
      expect(proposal.diff?.itemsAdded).toBeGreaterThan(0);
      const reseeded = regenerateFrom(plan, today, CATALOG_2026_10, {
        mode: 'reseed',
        paramsPatch: { level: after?.level, placedOutQuestIds: after?.placedOutQuestIds },
      });
      // They lead the future lessons in route order; what no longer fits falls off the tail (section 3.7).
      const lessons = new Set(grid.map((quest) => quest.id));
      const future = reseeded.items.filter((item) => (item.targetDate as string) >= today && lessons.has(item.id)).map((item) => item.id);
      const ordered = grid.map((quest) => quest.id).filter((id) => putBack.includes(id));
      const fits = Math.min(ordered.length, future.length);
      expect(fits).toBeGreaterThan(0);
      expect(future.slice(0, fits)).toEqual(ordered.slice(0, fits));
    }
  });
});

describe('live catalogue (routeCatalogOf(CATALOG)): the rule holds as content grows', () => {
  it('pre-selects the length of the probe and keeps every card consistent', () => {
    for (const unlockedStages of [FREE, ALL]) {
      for (const level of [null, ...([0, 1, 2, 3] as const).map((band): PlacementLevel => ({ stage: 'stage1', band }))]) {
        for (const pace of ['gentle', 'steady', 'brisk'] as const) {
          const proposal = proposeRoute(input({ seed: level === null ? null : seedAt(CATALOG, level), pace, unlockedStages, catalog: CATALOG }));
          if (proposal === null) throw new Error('the shipped Stage 1 always gives a proposal');
          expect(proposal.defaultId).toBe(defaultDurationFor(lessonWeek(probeOf(proposal, CATALOG), CATALOG)));
          expect(proposal.params.weeks).toBe(LENGTH_PRESETS[proposal.defaultId].weeks);
          expect(proposal.options.map((option) => option.id)).toEqual(DURATION_IDS);
        }
      }
    }
  });
});

describe('purity and the benchmark gate (rule 6, FP-B10)', () => {
  it('is deterministic and never changes its input', () => {
    const value = input({ seed: seedAt(CATALOG_2026_10, { stage: 'stage1', band: 1 }), completedQuestIds: [q('rites-q1')] });
    const before = structuredClone(value);
    expect(proposeRoute(value)).toEqual(proposeRoute(value));
    expect(value).toEqual(before);
  });

  it('proposes within the time budget (a probe and three cards: four generator runs)', () => {
    // Generous on purpose: a regression that makes the generator quadratic fails it; CI noise does not.
    const BUDGET_MS = 150;
    const value = input({ unlockedStages: ALL, pace: 'gentle' });
    for (let i = 0; i < 3; i += 1) proposeRoute(value);
    const times = Array.from({ length: 15 }, () => {
      const start = performance.now();
      proposeRoute(value);
      return performance.now() - start;
    }).sort((a, b) => a - b);
    expect(times[7]).toBeLessThan(BUDGET_MS);
  });
});

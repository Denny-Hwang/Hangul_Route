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
  inRouteOrder,
  placementLevelRank,
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
  type PlanItem,
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
/** Each card's stats, drafted from the proposal's own params from `from` on. */
const cardStatsOf = (proposal: RouteProposal, from: string, catalog: Catalog) =>
  DURATION_IDS.map((id) => {
    const { lessons, stories, comingSoonItems, openSessions, endsAtStage } = generateCurriculum(
      { ...proposal.params, startDate: from, weeks: LENGTH_PRESETS[id].weeks },
      catalog,
    ).stats;
    return { lessons, stories, comingSoonItems, openSessions, endsAtStage };
  });

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

  it('starts a class on the next class day the wizard passes, and every card starts there too', () => {
    const nextClassDay = addDays(TODAY, 3);
    const proposal = propose({ audience: 'class', rosterLevelOrders: [1, 2], startDate: nextClassDay });
    expect(proposal.params.startDate).toBe(nextClassDay);
    expect(proposal.params.sessionDays).toBeUndefined();
    expect(propose({ audience: 'class', rosterLevelOrders: [1, 2] }).params.startDate).toBe(TODAY);
    const card = generateCurriculum({ ...proposal.params, weeks: proposal.options[1].weeks }, CATALOG_2026_10);
    expect(proposal.options[1].stats.lessons).toBe(card.stats.lessons);
    expect(card.items.every((item) => item.targetDate === undefined || item.targetDate >= nextClassDay)).toBe(true);
  });

  it('never starts a new plan before today: an earlier start date counts as today', () => {
    const early = propose({ startDate: addDays(TODAY, -11) });
    expect(early.params.startDate).toBe(TODAY);
    expect(early).toEqual(propose());
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

  describe('focus from the oral stage (F-PLC-001 AM-4)', () => {
    const heard = (level: PlacementLevel, oralStage: StageKey | null): Seed => ({ ...seedAt(CATALOG_2026_10, level), oralStage });
    const stage1 = { stage: 'stage1', band: 0 } as const;

    it('reads `reading` when the oral stage is exactly two stages above the level', () => {
      expect(propose({ seed: heard(stage1, 'stage3') }).params.goals.focus).toBe('reading');
      expect(propose({ seed: heard({ stage: 'stage2', band: 1 }, 'stage4'), unlockedStages: ALL }).params.goals.focus).toBe('reading');
    });

    it('reads `reading` when the oral stage is more than two stages above the level', () => {
      expect(propose({ seed: heard(stage1, 'stage7') }).params.goals.focus).toBe('reading');
    });

    it('stays `balanced` one stage above, at the level, below it, and with no oral stage', () => {
      expect(propose({ seed: heard(stage1, 'stage2') }).params.goals.focus).toBe('balanced');
      expect(propose({ seed: heard({ stage: 'stage2', band: 0 }, 'stage3'), unlockedStages: ALL }).params.goals.focus).toBe('balanced');
      expect(propose({ seed: heard(stage1, 'stage1') }).params.goals.focus).toBe('balanced');
      expect(propose({ seed: heard({ stage: 'stage3', band: 0 }, 'stage1'), unlockedStages: ALL }).params.goals.focus).toBe('balanced');
      expect(propose({ seed: heard(stage1, null) }).params.goals.focus).toBe('balanced');
      expect(propose({ seed: null }).params.goals.focus).toBe('balanced');
    });

    it('keeps the themes and the motivation next to a reading focus', () => {
      const seed = { ...heard(stage1, 'stage3'), themeOrder: themeOrderFor('kculture') };
      expect(propose({ seed }).params.goals).toEqual({ focus: 'reading', themes: themeOrderFor('kculture') });
      expect(propose({ seed, motivation: 'heritage' }).params.goals).toEqual({ focus: 'reading', motivation: 'heritage' });
    });

    it('builds the probe, defaultId and every card with the reading focus (festival weeks only, no word weeks)', () => {
      const over = { unlockedStages: ALL, levelOrder: 1 } as const;
      const balanced = propose({ ...over, seed: heard(stage1, 'stage2') });
      const reading = propose({ ...over, seed: heard(stage1, 'stage3') });
      const balancedProbe = probeOf(balanced, CATALOG_2026_10);
      const readingProbe = probeOf(reading, CATALOG_2026_10);
      // A reading focus has no cadence culture or word weeks; festival anchors still lead a week.
      expect(readingProbe.stats.cultureWeeks).toBeLessThan(balancedProbe.stats.cultureWeeks);
      expect(balancedProbe.stats.vocabWeeks).toBeGreaterThan(0);
      expect(readingProbe.stats.vocabWeeks).toBe(0);
      expect(reading.defaultId).toBe(defaultDurationFor(lessonWeek(readingProbe, CATALOG_2026_10)));
      for (const option of reading.options) {
        const card = generateCurriculum({ ...reading.params, weeks: option.weeks }, CATALOG_2026_10);
        expect(card.params.goals.focus).toBe('reading');
        expect(card.stats.vocabWeeks).toBe(0);
        expect(option.stats).toEqual({
          lessons: card.stats.lessons,
          stories: card.stats.stories,
          comingSoonItems: card.stats.comingSoonItems,
          openSessions: card.stats.openSessions,
          endsAtStage: card.stats.endsAtStage,
        });
      }
      // Without cadence culture weeks the lessons finish sooner on the same catalogue (week 7, not 9).
      expect(lessonWeek(readingProbe, CATALOG_2026_10)).toBe(7);
      expect(lessonWeek(balancedProbe, CATALOG_2026_10)).toBe(9);
      expect(reading.options.map((option) => option.lastLessonWeek)).toEqual([7, 7, 7]);
      expect(balanced.options.map((option) => option.lastLessonWeek)).toEqual([9, 9, 9]);
    });
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

  it('stage2 band 0 or higher on the free tier: 4 weeks of stories and word topics', () => {
    for (const pace of ['gentle', 'steady', 'brisk'] as const) {
      const proposal = run({ stage: 'stage2', band: 0 }, pace);
      expectGolden(proposal, A, ['4-week', 0, same(0, 'stories-and-words')]);
      expect(proposal?.headline).toBe('stories-and-words');
      expect(proposal?.options.every((option) => option.stats.lessons === 0 && option.stats.stories > 0)).toBe(true);
      const beyond = run({ stage: 'stage3', band: 0 }, pace);
      expectGolden(beyond, A, ['4-week', 0, same(0, 'stories-and-words')]);
      expect(beyond?.headline).toBe('beyond-content');
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
    expect(propose({ seed: seedAt(CATALOG_2026_10, { stage: 'stage3', band: 0 }) }).headline).toBe('beyond-content');
  });

  it('names a later stage when its lessons are scheduled, never "no lessons"', () => {
    for (const stage of ['stage2', 'stage3'] as const) {
      const proposal = propose({ seed: seedAt(CATALOG_2026_10, { stage, band: 0 }), unlockedStages: ALL });
      expect(proposal.options.every((option) => option.stats.lessons > 0)).toBe(true);
      expect(proposal.headline).toBe('continue-lessons');
    }
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

  it("keeps the stored plan's goals on a re-seed: the patch moves the start only (FP-B4)", () => {
    const heardMore = { ...band3, oralStage: 'stage3' as const, themeOrder: themeOrderFor('kculture') };
    const fresh = propose({ seed: heardMore });
    expect(fresh.params.goals).toEqual({ focus: 'reading', themes: themeOrderFor('kculture') });
    const proposal = propose({ seed: heardMore, existing: plan, today: later, motivation: 'heritage' });
    expect(proposal.kind).toBe('update');
    expect(proposal.params.goals).toEqual(plan.meta.params.goals);
    expect(proposal.params.goals.focus).toBe('balanced');
    expect(proposal.params.level).toEqual(band3.level);
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

  it("never reads a grown-up's hand edits as a new start", () => {
    const ahead = plan.items.filter((item) => (item.targetDate as string) >= later);
    const pastItems = plan.items.filter((item) => (item.targetDate as string) < later);
    const [a, b, ...rest] = ahead as [PlanItem, PlanItem, ...PlanItem[]];
    const edits: PlanItem[][] = [
      [...plan.items, { kind: 'quest', id: 'quest:hand-picked' }],
      [...pastItems, { ...b, targetDate: a.targetDate }, { ...a, targetDate: b.targetDate }, ...rest],
      [...pastItems, b, ...rest],
      [...pastItems, a, { ...b, targetDate: addDays(b.targetDate as string, 1) }, ...rest],
    ];
    for (const items of edits) {
      const proposal = propose({ seed: band0, existing: { ...plan, items }, today: later });
      expect(proposal.kind).toBe('unchanged');
      expect(proposal.diff).toBeUndefined();
    }
  });

  it('never reads new catalogue lessons as a new start', () => {
    const bundleSeed = seedAt(CATALOG_2026_10_BUNDLE8, { stage: 'stage1', band: 0 });
    const made = planOf(generateCurriculum(propose({ seed: bundleSeed, catalog: CATALOG_2026_10_BUNDLE8 }).params, CATALOG_2026_10_BUNDLE8));
    expect(propose({ seed: bundleSeed, existing: made, today: later }).kind).toBe('unchanged');
    expect(propose({ seed: null, existing: made, today: later }).kind).toBe('unchanged');
  });

  it('keeps the pace of the stored plan, and its cards follow that pace', () => {
    const update = propose({ seed: band3, existing: plan, today: later, pace: 'brisk' });
    expect(update.pace).toBe('steady');
    expect(update.options).toEqual(propose({ seed: band3, pace: 'steady', today: later }).options);
    const brisk = planOf(generateCurriculum({ ...first.params, sessionsPerWeek: PACES.brisk }, CATALOG_2026_10));
    const unchanged = propose({ seed: band0, existing: brisk, today: later });
    expect(unchanged.kind).toBe('unchanged');
    expect(unchanged.pace).toBe('brisk');
    const fresh = propose({ seed: band0, pace: 'brisk', today: later });
    expect(unchanged.options).toEqual(fresh.options);
    expect(unchanged.defaultId).toBe(fresh.defaultId);
    // The headline names where the stored plan goes on: two weeks in, a later Stage 1 lesson.
    expect(fresh.headline).toBe('start-stage1');
    expect(unchanged.headline).toBe('continue-stage1');
    // Sessions a week off every chip: no chip is named, and the cards keep the plan's own rhythm.
    const custom = planOf(generateCurriculum({ ...first.params, sessionsPerWeek: 5 }, CATALOG_2026_10));
    const off = propose({ seed: band3, existing: custom, today: later, pace: 'brisk' });
    expect(off.pace).toBeNull();
    expect(off.params.sessionsPerWeek).toBe(5);
    expect(off.options.map((option) => option.stats)).toEqual(cardStatsOf(off, later, CATALOG_2026_10));
  });

  describe("cards, defaultId and headline describe the plan the proposal returns", () => {
    it('a family plan made at band 2 with no seed reads as a later Stage 1 start, like a new band 2 plan', () => {
      const band2 = seedAt(CATALOG_2026_10, { stage: 'stage1', band: 2 });
      const fresh = propose({ seed: band2 });
      // The wizard stores the level only (no exact set) and the device later proposes with no seed.
      const { placedOutQuestIds: _omit, ...levelOnly } = fresh.params;
      const made = planOf(generateCurriculum(levelOnly, CATALOG_2026_10));
      const proposal = propose({ seed: null, existing: made });
      expect(proposal.kind).toBe('unchanged');
      expect(proposal.headline).toBe('continue-stage1');
      expect(proposal.defaultId).toBe(fresh.defaultId);
      expect(proposal.options.map((option) => option.lastLessonWeek)).toEqual(fresh.options.map((option) => option.lastLessonWeek));
      expect(proposal.options.map((option) => option.stats)).toEqual(cardStatsOf(proposal, TODAY, CATALOG_2026_10));
    });

    it('keeps the stored entitlement: a wider `unlockedStages` on the input never reaches an existing plan', () => {
      const stage2 = seedAt(CATALOG_2026_10, { stage: 'stage2', band: 0 });
      const proposal = propose({ seed: stage2, existing: plan, today: later, unlockedStages: ALL });
      expect(proposal.params.unlockedStages).toEqual(FREE);
      expect(proposal.options.map((option) => option.stats)).toEqual(cardStatsOf(proposal, later, CATALOG_2026_10));
      expect(proposal.options.every((option) => option.stats.lessons === 0)).toBe(true);
      expect(proposal.headline).toBe('stories-and-words');
      if (proposal.kind === 'update') expect(proposal.diff?.newStartQuestId).toBeNull();
    });

    it('builds the cards of an oral-stage retake with the stored balanced goals the update keeps', () => {
      // Every stage unlocked, so the reading focus would drop culture and word weeks from the cards.
      const allPlan = planOf(generateCurriculum(propose({ seed: band0, unlockedStages: ALL }).params, CATALOG_2026_10));
      const heardMore = { ...seedAt(CATALOG_2026_10, { stage: 'stage1', band: 2 }), oralStage: 'stage3' as const };
      const proposal = propose({ seed: heardMore, existing: allPlan, unlockedStages: ALL });
      expect(proposal.kind).toBe('update');
      expect(proposal.params.goals.focus).toBe('balanced');
      expect(proposal.options.map((option) => option.stats)).toEqual(cardStatsOf(proposal, TODAY, CATALOG_2026_10));
      const probe = generateCurriculum({ ...proposal.params, startDate: TODAY, weeks: PROBE_WEEKS }, CATALOG_2026_10);
      expect(proposal.defaultId).toBe(defaultDurationFor(lessonWeek(probe, CATALOG_2026_10)));
      expect(proposal.headline).toBe('continue-stage1');
    });

    it('takes the headline from the first lesson of the future the proposal keeps', () => {
      const update = propose({ seed: band3, existing: plan, today: later });
      expect(update.diff?.newStartQuestId).toBe(q('nature-q2'));
      expect(update.headline).toBe('continue-stage1');
      expect(propose({ seed: band0, existing: plan }).headline).toBe('start-stage1');
    });

    it('gives a plan of six or seven sessions a week its cards (the probe stays under the item cap)', () => {
      for (const sessionDays of [['mon', 'tue', 'wed', 'thu', 'fri', 'sat'], ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']] as const) {
        const daily = planOf(generateCurriculum({ ...first.params, sessionDays: [...sessionDays] }, CATALOG_2026_10));
        const proposal = propose({ seed: band0, existing: daily, today: later });
        expect(proposal.pace).toBeNull();
        expect(proposal.options.map((option) => option.stats)).toEqual(cardStatsOf(proposal, later, CATALOG_2026_10));
      }
    });
  });

  describe('with quests finished before the plan was made', () => {
    const done = [q('letters-q1'), q('letters-q2'), q('letters-q3')];
    const made = propose({ seed: band0, completedQuestIds: done });
    const withDone = planOf(generateCurriculum(made.params, CATALOG_2026_10));
    const routeIndex = new Map(inRouteOrder(routeCatalogOf(CATALOG_2026_10)).map((quest, i) => [quest.id, i]));
    const storedNext = withDone.items.find((item) => (item.targetDate as string) >= later && routeIndex.has(item.id))?.id as string;

    it('is unchanged with the same start, on the same day or later', () => {
      for (const today of [TODAY, later]) {
        const proposal = propose({ seed: band0, existing: withDone, today, completedQuestIds: done });
        expect(proposal.kind).toBe('unchanged');
        expect(proposal.params.completedQuestIds).toEqual(done);
      }
    });

    it('is unchanged after a lower retake', () => {
      const lower = { ...band0, level: { stage: 'stage1', band: 0 } as const };
      const higherPlan = planOf(generateCurriculum(propose({ seed: band3, completedQuestIds: done }).params, CATALOG_2026_10));
      expect(propose({ seed: { ...band3, level: lower.level }, existing: higherPlan, today: later, completedQuestIds: done }).kind).toBe('unchanged');
    });

    it('updates after a higher retake, never starting at a finished quest or earlier than the stored next lesson', () => {
      const proposal = propose({ seed: band3, existing: withDone, today: later, completedQuestIds: done });
      expect(proposal.kind).toBe('update');
      expect(proposal.params.completedQuestIds).toEqual(done);
      const start = proposal.diff?.newStartQuestId as string;
      expect(done).not.toContain(start);
      expect(routeIndex.get(start)).toBeGreaterThan(routeIndex.get(storedNext) as number);
      expect(proposal.diff?.itemsRemoved).toBeGreaterThan(0);
    });
  });

  it('carries the learner completions in params on every kind', () => {
    const done = [q('letters-q1')];
    for (const proposal of [
      propose({ seed: band0, completedQuestIds: done }),
      propose({ seed: band0, existing: plan, today: later, completedQuestIds: done }),
      propose({ seed: band3, existing: plan, today: later, completedQuestIds: done }),
    ]) {
      expect(proposal.params.completedQuestIds).toEqual(done);
    }
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

  it('keeps an existing plan as it is when nothing new is left to schedule', () => {
    const everything = CATALOG_2026_10_BUNDLE8.quests.filter((quest) => quest.kind === 'lesson').map((quest) => quest.id);
    const bundlePlan = planOf(generateCurriculum(propose({ catalog: CATALOG_2026_10_BUNDLE8 }).params, CATALOG_2026_10_BUNDLE8));
    const proposal = propose({ catalog: CATALOG_2026_10_BUNDLE8, existing: bundlePlan, today: later, completedQuestIds: everything, unlockedStages: ALL });
    expect(proposal.kind).toBe('unchanged');
    // A retake past every lesson of the bundle re-seeds to a future with nothing ready: no update
    // ever empties the plan's future, and an existing plan always gets a proposal (rule 5).
    const beyond = propose({ catalog: CATALOG_2026_10_BUNDLE8, existing: bundlePlan, today: later, seed: seedAt(CATALOG_2026_10_BUNDLE8, { stage: 'stage2', band: 0 }) });
    expect(beyond.kind).toBe('unchanged');
    expect(beyond.diff).toBeUndefined();
    // The rejected re-seed is never handed back: `params` is the plan as it is, re-paced.
    expect(beyond.params).toEqual(regenerateFrom(bundlePlan, later, CATALOG_2026_10_BUNDLE8, { mode: 'shift', completedQuestIds: [] }).params);
    expect(beyond.params.level).toEqual(bundlePlan.meta.params.level);
    expect(generateCurriculum(beyond.params, CATALOG_2026_10_BUNDLE8).stats.lessons).toBeGreaterThan(0);
    expect(beyond.headline).toBe('continue-stage1');
  });

  it('is unchanged on a plan extended by weeks, with the same start or after a lower retake', () => {
    const higher = planOf(generateCurriculum(propose({ seed: seedAt(CATALOG_2026_10, { stage: 'stage1', band: 2 }) }).params, CATALOG_2026_10));
    const extended = regenerateFrom(higher, later, CATALOG_2026_10, { mode: 'shift' });
    const longer = planOf(generateCurriculum({ ...extended.params, weeks: extended.params.weeks + 2 }, CATALOG_2026_10));
    const band2 = seedAt(CATALOG_2026_10, { stage: 'stage1', band: 2 });
    // A lower retake through effectiveRoute keeps the higher placed-out set; only the level is lower.
    for (const seed of [band2, { ...band2, level: band0.level }, null]) {
      const proposal = propose({ seed, existing: longer, today: later });
      expect(proposal.kind).toBe('unchanged');
      expect(proposal.diff).toBeUndefined();
    }
  });

  it("builds an existing plan's cards with its own minutes", () => {
    // Longer quests, so the minutes show in the cards' warnings (session-too-short).
    const catalog = { ...CATALOG_2026_10, quests: CATALOG_2026_10.quests.map((quest) => ({ ...quest, minutes: 20 })) };
    const short = planOf(generateCurriculum({ ...first.params, minutesPerSession: 10 }, catalog));
    const proposal = propose({ seed: band0, existing: short, today: later, catalog });
    expect(proposal.options.every((option) => option.warnings.includes('session-too-short'))).toBe(true);
    expect(proposal.options).toEqual(propose({ seed: band0, pace: 'steady', levelOrder: 0, today: later, catalog }).options);
    expect(propose({ seed: band0, today: later, catalog }).options[1].warnings).not.toContain('session-too-short');
  });

  it('is unchanged when a new start re-seeds to the future the plan already has', () => {
    // A higher level on a plan with an exact set the seed keeps: the queue is the same.
    const exact = planOf(generateCurriculum({ ...first.params, placedOutQuestIds: band3.placedOutQuestIds }, CATALOG_2026_10));
    const proposal = propose({ seed: { ...band3, level: { stage: 'stage1', band: 3 } }, existing: exact, today: later });
    expect(proposal.kind).toBe('unchanged');
    // Unchanged hands back the stored plan (re-paced), never the re-seed it did not take.
    expect(proposal.params.level).toEqual(exact.meta.params.level);
    expect(proposal.params).toEqual(regenerateFrom(exact, later, CATALOG_2026_10, { mode: 'shift', completedQuestIds: [] }).params);
  });
});

describe('property: retakes never move the start back; an override puts quests back (FP-B8)', () => {
  const routeCatalog = routeCatalogOf(CATALOG_2026_10);
  const opts = { isEntitled: (stage: StageKey) => stage === 'stage1', completedQuestIds: new Set<string>() };
  const rank = placementLevelRank;
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

  it('over 60 generated sequences with prior completions: the level never drops, the placed-out set only grows, the start never moves back', () => {
    const next = lcg(20261012);
    const grid = routeCatalog.quests.filter((quest) => quest.grid && quest.stage === 'stage1' && quest.playable);
    const routeIndex = new Map(inRouteOrder(routeCatalog).map((quest, i) => [quest.id, i]));
    let moved = 0;
    for (let run = 0; run < 60; run += 1) {
      const count = 2 + next(3);
      const results = Array.from({ length: count }, (_, i) => resultAt(i, levels[next(levels.length)] as PlacementLevel));
      // About one in five Stage 1 lessons finished before the plan, a different pick each run.
      const done = grid.filter((_, i) => (run * 7 + i * 3) % 5 === 0).map((quest) => quest.id);
      let seed = effectiveRoute(results.slice(0, 1), routeCatalog, opts);
      let plan = planOf(generateCurriculum(propose({ seed, completedQuestIds: done }).params, CATALOG_2026_10));
      for (let k = 2; k <= count; k += 1) {
        const today = addDays(TODAY, 7 * (k - 1));
        const before = plan.meta.params;
        seed = effectiveRoute(results.slice(0, k), routeCatalog, opts);
        const proposal = proposeRoute(input({ seed, existing: plan, today, completedQuestIds: done }));
        if (proposal === null) continue;
        expect(proposal.params.completedQuestIds).toEqual(done);
        expect(rank(proposal.params.level)).toBeGreaterThanOrEqual(rank(before.level));
        for (const id of before.placedOutQuestIds ?? []) expect(proposal.params.placedOutQuestIds).toContain(id);
        if (proposal.kind === 'update') {
          const start = proposal.diff?.newStartQuestId;
          const storedNext = regenerateFrom(plan, today, CATALOG_2026_10, { mode: 'shift', completedQuestIds: done })
            .items.find((item) => (item.targetDate as string) >= today && !done.includes(item.id) && routeIndex.has(item.id))?.id;
          if (start !== null && start !== undefined) {
            moved += 1;
            expect(done).not.toContain(start);
            if (storedNext !== undefined) expect(routeIndex.get(start)).toBeGreaterThanOrEqual(routeIndex.get(storedNext) as number);
          }
          const reseeded = regenerateFrom(plan, today, CATALOG_2026_10, {
            mode: 'reseed',
            paramsPatch: { level: seed?.level, placedOutQuestIds: seed?.placedOutQuestIds },
            completedQuestIds: done,
          });
          expect(proposal.params).toEqual(reseeded.params);
          plan = planOf(reseeded);
        }
      }
    }
    expect(moved).toBeGreaterThan(5);
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

  it('proposes for an existing plan within the same budget (shift, re-seed, a probe and three cards)', () => {
    const BUDGET_MS = 150;
    const made = proposeRoute(input({ unlockedStages: ALL, pace: 'gentle' }));
    if (made === null) throw new Error('expected a proposal');
    const plan = planOf(generateCurriculum(made.params, CATALOG_2026_10));
    const value = input({ unlockedStages: ALL, seed: seedAt(CATALOG_2026_10, { stage: 'stage1', band: 3 }), existing: plan, today: addDays(TODAY, 14) });
    expect(proposeRoute(value)?.kind).toBe('update');
    for (let i = 0; i < 3; i += 1) proposeRoute(value);
    const times = Array.from({ length: 15 }, () => {
      const start = performance.now();
      proposeRoute(value);
      return performance.now() - start;
    }).sort((a, b) => a - b);
    expect(times[7]).toBeLessThan(BUDGET_MS);
  });
});

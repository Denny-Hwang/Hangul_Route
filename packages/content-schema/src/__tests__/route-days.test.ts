import { describe, expect, it } from 'vitest';
import {
  CATALOG,
  CATALOG_VERSION,
  FREE_ROUTE_STAGES,
  StageKeySchema,
  freeLessonsFacts,
  freeRouteDays,
  freeRouteQuestIds,
  generateCurriculum,
  gridLessonIds,
  routeDayOfQuest,
  routeDaysOf,
  type Catalog,
  type CatalogCell,
  type CatalogQuest,
  type CurriculumParamsInput,
  type FreeLessonsFacts,
  type StageKey,
} from '..';
import { CATALOG_2026_10 } from './fixtures/catalog-2026-10';

/**
 * F-ENT-003 section 3.1 (revision 3, owner decision OD-1 of 2026-10-11): route days
 * are a property of the content, one per playable cell in default route order, and
 * the free plan is every route day of Stage 1.
 */

const CHANGED = 'The free lessons changed: check F-ENT-003 section 3.1 (all of Stage 1 is free, OD-1)';
const q = (id: string): string => `quest:${id}`;
const sorted = (ids: Iterable<string>): string[] => [...ids].sort();

const TODAY_FREE = [
  'stage1-letters-q1', 'stage1-letters-q2', 'stage1-letters-q3',
  'stage1-life-q1', 'stage1-life-q2', 'stage1-life-q3',
  'stage1-rites-q1', 'stage1-nature-q1', 'stage1-crafts-q1',
].map(q);

/**
 * The live catalogue's figures, one entry per CATALOG_VERSION. Whoever bumps the
 * catalogue adds the new version's figures here (a missing entry fails, it never skips),
 * because grown-up copy shows these numbers.
 */
const LIVE_ROUTE_DAYS: Partial<Record<number, readonly (readonly [string, number])[]>> = {
  3: [
    ['episode:stage1-letters', 15],
    ['episode:stage1-life', 12],
    ['episode:stage1-rites', 5],
    ['episode:stage1-nature', 5],
    ['episode:stage1-crafts', 5],
    ['episode:stage2-life', 5],
    ['episode:stage2-nature', 5],
    ['episode:stage4-rites', 4],
  ],
  // F-QUEST-002 Q-7b (#365): rites q2-q3 join, the rites day grows to 14 minutes.
  4: [
    ['episode:stage1-letters', 15],
    ['episode:stage1-life', 12],
    ['episode:stage1-rites', 14],
    ['episode:stage1-nature', 5],
    ['episode:stage1-crafts', 5],
    ['episode:stage2-life', 5],
    ['episode:stage2-nature', 5],
    ['episode:stage4-rites', 4],
  ],
};
const LIVE_FREE_FACTS: Partial<Record<number, FreeLessonsFacts>> = {
  3: {
    lessons: 9,
    letters: 18,
    minutes: 40,
    days: 5,
    episodeIds: [
      'episode:stage1-letters',
      'episode:stage1-life',
      'episode:stage1-rites',
      'episode:stage1-nature',
      'episode:stage1-crafts',
    ],
  },
  4: {
    lessons: 11,
    letters: 24,
    minutes: 50,
    days: 5,
    episodeIds: [
      'episode:stage1-letters',
      'episode:stage1-life',
      'episode:stage1-rites',
      'episode:stage1-nature',
      'episode:stage1-crafts',
    ],
  },
};
const MISSING = `${CHANGED}; add the live figures for CATALOG_VERSION ${CATALOG_VERSION}`;

/** A small catalogue built from the frozen one: same 35 cells, with the given changes. */
const withChanges = (
  cells: (cell: CatalogCell) => CatalogCell,
  quests: (list: CatalogQuest[]) => CatalogQuest[] = (list) => list,
): Catalog => ({
  ...CATALOG_2026_10,
  cells: CATALOG_2026_10.cells.map(cells),
  quests: quests([...CATALOG_2026_10.quests]),
});

describe('routeDaysOf', () => {
  it('has one day per playable cell, in default route order (frozen fixture: eight days)', () => {
    const days = routeDaysOf(CATALOG_2026_10);
    expect(days.map((d) => [d.day, d.episodeId])).toEqual([
      [1, 'episode:stage1-letters'],
      [2, 'episode:stage1-life'],
      [3, 'episode:stage1-rites'],
      [4, 'episode:stage1-nature'],
      [5, 'episode:stage1-crafts'],
      [6, 'episode:stage2-life'],
      [7, 'episode:stage2-nature'],
      [8, 'episode:stage4-rites'],
    ]);
    expect(days[0]).toEqual({
      day: 1,
      stage: 'stage1',
      theme: 'letters',
      episodeId: 'episode:stage1-letters',
      questIds: [q('stage1-letters-q1'), q('stage1-letters-q2'), q('stage1-letters-q3')],
      minutes: 15,
    });
  });

  it('on the live catalogue, has the days of today in the same order', () => {
    const days = routeDaysOf(CATALOG);
    expect(days.slice(0, 5).map((d) => d.episodeId)).toEqual([
      'episode:stage1-letters',
      'episode:stage1-life',
      'episode:stage1-rites',
      'episode:stage1-nature',
      'episode:stage1-crafts',
    ]);
    expect(days.map((d) => d.day)).toEqual(days.map((_, i) => i + 1));
  });

  it('on the live catalogue, pins every day and its minutes for this CATALOG_VERSION', () => {
    const expected = LIVE_ROUTE_DAYS[CATALOG_VERSION];
    expect(expected, MISSING).toBeDefined();
    expect(routeDaysOf(CATALOG).map((d) => [d.episodeId, d.minutes]), CHANGED).toEqual(expected);
  });

  it('sums the quests\' catalogue minutes, not the cell minutes', () => {
    const rites = routeDaysOf(CATALOG_2026_10).find((d) => d.episodeId === 'episode:stage1-rites');
    expect(rites?.minutes).toBe(4 + 5 + 5);
  });

  it('orders by stage then canonical theme, whatever the order of the cells array', () => {
    const shuffled: Catalog = { ...CATALOG_2026_10, cells: [...CATALOG_2026_10.cells].reverse() };
    expect(routeDaysOf(shuffled)).toEqual(routeDaysOf(CATALOG_2026_10));
  });

  it('leaves out preview cells, ready cells with no lesson, story quests and unlisted quest ids', () => {
    const catalog = withChanges(
      (cell) => {
        if (cell.episodeId === 'episode:stage2-life') return { ...cell, status: 'preview' };
        // A ready cell that lists only a story quest and an unknown id: not a day.
        if (cell.episodeId === 'episode:stage3-letters') {
          return { ...cell, status: 'ready', questIds: ['quest:story-sejong-new-letters-listen', 'quest:nowhere'] };
        }
        // A day keeps its listed lessons and drops the unknown id.
        if (cell.episodeId === 'episode:stage2-nature') return { ...cell, questIds: [...cell.questIds, 'quest:nowhere'] };
        return cell;
      },
    );
    const days = routeDaysOf(catalog);
    expect(days.map((d) => d.episodeId)).not.toContain('episode:stage2-life');
    expect(days.map((d) => d.episodeId)).not.toContain('episode:stage3-letters');
    expect(days.find((d) => d.episodeId === 'episode:stage2-nature')?.questIds).toEqual([q('stage2-nature-q1')]);
    expect(days.map((d) => d.day)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it('computes once per catalogue: a caller changing its copy never changes the next answer', () => {
    const catalog: Catalog = { ...CATALOG_2026_10 };
    const first = routeDaysOf(catalog);
    first.pop();
    expect(routeDaysOf(catalog)).toHaveLength(8);
    expect(routeDaysOf(catalog)).not.toBe(routeDaysOf(catalog));
    expect(Object.isFrozen(routeDaysOf(catalog)[0])).toBe(true);
    expect(Object.isFrozen(routeDaysOf(catalog)[0]?.questIds)).toBe(true);
  });

  it('keeps a draft cell out (only shipped and ready cells are playable)', () => {
    const catalog = withChanges((cell) => (cell.episodeId === 'episode:stage4-rites' ? { ...cell, status: 'draft' } : cell));
    expect(routeDaysOf(catalog).map((d) => d.episodeId)).not.toContain('episode:stage4-rites');
  });
});

describe('the free route days (FREE_ROUTE_STAGES)', () => {
  it('cannot be changed at run time', () => {
    expect(Object.isFrozen(FREE_ROUTE_STAGES)).toBe(true);
  });

  it('is all of Stage 1 (owner decision OD-1)', () => {
    expect(FREE_ROUTE_STAGES).toEqual(['stage1']);
  });

  it('frozen fixture: the five Stage 1 days and their 15 lessons', () => {
    expect(freeRouteDays(CATALOG_2026_10).map((d) => d.day)).toEqual([1, 2, 3, 4, 5]);
    const free = freeRouteQuestIds(CATALOG_2026_10);
    expect(free.size).toBe(15);
    expect([...free].every((id) => id.startsWith('quest:stage1-'))).toBe(true);
  });

  it('live catalogue: the free quests are exactly the lesson quests of the Stage 1 cells and include today\'s nine', () => {
    const stage1Lessons = new Set(
      CATALOG.cells
        .filter((cell) => cell.stage === 'stage1')
        .flatMap((cell) => cell.questIds)
        .filter((id) => CATALOG.quests.some((quest) => quest.id === id && quest.kind === 'lesson')),
    );
    const free = freeRouteQuestIds(CATALOG);
    expect(sorted(free), CHANGED).toEqual(sorted(stage1Lessons));
    for (const id of TODAY_FREE) expect(free.has(id), `${CHANGED}: ${id}`).toBe(true);
  });

  it('takes another stage list', () => {
    expect(freeRouteDays(CATALOG_2026_10, ['stage2']).map((d) => d.episodeId)).toEqual([
      'episode:stage2-life',
      'episode:stage2-nature',
    ]);
    expect(sorted(freeRouteQuestIds(CATALOG_2026_10, ['stage2', 'stage4']))).toEqual(
      sorted([q('stage2-life-q1'), q('stage2-nature-q1'), q('stage4-rites-q1')]),
    );
    expect(freeRouteQuestIds(CATALOG_2026_10, []).size).toBe(0);
    expect(freeRouteDays(CATALOG_2026_10, ['stage7'])).toEqual([]);
  });
});

describe('gridLessonIds and routeDayOfQuest', () => {
  it('gridLessonIds is every quest of every route day', () => {
    const grid = gridLessonIds(CATALOG_2026_10);
    expect(grid.size).toBe(18);
    expect(grid.has(q('stage4-rites-q1'))).toBe(true);
    expect(grid.has('quest:story-sejong-new-letters-listen')).toBe(false);
  });

  it('routeDayOfQuest gives the day of a lesson and null for a story or an unknown id', () => {
    expect(routeDayOfQuest(CATALOG_2026_10, q('stage1-letters-q1'))).toBe(1);
    expect(routeDayOfQuest(CATALOG_2026_10, q('stage1-crafts-q3'))).toBe(5);
    expect(routeDayOfQuest(CATALOG_2026_10, q('stage4-rites-q1'))).toBe(8);
    expect(routeDayOfQuest(CATALOG_2026_10, 'quest:story-sejong-new-letters-listen')).toBeNull();
    expect(routeDayOfQuest(CATALOG_2026_10, 'quest:nowhere')).toBeNull();
  });
});

describe('freeLessonsFacts', () => {
  it('frozen fixture (Stage 1 complete): 15 lessons, 24 letters, about 65 minutes, 5 days', () => {
    expect(freeLessonsFacts(CATALOG_2026_10)).toEqual({
      lessons: 15,
      letters: 24,
      minutes: 65,
      days: 5,
      episodeIds: [
        'episode:stage1-letters',
        'episode:stage1-life',
        'episode:stage1-rites',
        'episode:stage1-nature',
        'episode:stage1-crafts',
      ],
    });
  });

  it('live catalogue: the free figures are pinned for this CATALOG_VERSION (11 lessons, 24 letters, about 50 minutes, 5 days at version 4)', () => {
    const expected = LIVE_FREE_FACTS[CATALOG_VERSION];
    expect(expected, MISSING).toBeDefined();
    expect(freeLessonsFacts(CATALOG), CHANGED).toEqual(expected);
  });

  it('counts a final form as its letter', () => {
    // ㄴ/final, ㄹ/final, ㅇ/final, ㄱ/final, ㅁ/final, ㅂ/final are all letters the fixture already teaches.
    const facts = freeLessonsFacts(CATALOG_2026_10);
    const withoutFinals = withChanges(
      (cell) => cell,
      (list) => list.map((quest) => ({ ...quest, teaches: quest.teaches.filter((key) => !key.endsWith('/final')) })),
    );
    expect(freeLessonsFacts(withoutFinals).letters).toBe(facts.letters);
  });

  it('rounds the minutes to the nearest 5', () => {
    const minutesTo = (letters: number): Catalog =>
      withChanges(
        (cell) => cell,
        (list) => list.map((quest) => (quest.id === q('stage1-letters-q1') ? { ...quest, minutes: letters } : quest)),
      );
    // The fixture's other free quests sum to 60.
    expect(freeLessonsFacts(minutesTo(2)).minutes).toBe(60); // 62
    expect(freeLessonsFacts(minutesTo(3)).minutes).toBe(65); // 63
    expect(freeLessonsFacts(minutesTo(7)).minutes).toBe(65); // 67
    expect(freeLessonsFacts(minutesTo(8)).minutes).toBe(70); // 68
  });

  it('takes another stage list, and an empty one gives zeros', () => {
    expect(freeLessonsFacts(CATALOG_2026_10, ['stage2'])).toEqual({
      lessons: 2,
      letters: 0,
      minutes: 10,
      days: 2,
      episodeIds: ['episode:stage2-life', 'episode:stage2-nature'],
    });
    expect(freeLessonsFacts(CATALOG_2026_10, [])).toEqual({ lessons: 0, letters: 0, minutes: 0, days: 0, episodeIds: [] });
  });
});

describe('golden: the default curriculum for an unlicensed space is the free plan (F-ENT-003 section 3.1, d)', () => {
  const ALL_STAGES = StageKeySchema.options as StageKey[];
  const params: CurriculumParamsInput = {
    audience: 'class',
    level: { stage: 'stage1', band: 0 },
    startDate: '2026-10-18',
    weeks: 26,
    sessionsPerWeek: 3,
    minutesPerSession: 15,
    goals: { focus: 'balanced' },
    unlockedStages: ['stage1'],
  };

  for (const [name, catalog] of [['live', CATALOG], ['frozen', CATALOG_2026_10]] as const) {
    it(`${name} catalogue: unlockedStages ['stage1'] schedules exactly the free lessons`, () => {
      const grid = gridLessonIds(catalog);
      const free = freeRouteQuestIds(catalog);
      const draft = generateCurriculum(params, catalog);
      const scheduledLessons = draft.items.map((item) => item.id).filter((id) => grid.has(id));
      expect(sorted(scheduledLessons)).toEqual(sorted(free));
      expect(sorted(draft.locked)).toEqual(sorted([...grid].filter((id) => !free.has(id))));
      // With every stage unlocked, the same plan holds lessons past the free plan.
      const licensed = generateCurriculum({ ...params, unlockedStages: ALL_STAGES }, catalog);
      expect(licensed.items.some((item) => grid.has(item.id) && !free.has(item.id))).toBe(true);
    });
  }
});

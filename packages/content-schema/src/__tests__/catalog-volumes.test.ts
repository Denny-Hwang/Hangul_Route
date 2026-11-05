import { describe, expect, it } from 'vitest';
import {
  CATALOG,
  CATALOG_VERSION,
  CatalogSchema,
  LectureBlockSchema,
  catalogEpisode,
  cellEpisodeIds,
  chooserGroups,
  classPosition,
  effectiveRoute,
  inRouteOrder,
  freeRouteQuestIds,
  gridLessonIds,
  groupOfKey,
  isRouteStartQuest,
  learnerPosition,
  placedOutGrowth,
  planCatalogStale,
  CATALOG_QUEST_ADDITIONS,
  presetBlockMinutes,
  questIdsOfBlocks,
  questIdsAtVersion,
  questsPlacedOutAtLevel,
  resolvePreset,
  routeCatalogOf,
  routeDaysOf,
  selectionBlocks,
  volumeEpisodeId,
  type Catalog,
  type CatalogHistory,
  type ChooserEpisodeRow,
} from '..';
import { assembleCatalog, expandCellRows, type GeneratedCellRow } from '../catalog/assemble';
import { GENERATED_LESSON_CELL_ROWS, GENERATED_STORIES, GENERATED_TOPICS } from '../catalog/catalog.generated';
import { STORY_SHELF } from '../catalog/data';
import { makeResult } from './fixtures/placement-results';

/**
 * Two volumes per cell in the catalogue (F-CURR-002 §5.1 and §6.2, F-STORY-005 PR 5.8, row CM-40): a cell's Volume 2
 * joins its `episodeIds`, its quests are catalogue quests on its own episode, a level below its stage places them out
 * like Volume 1's, and it adds no route day. These tests add fixture rows to the catalogue beside the shipped Volume 2
 * cells (rows CM-41..CM-45) and books 2 (row CM-46), on two cells that ship no Volume 2: Stage 2 Holidays & Traditions and
 * Stage 4 Letters & Books.
 */

const quests3 = [
  ['Rain and Sun', 4, []],
  ['Four Seasons', 5, []],
  ['Snow Day', 4, []],
] as const;
const V2_ROWS: GeneratedCellRow[] = [
  ['stage2', 'rites', 'Outdoor Words', 'shipped', 13, quests3, 2],
  ['stage4', 'letters', 'Playdate Talk', 'shipped', 13, quests3, 2],
];
const V2 = expandCellRows(V2_ROWS);

/** The shipped Volume 2 cells as the volume sources catalog/data.ts assembles them from. */
const SHIPPED_VOLUMES = CATALOG.cells.flatMap((c) =>
  (c.volumes ?? []).map((v, i) => ({ cellId: c.episodeId, episodeId: v.episodeId, volume: i + 2, title: v.title, minutes: v.minutes, questIds: v.questIds })),
);
/** The shipped later volumes (rows CM-41..CM-45 add a cell's Volume 2, row CM-46 a Stage 5 book 2). */
const SHIPPED_V2 = SHIPPED_VOLUMES.map((v) => v.episodeId);

/** The shipped catalogue with fixture Volume 2 rows added, assembled the way catalog/data.ts assembles it. */
function withVolumes(rows = V2): Catalog {
  return assembleCatalog({
    version: CATALOG_VERSION,
    cells: CATALOG.cells,
    volumes: [...SHIPPED_VOLUMES, ...rows.volumes],
    lessonQuests: [...CATALOG.quests.filter((q) => q.kind === 'lesson'), ...rows.quests],
    stories: GENERATED_STORIES,
    storyShelf: STORY_SHELF,
    topics: GENERATED_TOPICS,
    freeTopics: 4,
    topicMinutes: 5,
  });
}
const FIXTURE2_V2 = ['quest:stage2-rites-v2-q1', 'quest:stage2-rites-v2-q2', 'quest:stage2-rites-v2-q3'];
const FIXTURE4_V2 = ['quest:stage4-letters-v2-q1', 'quest:stage4-letters-v2-q2', 'quest:stage4-letters-v2-q3'];
/** Every later-volume quest the shipped catalogue holds (each Volume 2 content row and each Stage 5 book 2). */
const SHIPPED_LATER_QUESTS = CATALOG.cells.flatMap((c) => (c.volumes ?? []).flatMap((v) => v.questIds));

describe('the catalogue with two volumes per cell (row CM-40)', () => {
  it('expands a Volume 2 row into a later volume of its cell, quests named <cell>-v2-q<k> on its own episode', () => {
    expect(V2.cells).toEqual([]);
    expect(V2.volumes[0]).toEqual({ cellId: 'episode:stage2-rites', episodeId: 'episode:stage2-rites-v2', volume: 2, title: 'Outdoor Words', minutes: 13, questIds: FIXTURE2_V2 });
    expect(V2.quests[0]).toEqual({
      id: 'quest:stage2-rites-v2-q1',
      episodeId: 'episode:stage2-rites-v2',
      stage: 'stage2',
      theme: 'rites',
      title: 'Rain and Sun',
      minutes: 4,
      teaches: [],
      kind: 'lesson',
    });
    expect(volumeEpisodeId('episode:stage2-rites', 1)).toBe('episode:stage2-rites');
    expect(volumeEpisodeId('episode:stage2-rites', 2)).toBe('episode:stage2-rites-v2');
  });

  it('lists each cell’s episodes by volume, and every shipped cell holds its first volume, then its shipped Volume 2', () => {
    expect(SHIPPED_V2.length).toBeGreaterThan(0);
    for (const id of SHIPPED_V2) expect(id).toMatch(/^episode:stage[2-7]-[a-z]+-v2$/);
    for (const id of ['episode:stage2-rites-v2', 'episode:stage4-letters-v2']) expect(SHIPPED_V2, `${id} is the fixture's cell`).not.toContain(id);
    for (const cell of CATALOG.cells) {
      const v2 = `${cell.episodeId}-v2`;
      expect(cell.episodeIds, cell.episodeId).toEqual(SHIPPED_V2.includes(v2) ? [cell.episodeId, v2] : [cell.episodeId]);
    }
    const catalog = withVolumes();
    expect(CatalogSchema.safeParse(catalog).success).toBe(true);
    expect(catalog.cells.find((c) => c.episodeId === 'episode:stage2-rites')?.episodeIds).toEqual(['episode:stage2-rites', 'episode:stage2-rites-v2']);
    expect(catalog.cells.find((c) => c.episodeId === 'episode:stage2-rites')?.volumes).toEqual([{ episodeId: 'episode:stage2-rites-v2', title: 'Outdoor Words', minutes: 13, questIds: FIXTURE2_V2 }]);
    for (const cell of CATALOG.cells) if (!SHIPPED_V2.includes(`${cell.episodeId}-v2`)) expect(cell.volumes, cell.episodeId).toBeUndefined();
    expect(cellEpisodeIds({ episodeId: 'episode:stage3-life' })).toEqual(['episode:stage3-life']);
    // The first volume's quests stay the cell's list; the later volume's follow every first volume's, in grid order.
    const lessons = catalog.quests.filter((q) => q.kind === 'lesson').map((q) => q.id);
    const firstVolumes = CATALOG.cells.flatMap((c) => c.questIds);
    expect(lessons.slice(0, firstVolumes.length)).toEqual(firstVolumes);
    expect([...lessons.slice(firstVolumes.length)].sort()).toEqual([...FIXTURE2_V2, ...SHIPPED_LATER_QUESTS, ...FIXTURE4_V2].sort());
    // In grid order: the Stage 2 fixture leads the Stage 3 later volumes, the Stage 4 fixture follows them.
    const at = (id: string) => lessons.indexOf(id);
    expect(at(FIXTURE2_V2[2] as string)).toBeLessThan(at('quest:stage3-nature-v2-q1'));
    expect(at(FIXTURE4_V2[0] as string)).toBeGreaterThan(at('quest:stage3-nature-v2-q3'));
    expect(catalog.cells.find((c) => c.episodeId === 'episode:stage2-rites')?.questIds).toEqual(CATALOG.cells.find((c) => c.episodeId === 'episode:stage2-rites')?.questIds);
  });

  it('keeps a later volume off the lecture route: no preset and no class position reaches a Volume 2 quest (row CM-41)', () => {
    const catalog = withVolumes();
    const later = new Set(catalog.cells.flatMap((c) => (c.volumes ?? []).flatMap((v) => v.questIds)));
    expect(later.size).toBe(SHIPPED_LATER_QUESTS.length + 6);
    // Past the last route quest the position is the fallback, never a Volume 2 quest, which the route ranks after it.
    expect(learnerPosition(null, ['quest:stage7-crafts-q3'], catalog)).toBeNull();
    for (const stage of ['stage2', 'stage3', 'stage4'] as const) {
      const blocks = resolvePreset('by-stage', 30, { catalog, stage }).blocks;
      expect(questIdsOfBlocks(blocks, catalog).filter((id) => later.has(id)), stage).toEqual([]);
    }
    const next = resolvePreset('next-lesson', 30, { catalog, shown: { questIds: ['quest:stage7-crafts-q2'], storyIds: [] } }).blocks;
    expect(questIdsOfBlocks(next, catalog).filter((id) => later.has(id))).toEqual([]);
  });

  it('refuses episodes out of volume order and a later volume’s quest in the first volume’s list', () => {
    const catalog = withVolumes();
    const nature = catalog.cells.findIndex((c) => c.episodeId === 'episode:stage2-rites');
    const swapped = { ...catalog, cells: catalog.cells.map((c, i) => (i === nature ? { ...c, episodeIds: [...cellEpisodeIds(c)].reverse() } : c)) };
    expect(CatalogSchema.safeParse(swapped).success).toBe(false);
    const listed = { ...catalog, cells: catalog.cells.map((c, i) => (i === nature ? { ...c, questIds: [...c.questIds, FIXTURE2_V2[0] as string] } : c)) };
    expect(CatalogSchema.safeParse(listed).error?.issues.map((i) => i.message)).toContain(
      'Lesson quest quest:stage2-rites-v2-q1 of episode:stage2-rites-v2 is listed by the first volume',
    );
    const undescribed = { ...catalog, cells: catalog.cells.map((c, i) => (i === nature ? { ...c, volumes: [] } : c)) };
    expect(CatalogSchema.safeParse(undescribed).error?.issues.map((i) => i.message)).toContain('Cell stage2-rites must describe each later volume its episodeIds lists, in order');
    const orphan = { ...catalog, cells: catalog.cells.map((c, i) => (i === nature ? { ...c, episodeIds: [c.episodeId], volumes: undefined } : c)) };
    expect(CatalogSchema.safeParse(orphan).error?.issues.map((i) => i.message)).toContain('Lesson quest quest:stage2-rites-v2-q1 names the unknown cell episode:stage2-rites-v2');
  });

  it('leaves out a later volume of a cell that is not ready', () => {
    const preview = expandCellRows([['stage2', 'life', 'x', 'shipped', 13, quests3, 2]]);
    const base = withVolumes(preview);
    const notReady = assembleCatalog({
      version: CATALOG_VERSION,
      cells: base.cells.map((c) => (c.episodeId === 'episode:stage2-rites' ? { ...c, status: 'preview' } : c)),
      volumes: preview.volumes,
      lessonQuests: [...CATALOG.quests.filter((q) => q.kind === 'lesson'), ...preview.quests],
      stories: GENERATED_STORIES,
      storyShelf: STORY_SHELF,
      topics: GENERATED_TOPICS,
      freeTopics: 4,
      topicMinutes: 5,
    });
    expect(notReady.cells.find((c) => c.episodeId === 'episode:stage2-rites')?.episodeIds).toEqual(['episode:stage2-rites']);
    expect(notReady.quests.some((q) => q.episodeId === 'episode:stage2-rites-v2')).toBe(false);
  });

  it('adds no route day: the route-day snapshot is the same with Volume 2 in the catalogue', () => {
    expect(routeDaysOf(withVolumes())).toEqual(routeDaysOf(CATALOG));
    expect(freeRouteQuestIds(withVolumes())).toEqual(freeRouteQuestIds(CATALOG));
  });

  it('a later volume never makes a saved plan stale: no plan holds its quests (F-CURR-002 rows CM-40, CM-46)', () => {
    const next = CATALOG_VERSION + 1;
    const catalog = { ...withVolumes(), version: next };
    // A history that stamps only later-volume quests at the new version asks no plan to move.
    const darkOnly = { ...CATALOG_QUEST_ADDITIONS, [next]: [...FIXTURE2_V2, ...FIXTURE4_V2] };
    expect(planCatalogStale(CATALOG_VERSION, catalog, darkOnly)).toBe(false);
    // A first-volume lesson stamped at the new version does ask.
    const lesson = catalog.cells.find((c) => c.stage === 'stage2' && c.theme === 'nature')!.questIds[0]!;
    expect(planCatalogStale(CATALOG_VERSION, catalog, { ...darkOnly, [next]: [...FIXTURE2_V2, lesson] })).toBe(true);
    // The Letters book 2 (shelf stories' read quests) is a later volume too: its quests are no plan's.
    const letters = CATALOG.cells.find((c) => c.episodeId === 'episode:stage5-letters')?.volumes ?? [];
    expect(letters.map((v) => v.episodeId)).toEqual(['episode:stage5-letters-v2']);
    expect(planCatalogStale(CATALOG_VERSION, catalog, { ...CATALOG_QUEST_ADDITIONS, [next]: [...(letters[0]?.questIds ?? [])] })).toBe(false);
    // Up to the hand-kept version 32 every bump still counts.
    expect(planCatalogStale(31, CATALOG)).toBe(true);
    expect(planCatalogStale(5, CATALOG)).toBe(true);
  });

  it('counts a later volume’s quests as grid lessons past the free plan, so the free plan never opens them', () => {
    const grid = gridLessonIds(withVolumes());
    for (const id of [...FIXTURE2_V2, ...FIXTURE4_V2]) expect(grid.has(id), id).toBe(true);
    expect(grid.size).toBe(gridLessonIds(CATALOG).size + 6);
    for (const id of FIXTURE2_V2) expect(freeRouteQuestIds(withVolumes()).has(id)).toBe(false);
  });

  it('puts a later volume’s quests on the route after every first volume’s and before the stories, grid and playable', () => {
    const route = routeCatalogOf(withVolumes()).quests;
    const at = (id: string) => route.findIndex((q) => q.id === id);
    const lastFirstVolume = Math.max(...CATALOG.cells.flatMap((c) => c.questIds).map(at));
    const firstStory = Math.min(...route.filter((q) => !q.grid).map((q) => at(q.id)));
    for (const id of [...FIXTURE2_V2, ...FIXTURE4_V2]) {
      expect(at(id), id).toBeGreaterThan(lastFirstVolume);
      expect(at(id), id).toBeLessThan(firstStory);
      expect(route[at(id)]).toMatchObject({ grid: true, playable: true, episodeId: id.includes('stage2') ? 'episode:stage2-rites-v2' : 'episode:stage4-letters-v2' });
    }
    expect(route.map((q) => q.order)).toEqual(route.map((_, i) => i + 1));
  });

  it('places out a Volume 2 quest of a stage below the placed level, like Volume 1, and keeps the rest', () => {
    const route = routeCatalogOf(withVolumes());
    const at3 = questsPlacedOutAtLevel({ stage: 'stage3', band: 0 }, route);
    for (const id of FIXTURE2_V2) expect(at3).toContain(id);
    for (const id of FIXTURE4_V2) expect(at3).not.toContain(id);
    expect(at3).toContain('quest:stage2-rites-q1');
    const at5 = questsPlacedOutAtLevel({ stage: 'stage5', band: 0 }, route);
    for (const id of FIXTURE4_V2) expect(at5).toContain(id);
    const at2 = questsPlacedOutAtLevel({ stage: 'stage2', band: 0 }, route);
    for (const id of FIXTURE2_V2) expect(at2).not.toContain(id);
  });

  it('widens a placement stored before Volume 2 shipped with the Volume 2 quests its level places out (the growth rule)', () => {
    const stamp = 20261201;
    const history: CatalogHistory = {
      version: stamp,
      idsAt: (v) => new Set([...questIdsAtVersion(v), ...(v >= stamp ? [...FIXTURE2_V2, ...FIXTURE4_V2] : [])]),
    };
    const route = routeCatalogOf(withVolumes());
    expect(placedOutGrowth({ stage: 'stage3', band: 0 }, CATALOG_VERSION, route, new Set(), history)).toEqual(FIXTURE2_V2);
    expect(placedOutGrowth({ stage: 'stage3', band: 0 }, CATALOG_VERSION, route, new Set([FIXTURE2_V2[1] as string]), history)).toEqual([FIXTURE2_V2[0], FIXTURE2_V2[2]]);
    expect(placedOutGrowth({ stage: 'stage3', band: 0 }, stamp, route, new Set(), history)).toEqual([]);
  });
});

describe('the lecture deck and the chooser take a Volume 2 id (row CM-40)', () => {
  const catalog = withVolumes();
  const V2_ID = 'episode:stage2-rites-v2';

  it('the deck schema and its link carry an episode block of a Volume 2', () => {
    expect(LectureBlockSchema.safeParse({ kind: 'episode', id: V2_ID }).success).toBe(true);
    expect(presetBlockMinutes({ kind: 'episode', id: V2_ID }, catalog)).toBe(13);
    expect(questIdsOfBlocks([{ kind: 'episode', id: V2_ID }], catalog)).toEqual(FIXTURE2_V2);
    expect(presetBlockMinutes({ kind: 'episode', id: V2_ID }, CATALOG)).toBe(0);
    expect(catalogEpisode(catalog, 'episode:stage2-rites')?.questIds).toEqual(CATALOG.cells.find((c) => c.episodeId === 'episode:stage2-rites')?.questIds);
    expect(catalogEpisode(catalog, 'episode:nope')).toBeUndefined();
  });

  it('chooserGroups lists a Volume 2 as its own row after its cell only with `volumes`, keyed by its episode id', () => {
    const rowsOf = (volumes: boolean) => chooserGroups({ catalog, title: (id) => id, volumes }).find((g) => g.id === 'stage2')?.rows ?? [];
    const on = rowsOf(true);
    const at = on.findIndex((r) => r.key === 'episode:stage2-rites');
    expect(on[at + 1]).toMatchObject({ kind: 'episode', key: V2_ID, minutes: 13 });
    expect((on[at + 1] as ChooserEpisodeRow).lessons.map((l) => l.key)).toEqual(FIXTURE2_V2);
    expect(rowsOf(false).some((r) => r.key === V2_ID)).toBe(false);
    expect(groupOfKey(chooserGroups({ catalog, title: (id) => id, volumes: true }), FIXTURE2_V2[0] as string)).toBe('stage2');
    expect(selectionBlocks([V2_ID], chooserGroups({ catalog, title: (id) => id, volumes: true }))).toEqual([{ kind: 'episode', id: V2_ID }]);
  });
});

describe('a later volume is no lecture route quest (row CM-40)', () => {
  const catalog = withVolumes();
  const later = new Set([...FIXTURE2_V2, ...catalog.quests.filter((q) => q.episodeId === 'episode:stage4-letters-v2').map((q) => q.id)]);
  const routeOrder = routeCatalogOf(catalog).quests.filter((q) => q.grid && q.playable).map((q) => q.id);

  it('the fixture puts the Volume 2 quests among the playable grid quests, so the filter is what keeps them out', () => {
    expect(routeOrder.filter((id) => later.has(id))).toHaveLength(later.size);
  });

  it('no learner position lands on a Volume 2 quest, whatever is done or named next', () => {
    expect(learnerPosition(FIXTURE2_V2[0] as string, [], catalog)).toEqual(learnerPosition(null, [], CATALOG));
    const done: string[] = [];
    for (const id of routeOrder) {
      done.push(id);
      const at = learnerPosition(null, done, catalog);
      if (at !== null) expect(later.has(at.questId), `after ${id}`).toBe(false);
    }
  });

  it('no class position and no preset lands on a Volume 2 quest', () => {
    for (const stage of ['stage2', 'stage4'] as const) {
      for (let reached = 0; reached < 40; reached += 1) {
        const at = classPosition([{ journey: { v: 1, here: stage, stages: [{ stage, done: reached, known: 0, state: 'open', total: 40 }] } }], catalog);
        if (at !== null) expect(later.has(at.questId), `${stage} at ${reached}`).toBe(false);
      }
      const preset = resolvePreset('by-stage', 60, { catalog, stage });
      expect(preset.blocks.some((b) => b.kind === 'quest')).toBe(true);
      expect(preset.blocks.some((b) => b.kind === 'quest' && later.has(b.id))).toBe(false);
    }
  });
});

describe('a later volume is no route start and no start choice (row CM-41)', () => {
  const route = routeCatalogOf(withVolumes());
  const later = new Set([...FIXTURE2_V2, ...FIXTURE4_V2, ...SHIPPED_LATER_QUESTS]);

  it('marks every later-volume quest, and only those, as a grid quest that is no route start', () => {
    expect(route.quests.filter((q) => q.laterVolume === true).map((q) => q.id).sort()).toEqual([...later].sort());
    for (const q of route.quests) expect(isRouteStartQuest(q), q.id).toBe(q.grid && !later.has(q.id));
  });

  it('with every Volume 1 grid quest done, the route has no start (never a Volume 2 quest) and asks for no stage', () => {
    const firstVolume = route.quests.filter((q) => q.grid && !later.has(q.id)).map((q) => q.id);
    const seed = effectiveRoute([makeResult()], route, { isEntitled: () => true, completedQuestIds: new Set(firstVolume) });
    expect(seed).toMatchObject({ startQuestId: null, startEpisodeId: null, needsStage: null });
    // One Volume 1 quest left: it is the start, ahead of every Volume 2 quest.
    const lastLeft = firstVolume[firstVolume.length - 1] as string;
    const one = effectiveRoute([makeResult()], route, { isEntitled: () => true, completedQuestIds: new Set(firstVolume.filter((id) => id !== lastLeft)) });
    expect(one?.startQuestId).toBe(lastLeft);
  });
});

describe('a later volume is no override target, and an override places it out with its own cell (rows CM-40, CM-43 S6)', () => {
  const route = routeCatalogOf(withVolumes());
  const later = new Set(route.quests.filter((q) => q.laterVolume === true).map((q) => q.id));
  const base = {
    id: 'placement:v2', startedAt: '2026-10-01T10:00:00.000Z', completedAt: '2026-10-01T10:08:00.000Z', source: 'onboarding', testLocale: 'en',
    length: 'full', mode: 'standard', revealMode: 'tap', bankVersion: 1, contentVer: 'test', responses: [], gates: [],
    strands: { 'hangul-recognition': 'secure', 'sound-letter': 'not-yet', 'syllable-reading': 'not-tested', vocabulary: 'not-yet', sentences: 'not-yet' },
    level: { stage: 'stage1', band: 0 }, oralStage: null, beyondContent: false, startQuestId: null, placedOutQuestIds: [], priorityTokens: [],
  } as unknown as Parameters<typeof effectiveRoute>[0][number];
  const opts = () => ({ isEntitled: () => true, completedQuestIds: new Set<string>(), catalogHistory: { version: CATALOG_VERSION, idsAt: () => new Set(route.quests.map((q) => q.id)) } });
  const override = (startQuestId: string) => ({ ...base, override: { by: 'parent' as const, at: '2026-10-02T00:00:00.000Z', startQuestId } });

  it('an override naming a Volume 2 quest moves nothing', () => {
    const ignored = effectiveRoute([override(FIXTURE2_V2[0] as string)], route, opts());
    expect(ignored?.placedOutQuestIds).toEqual([]);
    expect(ignored?.startQuestId).toBe(effectiveRoute([base], route, opts())?.startQuestId);
  });

  it('an override naming a Stage 3 first volume places every Stage 2 later volume out and no later one of a later stage', () => {
    const atStage3 = effectiveRoute([override('quest:stage3-letters-q1')], route, opts())?.placedOutQuestIds ?? [];
    const placedLater = atStage3.filter((id) => later.has(id));
    for (const id of FIXTURE2_V2) expect(placedLater).toContain(id);
    for (const id of FIXTURE4_V2) expect(placedLater).not.toContain(id);
    const stageOf = (id: string) => route.quests.find((q) => q.id === id)?.stage;
    expect(placedLater.length).toBeGreaterThan(FIXTURE2_V2.length);
    expect(placedLater.every((id) => stageOf(id) === 'stage2')).toBe(true);
    expect([...later].filter((id) => stageOf(id) === 'stage2').every((id) => placedLater.includes(id))).toBe(true);
  });
});

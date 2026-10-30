import { describe, expect, it } from 'vitest';
import {
  CATALOG,
  CATALOG_VERSION,
  CatalogSchema,
  LectureBlockSchema,
  catalogEpisode,
  cellEpisodeIds,
  chooserGroups,
  freeRouteQuestIds,
  gridLessonIds,
  groupOfKey,
  placedOutGrowth,
  presetBlockMinutes,
  questIdsOfBlocks,
  questIdsAtVersion,
  questsPlacedOutAtLevel,
  learnerPosition,
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
import { GENERATED_STORIES, GENERATED_TOPICS } from '../catalog/catalog.generated';
import { STORY_SHELF } from '../catalog/data';

/**
 * Two volumes per cell in the catalogue (F-CURR-002 §5.1 and §6.2, F-STORY-005 PR 5.8, row CM-40): a cell's Volume 2
 * joins its `episodeIds`, its quests are catalogue quests on its own episode, a level below its stage places them out
 * like Volume 1's, and it adds no route day. These tests add fixture rows to the catalogue beside the shipped Volume 2
 * cells (row CM-42: Play Volume 2, S6, `episode:stage6-crafts-v2`).
 */

const quests3 = [
  ['Rain and Sun', 4, []],
  ['Four Seasons', 5, []],
  ['Snow Day', 4, []],
] as const;
const V2_ROWS: GeneratedCellRow[] = [
  ['stage2', 'nature', 'Outdoor Words', 'shipped', 13, quests3, 2],
  ['stage4', 'crafts', 'Playdate Talk', 'shipped', 13, quests3, 2],
];
const V2 = expandCellRows(V2_ROWS);

/** The shipped Volume 2 cells as the volume sources catalog/data.ts assembles them from. */
const SHIPPED_VOLUMES = CATALOG.cells.flatMap((c) =>
  (c.volumes ?? []).map((v, i) => ({ cellId: c.episodeId, episodeId: v.episodeId, volume: i + 2, title: v.title, minutes: v.minutes, questIds: v.questIds })),
);
/** The shipped Volume 2 cells (each Volume 2 content row adds its cell). */
const SHIPPED_V2 = ['episode:stage6-crafts-v2'];

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
const NATURE_V2 = ['quest:stage2-nature-v2-q1', 'quest:stage2-nature-v2-q2', 'quest:stage2-nature-v2-q3'];
const CRAFTS4_V2 = ['quest:stage4-crafts-v2-q1', 'quest:stage4-crafts-v2-q2', 'quest:stage4-crafts-v2-q3'];

describe('the catalogue with two volumes per cell (row CM-40)', () => {
  it('expands a Volume 2 row into a later volume of its cell, quests named <cell>-v2-q<k> on its own episode', () => {
    expect(V2.cells).toEqual([]);
    expect(V2.volumes[0]).toEqual({ cellId: 'episode:stage2-nature', episodeId: 'episode:stage2-nature-v2', volume: 2, title: 'Outdoor Words', minutes: 13, questIds: NATURE_V2 });
    expect(V2.quests[0]).toEqual({
      id: 'quest:stage2-nature-v2-q1',
      episodeId: 'episode:stage2-nature-v2',
      stage: 'stage2',
      theme: 'nature',
      title: 'Rain and Sun',
      minutes: 4,
      teaches: [],
      kind: 'lesson',
    });
    expect(volumeEpisodeId('episode:stage2-nature', 1)).toBe('episode:stage2-nature');
    expect(volumeEpisodeId('episode:stage2-nature', 2)).toBe('episode:stage2-nature-v2');
  });

  it('lists each cell’s episodes by volume, and every shipped cell holds its first volume, then its shipped Volume 2', () => {
    expect(SHIPPED_VOLUMES.map((v) => v.episodeId)).toEqual(SHIPPED_V2);
    for (const cell of CATALOG.cells) {
      const v2 = `${cell.episodeId}-v2`;
      expect(cell.episodeIds, cell.episodeId).toEqual(SHIPPED_V2.includes(v2) ? [cell.episodeId, v2] : [cell.episodeId]);
    }
    const catalog = withVolumes();
    expect(CatalogSchema.safeParse(catalog).success).toBe(true);
    expect(catalog.cells.find((c) => c.episodeId === 'episode:stage2-nature')?.episodeIds).toEqual(['episode:stage2-nature', 'episode:stage2-nature-v2']);
    expect(catalog.cells.find((c) => c.episodeId === 'episode:stage2-nature')?.volumes).toEqual([{ episodeId: 'episode:stage2-nature-v2', title: 'Outdoor Words', minutes: 13, questIds: NATURE_V2 }]);
    for (const cell of CATALOG.cells) if (!SHIPPED_V2.includes(`${cell.episodeId}-v2`)) expect(cell.volumes, cell.episodeId).toBeUndefined();
    expect(cellEpisodeIds({ episodeId: 'episode:stage3-life' })).toEqual(['episode:stage3-life']);
    // The first volume's quests stay the cell's list; the later volume's follow every first volume's, in grid order.
    const lessons = catalog.quests.filter((q) => q.kind === 'lesson').map((q) => q.id);
    // Grid order: the fixture Stage 2 and Stage 4 rows, then the shipped Stage 6 Volume 2 (row CM-42).
    const shipped = SHIPPED_VOLUMES.flatMap((v) => v.questIds);
    expect(lessons).toEqual([...CATALOG.cells.flatMap((c) => c.questIds), ...NATURE_V2, ...CRAFTS4_V2, ...shipped]);
    expect(catalog.cells.find((c) => c.episodeId === 'episode:stage2-nature')?.questIds).toEqual(CATALOG.cells.find((c) => c.episodeId === 'episode:stage2-nature')?.questIds);
  });

  it('keeps a later volume off the lecture route: no preset and no class position reaches a Volume 2 quest (row CM-41, CM-42)', () => {
    const catalog = withVolumes();
    const later = new Set(catalog.cells.flatMap((c) => (c.volumes ?? []).flatMap((v) => v.questIds)));
    expect(later.size).toBe(9);
    // Past the last route quest the position is the fallback, never a Volume 2 quest, which the route ranks after it.
    expect(learnerPosition(null, ['quest:stage7-crafts-q3'], catalog)).toBeNull();
    for (const stage of ['stage2', 'stage3', 'stage4', 'stage6'] as const) {
      const blocks = resolvePreset('by-stage', 30, { catalog, stage }).blocks;
      expect(questIdsOfBlocks(blocks, catalog).filter((id) => later.has(id)), stage).toEqual([]);
    }
    const next = resolvePreset('next-lesson', 30, { catalog, shown: { questIds: ['quest:stage7-crafts-q2'], storyIds: [] } }).blocks;
    expect(questIdsOfBlocks(next, catalog).filter((id) => later.has(id))).toEqual([]);
  });

  it('refuses episodes out of volume order and a later volume’s quest in the first volume’s list', () => {
    const catalog = withVolumes();
    const nature = catalog.cells.findIndex((c) => c.episodeId === 'episode:stage2-nature');
    const swapped = { ...catalog, cells: catalog.cells.map((c, i) => (i === nature ? { ...c, episodeIds: [...cellEpisodeIds(c)].reverse() } : c)) };
    expect(CatalogSchema.safeParse(swapped).success).toBe(false);
    const listed = { ...catalog, cells: catalog.cells.map((c, i) => (i === nature ? { ...c, questIds: [...c.questIds, NATURE_V2[0] as string] } : c)) };
    expect(CatalogSchema.safeParse(listed).error?.issues.map((i) => i.message)).toContain(
      'Lesson quest quest:stage2-nature-v2-q1 of episode:stage2-nature-v2 is listed by the first volume',
    );
    const undescribed = { ...catalog, cells: catalog.cells.map((c, i) => (i === nature ? { ...c, volumes: [] } : c)) };
    expect(CatalogSchema.safeParse(undescribed).error?.issues.map((i) => i.message)).toContain('Cell stage2-nature must describe each later volume its episodeIds lists, in order');
    const orphan = { ...catalog, cells: catalog.cells.map((c, i) => (i === nature ? { ...c, episodeIds: [c.episodeId], volumes: undefined } : c)) };
    expect(CatalogSchema.safeParse(orphan).error?.issues.map((i) => i.message)).toContain('Lesson quest quest:stage2-nature-v2-q1 names the unknown cell episode:stage2-nature-v2');
  });

  it('leaves out a later volume of a cell that is not ready', () => {
    const preview = expandCellRows([['stage2', 'nature', 'x', 'shipped', 13, quests3, 2]]);
    const base = withVolumes(preview);
    const notReady = assembleCatalog({
      version: CATALOG_VERSION,
      cells: base.cells.map((c) => (c.episodeId === 'episode:stage2-nature' ? { ...c, status: 'preview' } : c)),
      volumes: preview.volumes,
      lessonQuests: [...CATALOG.quests.filter((q) => q.kind === 'lesson'), ...preview.quests],
      stories: GENERATED_STORIES,
      storyShelf: STORY_SHELF,
      topics: GENERATED_TOPICS,
      freeTopics: 4,
      topicMinutes: 5,
    });
    expect(notReady.cells.find((c) => c.episodeId === 'episode:stage2-nature')?.episodeIds).toEqual(['episode:stage2-nature']);
    expect(notReady.quests.some((q) => q.episodeId === 'episode:stage2-nature-v2')).toBe(false);
  });

  it('adds no route day: the route-day snapshot is the same with Volume 2 in the catalogue', () => {
    expect(routeDaysOf(withVolumes())).toEqual(routeDaysOf(CATALOG));
    expect(freeRouteQuestIds(withVolumes())).toEqual(freeRouteQuestIds(CATALOG));
  });

  it('counts a later volume’s quests as grid lessons past the free plan, so the free plan never opens them', () => {
    const grid = gridLessonIds(withVolumes());
    for (const id of [...NATURE_V2, ...CRAFTS4_V2]) expect(grid.has(id), id).toBe(true);
    expect(grid.size).toBe(gridLessonIds(CATALOG).size + 6);
    for (const id of NATURE_V2) expect(freeRouteQuestIds(withVolumes()).has(id)).toBe(false);
  });

  it('puts a later volume’s quests on the route after every first volume’s and before the stories, grid and playable', () => {
    const route = routeCatalogOf(withVolumes()).quests;
    const at = (id: string) => route.findIndex((q) => q.id === id);
    const lastFirstVolume = Math.max(...CATALOG.cells.flatMap((c) => c.questIds).map(at));
    const firstStory = Math.min(...route.filter((q) => !q.grid).map((q) => at(q.id)));
    for (const id of [...NATURE_V2, ...CRAFTS4_V2]) {
      expect(at(id), id).toBeGreaterThan(lastFirstVolume);
      expect(at(id), id).toBeLessThan(firstStory);
      expect(route[at(id)]).toMatchObject({ grid: true, playable: true, episodeId: id.includes('nature') ? 'episode:stage2-nature-v2' : 'episode:stage4-crafts-v2' });
    }
    expect(route.map((q) => q.order)).toEqual(route.map((_, i) => i + 1));
  });

  it('places out a Volume 2 quest of a stage below the placed level, like Volume 1, and keeps the rest', () => {
    const route = routeCatalogOf(withVolumes());
    const at3 = questsPlacedOutAtLevel({ stage: 'stage3', band: 0 }, route);
    for (const id of NATURE_V2) expect(at3).toContain(id);
    for (const id of CRAFTS4_V2) expect(at3).not.toContain(id);
    expect(at3).toContain('quest:stage2-nature-q1');
    const at5 = questsPlacedOutAtLevel({ stage: 'stage5', band: 0 }, route);
    for (const id of CRAFTS4_V2) expect(at5).toContain(id);
    const at2 = questsPlacedOutAtLevel({ stage: 'stage2', band: 0 }, route);
    for (const id of NATURE_V2) expect(at2).not.toContain(id);
  });

  it('widens a placement stored before Volume 2 shipped with the Volume 2 quests its level places out (the growth rule)', () => {
    const stamp = 20261201;
    const history: CatalogHistory = {
      version: stamp,
      idsAt: (v) => new Set([...questIdsAtVersion(v), ...(v >= stamp ? [...NATURE_V2, ...CRAFTS4_V2] : [])]),
    };
    const route = routeCatalogOf(withVolumes());
    expect(placedOutGrowth({ stage: 'stage3', band: 0 }, CATALOG_VERSION, route, new Set(), history)).toEqual(NATURE_V2);
    expect(placedOutGrowth({ stage: 'stage3', band: 0 }, CATALOG_VERSION, route, new Set([NATURE_V2[1] as string]), history)).toEqual([NATURE_V2[0], NATURE_V2[2]]);
    expect(placedOutGrowth({ stage: 'stage3', band: 0 }, stamp, route, new Set(), history)).toEqual([]);
  });
});

describe('the lecture deck and the chooser take a Volume 2 id (row CM-40)', () => {
  const catalog = withVolumes();
  const V2_ID = 'episode:stage2-nature-v2';

  it('the deck schema and its link carry an episode block of a Volume 2', () => {
    expect(LectureBlockSchema.safeParse({ kind: 'episode', id: V2_ID }).success).toBe(true);
    expect(presetBlockMinutes({ kind: 'episode', id: V2_ID }, catalog)).toBe(13);
    expect(questIdsOfBlocks([{ kind: 'episode', id: V2_ID }], catalog)).toEqual(NATURE_V2);
    expect(presetBlockMinutes({ kind: 'episode', id: V2_ID }, CATALOG)).toBe(0);
    expect(catalogEpisode(catalog, 'episode:stage2-nature')?.questIds).toEqual(CATALOG.cells.find((c) => c.episodeId === 'episode:stage2-nature')?.questIds);
    expect(catalogEpisode(catalog, 'episode:nope')).toBeUndefined();
  });

  it('chooserGroups lists a Volume 2 as its own row after its cell only with `volumes`, keyed by its episode id', () => {
    const rowsOf = (volumes: boolean) => chooserGroups({ catalog, title: (id) => id, volumes }).find((g) => g.id === 'stage2')?.rows ?? [];
    const on = rowsOf(true);
    const at = on.findIndex((r) => r.key === 'episode:stage2-nature');
    expect(on[at + 1]).toMatchObject({ kind: 'episode', key: V2_ID, minutes: 13 });
    expect((on[at + 1] as ChooserEpisodeRow).lessons.map((l) => l.key)).toEqual(NATURE_V2);
    expect(rowsOf(false).some((r) => r.key === V2_ID)).toBe(false);
    expect(groupOfKey(chooserGroups({ catalog, title: (id) => id, volumes: true }), NATURE_V2[0] as string)).toBe('stage2');
    expect(selectionBlocks([V2_ID], chooserGroups({ catalog, title: (id) => id, volumes: true }))).toEqual([{ kind: 'episode', id: V2_ID }]);
  });
});

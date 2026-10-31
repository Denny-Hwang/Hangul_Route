import { CATALOG, CatalogSchema, type Catalog, type CatalogQuest } from '@hangul-route/content-schema';

export { CATALOG, LectureOptionsSchema, decodeDeck, encodeDeck, type Catalog, type LectureDeck } from '@hangul-route/content-schema';

/**
 * The shipped catalogue with a fixture Volume 2 of Stage 2 Nature (F-CURR-002 row CM-40): the cell lists it in
 * `episodeIds` and `volumes`, and its two quests sit on its own episode, as `assembleCatalog` gives them.
 */
export function assembleCatalogWithVolumesForTest(): Catalog {
  const episodeId = 'episode:stage2-nature-v2';
  const quests: CatalogQuest[] = ['Rain and Sun', 'Snow Day'].map((title, i) => ({
    id: `quest:stage2-nature-v2-q${i + 1}`,
    episodeId,
    stage: 'stage2',
    theme: 'nature',
    title,
    minutes: 4,
    teaches: [],
    kind: 'lesson',
  }));
  const catalog: Catalog = {
    ...CATALOG,
    cells: CATALOG.cells.map((c) =>
      c.episodeId === 'episode:stage2-nature'
        ? { ...c, episodeIds: [c.episodeId, episodeId], volumes: [{ episodeId, title: 'Outdoor Words 2', minutes: 8, questIds: quests.map((q) => q.id) }] }
        : c,
    ),
    quests: [...CATALOG.quests.filter((q) => q.kind === 'lesson'), ...quests, ...CATALOG.quests.filter((q) => q.kind === 'story')],
  };
  return CatalogSchema.parse(catalog);
}

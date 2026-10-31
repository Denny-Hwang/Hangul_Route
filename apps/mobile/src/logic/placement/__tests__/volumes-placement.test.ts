import { questsPlacedOutAtLevel, type Episode, type Quest } from '@hangul-route/content-schema';
import { describe, expect, it } from 'vitest';
import { episodesAll, questsAll } from '../../../content';
import { placementRouteCatalog } from '../catalog';

/**
 * Placement of a cell's Volume 2 in the app (F-CURR-002 §6.2 and row CM-40): the level check scores against the app's
 * quests with the later volumes' episodes, so a level above a Volume 2's stage places it out like its Volume 1, and a
 * level at or below it never does. No Volume 2 ships yet, so a fixture Volume 2 of Stage 2 Nature joins the bundle.
 */
const v2: Episode = {
  ...(episodesAll.find((e) => e.id === 'episode:stage2-nature') as Episode),
  id: 'episode:stage2-nature-v2',
  volume: 2,
  questIds: ['quest:stage2-nature-v2-q1', 'quest:stage2-nature-v2-q2'],
};
const v2Quests: Quest[] = v2.questIds.map((id) => ({ id, titleEn: id, estimatedMinutes: 4, steps: [] }));

describe('placement places out a Volume 2 quest of a stage below the level (row CM-40)', () => {
  const catalog = placementRouteCatalog([...questsAll, ...v2Quests], [...episodesAll, v2]);

  it('lists the Volume 2 quests as grid quests of their own episode', () => {
    for (const id of v2.questIds) expect(catalog.quests.find((q) => q.id === id)).toMatchObject({ episodeId: v2.id, stage: 'stage2', grid: true, playable: true });
  });

  it('a stage3 level places them out with Volume 1; a stage2 level keeps them', () => {
    const at3 = questsPlacedOutAtLevel({ stage: 'stage3', band: 0 }, catalog);
    for (const id of [...v2.questIds, 'quest:stage2-nature-q1']) expect(at3).toContain(id);
    const at2 = questsPlacedOutAtLevel({ stage: 'stage2', band: 2 }, catalog);
    for (const id of v2.questIds) expect(at2).not.toContain(id);
  });
});

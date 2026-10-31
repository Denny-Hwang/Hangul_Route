import { questsPlacedOutAtLevel, seedRoute, type Episode, type Quest } from '@hangul-route/content-schema';
import { describe, expect, it } from 'vitest';
import { episodesAll, episodesWithVolumes, questsAll } from '../../../content';
import { placementRouteCatalog } from '../catalog';
import { startChoices } from '../report-page';
import { placementResult } from './fixtures';

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

describe('a Volume 2 quest is never a start (row CM-40, CM-42 S6 review)', () => {
  // The shipped bundle: Stage 6 Rules and Crafts ships a Volume 2 behind `volumes`.
  const catalog = placementRouteCatalog(questsAll, episodesWithVolumes);
  const later = catalog.quests.filter((q) => q.laterVolume === true).map((q) => q.id);

  it('marks the shipped Volume 2 quests as a later volume, and only those', () => {
    expect(later).toEqual(expect.arrayContaining(['quest:stage6-crafts-v2-q1', 'quest:stage6-crafts-v2-q2', 'quest:stage6-crafts-v2-q3']));
    for (const id of later) expect(id).toMatch(/-v\d+-q\d+$/);
  });

  it("leaves them out of a parent's 'Choose a different start' list", () => {
    const seed = seedRoute(placementResult({ level: { stage: 'stage1', band: 0 }, placedOutQuestIds: [] }), catalog, {
      isEntitled: () => true,
      completedQuestIds: new Set(),
    });
    const choices = startChoices(seed, catalog, new Set(), () => true).map((c) => c.questId);
    expect(choices.length).toBeGreaterThan(0);
    for (const id of later) expect(choices).not.toContain(id);
  });

  it('never seeds a start in a later volume, even when every first-volume quest is done', () => {
    const done = new Set(catalog.quests.filter((q) => q.grid && q.laterVolume !== true).map((q) => q.id));
    const seed = seedRoute(placementResult({ level: { stage: 'stage1', band: 0 }, placedOutQuestIds: [] }), catalog, {
      isEntitled: () => true,
      completedQuestIds: done,
    });
    expect(seed.startQuestId).toBeNull();
    expect(seed.needsStage).toBeNull();
  });
});

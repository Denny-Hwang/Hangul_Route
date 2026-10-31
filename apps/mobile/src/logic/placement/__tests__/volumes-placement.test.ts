import { effectiveRoute, inRouteOrder, placementStageNumber, questsPlacedOutAtLevel, type Episode, type Quest } from '@hangul-route/content-schema';
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

  it('lists the Volume 2 quests as grid quests of their own episode, never a start (they open from the cell page)', () => {
    for (const id of v2.questIds) expect(catalog.quests.find((q) => q.id === id)).toMatchObject({ episodeId: v2.id, stage: 'stage2', grid: true, playable: false });
  });

  it('puts them in route order right after their cell Volume 1, before the next cell', () => {
    const order = inRouteOrder(catalog).map((q) => q.id);
    const lastV1 = Math.max(...['quest:stage2-nature-q1', 'quest:stage2-nature-q2', 'quest:stage2-nature-q3'].map((id) => order.indexOf(id)).filter((i) => i >= 0));
    expect(order.indexOf('quest:stage2-nature-v2-q1')).toBe(lastV1 + 1);
    expect(order.indexOf('quest:stage2-nature-v2-q2')).toBe(lastV1 + 2);
  });

  it('a stage3 level places them out with Volume 1; a stage2 level keeps them', () => {
    const at3 = questsPlacedOutAtLevel({ stage: 'stage3', band: 0 }, catalog);
    for (const id of [...v2.questIds, 'quest:stage2-nature-q1']) expect(at3).toContain(id);
    const at2 = questsPlacedOutAtLevel({ stage: 'stage2', band: 2 }, catalog);
    for (const id of v2.questIds) expect(at2).not.toContain(id);
  });
});

/**
 * The grown-up's "Choose a different start" with the shipped later volumes (row CM-40, made reachable by CM-44 S4's
 * Letters Volume 2): a later volume is never a choice, whatever `volumes` is, and a chosen start never places out a
 * quest of a later stage than its own.
 */
describe('the start choices and a grown-up override with the shipped later volumes', () => {
  const catalog = placementRouteCatalog(questsAll, episodesWithVolumes);
  const stageOf = new Map(catalog.quests.map((q) => [q.id, q.stage]));
  const choices = startChoices({ startQuestId: null, placedOutQuestIds: [] } as never, catalog, new Set(), () => true);

  it('a shipped Volume 2 is in the catalogue (so the checks below bite)', () => {
    expect(catalog.quests.some((q) => q.id === 'quest:stage4-letters-v2-q1')).toBe(true);
  });

  it('lists no later-volume quest', () => {
    expect(choices.length).toBeGreaterThan(50);
    expect(choices.filter((c) => c.questId.includes('-v2-'))).toEqual([]);
  });

  it('a chosen start places out only quests of its stage or before, and starts on the chosen quest', () => {
    for (const { questId } of choices) {
      const result = placementResult({ override: { by: 'parent', at: '2026-10-02T00:00:00.000Z', startQuestId: questId } });
      const seed = effectiveRoute([result], catalog, { isEntitled: () => true, completedQuestIds: new Set() });
      const chosenStage = placementStageNumber(stageOf.get(questId) as never);
      for (const id of seed?.placedOutQuestIds ?? []) expect(placementStageNumber(stageOf.get(id) as never), `${questId} placed out ${id}`).toBeLessThanOrEqual(chosenStage);
      expect(seed?.startQuestId, questId).toBe(questId);
    }
  });

  it('a level at Stage 5 places the Stage 4 Letters Volume 2 out with its Volume 1', () => {
    const at5 = questsPlacedOutAtLevel({ stage: 'stage5', band: 0 } as never, catalog);
    for (const id of ['quest:stage4-letters-q1', 'quest:stage4-letters-v2-q1']) expect(at5).toContain(id);
  });
});

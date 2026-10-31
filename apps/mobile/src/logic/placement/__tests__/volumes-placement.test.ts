import { effectiveRoute, inRouteOrder, questsPlacedOutAtLevel, type Episode, type Quest } from '@hangul-route/content-schema';
import { describe, expect, it } from 'vitest';
import { episodesAll, episodesWithVolumes, questsAll } from '../../../content';
import { placementRouteCatalog } from '../catalog';
import { startChoices } from '../report-page';
import { resultView } from '../result-view';
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

/**
 * The shipped Volume 2 (Stage 6 Food, row CM-43 S6) with the catalogue the level check and the placement report use.
 * The route is each cell's first volume, so a later volume is never a start, an override target or a 'next' card,
 * whatever the `volumes` switch says; a level still places it out like its Volume 1 (above).
 */
describe('a later volume is never a start, an override target or a next card (rows CM-40, CM-43 S6)', () => {
  const catalog = placementRouteCatalog(questsAll, episodesWithVolumes);
  const all = () => true;
  const V2 = catalog.quests.filter((q) => q.episodeId === 'episode:stage6-life-v2').map((q) => q.id);
  const firstVolumes = inRouteOrder(catalog).filter((q) => q.grid && q.playable && q.laterVolume !== true);

  it('the shipped catalogue holds the Stage 6 Food Volume 2, marked as a later volume', () => {
    expect(V2).toEqual(['quest:stage6-life-v2-q1', 'quest:stage6-life-v2-q2', 'quest:stage6-life-v2-q3']);
    for (const id of V2) expect(catalog.quests.find((q) => q.id === id)).toMatchObject({ grid: true, laterVolume: true });
  });

  it("'Choose a different start' lists no Volume 2 quest", () => {
    const seed = effectiveRoute([placementResult({ level: { stage: 'stage1', band: 0 } })], catalog, { isEntitled: all, completedQuestIds: new Set() });
    if (seed === null) throw new Error('a stored result always has a route');
    const ids = startChoices(seed, catalog, new Set(), all).map((c) => c.questId);
    expect(ids).toHaveLength(firstVolumes.length);
    expect(ids.filter((id) => id.includes('-v2-'))).toEqual([]);
  });

  it('an override naming a Volume 2 quest is ignored, as the Journey ignores it', () => {
    const override = { by: 'parent' as const, at: '2026-10-02T00:00:00.000Z', startQuestId: 'quest:stage6-life-v2-q1' };
    const seed = effectiveRoute([placementResult({ override })], catalog, { isEntitled: all, completedQuestIds: new Set() });
    expect(seed?.startQuestId).toBe(firstVolumes[0]?.id);
    expect(seed?.placedOutQuestIds).toEqual([]);
  });

  it('an override places a Volume 2 out with its own cell: before the start when its cell is, put back otherwise', () => {
    const at = (startQuestId: string) =>
      effectiveRoute([placementResult({ level: { stage: 'stage7', band: 0 }, placedOutQuestIds: [...V2], override: { by: 'parent', at: '2026-10-02T00:00:00.000Z', startQuestId } })], catalog, {
        isEntitled: all,
        completedQuestIds: new Set(),
      });
    const stage7 = firstVolumes.find((q) => q.stage === 'stage7') as { id: string };
    const stage6Life = firstVolumes.find((q) => q.episodeId === 'episode:stage6-life') as { id: string };
    for (const id of V2) expect(at(stage7.id)?.placedOutQuestIds).toContain(id);
    for (const id of V2) expect(at(stage6Life.id)?.placedOutQuestIds).not.toContain(id);
    expect(at(stage6Life.id)?.startQuestId).toBe(stage6Life.id);
  });

  it('with every first volume done, the check names no start and no Volume 2 next card', () => {
    const done = new Set(firstVolumes.map((q) => q.id));
    const seed = effectiveRoute([placementResult({ level: { stage: 'stage1', band: 0 } })], catalog, { isEntitled: all, completedQuestIds: done });
    expect(seed?.startQuestId).toBeNull();
    expect(seed?.startEpisodeId).toBeNull();
    const last = firstVolumes[firstVolumes.length - 1] as { id: string };
    const lastSeed = effectiveRoute([placementResult({ level: { stage: 'stage1', band: 0 } })], catalog, {
      isEntitled: all,
      completedQuestIds: new Set(firstVolumes.slice(0, -1).map((q) => q.id)),
    });
    expect(lastSeed?.startQuestId).toBe(last.id);
    if (lastSeed === null) throw new Error('a stored result always has a route');
    const view = resultView({
      result: placementResult(),
      before: null,
      after: lastSeed,
      catalog,
      completedQuestIds: new Set(firstVolumes.slice(0, -1).map((q) => q.id)),
      profileType: 'self',
      routeEnabled: false,
      myRouteEnabled: false,
      proposalAvailable: false,
      planPromptDismissed: false,
      hasActivePlan: false,
      planUpdateAvailable: false,
      hasReviewedShelfStory: false,
      gateRequired: false,
    });
    expect(view.cards.next.filter((id) => id.includes('-v2-'))).toEqual([]);
  });
});

import { describe, expect, it } from 'vitest';
import { CATALOG, StageKeySchema, stageAvailabilityOf } from '@hangul-route/content-schema';
import { episodesAll, gridEpisodes } from '../../content';
import { stageAvailability } from '../journey';

/**
 * AMENDMENTS-ROUTE-LEARNING-ROUTE section 4.1 (LR-3b): the console words a stage from the shared
 * catalogue (`stageAvailabilityOf`), the app from its bundle (`stageAvailability` over the grid
 * episodes). On the bundled content both name the same availability for all seven stages, so a
 * taste goal reads "Explore" on the child's tab and on the grown-up card alike.
 */
describe('stage availability parity: the shared catalogue and the app bundle (LR-3b)', () => {
  const grid = gridEpisodes(episodesAll);

  for (const stage of StageKeySchema.options) {
    it(`${stage}: stageAvailabilityOf(CATALOG) equals stageAvailability(gridEpisodes)`, () => {
      expect(stageAvailabilityOf(CATALOG, stage)).toBe(stageAvailability(stage, grid));
    });
  }

  it('the bundle is not trivially uniform: it has a full stage, a taste and a stage still to come', () => {
    const all = new Set(StageKeySchema.options.map((stage) => stageAvailability(stage, grid)));
    expect(all).toEqual(new Set(['open', 'taste', 'soon']));
  });
});

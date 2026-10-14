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

  it('the bundle is not trivially uniform: it has a full stage, and every stage reads a known state', () => {
    // F-CURR-001 ships the last "Coming later" cells, so the live bundle may hold no taste or soon stage;
    // the taste and soon cases are checked on a bundle with cells taken back below.
    const all = new Set(StageKeySchema.options.map((stage) => stageAvailability(stage, grid)));
    expect(all.has('open')).toBe(true);
    for (const state of all) expect(['open', 'taste', 'soon']).toContain(state);
  });

  it('agrees on a taste and a stage still to come too (cells taken back to placeholders)', () => {
    const back = (keep: (cell: { stage: string; theme: string }) => boolean) => ({
      app: grid.map((e) => (e.stage === 'stage6' && !keep(e) ? { ...e, status: 'preview' as const, questIds: [] } : e)),
      catalog: { ...CATALOG, cells: CATALOG.cells.map((c) => (c.stage === 'stage6' && !keep(c) ? { ...c, status: 'preview' as const, questIds: [] } : c)) },
    });
    const taste = back((c) => c.theme === 'letters');
    expect(stageAvailability('stage6', taste.app)).toBe('taste');
    expect(stageAvailabilityOf(taste.catalog, 'stage6')).toBe('taste');
    const soon = back(() => false);
    expect(stageAvailability('stage6', soon.app)).toBe('soon');
    expect(stageAvailabilityOf(soon.catalog, 'stage6')).toBe('soon');
  });
});

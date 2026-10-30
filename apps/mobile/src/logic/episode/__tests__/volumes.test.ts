import type { Episode } from '@hangul-route/content-schema';
import { describe, expect, it } from 'vitest';
import { episodesAll } from '../../../content';
import { cellVolumes, volumePageEpisode } from '../volumes';

/** A cell's page and its volumes (F-CURR-002 row CM-40), with a fixture Volume 2 of Stage 2 Nature (none ships yet). */
const nature = episodesAll.find((e) => e.id === 'episode:stage2-nature') as Episode;
const v2: Episode = { ...nature, id: 'episode:stage2-nature-v2', volume: 2, questIds: ['quest:stage2-nature-v2-q1'] };
const list = [...episodesAll, v2];

describe('volumePageEpisode and cellVolumes', () => {
  it('shows the asked volume while volumes is on, and the cell\'s Volume 1 for a Volume 2 while it is off', () => {
    expect(volumePageEpisode(v2, true, list)?.id).toBe(v2.id);
    expect(volumePageEpisode(v2, false, list)?.id).toBe(nature.id);
    expect(volumePageEpisode(nature, false, list)?.id).toBe(nature.id);
    expect(volumePageEpisode(undefined, true, list)).toBeUndefined();
  });

  it('lists the cell\'s playable volumes in order only while volumes is on; a preview Volume 2 is not listed', () => {
    expect(cellVolumes(v2, true, list).map((e) => e.id)).toEqual([nature.id, v2.id]);
    expect(cellVolumes(nature, false, list).map((e) => e.id)).toEqual([nature.id]);
    expect(cellVolumes(nature, true, [...episodesAll, { ...v2, status: 'preview' }]).map((e) => e.id)).toEqual([nature.id]);
    expect(cellVolumes(nature, true).map((e) => e.id)).toEqual([nature.id]);
  });
});

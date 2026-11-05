import type { Episode } from '@hangul-route/content-schema';
import { describe, expect, it } from 'vitest';
import { episodesAll } from '../../../content';
import { cellVolumes, isLaterVolumeQuest, volumePageEpisode } from '../volumes';

/**
 * A cell's page and its volumes (F-CURR-002 row CM-40), with a fixture Volume 2 of Stage 2 Nature; the shipped one (row
 * CM-41 S2) is read from the bundle in the last case.
 */
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
    // The bundle ships Stage 2 Nature's Volume 2 (row CM-41 S2); a cell with none lists its first volume alone.
    expect(cellVolumes(nature, true).map((e) => e.id)).toEqual([nature.id, 'episode:stage2-nature-v2']);
    expect(cellVolumes(nature, false).map((e) => e.id)).toEqual([nature.id]);
    // Stage 2 Holidays & Traditions ships no Volume 2 yet (row CM-45 S2 is not merged).
    const rites = episodesAll.find((e) => e.id === 'episode:stage2-rites') as Episode;
    expect(cellVolumes(rites, true).map((e) => e.id)).toEqual([rites.id]);
  });
});

describe('isLaterVolumeQuest (the quest player holds a later volume while volumes is off, row CM-41 S2)', () => {
  it('names a quest of a later volume, or any quest opened under one; a first volume quest is never held', () => {
    expect(isLaterVolumeQuest('quest:stage2-nature-v2-q1', v2.id, list)).toBe(true);
    expect(isLaterVolumeQuest('quest:stage2-nature-v2-q1', nature.id, list)).toBe(true);
    expect(isLaterVolumeQuest(nature.questIds[0]!, v2.id, list)).toBe(true);
    expect(isLaterVolumeQuest(nature.questIds[0]!, nature.id, list)).toBe(false);
    expect(isLaterVolumeQuest('quest:stage1-letters-q1', 'episode:stage1-letters', list)).toBe(false);
  });

  it('reads the shipped Volume 2 from the bundle: each of its three quests is held', () => {
    for (const q of ['quest:stage2-nature-v2-q1', 'quest:stage2-nature-v2-q2', 'quest:stage2-nature-v2-q3']) {
      expect(isLaterVolumeQuest(q, 'episode:stage2-nature-v2')).toBe(true);
      expect(isLaterVolumeQuest(q, 'episode:stage2-nature')).toBe(true);
    }
    for (const q of nature.questIds) expect(isLaterVolumeQuest(q, nature.id)).toBe(false);
  });
});

import type { Episode } from '@hangul-route/content-schema';
import { describe, expect, it } from 'vitest';
import { episodesAll, themes } from '../../content';
import {
  isEpisodeComplete,
  stageAvailability,
  stagePillLabel,
  themeCellInitial,
  themeColumnLabel,
} from '../journey';

const ep = (id: string, stage: Episode['stage'], status: Episode['status'], questIds = ['q1']): Episode => ({
  id,
  stage,
  theme: 'letters',
  order: 1,
  titleEn: id,
  hoyaIntroEn: 'hi',
  questIds,
  rewardCardIds: [],
  estimatedMinutes: 5,
  status,
});

describe('stageAvailability', () => {
  it('open when every cell is shipped, taste when some, soon when none', () => {
    const eps = [
      ep('a', 'stage1', 'shipped'),
      ep('b', 'stage1', 'shipped'),
      ep('c', 'stage2', 'shipped'),
      ep('d', 'stage2', 'preview'),
      ep('e', 'stage3', 'preview'),
    ];
    expect(stageAvailability('stage1', eps)).toBe('open');
    expect(stageAvailability('stage2', eps)).toBe('taste');
    expect(stageAvailability('stage3', eps)).toBe('soon');
    expect(stageAvailability('stage7', eps)).toBe('soon');
  });
  it('matches the real bundle: stage1 open, stage2/4 taste, others soon', () => {
    expect(stageAvailability('stage1', episodesAll)).toBe('open');
    expect(stageAvailability('stage2', episodesAll)).toBe('taste');
    expect(stageAvailability('stage4', episodesAll)).toBe('taste');
    expect(stageAvailability('stage3', episodesAll)).toBe('soon');
  });
  it('labels are short and English', () => {
    expect(stagePillLabel('open')).toBe('Open');
    expect(stagePillLabel('taste')).toBe('Taste');
    expect(stagePillLabel('soon')).toBe('Soon');
  });
});

describe('isEpisodeComplete', () => {
  const episode = ep('episode:x', 'stage1', 'shipped', ['q1', 'q2']);
  it('requires every quest of the episode to be completed', () => {
    expect(
      isEpisodeComplete(episode, [{ questId: 'q1', episodeId: 'episode:x', completedAt: 't' }]),
    ).toBe(false);
    expect(
      isEpisodeComplete(episode, [
        { questId: 'q1', episodeId: 'episode:x', completedAt: 't' },
        { questId: 'q2', episodeId: 'episode:x', completedAt: 't' },
      ]),
    ).toBe(true);
  });
  it('ignores progress from other episodes and unfinished quests', () => {
    expect(
      isEpisodeComplete(episode, [
        { questId: 'q1', episodeId: 'episode:y', completedAt: 't' },
        { questId: 'q2', episodeId: 'episode:x', completedAt: undefined },
      ]),
    ).toBe(false);
  });
  it('an episode with no quests is never complete', () => {
    expect(isEpisodeComplete(ep('e', 'stage1', 'shipped', []), [])).toBe(false);
  });
});

describe('theme column labels (audit UX-11: two columns both read "L")', () => {
  it('column headers are the first word of each theme title', () => {
    expect(themes.map(themeColumnLabel)).toEqual(['Letters', 'Food', 'Holidays', 'Nature', 'Play']);
  });

  it('cell initials match their column header', () => {
    for (const t of themes) {
      expect(themeCellInitial(t)).toBe(themeColumnLabel(t).charAt(0).toUpperCase());
    }
    expect(themes.map(themeCellInitial)).toEqual(['L', 'F', 'H', 'N', 'P']);
  });

  it('every column has its own initial', () => {
    const initials = themes.map(themeCellInitial);
    expect(new Set(initials).size).toBe(themes.length);
  });

  it('copes with a one-word or padded title', () => {
    expect(themeColumnLabel({ titleEn: 'Music' })).toBe('Music');
    expect(themeColumnLabel({ titleEn: '  Sea & Sky ' })).toBe('Sea');
    expect(themeCellInitial({ titleEn: 'music' })).toBe('M');
  });
});

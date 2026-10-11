import type { Episode } from '@hangul-route/content-schema';
import { getMessages } from '@hangul-route/i18n';
import { describe, expect, it } from 'vitest';
import { episodesAll, gridEpisodes, questsAll, themes } from '../../content';
import {
  gridQuestProgress,
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
  it('is unchanged by shelf episodes once the grid selector runs (F-STORY-004 §3.10)', () => {
    const cells = [ep('a', 'stage1', 'shipped'), ep('b', 'stage1', 'shipped')];
    const shelf: Episode = { ...ep('shelf-tale', 'stage1', 'ready'), placement: 'shelf', format: 'story' };
    expect(stageAvailability('stage1', [...cells, shelf])).toBe('taste');
    expect(stageAvailability('stage1', gridEpisodes([...cells, shelf]))).toBe('open');
    expect(stageAvailability('stage3', gridEpisodes([{ ...ep('shelf-x', 'stage3', 'shipped'), placement: 'shelf' }]))).toBe('soon');
  });
  it('matches the real bundle: stage1 open, stage2/4 taste, others soon', () => {
    expect(stageAvailability('stage1', episodesAll)).toBe('open');
    expect(stageAvailability('stage2', episodesAll)).toBe('taste');
    expect(stageAvailability('stage4', episodesAll)).toBe('taste');
    expect(stageAvailability('stage3', episodesAll)).toBe('soon');
  });
  it('labels are short and come from the message subtree it is given (F-I18N-001 PR 6b)', () => {
    const m = getMessages('en').learner.journey.availability;
    expect(stagePillLabel('open', m)).toBe('Open');
    expect(stagePillLabel('taste', m)).toBe('Taste');
    expect(stagePillLabel('soon', m)).toBe('Soon');
    expect(stagePillLabel('soon', { ...m, soon: { pill: 'Pronto' } })).toBe('Pronto');
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

describe('gridQuestProgress (F-STORY-004 §3.10, behaviour #9: the Home quest total)', () => {
  const grid = ep('grid-a', 'stage1', 'shipped', ['q1', 'q2']);
  const shelf: Episode = { ...ep('shelf-a', 'stage1', 'shipped', ['qs']), placement: 'shelf' };
  const quests = [{ id: 'q1' }, { id: 'q2' }, { id: 'qs' }];
  const done = (questId: string) => ({ questId, completedAt: '2026-10-01T00:00:00.000Z' });

  it('counts grid quests on both sides, so a finished shelf story never reads "3 of 2"', () => {
    expect(gridQuestProgress([grid, shelf], quests, [done('q1'), done('q2'), done('qs')])).toEqual({ completed: 2, total: 2 });
  });

  it('leaves out started-but-unfinished quests and ids no grid episode lists', () => {
    expect(
      gridQuestProgress([grid, shelf], quests, [done('q1'), { questId: 'q2' }, done('retired')]),
    ).toEqual({ completed: 1, total: 2 });
  });

  it('is 0 of the grid total with no progress, and the total stays the grid count for today\'s bundle', () => {
    expect(gridQuestProgress([grid, shelf], quests, [])).toEqual({ completed: 0, total: 2 });
    const gridIds = new Set(gridEpisodes(episodesAll).flatMap((e) => e.questIds));
    expect(gridQuestProgress(episodesAll, questsAll, []).total).toBe(questsAll.filter((q) => gridIds.has(q.id)).length);
  });
});

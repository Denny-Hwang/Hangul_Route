import type { Episode } from '@hangul-route/content-schema';
import { getMessages } from '@hangul-route/i18n';
import { describe, expect, it } from 'vitest';
import { episodesAll, gridEpisodes, questsAll, themes } from '../../content';
import { storyQuests } from '../../content/stories';
import {
  gridQuestProgress,
  isCellComplete,
  isEpisodeComplete,
  stageAvailability,
  stagePillLabel,
  stagePillState,
  themeCellInitial,
  themeColumnLabel,
} from '../journey';
import { completeStages } from '../my-route/latch';

const ep = (
  id: string,
  stage: Episode['stage'],
  status: Episode['status'],
  questIds = ['q1'],
  theme: Episode['theme'] = 'letters',
): Episode => ({
  id,
  stage,
  theme,
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
      ep('b', 'stage1', 'shipped', ['q1'], 'life'),
      ep('c', 'stage2', 'shipped'),
      ep('d', 'stage2', 'preview', ['q1'], 'life'),
      ep('e', 'stage3', 'preview'),
    ];
    expect(stageAvailability('stage1', eps)).toBe('open');
    expect(stageAvailability('stage2', eps)).toBe('taste');
    expect(stageAvailability('stage3', eps)).toBe('soon');
    expect(stageAvailability('stage7', eps)).toBe('soon');
  });
  it('is unchanged by shelf episodes once the grid selector runs (F-STORY-004 §3.10)', () => {
    const cells = [ep('a', 'stage1', 'shipped'), ep('b', 'stage1', 'shipped', ['q1'], 'life')];
    const shelf: Episode = { ...ep('shelf-tale', 'stage1', 'ready', ['q1'], 'crafts'), placement: 'shelf', format: 'story' };
    expect(stageAvailability('stage1', [...cells, shelf])).toBe('taste');
    expect(stageAvailability('stage1', gridEpisodes([...cells, shelf]))).toBe('open');
    expect(stageAvailability('stage3', gridEpisodes([{ ...ep('shelf-x', 'stage3', 'shipped'), placement: 'shelf' }]))).toBe('soon');
  });
  it('counts cells, not episodes: two episodes in one cell are one cell (F-STORY-005 §3.5)', () => {
    const lesson = ep('lesson', 'stage5', 'shipped');
    const volume2 = { ...ep('volume-2', 'stage5', 'preview'), volume: 2 };
    expect(stageAvailability('stage5', [lesson, volume2])).toBe('open');
    expect(stageAvailability('stage5', [volume2, lesson])).toBe('open');
    expect(stageAvailability('stage5', [lesson, volume2, ep('other', 'stage5', 'preview', ['q1'], 'life')])).toBe('taste');
    expect(stageAvailability('stage5', [volume2, { ...volume2, id: 'volume-3', volume: 3 }])).toBe('soon');
  });
  it('matches the real bundle: stage1 open, stage2/3/4/6 taste (stage3 since First Sentences, F-CURR-001 S3-1; stage6 since Travel for Chuseok, S6-3), others soon', () => {
    expect(stageAvailability('stage1', episodesAll)).toBe('open');
    expect(stageAvailability('stage2', episodesAll)).toBe('taste');
    expect(stageAvailability('stage4', episodesAll)).toBe('taste');
    expect(stageAvailability('stage3', episodesAll)).toBe('taste');
    expect(stageAvailability('stage6', episodesAll)).toBe('taste');
    expect(stageAvailability('stage7', episodesAll)).toBe('soon');
  });
  it('labels are short and come from the message subtree it is given (F-I18N-001 PR 6b)', () => {
    const m = getMessages('en').learner.journey.availability;
    expect(stagePillLabel('open', m)).toBe('Open');
    expect(stagePillLabel('taste', m)).toBe('A taste');
    expect(stagePillLabel('soon', m)).toBe('Coming later');
    expect(stagePillLabel('soon', { ...m, soon: { pill: 'Pronto' } })).toBe('Pronto');
  });

  it('reads Complete for a completed stage (F-QUEST-002 section 3.8)', () => {
    const m = getMessages('en').learner.journey.availability;
    expect(stagePillLabel('complete', m)).toBe('Complete');
  });
});

describe('stagePillState', () => {
  it('is complete when the stage is complete, whatever its availability word', () => {
    expect(stagePillState('open', true)).toBe('complete');
  });

  it('keeps the availability word while the stage is not complete', () => {
    expect(stagePillState('open', false)).toBe('open');
    expect(stagePillState('taste', false)).toBe('taste');
    expect(stagePillState('soon', false)).toBe('soon');
  });
});

describe('completeStages: which stage rows read Complete', () => {
  const AT = '2026-10-01T09:00:00.000Z';
  const stage1Done = gridEpisodes(episodesAll)
    .filter((e) => e.stage === 'stage1')
    .flatMap((e) => e.questIds.map((questId) => ({ questId, episodeId: e.id, startedAt: AT, completedAt: AT, stars: 1 as const, attempts: 1, accuracy: 0.5 })));

  it('is empty for a new learner', () => {
    expect(completeStages({ quests: [] }, episodesAll)).toEqual(new Set());
  });

  it('holds Stage 1 once every Stage 1 quest is complete, at any star count', () => {
    expect(completeStages({ quests: stage1Done }, episodesAll)).toEqual(new Set(['stage1']));
  });

  it('is not complete while one Stage 1 quest is missing', () => {
    expect(completeStages({ quests: stage1Done.slice(1) }, episodesAll).has('stage1')).toBe(false);
  });

  it('keeps a latched stage complete when new quests join it (F-ROUTE-001 stage latch)', () => {
    const snapshot = { quests: stage1Done.slice(1), stageDoneAt: { stage1: '2026-10-01T09:00:00.000Z' } };
    expect(completeStages(snapshot, episodesAll)).toEqual(new Set(['stage1']));
  });

  it('ignores a latch key that is not a stage', () => {
    expect(completeStages({ quests: [], stageDoneAt: { stage9: 'x' } }, episodesAll)).toEqual(new Set());
  });

  it('never completes a taste stage from its shipped quests alone', () => {
    const stage2 = gridEpisodes(episodesAll)
      .filter((e) => e.stage === 'stage2')
      .flatMap((e) => e.questIds.map((questId) => ({ questId, episodeId: e.id, startedAt: AT, completedAt: AT, stars: 1 as const, attempts: 1, accuracy: 0.5 })));
    expect(completeStages({ quests: stage2 }, episodesAll).has('stage2')).toBe(false);
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
    // Every hand-written quest is a grid quest; bundled shelf stories never count.
    expect(gridQuestProgress(episodesAll, questsAll, []).total).toBe(
      questsAll.filter((q) => !storyQuests.includes(q)).length,
    );
  });

  it('never reads "completed of total" past the total when a grid episode lists a quest that is not bundled', () => {
    const listsMissing = ep('grid-b', 'stage1', 'shipped', ['q1', 'q-missing']);
    expect(
      gridQuestProgress([listsMissing], [{ id: 'q1' }], [done('q1'), done('q-missing')]),
    ).toEqual({ completed: 1, total: 1 });
  });
});

describe('isCellComplete (F-STORY-005 §3.5)', () => {
  const done = (episodeId: string, questId: string) => ({ questId, episodeId, completedAt: '2026-10-01T00:00:00Z' });
  const one = ep('one', 'stage5', 'shipped', ['q1', 'q2']);
  const two = { ...ep('two', 'stage5', 'shipped', ['q3']), volume: 2 };

  it('equals isEpisodeComplete while a cell holds one episode', () => {
    const partial = [done('one', 'q1')];
    const full = [done('one', 'q1'), done('one', 'q2')];
    expect(isCellComplete([one], partial)).toBe(isEpisodeComplete(one, partial));
    expect(isCellComplete([one], full)).toBe(isEpisodeComplete(one, full));
    expect(isCellComplete([one], full)).toBe(true);
  });

  it('needs every episode of the cell complete', () => {
    expect(isCellComplete([one, two], [done('one', 'q1'), done('one', 'q2')])).toBe(false);
    expect(isCellComplete([one, two], [done('one', 'q1'), done('one', 'q2'), done('two', 'q3')])).toBe(true);
  });

  it('is false for an empty cell and for a preview cell', () => {
    expect(isCellComplete([], [])).toBe(false);
    expect(isCellComplete([ep('soon', 'stage6', 'preview', [])], [])).toBe(false);
  });

  // Before MAX_EPISODES_PER_CELL becomes 2 (PR 5.8): stage completion still counts
  // grid episodes in awards/derive.ts `isStageComplete` and my-route/stage-rows.ts
  // `isDerivedComplete`/`completionState`, while stageAvailability counts cells.
  it.todo('a cell with a shipped volume 1 and a preview volume 2 still lets its stage complete (PR 5.8)');
});

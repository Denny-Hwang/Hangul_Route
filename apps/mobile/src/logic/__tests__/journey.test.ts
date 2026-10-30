import type { Episode } from '@hangul-route/content-schema';
import { getMessages } from '@hangul-route/i18n';
import { iconNames } from '@hangul-route/design-system/icon-glyphs';
import { ThemeKeySchema } from '@hangul-route/content-schema';
import { describe, expect, it } from 'vitest';
import { episodesAll, gridEpisodes, questsAll, themes } from '../../content';
import { storyQuests } from '../../content/stories';
import { volumeEpisodes } from '../../content/episodes';
import {
  gridQuestProgress,
  isCellComplete,
  isEpisodeComplete,
  stageAvailability,
  stagePillLabel,
  stagePillState,
  themeColumnLabel,
  themeGlyph,
} from '../journey';
import { completeStages } from '../my-route/latch';
import { allPlayableDone, isDerivedComplete } from '../my-route/stage-rows';
import { stageCompleteFor } from '../awards/transitions';

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
  it('matches the real bundle: stage1 open, stage2 open, stage3 open, stage4 open, stage6 open, stage7 open (every stage opened as its last placeholder shipped: Stage 2 with Holiday Words S2-2, Stage 3 with Animal Sentences S3-4, Stage 4 with Playdate Talk S4-4, Stage 6 with Buy at Market S6-5, Stage 7 with Make & Share S7-5, F-CURR-001)', () => {
    expect(stageAvailability('stage1', episodesAll)).toBe('open');
    expect(stageAvailability('stage2', episodesAll)).toBe('open');
    expect(stageAvailability('stage3', episodesAll)).toBe('open');
    expect(stageAvailability('stage4', episodesAll)).toBe('open');
    expect(stageAvailability('stage6', episodesAll)).toBe('open');
    expect(stageAvailability('stage7', episodesAll)).toBe('open');
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
    // Every Stage 3 cell has shipped (F-CURR-001 S3-4), so the taste is made here: one Stage 3 cell
    // goes back to a "Coming later" placeholder, and the other cells' quests stay completed.
    const [held, ...rest] = gridEpisodes(episodesAll).filter((e) => e.stage === 'stage3');
    if (held === undefined) throw new Error('no Stage 3 cell');
    const tasteBundle = episodesAll.map((e) => (e.id === held.id ? { ...e, status: 'preview' as const, questIds: [] } : e));
    expect(stageAvailability('stage3', tasteBundle)).toBe('taste');
    const stage3 = rest.flatMap((e) => e.questIds.map((questId) => ({ questId, episodeId: e.id, startedAt: AT, completedAt: AT, stars: 1 as const, attempts: 1, accuracy: 0.5 })));
    expect(stage3.length).toBeGreaterThan(0);
    expect(completeStages({ quests: stage3 }, tasteBundle).has('stage3')).toBe(false);
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

  it('cells draw a theme glyph, never a letter: L / F / H / N / P could not be decoded (owner decision 2026-10-14)', () => {
    expect(themes.map((t) => themeGlyph(t.key))).toEqual(['hangul-tile', 'rice-bowl', 'lantern', 'leaf', 'spinning-top']);
  });

  it('every theme key has its own glyph from the design-system set', () => {
    const glyphs = ThemeKeySchema.options.map(themeGlyph);
    expect(new Set(glyphs).size).toBe(ThemeKeySchema.options.length);
    for (const glyph of glyphs) expect(iconNames).toContain(glyph);
  });

  it('copes with a one-word or padded title', () => {
    expect(themeColumnLabel({ titleEn: 'Music' })).toBe('Music');
    expect(themeColumnLabel({ titleEn: '  Sea & Sky ' })).toBe('Sea');
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
    // Every hand-written quest is a grid quest; bundled shelf stories never count, nor an optional addition not yet done.
    const optional = new Set(episodesAll.flatMap((e) => e.optionalQuestIds ?? []));
    // A later volume's quests (Stage 6 Food Volume 2, rows CM-40 and CM-43 S6) never join Home's total.
    const later = new Set(volumeEpisodes.flatMap((e) => e.questIds));
    expect(later.size).toBe(3);
    expect(gridQuestProgress(episodesAll, questsAll, []).total).toBe(
      questsAll.filter((q) => !storyQuests.includes(q) && !optional.has(q.id) && !later.has(q.id)).length,
    );
  });

  it('counts an optional addition on both sides once it is done, never before (F-CURR-002 section 4.2)', () => {
    const withAddition: Episode = { ...grid, questIds: ['q1', 'q2', 'qx'], optionalQuestIds: ['qx'] };
    const bundled = [...quests, { id: 'qx' }];
    // A learner who finished every quest before the addition shipped still reads 2 of 2.
    expect(gridQuestProgress([withAddition, shelf], bundled, [done('q1'), done('q2')])).toEqual({ completed: 2, total: 2 });
    expect(gridQuestProgress([withAddition, shelf], bundled, [])).toEqual({ completed: 0, total: 2 });
    expect(gridQuestProgress([withAddition, shelf], bundled, [done('q1'), done('q2'), done('qx')])).toEqual({ completed: 3, total: 3 });
    expect(gridQuestProgress([withAddition, shelf], bundled, [done('qx')])).toEqual({ completed: 1, total: 3 });
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

  // PR 5.8 (F-CURR-002 row CM-40): stage completion reads cells, each by its first volume, in awards/derive.ts
  // `isStageComplete` and my-route/stage-rows.ts `isDerivedComplete` / `allPlayableDone`, as stageAvailability counts cells.
  it('a cell with a shipped volume 1 and a preview volume 2 still lets its stage complete (PR 5.8)', () => {
    const cells = ['letters', 'life', 'rites', 'nature', 'crafts'].map((theme, i) => ({
      ...ep(`episode:stage2-${theme}`, 'stage2', 'shipped', [`quest:stage2-${theme}-q1`]),
      theme: theme as Episode['theme'],
      order: i + 1,
    }));
    const preview = { ...ep('episode:stage2-nature-v2', 'stage2', 'preview', []), theme: 'nature' as const, order: 4, volume: 2 };
    const shipped = { ...ep('episode:stage2-nature-v2', 'stage2', 'shipped', ['quest:stage2-nature-v2-q1']), theme: 'nature' as const, order: 4, volume: 2 };
    const at = '2026-10-01T00:00:00Z';
    const firstVolumes = { quests: cells.map((c) => ({ questId: c.questIds[0] as string, episodeId: c.id, startedAt: at, completedAt: at, stars: 3 as const, attempts: 1, accuracy: 1 })) };
    expect(stageAvailability('stage2', [...cells, preview])).toBe('open');
    expect(stageCompleteFor('stage2', [...cells, preview], firstVolumes)).toBe(true);
    // A shipped Volume 2 not started yet never holds the stage back, and the cell's own look still waits for it.
    expect(stageCompleteFor('stage2', [...cells, shipped], firstVolumes)).toBe(true);
    expect(isDerivedComplete('stage2', [...cells, shipped], firstVolumes)).toBe(true);
    expect(allPlayableDone('stage2', [...cells, shipped], firstVolumes)).toBe(true);
    const natureCell = [cells[3] as Episode, shipped];
    expect(isCellComplete(natureCell, firstVolumes.quests)).toBe(false);
    // Without its first volumes done the stage is not complete, whatever a Volume 2 says.
    const v2Only = { quests: [{ questId: 'quest:stage2-nature-v2-q1', episodeId: shipped.id, startedAt: at, completedAt: at, stars: 3 as const, attempts: 1, accuracy: 1 }] };
    expect(stageCompleteFor('stage2', [...cells, shipped], v2Only)).toBe(false);
  });
});

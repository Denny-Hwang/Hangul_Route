import type { Episode, QuestProgress, StageKey, ThemeKey } from '@hangul-route/content-schema';
import { getMessages } from '@hangul-route/i18n';
import { describe, expect, it } from 'vitest';
import { stages, themes } from '../../content';
import { scanLearnerCopy } from '../homework/banned-text';
import { COUNT_MARK_MAX, cellLabel, cellModel, cellTestId, countMarkOf, type CellModel } from '../journey-cells';
import { NO_CELL_MARKS } from '../journey-grid';
import { buildStoryIndex } from '../story/story-index';
import { bookEpisode, questId, shelfEpisode, shelfIndex, story, storyQuest, unreviewed } from '../story/__tests__/shelf-fixture';

/**
 * F-STORY-005 PR 5.5a §3.5: one model per Journey cell (lesson, book, stories-only, placeholder) with
 * the heritage stories whose home is the cell, and its screen-reader sentence.
 */

const lesson = (id: string, stage: StageKey, theme: ThemeKey, status: Episode['status'] = 'shipped', questIds = [`quest:${id}-q1`]): Episode => ({
  id: `episode:${id}`,
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

const done = (episodeId: string, ...ids: string[]): Pick<QuestProgress, 'questId' | 'episodeId' | 'completedAt'>[] =>
  ids.map((id) => ({ questId: id, episodeId, completedAt: '2026-10-01T00:00:00.000Z' }));

const S1_LETTERS = lesson('s1-letters', 'stage1', 'letters', 'shipped', ['quest:a', 'quest:b']);
const S2_LETTERS_PREVIEW = lesson('stage2-letters', 'stage2', 'letters', 'preview');
const S3_RITES_PREVIEW = lesson('stage3-rites', 'stage3', 'rites', 'preview');
const BOOK = bookEpisode('episode:stage5-letters', [questId('book-one', 'read-along')]);
const GRID: Episode[] = [S1_LETTERS, S2_LETTERS_PREVIEW, S3_RITES_PREVIEW, BOOK];

const sejong = story('sejong-new-letters', { recommendedStage: 1, theme: 'letters', shelf: { order: 2 } });
const hangulDay = story('hangeul-day', { recommendedStage: 1, theme: 'letters', shelf: { order: 1 } });
const jikji = story('jikji-metal-type', { recommendedStage: 2, theme: 'letters', shelf: { order: 3 } });
const ENTRIES = shelfIndex([sejong, hangulDay, jikji]);

const model = (stage: StageKey, theme: ThemeKey, patch: Partial<Parameters<typeof cellModel>[0]> = {}): CellModel =>
  cellModel({ stage, theme, episodes: GRID, storyEntries: ENTRIES, quests: [], ...patch });

describe('cellModel', () => {
  it('a shipped grid lesson is a lesson cell with its stories counted', () => {
    expect(model('stage1', 'letters')).toEqual({
      stage: 'stage1',
      theme: 'letters',
      kind: 'lesson',
      episodeId: 'episode:s1-letters',
      completed: false,
      storyCount: 2,
      storiesFinished: 0,
    });
  });

  it('a ready grid lesson is a lesson cell too', () => {
    const ready = lesson('s1-life', 'stage1', 'life', 'ready');
    expect(model('stage1', 'life', { episodes: [ready] })).toMatchObject({ kind: 'lesson', episodeId: 'episode:s1-life' });
  });

  it('a shipped story-format grid episode is a book', () => {
    expect(model('stage5', 'letters')).toMatchObject({ kind: 'book', episodeId: 'episode:stage5-letters', storyCount: 0 });
  });

  it('a preview cell with stories is stories-only: no episode to open, never complete', () => {
    const quests = done(S2_LETTERS_PREVIEW.id, 'quest:stage2-letters-q1');
    expect(model('stage2', 'letters', { quests })).toEqual({
      stage: 'stage2',
      theme: 'letters',
      kind: 'stories-only',
      completed: false,
      storyCount: 1,
      storiesFinished: 0,
    });
  });

  it('an empty cell with a story is stories-only as well', () => {
    expect(model('stage2', 'letters', { episodes: [] })).toMatchObject({ kind: 'stories-only', storyCount: 1 });
  });

  it('a cell with no shipped episode and no story is a placeholder', () => {
    expect(model('stage3', 'rites')).toEqual({
      stage: 'stage3',
      theme: 'rites',
      kind: 'placeholder',
      completed: false,
      storyCount: 0,
      storiesFinished: 0,
    });
    expect(model('stage7', 'crafts', { episodes: [] })).toMatchObject({ kind: 'placeholder' });
    const draft = lesson('s3-life', 'stage3', 'life', 'draft');
    expect(model('stage3', 'life', { episodes: [draft] })).toMatchObject({ kind: 'placeholder' });
  });

  it('completed only when every quest of the cell episode is done', () => {
    expect(model('stage1', 'letters', { quests: done(S1_LETTERS.id, 'quest:a') }).completed).toBe(false);
    expect(model('stage1', 'letters', { quests: done(S1_LETTERS.id, 'quest:a', 'quest:b') }).completed).toBe(true);
  });

  it('counts the finished stories from quest progress, for the label only', () => {
    const quests = done('episode:shelf-sejong-new-letters', questId('sejong-new-letters'));
    expect(model('stage1', 'letters', { quests })).toMatchObject({ storyCount: 2, storiesFinished: 1 });
    const started = [{ questId: questId('hangeul-day'), episodeId: 'episode:shelf-hangeul-day' }];
    expect(model('stage1', 'letters', { quests: started }).storiesFinished).toBe(0);
  });

  it('the review gate is the index’s: an unreviewed story is not counted unless the index shows unreviewed stories', () => {
    const draftJikji = unreviewed(jikji);
    const input = {
      stories: [draftJikji],
      episodes: [shelfEpisode(draftJikji)],
      quests: [storyQuest('jikji-metal-type')],
    };
    const gated = buildStoryIndex({ ...input, showUnreviewed: false });
    expect(model('stage2', 'letters', { storyEntries: gated })).toMatchObject({ kind: 'placeholder', storyCount: 0 });
    const open = buildStoryIndex({ ...input, showUnreviewed: true });
    expect(model('stage2', 'letters', { storyEntries: open })).toMatchObject({ kind: 'stories-only', storyCount: 1 });
  });

  it('a book entry of the cell is the cell’s episode, not a story that calls it home', () => {
    const bookStory = story('book-one', { recommendedStage: 5, theme: 'letters', shelf: null });
    const entries = buildStoryIndex({
      stories: [bookStory],
      episodes: [BOOK],
      quests: [storyQuest('book-one', 'read-along')],
      showUnreviewed: false,
    });
    expect(entries).toHaveLength(1);
    expect(model('stage5', 'letters', { storyEntries: entries }).storyCount).toBe(0);
  });

  it('a shelf episode in the list is never the cell’s episode', () => {
    const shelf = shelfEpisode(story('x', { recommendedStage: 3, theme: 'rites' }), { stage: 'stage3', theme: 'rites' });
    expect(model('stage3', 'rites', { episodes: [shelf] })).toMatchObject({ kind: 'placeholder' });
  });

  it('with no story in the bundle every cell keeps today’s kinds (ships dark)', () => {
    expect(model('stage1', 'letters', { storyEntries: [] })).toMatchObject({ kind: 'lesson', storyCount: 0 });
    expect(model('stage2', 'letters', { storyEntries: [] })).toMatchObject({ kind: 'placeholder', storyCount: 0 });
  });
});

describe('countMarkOf', () => {
  it('no mark for no story, the number up to 5, then 5+', () => {
    expect(countMarkOf(0)).toBeNull();
    expect(countMarkOf(1)).toEqual({ value: 1, more: false });
    expect(countMarkOf(COUNT_MARK_MAX)).toEqual({ value: 5, more: false });
    expect(countMarkOf(6)).toEqual({ value: 5, more: true });
    expect(countMarkOf(24)).toEqual({ value: 5, more: true });
  });
});

describe('cellLabel', () => {
  const m = getMessages('en');
  const stage = (key: StageKey) => stages.find((s) => s.key === key) as (typeof stages)[number];
  const theme = (key: ThemeKey) => themes.find((t) => t.key === key) as (typeof themes)[number];
  const label = (c: CellModel, marks = NO_CELL_MARKS): string => cellLabel(c, stage(c.stage), theme(c.theme), m.a11y.journeyCell, marks);

  it('names the stage by number and title, never by its key (the old "episode for stage1")', () => {
    expect(label(model('stage1', 'letters', { storyEntries: [] }))).toBe('Stage 1 Hangul, Letters & Books: lesson');
    expect(label(model('stage1', 'letters'))).toBe('Stage 1 Hangul, Letters & Books: lesson, 2 heritage stories');
  });

  it('says complete, the stories and the finished ones', () => {
    const quests = [...done(S1_LETTERS.id, 'quest:a', 'quest:b'), ...done('episode:shelf-hangeul-day', questId('hangeul-day'))];
    expect(label(model('stage1', 'letters', { quests }))).toBe(
      'Stage 1 Hangul, Letters & Books: lesson, complete, 2 heritage stories, 1 finished',
    );
  });

  it('a stories-only cell, a book and a placeholder', () => {
    expect(label(model('stage2', 'letters'))).toBe('Stage 2 Words, Letters & Books: 1 heritage story');
    expect(label(model('stage5', 'letters'))).toBe('Stage 5 Stories, Letters & Books: story book');
    expect(label(model('stage3', 'rites'))).toBe('Stage 3 Sentences, Holidays & Traditions, coming soon');
  });

  it('keeps the level-check marks', () => {
    expect(label(model('stage1', 'letters', { storyEntries: [] }), { completed: false, placedOut: true, isStart: true })).toBe(
      'Stage 1 Hangul, Letters & Books: lesson. You started here. You can skip ahead here, and it is still open to play.',
    );
  });

  it('never uses a banned learner word in any cell of the grid', () => {
    const labels = stages.flatMap((s) =>
      themes.flatMap((t) => [
        label(model(s.key, t.key)),
        label(model(s.key, t.key, { storyEntries: [] }), { completed: true, placedOut: true, isStart: true }),
      ]),
    );
    expect(labels).toHaveLength(70);
    expect(scanLearnerCopy(labels)).toEqual([]);
    for (const l of labels) expect(l).not.toMatch(/stage\d|episode for/);
  });
});

describe('cellTestId (F-STORY-005 PR 5.5a review)', () => {
  const marks = { completed: false, placedOut: false, isStart: false };

  it('a stories-only cell keeps its stories id even when it is also the start or a placed-out cell', () => {
    expect(cellTestId('stories-only', 'stage2', 'letters', { ...marks, isStart: true })).toBe('journey-cell-stories-stage2-letters');
    expect(cellTestId('stories-only', 'stage2', 'letters', { ...marks, placedOut: true })).toBe('journey-cell-stories-stage2-letters');
    expect(cellTestId('stories-only', 'stage3', 'rites', marks)).toBe('journey-cell-stories-stage3-rites');
  });

  it('other cells keep the start, then the placed-out id, and no id otherwise', () => {
    expect(cellTestId('lesson', 'stage1', 'letters', { ...marks, isStart: true, placedOut: true })).toBe('journey-cell-start');
    expect(cellTestId('lesson', 'stage1', 'letters', { ...marks, placedOut: true })).toBe('journey-cell-placed-out');
    expect(cellTestId('book', 'stage5', 'crafts', marks)).toBeUndefined();
    expect(cellTestId('placeholder', 'stage4', 'life', marks)).toBeUndefined();
  });
});

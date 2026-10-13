import { describe, expect, it } from 'vitest';
import { episodesFor, gridEpisodes } from '../../../content/episodes';
import { isOpenableEpisode } from '../bundle';
import {
  PREVIEW_MINUTES_CAP,
  catalogueLessons,
  endCardId,
  nextLesson,
  nextStory,
  previewEndedEvent,
  previewMinutes,
  previewStartedEvent,
  storyPreviewParams,
} from '../preview';
import { CULTURE_ID, TALE_ID, fixtureBundle } from './browse-fixture';

/**
 * F-BROWSE-001 BR-8 (sections 4.7, 4.8 and 9; BD9; mocks
 * design/screens/browse/preview-player.md and preview-end.md): what a preview
 * sends, where Next lesson and Next story go, the card the end screen names
 * and how a story preview opens. Read from the bundle: the few named content
 * anchors (Stage 1 Letters' first lessons) sit in the block below and change
 * with the content.
 */
const bundle = fixtureBundle();
const full = { bundle, scope: 'full' as const, gatingEnabled: false };

// Content anchors (change with the content).
const LETTERS = 'episode:stage1-letters';
const LETTERS_Q1 = 'quest:stage1-letters-q1';
const LETTERS_Q2 = 'quest:stage1-letters-q2';

describe('preview telemetry (section 9): content ids only, never a person', () => {
  it('browse.preview_started names the kind and the item', () => {
    expect(previewStartedEvent('quest', LETTERS_Q1)).toEqual({ name: 'browse.preview_started', payload: { kind: 'quest', itemId: LETTERS_Q1 } });
    expect(Object.keys(previewStartedEvent('story', TALE_ID).payload)).toEqual(['kind', 'itemId']);
  });

  it('browse.preview_ended says whether the end screen was reached and the whole minutes, at most 60', () => {
    const at = 1_000_000;
    expect(previewEndedEvent({ kind: 'quest', itemId: LETTERS_Q1, reachedEnd: true, startedAt: at, now: at + 4 * 60_000 + 59_000 })).toEqual({
      name: 'browse.preview_ended',
      payload: { kind: 'quest', itemId: LETTERS_Q1, reachedEnd: true, minutes: 4 },
    });
    expect(previewEndedEvent({ kind: 'story', itemId: TALE_ID, reachedEnd: false, startedAt: at, now: at }).payload).toEqual({ kind: 'story', itemId: TALE_ID, reachedEnd: false, minutes: 0 });
  });

  it('minutes are rounded down, capped at 60 and never negative (a clock that moved back)', () => {
    expect(PREVIEW_MINUTES_CAP).toBe(60);
    expect(previewMinutes(0, 59_999)).toBe(0);
    expect(previewMinutes(0, 60_000)).toBe(1);
    expect(previewMinutes(0, 3 * 60 * 60_000)).toBe(60);
    expect(previewMinutes(120_000, 0)).toBe(0);
  });
});

describe('catalogueLessons: the shipped lessons in catalogue order (section 4.8)', () => {
  it('stage by stage, theme by theme, volume by volume, each openable episode in its lesson order', () => {
    const order = catalogueLessons(bundle);
    const expected = bundle.stages.flatMap((stage) =>
      bundle.themes.flatMap((theme) =>
        episodesFor(stage.key, theme.key, gridEpisodes(bundle.episodes))
          .filter(isOpenableEpisode)
          .flatMap((e) => e.questIds.map((questId) => ({ questId, episodeId: e.id }))),
      ),
    );
    expect(order).toEqual(expected);
    expect(order[0]).toEqual({ questId: LETTERS_Q1, episodeId: LETTERS });
    // a shelf story's quest is not a grid lesson
    expect(order.some((l) => bundle.storyIndex.some((s) => s.placement === 'shelf' && s.questId === l.questId))).toBe(false);
  });
});

describe('nextLesson (section 4.8: Next lesson)', () => {
  it('the next lesson of the same episode first', () => {
    expect(nextLesson(LETTERS_Q1, full)).toEqual({ questId: LETTERS_Q2, episodeId: LETTERS, open: true });
  });

  it('after the last lesson of an episode, the first lesson of the next shipped cell', () => {
    const order = catalogueLessons(bundle);
    const lastOfFirst = order.filter((l) => l.episodeId === LETTERS).at(-1);
    if (!lastOfFirst) throw new Error('Letters has lessons');
    const after = order[order.indexOf(lastOfFirst) + 1];
    expect(after?.episodeId).not.toBe(LETTERS);
    expect(nextLesson(lastOfFirst.questId, full)).toEqual({ ...after, open: true });
  });

  it('none after the last shipped lesson: the end screen hides Next lesson', () => {
    const last = catalogueLessons(bundle).at(-1);
    if (!last) throw new Error('lessons exist');
    expect(nextLesson(last.questId, full)).toBeNull();
  });

  it('a shelf story quest and an unknown quest have no next lesson', () => {
    const shelf = bundle.storyIndex.find((s) => s.placement === 'shelf');
    if (!shelf) throw new Error('the fixture holds a shelf story');
    expect(nextLesson(shelf.questId, full)).toBeNull();
    expect(nextLesson('quest:not-bundled', full)).toBeNull();
  });

  it('a closed next lesson is named closed, so it opens its page and never plays (switch on, sampler)', () => {
    const closedAfterQ1 = nextLesson(LETTERS_Q1, { bundle, scope: 'sampler', gatingEnabled: true, freeQuestOpen: (id) => id === LETTERS_Q1 });
    expect(closedAfterQ1).toEqual({ questId: LETTERS_Q2, episodeId: LETTERS, open: false });
    // switch off: sampler opens every lesson
    expect(nextLesson(LETTERS_Q1, { bundle, scope: 'sampler', gatingEnabled: false })?.open).toBe(true);
  });
});

describe('nextStory (preview end, a story: Next story)', () => {
  it('the next reviewed story in the index order, once each, and none after the last', () => {
    const ids = [...new Set(bundle.storyIndex.map((s) => s.storyId))];
    expect(ids.indexOf(TALE_ID)).toBeLessThan(ids.indexOf(CULTURE_ID));
    expect(nextStory(TALE_ID, full)).toEqual({ storyId: ids[ids.indexOf(TALE_ID) + 1], open: true });
    expect(nextStory(ids[ids.length - 1] as string, full)).toBeNull();
    expect(nextStory('story:not-bundled', full)).toBeNull();
  });

  it('a closed next story is named closed (switch on, sampler)', () => {
    // the Culture fixture story is not a sampler story
    expect(nextStory(TALE_ID, { bundle, scope: 'sampler', gatingEnabled: true })).toEqual({ storyId: CULTURE_ID, open: false });
  });
});

describe('endCardId (section 4.8: the card a learner collects)', () => {
  it('the quest reward card the bundle holds, else none', () => {
    const q1 = bundle.quests.find((q) => q.id === LETTERS_Q1);
    expect(endCardId(bundle, LETTERS_Q1)).toBe(q1?.rewardCardId ?? null);
    expect(endCardId(bundle, LETTERS_Q1)).not.toBeNull();
    expect(endCardId({ ...bundle, cards: [] }, LETTERS_Q1)).toBeNull();
    expect(endCardId(bundle, 'quest:not-bundled')).toBeNull();
  });
});

describe('storyPreviewParams (section 4.7: the replay reader at scene 0 of the level picked)', () => {
  it('opens the learner replay route, which writes nothing', () => {
    expect(storyPreviewParams(TALE_ID, 'listen')).toEqual({ storyId: TALE_ID, level: 'listen', mode: 'replay', sceneIndex: 0 });
  });
});

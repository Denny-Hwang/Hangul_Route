import { describe, expect, it } from 'vitest';
import { LESSON_EPISODES, LESSON_QUESTS, LESSON_TEACHES } from '../../../content/__generated__/lessons-index';
import { LESSON_CELL_MODULES } from '../../../content/__tests__/helpers/lesson-stages';
import { taughtLetters } from '../../episode-access';
import { placementRouteCatalog } from '../../placement/catalog';
import { resultsTeaser } from '../../quest-flow/results-teaser';
import { discoverQuest, episodeOf, snapshotWith } from '../../stage1/__tests__/fixtures';
import { discoverJamo, questTeaches } from '../../stage1/curriculum';
import { questsOverStore } from '../lesson-store';

/**
 * The readers that name a lesson quest's letters before its cell's chunk has loaded (F-CURR-002 §10,
 * row CM-5): a closed quest's letters on the lesson page, the results teaser into a new cell, and the
 * placement catalogue built at module load. The global test setup preloads every chunk, so these
 * build the quests over a store that has loaded nothing: their `steps` are empty, as in the app
 * before the chunk is in, and the letters must come from the manifest.
 */
const cold = questsOverStore(LESSON_QUESTS, { stepsOf: () => undefined });
const coldQuest = (id: string) => {
  const quest = cold.find((q) => q.id === id);
  if (quest === undefined) throw new Error(`no lesson quest ${id}`);
  return quest;
};
const LETTERS_Q1 = 'quest:stage2-letters-q1';

describe('lesson quest letters before the chunk loads', () => {
  it('the manifest lists each lesson quest’s Discover jamo, the same as its chunk’s steps', () => {
    let teaching = 0;
    for (const [cellId, mod] of Object.entries(LESSON_CELL_MODULES)) {
      for (const [questId, steps] of Object.entries(mod.LESSON_STEPS)) {
        const fromSteps = discoverJamo(steps);
        expect(LESSON_TEACHES[questId] ?? [], `${cellId} ${questId}`).toEqual(fromSteps);
        if (fromSteps.length > 0) teaching += 1;
      }
    }
    // Stage 2 Letters & Books teaches the rest of Hangul in all six quests.
    expect(teaching).toBeGreaterThanOrEqual(6);
    expect(Object.keys(LESSON_TEACHES).every((id) => LESSON_QUESTS.some((q) => q.id === id))).toBe(true);
  });

  it('a cold lesson quest has no steps, yet questTeaches names its letters', () => {
    const quest = coldQuest(LETTERS_Q1);
    expect(quest.steps).toEqual([]);
    expect(questTeaches(quest)).toEqual(['jamo:ae', 'jamo:e', 'jamo:yae', 'jamo:ye']);
    for (const q of cold) expect(questTeaches(q), q.id).toEqual([...(LESSON_TEACHES[q.id] ?? [])]);
  });

  it('a closed Stage 2 Letters & Books quest shows its letters on the lesson page', () => {
    expect(taughtLetters(coldQuest(LETTERS_Q1)).map((l) => l.ko)).toEqual(['ㅐ', 'ㅔ', 'ㅒ', 'ㅖ']);
    const episode = LESSON_EPISODES.find((e) => e.id === 'episode:stage2-letters');
    for (const id of episode?.questIds ?? []) expect(taughtLetters(coldQuest(id)).length, id).toBeGreaterThan(0);
  });

  it('the results teaser into the first Stage 2 Letters & Books quest shows its new letters', () => {
    const before = discoverQuest('quest:q1', ['jamo:giyeok']);
    const target = coldQuest(LETTERS_Q1);
    expect(target.teaserEn).toBeUndefined();
    const episodes = [episodeOf('episode:one', ['quest:q1']), episodeOf('episode:stage2-letters', [LETTERS_Q1], { stage: 'stage2', theme: 'letters' })];
    const teaser = resultsTeaser({ quests: [before, target], episodes, snapshot: snapshotWith([]), questId: 'quest:q1', total: 5 });
    expect(teaser?.questId).toBe(LETTERS_Q1);
    expect(teaser?.line).toEqual({
      kind: 'letters',
      letters: [
        { ko: 'ㅐ', romanization: 'ae' },
        { ko: 'ㅔ', romanization: 'e' },
        { ko: 'ㅒ', romanization: 'yae' },
        { ko: 'ㅖ', romanization: 'ye' },
      ],
    });
  });

  it('the placement catalogue is the same over cold and loaded lesson quests', () => {
    const episodes = LESSON_EPISODES;
    const warm = questsOverStore(LESSON_QUESTS, { stepsOf: (id) => Object.values(LESSON_CELL_MODULES).find((m) => m.LESSON_STEPS[id])?.LESSON_STEPS[id] });
    expect(placementRouteCatalog(cold, episodes)).toEqual(placementRouteCatalog(warm, episodes));
    expect(placementRouteCatalog(cold, episodes).quests.find((q) => q.id === LETTERS_Q1)?.teaches).toEqual(['ㅐ', 'ㅔ', 'ㅒ', 'ㅖ']);
  });
});

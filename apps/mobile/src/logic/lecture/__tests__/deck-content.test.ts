import type { LectureBlock } from '@hangul-route/content-schema';
import { describe, expect, it, vi } from 'vitest';
import { deckContentIds, loadDeckContent, type DeckContentLoaders, type DeckContentLookups } from '../deck-content';

/**
 * [FN] AMENDMENTS-FINISH-2026-11 row FN-4 (finding F6): what one presenter deck loads. Its blocks' quests (and so their
 * cells), an episode's quests and tales, a story block's tale; then the tales its quests' steps play, once their cells
 * are in. A core chunk that fails fails the deck; a later volume's does not (its block is skipped).
 */

const lookups: DeckContentLookups = {
  cellOfQuest: (id) => (id.startsWith('quest:stage2-rites') ? 'episode:stage2-rites' : id.startsWith('quest:stage5-life-v2') ? 'episode:stage5-life-v2' : undefined),
  episodeOf: (id) =>
    id === 'episode:stage2-rites'
      ? { questIds: ['quest:stage2-rites-q1', 'quest:stage2-rites-q2'] }
      : id === 'episode:stage5-story'
        ? { questIds: ['quest:story-a-read'], storyIds: ['story:a'] }
        : undefined,
  storiesOfQuest: (id) => (id === 'quest:stage2-rites-q2' ? ['story:b'] : []),
};

function loaders(over: Partial<DeckContentLoaders> = {}): DeckContentLoaders & { log: string[] } {
  const log: string[] = [];
  return {
    log,
    ensureCells: vi.fn(async (ids: readonly string[]) => void log.push(`cells ${ids.join(',')}`)),
    ensureStories: vi.fn(async (ids: readonly string[]) => void log.push(`stories ${ids.join(',')}`)),
    ensureTitles: vi.fn(async () => undefined),
    ensureLocale: vi.fn(async () => undefined),
    isLaterCell: (id) => id.endsWith('-v2'),
    isLaterStory: (id) => id === 'story:later',
    onLaterNewBuild: vi.fn(() => false),
    ...over,
  };
}

describe('deckContentIds', () => {
  it('collects the quests, cells and stories a deck holds, once each; the other blocks load nothing', () => {
    const blocks: LectureBlock[] = [
      { kind: 'quest', id: 'quest:stage2-rites-q1' },
      { kind: 'episode', id: 'episode:stage2-rites' },
      { kind: 'episode', id: 'episode:stage5-story' },
      { kind: 'story', storyId: 'story:c', checks: true },
      { kind: 'word-review', questIds: ['quest:stage1-letters-q1'], vocabIds: [], rounds: 2 },
      { kind: 'jamo-set', jamoIds: ['jamo:g'] },
      { kind: 'quiz', from: 'all', rounds: 3 },
    ] as LectureBlock[];
    expect(deckContentIds(blocks, lookups)).toEqual({
      questIds: ['quest:stage2-rites-q1', 'quest:stage2-rites-q2', 'quest:story-a-read', 'quest:stage1-letters-q1'],
      cellIds: ['episode:stage2-rites'],
      storyIds: ['story:a', 'story:c'],
    });
    expect(deckContentIds([{ kind: 'jamo-set', jamoIds: ['jamo:g'] }] as LectureBlock[], lookups)).toEqual({ questIds: [], cellIds: [], storyIds: [] });
  });
});

describe('loadDeckContent', () => {
  it('loads the cells first, then the stories its quests play beside the blocks\' own', async () => {
    const l = loaders();
    await loadDeckContent([{ kind: 'episode', id: 'episode:stage2-rites' }, { kind: 'story', storyId: 'story:c', checks: true }] as LectureBlock[], 'es', lookups, l);
    expect(l.log).toEqual(['cells episode:stage2-rites', 'stories story:c,story:b']);
    expect(l.ensureTitles).toHaveBeenCalledWith('es');
    expect(l.ensureLocale).toHaveBeenCalledWith('es');
  });

  it('a core cell that fails rejects; the slide locale\'s text failing does not', async () => {
    await expect(loadDeckContent([{ kind: 'quest', id: 'quest:stage2-rites-q1' }] as LectureBlock[], 'en', lookups, loaders({ ensureCells: () => Promise.reject(new Error('offline')) }))).rejects.toThrow('offline');
    await expect(loadDeckContent([{ kind: 'quest', id: 'quest:stage2-rites-q1' }] as LectureBlock[], 'ko', lookups, loaders({ ensureLocale: () => Promise.reject(new Error('offline')) }))).resolves.toBeUndefined();
  });

  it('a later volume that fails is left out (and a newer build is reported); a later tale too', async () => {
    const failed = new Error('offline');
    const l = loaders({
      ensureCells: vi.fn((ids: readonly string[]) => (ids.some((id) => id.endsWith('-v2')) ? Promise.reject(failed) : Promise.resolve())),
      ensureStories: vi.fn((ids: readonly string[]) => (ids.includes('story:later') ? Promise.reject(failed) : Promise.resolve())),
    });
    await loadDeckContent(
      [{ kind: 'quest', id: 'quest:stage5-life-v2-q1' }, { kind: 'quest', id: 'quest:stage2-rites-q1' }, { kind: 'story', storyId: 'story:later', checks: true }] as LectureBlock[],
      'en',
      lookups,
      l,
    );
    expect(l.ensureCells).toHaveBeenCalledWith(['episode:stage2-rites']);
    expect(l.ensureCells).toHaveBeenCalledWith(['episode:stage5-life-v2']);
    expect(l.onLaterNewBuild).toHaveBeenCalledTimes(2);
    expect(l.onLaterNewBuild).toHaveBeenCalledWith(failed);
  });
});

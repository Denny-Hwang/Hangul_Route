import type { Episode } from '@hangul-route/content-schema';
import { describe, expect, it } from 'vitest';
import { gridEpisodes } from '../../../content/episodes';
import { episodeOf, snapshotWith } from '../../stage1/__tests__/fixtures';
import { initialCard, initialEpisode, latchedSelection, reconcileSelection, requestedSelection } from '../pane-selection';

const EPISODES: Episode[] = [
  episodeOf('episode:one', ['quest:a', 'quest:b']),
  episodeOf('episode:two', ['quest:c'], { theme: 'life', status: 'ready' }),
  episodeOf('episode:soon', ['quest:d'], { theme: 'rites', status: 'preview' }),
  episodeOf('episode:three', ['quest:e'], { stage: 'stage2', theme: 'life' }),
];
const done = (...pairs: Array<[string, string]>) => snapshotWith(pairs.map(([q, e]) => ({ questId: `quest:${q}`, episodeId: `episode:${e}` })));

describe('initialEpisode', () => {
  it('is the first playable episode when nothing is done', () => {
    expect(initialEpisode(EPISODES, snapshotWith([]))).toBe('episode:one');
  });

  it('is the first playable episode when there is no snapshot yet', () => {
    expect(initialEpisode(EPISODES, undefined)).toBe('episode:one');
  });

  it('skips an episode with a quest left and moves on only when every quest is done', () => {
    expect(initialEpisode(EPISODES, done(['a', 'one']))).toBe('episode:one');
    expect(initialEpisode(EPISODES, done(['a', 'one'], ['b', 'one']))).toBe('episode:two');
  });

  it('never picks a preview placeholder', () => {
    const all = done(['a', 'one'], ['b', 'one'], ['c', 'two']);
    expect(initialEpisode(EPISODES, all)).toBe('episode:three');
  });

  it('falls back to the first playable episode when everything is done', () => {
    const all = done(['a', 'one'], ['b', 'one'], ['c', 'two'], ['e', 'three']);
    expect(initialEpisode(EPISODES, all)).toBe('episode:one');
  });

  it('is null when no episode is playable', () => {
    expect(initialEpisode([EPISODES[2]!], undefined)).toBeNull();
    expect(initialEpisode([], undefined)).toBeNull();
  });
});

describe('initialCard', () => {
  const cards = [{ id: 'card:a' }, { id: 'card:b' }, { id: 'card:c' }];

  it('is the most recently earned card', () => {
    const unlocked = [
      { cardId: 'card:a', unlockedAt: '2026-10-01T00:00:00.000Z' },
      { cardId: 'card:c', unlockedAt: '2026-10-05T00:00:00.000Z' },
      { cardId: 'card:b', unlockedAt: '2026-10-03T00:00:00.000Z' },
    ];
    expect(initialCard(cards, unlocked)).toBe('card:c');
  });

  it('ignores earned ids that are not in the list', () => {
    expect(initialCard(cards, [{ cardId: 'card:gone', unlockedAt: '2026-10-09T00:00:00.000Z' }])).toBe('card:a');
  });

  it('is the first card when none is earned, and null for an empty list', () => {
    expect(initialCard(cards, [])).toBe('card:a');
    expect(initialCard([], [])).toBeNull();
  });
});

describe('reconcileSelection', () => {
  const items = [{ id: 'x' }, { id: 'y' }];

  it('keeps the selection while it is still present', () => {
    expect(reconcileSelection('y', items, 'x')).toBe('y');
  });

  it('falls back when the selection is gone or was never made', () => {
    expect(reconcileSelection('gone', items, 'x')).toBe('x');
    expect(reconcileSelection(null, items, 'y')).toBe('y');
  });

  it('falls back to the first item when the fallback is not in the list either', () => {
    expect(reconcileSelection('gone', items, 'nope')).toBe('x');
    expect(reconcileSelection(null, items, null)).toBe('x');
  });

  it('is null when there is nothing to select', () => {
    expect(reconcileSelection('x', [], null)).toBeNull();
  });

  it('round trip: one pane then two panes shows the remembered item', () => {
    let selected: string | null = initialEpisode(EPISODES, snapshotWith([]));
    selected = reconcileSelection('episode:two', EPISODES, selected);
    // rotation changes only the layout class; the selection state is untouched
    expect(reconcileSelection(selected, EPISODES, initialEpisode(EPISODES, snapshotWith([])))).toBe('episode:two');
  });
});

/** A latched selection belongs to the profile that made it (switching profile starts from the new learner's first selection). */
describe('latchedSelection', () => {
  it('is the latched id while the same profile is active', () => {
    expect(latchedSelection({ ownerId: 'p1', id: 'card:book' }, 'p1')).toBe('card:book');
  });

  it('is null for another profile, so that learner gets its own first selection', () => {
    expect(latchedSelection({ ownerId: 'p1', id: 'card:book' }, 'p2')).toBeNull();
    expect(latchedSelection({ ownerId: 'p1', id: 'card:book' }, null)).toBeNull();
  });

  it('is null when nothing is latched', () => {
    expect(latchedSelection(null, 'p1')).toBeNull();
  });
});

describe('requestedSelection', () => {
  it('is the requested episode when the catalogue has it', () => {
    expect(requestedSelection('episode:two', EPISODES)).toBe('episode:two');
  });

  it('is null for an unknown id (a stale homework link), so the latched default applies', () => {
    expect(requestedSelection('episode:gone', EPISODES)).toBeNull();
  });

  it('is null when nothing is requested', () => {
    expect(requestedSelection(undefined, EPISODES)).toBeNull();
  });

  it('is null for a shelf episode once the Journey passes its grid episodes, so the pane keeps a grid cell (F-STORY-004 §3.10)', () => {
    const shelf = episodeOf('episode:story-a', ['quest:s'], { placement: 'shelf' });
    const grid = gridEpisodes([...EPISODES, shelf]);
    expect(requestedSelection('episode:story-a', grid)).toBeNull();
    expect(reconcileSelection('episode:story-a', grid, initialEpisode(grid, undefined))).toBe('episode:one');
  });
});


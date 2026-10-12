import { describe, expect, it, vi } from 'vitest';

vi.mock('../../content/stories', () => ({
  // The heritage story cards (content/story-cards.ts) are built from the bundle when the cards load.
  storiesAll: [],
  heldStoryCards: [],
  storyById: (id: string) =>
    id === 'story:seollal-new-year' ? { tiers: [{ level: 'listen' }] } : undefined,
}));

describe('scopeFor story fallback', () => {
  it('hand-written scopes still win', async () => {
    const { scopeFor, minigameScopes } = await import('../minigame-config');
    const ref = 'minigame:s1-letters-q1-play';
    expect(minigameScopes[ref]).toBeDefined();
    expect(scopeFor(ref)).toBe(minigameScopes[ref]);
  });

  it('falls back to storyScopeFor for story refs', async () => {
    const { scopeFor } = await import('../minigame-config');
    const scope = scopeFor('minigame:story-check-listen-seollal-new-year');
    expect(scope).toEqual({
      kind: 'story-check',
      story: { storyId: 'story:seollal-new-year', level: 'listen' },
    });
    // The optional StoryScope fields type-check on MinigameScope.story.
    expect(scope?.story?.checkIds).toBeUndefined();
    expect(scope?.story?.sceneIds).toBeUndefined();
  });

  it('is undefined for unknown refs and unknown stories', async () => {
    const { scopeFor } = await import('../minigame-config');
    expect(scopeFor('minigame:nope')).toBeUndefined();
    expect(scopeFor('minigame:story-seq-listen-missing')).toBeUndefined();
  });
});

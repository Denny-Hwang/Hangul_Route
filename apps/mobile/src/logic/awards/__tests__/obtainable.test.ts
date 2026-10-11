import { describe, expect, it } from 'vitest';
import { obtainableCards } from '../obtainable';
import type { AwardWorld } from '../types';
import { WORLD } from './fixtures';

const ids = (world: AwardWorld, owned: readonly string[] = []): string[] => obtainableCards(world, new Set(owned)).map((c) => c.id);

describe('obtainableCards (F-STORY-006 §3.7)', () => {
  it('lists cards whose rule can still fire and hides the ones that cannot, in content order', () => {
    expect(ids(WORLD)).toEqual(['card:book', 'card:hanji', 'card:rice', 'card:lantern', 'card:tiger', 'card:story-sun-and-moon', 'card:apple', 'card:set-tales']);
  });

  it('an owned card is always listed, even when its rule can no longer fire', () => {
    expect(ids(WORLD, ['card:soon', 'card:stage2-prize'])).toContain('card:soon');
    expect(ids(WORLD, ['card:soon', 'card:stage2-prize'])).toContain('card:stage2-prize');
  });

  it('a held story (its episode back to draft) hides its unowned card, keeps an owned one, and hides the set it belongs to', () => {
    const held: AwardWorld = { ...WORLD, episodes: WORLD.episodes.map((e) => (e.id === 'episode:shelf-sun-and-moon' ? { ...e, status: 'draft' } : e)) };
    expect(ids(held)).not.toContain('card:story-sun-and-moon');
    expect(ids(held)).not.toContain('card:set-tales');
    expect(ids(held, ['card:story-sun-and-moon'])).toContain('card:story-sun-and-moon');
    expect(ids(held, ['card:story-sun-and-moon'])).toContain('card:set-tales');
  });

  it('a story removed from the bundle hides its card the same way', () => {
    const gone: AwardWorld = { ...WORLD, episodes: WORLD.episodes.filter((e) => e.id !== 'episode:shelf-sun-and-moon') };
    expect(ids(gone)).not.toContain('card:story-sun-and-moon');
  });

  it('an unregistered set, a set with no members and an unknown rule are hidden', () => {
    expect(ids({ ...WORLD, sets: [] })).not.toContain('card:set-tales');
    expect(ids({ ...WORLD, sets: [{ id: 'set:tales', cardId: 'card:set-tales', titleEn: 'Tales', memberCardIds: [] }] })).not.toContain('card:set-tales');
    const typo: AwardWorld = { ...WORLD, cards: [...WORLD.cards, { ...WORLD.cards[0]!, id: 'card:typo', unlockedBy: 'episod:x' }] };
    expect(ids(typo)).not.toContain('card:typo');
  });

  it('a set whose member is a card no rule can award is hidden', () => {
    const world: AwardWorld = { ...WORLD, sets: [{ id: 'set:tales', cardId: 'card:set-tales', titleEn: 'Tales', memberCardIds: ['card:rice', 'card:soon'] }] };
    expect(ids(world)).not.toContain('card:set-tales');
    expect(ids(world, ['card:soon'])).toContain('card:set-tales');
  });

  it('an episode card whose episode has no quests is hidden', () => {
    const world: AwardWorld = { ...WORLD, episodes: WORLD.episodes.map((e) => (e.id === 'episode:stage1-life' ? { ...e, questIds: [] } : e)) };
    expect(ids(world)).not.toContain('card:rice');
  });
});

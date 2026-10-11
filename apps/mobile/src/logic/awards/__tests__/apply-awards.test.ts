import { describe, expect, it } from 'vitest';
import { applyAwards } from '../apply';
import type { DerivedAward } from '../types';
import { NOW, owned, snapshot, T1, T2, T3 } from './fixtures';

const award = (cardId: string, unlockedAt = T2): DerivedAward => ({ cardId, source: 'episode', via: 'episode:stage1-letters', unlockedAt });

describe('applyAwards (F-STORY-006 §3.2)', () => {
  it('adds each new card with its deterministic time and the "new" flag, and stamps updatedAt', () => {
    const s = snapshot({ cards: [owned('card:book', T1)] });
    const out = applyAwards(s, [award('card:hanji', T2), award('card:ink', T3)], NOW);
    expect(out.cards).toEqual([owned('card:book', T1), owned('card:hanji', T2, true), owned('card:ink', T3, true)]);
    expect(out.updatedAt).toBe(NOW);
  });

  it('never removes or changes an owned card, even when an award names it with another time', () => {
    const s = snapshot({ cards: [owned('card:book', T3, false)] });
    const out = applyAwards(s, [award('card:book', T1)], NOW);
    expect(out.cards).toEqual([owned('card:book', T3, false)]);
  });

  it('returns the same snapshot when nothing is new (idempotent, no write needed)', () => {
    const s = snapshot({ cards: [owned('card:book')] });
    expect(applyAwards(s, [], NOW)).toBe(s);
    expect(applyAwards(s, [award('card:book')], NOW)).toBe(s);
  });

  it('adds a card named twice only once', () => {
    const out = applyAwards(snapshot(), [award('card:hanji', T2), award('card:hanji', T3)], NOW);
    expect(out.cards).toEqual([owned('card:hanji', T2, true)]);
  });

  it('leaves the rest of the snapshot untouched', () => {
    const s = snapshot({ streakDays: 4 });
    const out = applyAwards(s, [award('card:hanji')], NOW);
    expect({ ...out, cards: [], updatedAt: '' }).toEqual({ ...s, cards: [], updatedAt: '' });
    expect(s.cards).toEqual([]);
  });

  it('applying the same awards twice equals applying them once', () => {
    const once = applyAwards(snapshot(), [award('card:a'), award('card:b')], NOW);
    expect(applyAwards(once, [award('card:a'), award('card:b')], NOW)).toBe(once);
  });
});

import { describe, expect, it } from 'vitest';
import { catchUpCard, catchUpGrantedPayload } from '../catch-up';
import type { AwardSource, DerivedAward } from '../types';
import { T1 } from './fixtures';

const award = (cardId: string, source: AwardSource): DerivedAward => ({ cardId, source, via: source, unlockedAt: T1 });

describe('catchUpGrantedPayload (F-STORY-006 §3.5)', () => {
  it('counts the added cards by source, the welcome card included', () => {
    const added = [
      award('card:book', 'quest'),
      award('card:hanji', 'episode'),
      award('card:ink', 'episode'),
      award('card:lantern', 'stage'),
      award('card:tiger', 'welcome'),
      award('card:set-tales', 'set'),
    ];
    expect(catchUpGrantedPayload(added)).toEqual({ count: 6, episode: 2, stage: 1, welcome: 1, quest: 1, set: 1 });
  });

  it('reports zero for a source that added nothing', () => {
    expect(catchUpGrantedPayload([award('card:rice', 'episode')])).toEqual({ count: 1, episode: 1, stage: 0, welcome: 0, quest: 0, set: 0 });
  });

  it('is null when nothing was added', () => {
    expect(catchUpGrantedPayload([])).toBeNull();
  });

  it('is null when the welcome card arrived alone: a new profile is not a catch-up', () => {
    expect(catchUpGrantedPayload([award('card:tiger', 'welcome')])).toBeNull();
  });
});

describe('catchUpCard: the Home catch-up card for one session (F-STORY-006 §3.5, PR 6.5c)', () => {
  const WELCOME = ['card:tiger'];

  it('shows the cards the reconcile listed this session, counted by the list length', () => {
    const listed = ['card:chuseok', 'card:sebae', 'card:tiger'];
    expect(catchUpCard(listed, WELCOME)).toEqual({ cardIds: listed, count: 3 });
  });

  it('is hidden when nothing is listed: no reconcile added cards, or See my cards cleared them', () => {
    expect(catchUpCard(undefined, WELCOME)).toBeNull();
    expect(catchUpCard([], WELCOME)).toBeNull();
  });

  it('is hidden for the welcome card alone: a new profile is not a catch-up', () => {
    expect(catchUpCard(['card:tiger'], WELCOME)).toBeNull();
  });

  it('is hidden once only the welcome card is left (the others were opened in the Library)', () => {
    expect(catchUpCard(['card:tiger'], new Set(WELCOME))).toBeNull();
  });

  it('counts a card once even if a list repeats it', () => {
    expect(catchUpCard(['card:sebae', 'card:sebae', 'card:tiger'], WELCOME)).toEqual({ cardIds: ['card:sebae', 'card:tiger'], count: 2 });
  });
});

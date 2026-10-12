import { getMessages } from '@hangul-route/i18n';
import { describe, expect, it } from 'vitest';
import { scanLearnerCopy } from '../../homework/banned-text';
import { catchUpCard, catchUpGrantedPayload, takeCatchUpAnnouncement } from '../catch-up';
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

  it('accepts the welcome ids as a Set as well as an array', () => {
    expect(catchUpCard(['card:tiger'], new Set(WELCOME))).toBeNull();
    expect(catchUpCard(['card:sebae', 'card:tiger'], new Set(WELCOME))).toEqual({ cardIds: ['card:sebae', 'card:tiger'], count: 2 });
  });

  it('shows the welcome card with one other, and is hidden once that other card was seen in the Library', () => {
    expect(catchUpCard(['card:tiger', 'card:sebae'], WELCOME)).toEqual({ cardIds: ['card:tiger', 'card:sebae'], count: 2 });
    expect(catchUpCard(['card:tiger'], WELCOME, ['card:tiger', 'card:sebae'])).toBeNull();
  });

  it('keeps the number found while cards opened in the Library leave the list: never a counter of what is left (D3)', () => {
    const found = ['card:a', 'card:b', 'card:c', 'card:tiger'];
    expect(catchUpCard(found, WELCOME, found)?.count).toBe(4);
    // card:a was opened in the Library (markCardsSeen): the card still says Hoya found 4.
    expect(catchUpCard(['card:b', 'card:c', 'card:tiger'], WELCOME, found)).toEqual({ cardIds: ['card:b', 'card:c', 'card:tiger'], count: 4 });
  });

  it('counts every listed card even when the found list is missing or behind', () => {
    expect(catchUpCard(['card:a', 'card:b'], WELCOME, undefined)?.count).toBe(2);
    expect(catchUpCard(['card:a', 'card:b'], WELCOME, ['card:a'])?.count).toBe(2);
  });

  it('counts a card once even if a list repeats it', () => {
    expect(catchUpCard(['card:sebae', 'card:sebae', 'card:tiger'], WELCOME)).toEqual({ cardIds: ['card:sebae', 'card:tiger'], count: 2 });
  });
});

describe('catch-up copy (F-STORY-006 §3.10)', () => {
  it('uses none of the banned learner words', () => {
    const m = getMessages('en').learner.home.catchUp;
    expect(scanLearnerCopy([m.line(1), m.line(22), m.cta])).toEqual([]);
  });
});

describe('takeCatchUpAnnouncement: once per profile per app session (F-STORY-006 §3.10)', () => {
  it('hands the line over the first time, then never again for that profile and line (a tab switch, a re-render)', () => {
    const announced = new Set<string>();
    expect(takeCatchUpAnnouncement(announced, 'p1', 'Hoya found 22 cards you already earned!')).toBe('Hoya found 22 cards you already earned!');
    expect(takeCatchUpAnnouncement(announced, 'p1', 'Hoya found 22 cards you already earned!')).toBeNull();
  });

  it('announces for each profile on its own', () => {
    const announced = new Set<string>();
    expect(takeCatchUpAnnouncement(announced, 'p1', 'line')).toBe('line');
    expect(takeCatchUpAnnouncement(announced, 'p2', 'line')).toBe('line');
  });

  it('announces a later catch-up of the same session, after See my cards cleared the first', () => {
    const announced = new Set<string>();
    expect(takeCatchUpAnnouncement(announced, 'p1', 'Hoya found 22 cards you already earned!')).not.toBeNull();
    expect(takeCatchUpAnnouncement(announced, 'p1', 'Hoya found 2 cards you already earned!')).toBe('Hoya found 2 cards you already earned!');
  });

  it('says nothing and spends nothing while no card shows', () => {
    const announced = new Set<string>();
    expect(takeCatchUpAnnouncement(announced, 'p1', null)).toBeNull();
    expect(takeCatchUpAnnouncement(announced, undefined, 'line')).toBeNull();
    expect(announced.size).toBe(0);
  });
});

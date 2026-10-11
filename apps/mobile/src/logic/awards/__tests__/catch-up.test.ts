import { describe, expect, it } from 'vitest';
import { catchUpGrantedPayload } from '../catch-up';
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

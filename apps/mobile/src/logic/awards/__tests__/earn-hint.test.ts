import { getMessages } from '@hangul-route/i18n';
import { describe, expect, it } from 'vitest';
import { scanLearnerCopy } from '../../homework/banned-text';
import { earnHint } from '../earn-hint';
import type { AwardWorld } from '../types';
import { CARDS, WORLD } from './fixtures';

const m = getMessages('en').learner.library.earnHint;
const card = (id: string) => CARDS.find((c) => c.id === id)!;

describe('earnHint (F-STORY-006 §3.7)', () => {
  it('a lesson episode card names the episode', () => {
    expect(earnHint(card('card:book'), WORLD, m)).toEqual({ kind: 'episode', text: 'Finish the episode: Meet the Letters' });
  });

  it('a story shelf card names the story', () => {
    expect(earnHint(card('card:story-sun-and-moon'), WORLD, m)).toEqual({ kind: 'story', text: 'Finish the story: The Sun and the Moon' });
  });

  it('a stage card names the stage number', () => {
    expect(earnHint(card('card:lantern'), WORLD, m)).toEqual({ kind: 'stage', text: 'Finish every quest in Stage 1' });
    expect(earnHint(card('card:stage2-prize'), WORLD, m)).toEqual({ kind: 'stage', text: 'Finish every quest in Stage 2' });
  });

  it('the welcome card is a gift from Hoya', () => {
    expect(earnHint(card('card:tiger'), WORLD, m)).toEqual({ kind: 'welcome', text: 'A welcome gift from Hoya' });
  });

  it('a set card names the collection', () => {
    expect(earnHint(card('card:set-tales'), WORLD, m)).toEqual({ kind: 'set', text: 'Collect every card from the Tales stories' });
  });

  it('has no hint for a rule it cannot explain (unknown rule, missing episode, unregistered set)', () => {
    expect(earnHint({ ...card('card:book'), unlockedBy: 'episod:x' }, WORLD, m)).toBeNull();
    expect(earnHint({ ...card('card:book'), unlockedBy: 'episode:nowhere' }, WORLD, m)).toBeNull();
    const noSets: AwardWorld = { ...WORLD, sets: [] };
    expect(earnHint(card('card:set-tales'), noSets, m)).toBeNull();
  });

  it('every hint is learner-safe: no banned word, no number of what is missing', () => {
    const texts = CARDS.map((c) => earnHint(c, WORLD, m)?.text ?? '');
    expect(scanLearnerCopy(texts)).toEqual([]);
    for (const t of texts) expect(t).not.toMatch(/\d+\s*(of|\/)\s*\d+|%/);
  });

  it('renders from the subtree it is given', () => {
    const other = { ...m, episode: (title: string) => `Termina: ${title}` };
    expect(earnHint(card('card:book'), WORLD, other)?.text).toBe('Termina: Meet the Letters');
  });
});

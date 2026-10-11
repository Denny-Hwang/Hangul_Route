import { describe, expect, it } from 'vitest';
import { getMessages } from '../resolve';
import { pseudoLocalize, pseudoText } from '../pseudo';
import { leafPaths, lookup } from '../tree';
import { SAMPLES } from './samples';

// F-STORY-006 PR 6.5a: the Results extra-cards banner and the Episode page card copy (§3.7).
// Whole sentences, never suffix concatenation; counts, never fractions or percents (D3).
const m = getMessages('en');

describe('learner.results.extraCards (F-STORY-006 §3.7)', () => {
  const x = m.learner.results.extraCards;

  it('counts the extra cards in a whole sentence, singular for one', () => {
    expect(x.title(1)).toBe('1 more card joined your Library!');
    expect(x.title(4)).toBe('4 more cards joined your Library!');
  });

  it('names the episode the run finished', () => {
    expect(x.episodeDone('Meet the Letters')).toBe('You finished Meet the Letters!');
  });

  it('says how many more wait in the Library when more than the row shows (a count, not a fraction)', () => {
    expect(x.more(1)).toBe('and 1 more in your Library');
    expect(x.more(3)).toBe('and 3 more in your Library');
  });

  it('announces the count and every card title as one sentence', () => {
    expect(x.announce(1, ['Rice'])).toBe('1 more card joined your Library: Rice');
    expect(x.announce(2, ['Rice', 'Chopsticks'])).toBe('2 more cards joined your Library: Rice, Chopsticks');
  });

  it('labels each thumbnail with the card it opens', () => {
    expect(x.seeA11y('Hanbok')).toBe('Open card: Hanbok');
  });

  it('never shows a fraction, a percent or a shaming word', () => {
    const lines = [x.title(3), x.episodeDone('X'), x.more(2), x.announce(2, ['A', 'B']), x.seeA11y('A')];
    for (const line of lines) {
      expect(line).not.toMatch(/\d\s*\/\s*\d|%/);
      expect(line).not.toMatch(/\b(missed|incomplete|failed|behind)\b/i);
    }
  });
});

describe('Episode page card copy (F-STORY-006 §3.7)', () => {
  it('says how a locked card in the episode is earned', () => {
    expect(m.learner.episode.cards.waiting).toBe('Finish every quest to earn it');
    expect(m.a11y.cardWaiting).toBe('A card you can earn by finishing this episode');
  });
});

describe('en-XA covers the extra-cards keys', () => {
  const pseudo = pseudoLocalize(m);
  const paths = leafPaths(m).filter((p) => p.startsWith('learner.results.extraCards.'));

  it('finds the keys', () => {
    expect(paths.sort()).toEqual(
      ['announce', 'episodeDone', 'more', 'seeA11y', 'title'].map((k) => `learner.results.extraCards.${k}`),
    );
  });

  for (const path of paths) {
    it(`${path} is bracketed and at least 40% longer`, () => {
      const samples = SAMPLES[path];
      expect(samples, `function message ${path} needs a row in SAMPLES`).toBeDefined();
      const value = lookup(pseudo, path) as (...a: unknown[]) => string;
      const source = lookup(m, path) as (...a: unknown[]) => string;
      for (const args of samples ?? []) {
        const out = value(...args);
        const src = source(...args);
        expect(out).toBe(pseudoText(src));
        expect(out.length - 2).toBeGreaterThanOrEqual(Math.ceil(src.length * 1.4));
      }
    });
  }
});

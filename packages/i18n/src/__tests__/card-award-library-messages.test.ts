import { describe, expect, it } from 'vitest';
import { getMessages } from '../resolve';
import { pseudoLocalize, pseudoText } from '../pseudo';
import { lookup } from '../tree';
import { SAMPLES } from './samples';

// F-STORY-006 PR 6.5b: the Library header, explainer, New pill and locked-tile labels (§3.7).
// Whole sentences; a plain count, never a fraction whose denominator grows (D3).
const m = getMessages('en');
const l = m.learner.library;

describe('learner.library (F-STORY-006 §3.7)', () => {
  it('counts the cards collected, singular for one, with no total', () => {
    expect(l.collected.line(1)).toBe('1 card collected');
    expect(l.collected.line(12)).toBe('12 cards collected');
    expect(l.collected.line(12)).not.toMatch(/\bof\b|\//);
    expect('pill' in l.collected).toBe(false);
  });

  it('marks a card earned since the last visit with a New pill', () => {
    expect(l.new.pill).toBe('New');
  });

  it('explains each award rule in one short sentence', () => {
    expect(l.how.title).toBe('How to collect more');
    expect(l.how.quest).toBe('Finish a quest to earn its card.');
    expect(l.how.episode).toBe('Finish every quest in an episode to earn more cards.');
    expect(l.how.stage(1)).toBe('Finish all of Stage 1 for the legendary cards.');
    expect(l.how.story).toBe('Finish a story to earn its card.');
    expect(l.how.welcome).toBe("Hoya's tiger card is a welcome gift.");
    expect('body' in l.how).toBe(false);
  });

  it('a locked tile and a locked card say how they are earned', () => {
    expect(m.a11y.lockedCardHint('Finish the episode: Around the Korean Table')).toBe(
      'Locked card. Finish the episode: Around the Korean Table',
    );
  });

  it('a tile with the New pill says so to assistive tech', () => {
    expect(m.a11y.newCard('Kimchi')).toBe('Kimchi. New');
  });

  it('never shows a fraction, a percent or a shaming word', () => {
    const lines = [l.collected.line(3), l.new.pill, l.how.quest, l.how.episode, l.how.stage(1), l.how.story, l.how.welcome];
    for (const line of lines) {
      expect(line).not.toMatch(/\d\s*\/\s*\d|%/);
      expect(line).not.toMatch(/\b(missed|incomplete|failed|behind)\b/i);
    }
  });
});

describe('en-XA covers the new function messages', () => {
  const pseudo = pseudoLocalize(m);
  for (const path of ['learner.library.collected.line', 'learner.library.how.stage', 'a11y.lockedCardHint', 'a11y.newCard']) {
    it(`${path} is bracketed and at least 40% longer`, () => {
      const samples = SAMPLES[path];
      expect(samples, `function message ${path} needs a row in SAMPLES`).toBeDefined();
      const value = lookup(pseudo, path) as (...a: unknown[]) => string;
      const source = lookup(m, path) as (...a: unknown[]) => string;
      for (const args of samples ?? []) {
        expect(value(...args)).toBe(pseudoText(source(...args)));
        expect(value(...args).length - 2).toBeGreaterThanOrEqual(Math.ceil(source(...args).length * 1.4));
      }
    });
  }
});

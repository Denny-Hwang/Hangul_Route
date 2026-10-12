import { describe, expect, it } from 'vitest';
import { getMessages } from '../resolve';
import { pseudoLocalize, pseudoText } from '../pseudo';
import { lookup } from '../tree';
import { SAMPLES } from './samples';

// F-STORY-006 PR 6.7: the source line under a story card's fact (§3.8 back face,
// wireframe library/card-back-citation G). Publisher and title are content, printed as given.
const m = getMessages('en');
const c = m.learner.cardDetail.citation;

describe('learner.cardDetail.citation (F-STORY-006 §3.8)', () => {
  it('names the first source as publisher, then title', () => {
    expect(c.source('National Hangeul Museum', 'Hangul Day')).toBe('Source: National Hangeul Museum, Hangul Day');
  });

  it('counts the other sources, singular for one', () => {
    expect(c.more(1)).toBe('and 1 more source');
    expect(c.more(3)).toBe('and 3 more sources');
  });

  it('never shows a link, a fraction or a percent', () => {
    for (const line of [c.source('P', 'T'), c.more(1), c.more(2)]) {
      expect(line).not.toMatch(/https?:|www\.|\d\s*\/\s*\d|%/);
    }
  });
});

describe('en-XA covers the citation messages', () => {
  const pseudo = pseudoLocalize(m);
  for (const path of ['learner.cardDetail.citation.source', 'learner.cardDetail.citation.more']) {
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

import { describe, expect, it } from 'vitest';
import { LOCALES } from '../locales';
import { getMessages } from '../resolve';
import { pseudoLocalize, pseudoText } from '../pseudo';
import { leafPaths, lookup } from '../tree';
import { SAMPLES } from './samples';

// F-I18N-001 PR 7b: the minigames (MinigameScreen and every game it launches), the audio
// prompt panel and voice help they share, and the story copy behind Story Order move into the
// dictionary with their English wording unchanged (§3.4 rule 1). Content (pairs, glosses, step
// labels in minigame-config) stays content: PR 12.
const m = getMessages('en');
const NO_AGE_OR_FAILURE = /\b(kids?|child(ren)?|ages?|fail\w*|wrong)\b|\p{Extended_Pictographic}/iu;

describe('learner.minigame shell (English wording as shipped)', () => {
  const g = m.learner.minigame;

  it('keeps the fallback cards and their way out', () => {
    expect(g.notFound).toBe('Minigame not found.');
    expect(g.comingSoon).toBe('This minigame is coming soon.');
    expect(g.voiceSoon).toBe('Voice practice is opening in our next beta.');
    expect(g.backToQuest.cta).toBe('Back to quest');
    expect(g.noRounds).toBe('No rounds.');
  });

  it('keeps the round counter and the skip button', () => {
    expect(g.progress.pill(1, 4)).toBe('1 / 4');
    expect(g.skip.cta).toBe('Skip');
  });

  it('never uses age words, failure language or emoji', () => {
    expect(JSON.stringify(g)).not.toMatch(NO_AGE_OR_FAILURE);
  });
});

describe('every locale', () => {
  for (const locale of LOCALES) {
    it(`${locale}: has the minigame keys`, () => {
      const messages = getMessages(locale);
      expect(typeof messages.learner.minigame.notFound).toBe('string');
      expect(typeof messages.learner.minigame.progress.pill).toBe('function');
    });
  }
});

/** The subtrees this PR adds; each game's commit extends the list. */
const NEW_PREFIXES = ['learner.minigame'];

// en-XA (F-I18N-001 §3.11): every new key, function messages and step lists included, survives pseudo-localisation.
describe('en-XA covers the new keys', () => {
  const paths = leafPaths(m).filter((p) => NEW_PREFIXES.some((x) => p.startsWith(`${x}.`)));
  const pseudo = pseudoLocalize(m);

  it('finds the new leaves', () => {
    expect(paths.length).toBeGreaterThan(5);
  });

  for (const path of paths) {
    it(`${path} is bracketed and at least 40% longer`, () => {
      const value = lookup(pseudo, path);
      const source = lookup(m, path);
      const outputs: Array<[string, string]> = [];
      if (typeof value === 'string' && typeof source === 'string') outputs.push([value, source]);
      else if (Array.isArray(value) && Array.isArray(source)) {
        source.forEach((s, i) => outputs.push([String(value[i]), String(s)]));
      } else if (typeof value === 'function' && typeof source === 'function') {
        const samples = SAMPLES[path];
        expect(samples, `function message ${path} needs a row in SAMPLES`).toBeDefined();
        for (const args of samples ?? []) {
          outputs.push([(value as (...a: unknown[]) => string)(...args), (source as (...a: unknown[]) => string)(...args)]);
        }
      } else throw new Error(`${path} is neither a string, a list nor a function`);
      expect(outputs.length).toBeGreaterThan(0);
      for (const [out, src] of outputs) {
        expect(out).toBe(pseudoText(src));
        expect(out.startsWith('[') && out.endsWith(']')).toBe(true);
        expect(out.length - 2).toBeGreaterThanOrEqual(Math.ceil(src.length * 1.4));
      }
    });
  }
});

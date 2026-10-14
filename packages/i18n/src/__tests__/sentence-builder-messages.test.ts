import { describe, expect, it } from 'vitest';
import { findBannedWord } from '../banned';
import { LOCALES } from '../locales';
import { fallbackPaths, getMessages } from '../resolve';
import { leafPaths } from '../tree';

// F-CURR-001 G-1: Sentence Builder (`order-it`) and its Check. The English is the wording of the D-1
// mock (design/screens/minigame-sentence-builder/v1/spec.md, "Strings"); es and ko land in the same PR.
const m = getMessages('en');
const NO_AGE_OR_FAILURE = /\b(kids?|child(ren)?|ages?|fail\w*|wrong|mistake\w*|error)\b|\p{Extended_Pictographic}/iu;

describe('learner.minigame.sentenceBuilder (English)', () => {
  const sb = m.learner.minigame.sentenceBuilder;

  it('has the heading, the two instructions and the meaning label', () => {
    expect(sb.heading).toBe('Build the sentence');
    expect(sb.instruction).toBe('Tap the words in order.');
    expect(sb.particleInstruction).toBe('Tap the piece that fits.');
    expect(sb.meaning).toBe('Meaning');
  });

  it("has Hoya's lines: a miss, the verb-last hint, the particle hint, the ring, the built sentence", () => {
    expect(sb.miss).toBe('Not that one yet. Try another word.');
    expect(sb.missLastWord).toBe('In Korean, the doing or describing word comes last.');
    expect(sb.missParticle).toBe('Look at how the word before it ends.');
    expect(sb.lookHere).toBe('This one comes next.');
    expect(sb.built).toBe('You built the sentence!');
    expect(sb.empty).toBe('Nothing to play here');
  });

  it('labels the places on the line and a tried tile', () => {
    const a = m.a11y.minigame.sentenceBuilder;
    expect(a.slotEmpty(2, 3)).toBe('Place 2 of 3, empty');
    expect(a.slotFilled(1, 2, '밥을, babeul')).toBe('Place 1 of 2: 밥을, babeul');
    expect(a.slotAttached(1, 2)).toBe('Place 1 of 2, joins the word before it, empty');
    expect(a.tried('물을, mureul')).toBe('물을, mureul, tried');
    expect(a.slotNext(1, 2)).toBe('Place 1 of 2, empty, next');
    expect(a.next('저는, jeoneun')).toBe('저는, jeoneun, comes next');
  });
});

describe('Sentence Builder in Korean', () => {
  it('the look-here line names no word, since a particle round rings a piece (G-1 review)', () => {
    expect(getMessages('ko').learner.minigame.sentenceBuilder.lookHere).toBe('다음은 이거예요.');
  });
});

describe('Sentence Builder in every locale', () => {
  for (const locale of LOCALES) {
    const messages = getMessages(locale);
    const words = [
      ...Object.values(messages.learner.minigame.sentenceBuilder),
      messages.a11y.minigame.sentenceBuilder.slotEmpty(1, 2),
      messages.a11y.minigame.sentenceBuilder.slotFilled(1, 2, 'x'),
      messages.a11y.minigame.sentenceBuilder.slotAttached(1, 2),
      messages.a11y.minigame.sentenceBuilder.tried('x'),
      messages.a11y.minigame.sentenceBuilder.slotNext(1, 2),
      messages.a11y.minigame.sentenceBuilder.next('x'),
    ];

    it(`${locale}: every key has its own value (no English fallback)`, () => {
      const missing = fallbackPaths(locale).filter((p) => p.includes('sentenceBuilder'));
      expect(missing).toEqual([]);
      const leaves = leafPaths(messages).filter((p) => p.includes('.sentenceBuilder.'));
      expect(leaves.length).toBe(16);
    });

    it(`${locale}: never shames, names an age or uses emoji`, () => {
      for (const text of words) {
        expect(text).not.toMatch(NO_AGE_OR_FAILURE);
        expect(findBannedWord(text, locale, 'learner')).toBeNull();
      }
    });

    it(`${locale}: puts the place number and the word into the labels`, () => {
      const a = messages.a11y.minigame.sentenceBuilder;
      expect(a.slotEmpty(4, 5)).toContain('4');
      expect(a.slotEmpty(4, 5)).toContain('5');
      expect(a.slotFilled(1, 3, 'WORD')).toContain('WORD');
      expect(a.tried('WORD')).toContain('WORD');
      expect(a.slotNext(4, 5)).toContain('4');
      expect(a.next('WORD')).toContain('WORD');
    });
  }
});

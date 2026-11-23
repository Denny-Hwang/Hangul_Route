import { describe, expect, it } from 'vitest';
import { KIDS_ONLY_FRAMING } from '../audience';
import { findBannedWord } from '../banned';
import { getMessages } from '../resolve';

// [DP] AMENDMENTS-DURABLE-PROGRESS sections 3.5 and 3.8, row DP-1c: the screen shown when the profile list or the
// active learner's progress could not be read. Persona-neutral (children and adults read the same screen), no blame,
// no word that it was lost, nothing that promises recovery, and no "ask a grown-up" (an adult on their own phone reads
// it too). es and ko follow the F-I18N-001 section 3.10 glossary (learner: estudiante / 학습자).

const LOCALES = ['en', 'es', 'ko'] as const;
const KEYS = ['title', 'body', 'bubble', 'tryAgain', 'chooseAnother', 'stillStuck'] as const;

describe('learner.progressReadFailed (DP-1c)', () => {
  it('English is the spec text (section 3.8)', () => {
    expect(getMessages('en').learner.progressReadFailed).toEqual({
      title: 'We could not open your progress.',
      body: "Nothing was erased. Let's try again.",
      bubble: 'Hmm, the box is stuck.',
      tryAgain: 'Try again',
      chooseAnother: 'Choose another learner',
      // [DP] Row DP-1d: the list variant's ghost button (damaged bytes, copy kept); `recover-record-messages.test.ts`.
      grownUpHelp: 'A grown-up can help',
      stillStuck: 'Still stuck? Close the app and open it again.',
    });
  });

  it('Spanish and Korean have their own value for every key', () => {
    const en = getMessages('en').learner.progressReadFailed;
    for (const locale of ['es', 'ko'] as const) {
      const m = getMessages(locale).learner.progressReadFailed;
      for (const key of KEYS) {
        expect(m[key], `${locale}.${key}`).not.toBe(en[key]);
        expect(m[key].trim(), `${locale}.${key}`).not.toBe('');
      }
    }
  });

  it('Try again is the same words as the shared Try again button in every locale', () => {
    for (const locale of LOCALES) {
      expect(getMessages(locale).learner.progressReadFailed.tryAgain, locale).toBe(getMessages(locale).common.buttons.tryAgain);
    }
  });

  it('the glossary word for learner', () => {
    expect(getMessages('es').learner.progressReadFailed.chooseAnother).toContain('estudiante');
    expect(getMessages('ko').learner.progressReadFailed.chooseAnother).toContain('학습자');
  });

  it('no banned word, no kids-only framing and no "grown-up" ask on a screen an adult may read alone', () => {
    for (const locale of LOCALES) {
      const m = getMessages(locale).learner.progressReadFailed;
      for (const key of KEYS) {
        const text = m[key];
        expect(findBannedWord(text, locale, 'learner'), `${locale}.${key}`).toBeNull();
        for (const { name, re } of KIDS_ONLY_FRAMING) expect(re.test(text), `${locale}.${key}: ${name}`).toBe(false);
        expect(text, `${locale}.${key}`).not.toMatch(/grown-up|adult|어른|lost|perd|잃/i);
      }
    }
  });
});

import type { WriteFrameRound } from '@hangul-route/content-schema';
import type { UiLocale } from '@hangul-route/i18n';
import { describe, expect, it } from 'vitest';
import { localizeScope } from '../../logic/content-locale';
import { fillGloss } from '../../logic/write-frame/view';
import { LESSON_STAGE_MODULES } from './helpers/lesson-stages';

/**
 * F-CURR-001 §3.7 / §3.8 pass 6: the Write Frame line under a finished sentence (and on
 * "My page") is the frame gloss with each pick's bank gloss put in its blank (`fillGloss`).
 * For every shipped word-bank round, every combination of picks, in every UI language, the
 * composed line has no blank left, no word said twice in a row (`태어난 날 날에`), and each
 * Korean bank gloss stays a short label (a dictionary definition spliced into a sentence
 * reads badly).
 */

const LOCALES: readonly UiLocale[] = ['en', 'es', 'ko'];
const KO_BANK_GLOSS_MAX = 20;

const combos = (banks: readonly (readonly string[])[]): string[][] =>
  banks.reduce<string[][]>((acc, bank) => acc.flatMap((prefix) => bank.map((g) => [...prefix, g])), [[]]);

const doubledWord = (line: string): string | undefined => {
  const words = line.split(/[\s,.:]+/).filter(Boolean);
  return words.find((w, i) => i > 0 && w === words[i - 1]);
};

interface Problem {
  where: string;
  line: string;
  why: string;
}

function problems(): Problem[] {
  const out: Problem[] = [];
  for (const module of Object.values(LESSON_STAGE_MODULES)) {
    for (const [ref, scope] of Object.entries(module.LESSON_SCOPES)) {
      if (scope.kind !== 'write-frame') continue;
      for (const locale of LOCALES) {
        const rounds: readonly WriteFrameRound[] = localizeScope(scope, ref, locale, module.LESSON_SCOPE_OVERLAYS).writeFrame?.rounds ?? [];
        for (const round of rounds.filter((r) => !r.freeEntry)) {
          const where = `${ref} ${round.id} ${locale}`;
          if (locale === 'ko') {
            for (const word of round.slots.flatMap((s) => s.bank)) {
              if (word.en.length > KO_BANK_GLOSS_MAX) out.push({ where, line: word.en, why: `bank gloss over ${KO_BANK_GLOSS_MAX} characters` });
            }
          }
          for (const picks of combos(round.slots.map((s) => s.bank.map((w) => w.en)))) {
            const line = fillGloss(round.frame.en, picks);
            if (line.includes('___')) out.push({ where, line, why: 'a blank is left' });
            const twice = doubledWord(line);
            if (twice !== undefined) out.push({ where, line, why: `"${twice}" twice in a row` });
          }
        }
      }
    }
  }
  return out;
}

describe('Write Frame composed glosses (F-CURR-001 §3.7, §3.8 pass 6)', () => {
  it('reads as one clean line for every pick in en, es and ko', () => {
    expect(problems()).toEqual([]);
  });

  it('checks at least one shipped word-bank round', () => {
    const refs = Object.values(LESSON_STAGE_MODULES).flatMap((m) => Object.entries(m.LESSON_SCOPES).filter(([, s]) => s.kind === 'write-frame'));
    expect(refs.length).toBeGreaterThan(0);
  });
});

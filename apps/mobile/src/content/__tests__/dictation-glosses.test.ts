import { typeHangulMode } from '@hangul-route/content-schema';
import { describe, expect, it } from 'vitest';
import { ALL_LESSON_SCOPES, LESSON_STAGE_MODULES } from './helpers/lesson-stages';

/**
 * A Dictation round (Type Hangul `hear`, F-CURR-002 section 7.1 F2, row CM-3A S2) shows the word's meaning before Done
 * and never its Korean or its romanization. A meaning that carries the word's sound gives its spelling away: "Chuseok,
 * the autumn harvest festival" prints the romanization, "banana" and "kimchi" are the word itself. So in every UI
 * language the shown meaning holds neither the romanization (spaces and hyphens ignored, g/k, d/t, b/p, r/l and j/ch
 * read alike) nor, in Korean, any syllable of the word.
 */

const OVERLAYS = {
  es: Object.assign({}, ...Object.values(LESSON_STAGE_MODULES).map((m) => m.LESSON_SCOPE_OVERLAYS.es)),
  ko: Object.assign({}, ...Object.values(LESSON_STAGE_MODULES).map((m) => m.LESSON_SCOPE_OVERLAYS.ko)),
} as Record<'es' | 'ko', Record<string, Record<string, string> | undefined>>;

/** Latin letters only, lower case, with the consonant pairs a romanization and an exonym swap read alike. */
function sound(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z]/g, '')
    .replace(/ch/g, 'j')
    .replace(/g/g, 'k')
    .replace(/d/g, 't')
    .replace(/b/g, 'p')
    .replace(/r/g, 'l');
}

const hearRounds = Object.entries(ALL_LESSON_SCOPES).flatMap(([ref, scope]) =>
  scope.kind === 'type-hangul'
    ? (scope.typeHangul?.rounds ?? []).filter((r) => typeHangulMode(r) === 'hear').map((round) => ({ ref, round }))
    : [],
);

describe('Dictation: the shown meaning never carries the word (row CM-3A S2)', () => {
  it('the Stage 2 Dictation Checks are shipped: fourteen rounds in Volume 1, and each Volume 2 Dictation Check beside them', () => {
    const stage2 = hearRounds.filter(({ ref }) => /^minigame:s2-.*-check$/.test(ref));
    expect(stage2.filter(({ ref }) => !ref.includes('-v2-'))).toHaveLength(14);
    // Food & Daily Life Volume 2 q1 (F-CURR-002 row CM-43 S2): 달다 and 밥.
    expect(stage2.filter(({ ref }) => ref === 'minigame:s2-life-v2-q1-check').map(({ round }) => round.target.ko)).toEqual(['달다', '밥']);
  });

  it('en and es: no meaning holds the romanization', () => {
    const leaks: string[] = [];
    for (const { ref, round } of hearRounds) {
      const key = sound(round.target.romanization);
      const shown = { en: round.target.en, es: OVERLAYS.es[ref]?.[`typeHangul.rounds.${round.id}.target.gloss`] ?? '' };
      for (const [locale, text] of Object.entries(shown)) if (key.length > 0 && sound(text).includes(key)) leaks.push(`${ref} ${round.id} ${locale}: ${text}`);
    }
    expect(leaks).toEqual([]);
  });

  it('ko: no meaning holds a syllable of the word', () => {
    const leaks: string[] = [];
    for (const { ref, round } of hearRounds) {
      const gloss = OVERLAYS.ko[ref]?.[`typeHangul.rounds.${round.id}.target.gloss`] ?? '';
      const shared = [...new Set([...gloss].filter((c) => /[가-힣]/.test(c) && round.target.ko.includes(c)))];
      if (shared.length > 0) leaks.push(`${ref} ${round.id}: ${shared.join('')}`);
    }
    expect(leaks).toEqual([]);
  });
});

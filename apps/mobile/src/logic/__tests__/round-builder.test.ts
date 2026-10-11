import { describe, expect, it } from 'vitest';
import { jamoAll, jamoConsonants, jamoVowels } from '../../content/jamo';
import {
  buildBuildLetterRounds,
  buildCultureQuizRounds,
  buildMatchSoundRounds,
  buildOddOneOutRounds,
  buildTraceStrokeRounds,
} from '../round-builder';

const scope4 = jamoConsonants.slice(0, 4).map((j) => j.id);
const scope6 = jamoConsonants.slice(0, 6).map((j) => j.id);
const oddScope = [
  ...jamoConsonants.slice(0, 3).map((j) => j.id),
  ...jamoVowels.slice(0, 2).map((j) => j.id),
];
const quizCardPairs = [
  { ko: '김치', en: 'Kimchi', romanization: 'gimchi' },
  { ko: '밥', en: 'Rice', romanization: 'bap' },
  { ko: '호랑이', en: 'Tiger', romanization: 'horangi' },
  { ko: '달', en: 'Moon', romanization: 'dal' },
  { ko: '산', en: 'Mountain', romanization: 'san' },
];

describe('buildMatchSoundRounds', () => {
  it('produces the requested number of rounds', () => {
    const rounds = buildMatchSoundRounds({ scopeJamoIds: scope6, rounds: 5, seed: 42 });
    expect(rounds).toHaveLength(5);
  });

  it('every round has exactly 4 tiles by default with the prompt included', () => {
    const rounds = buildMatchSoundRounds({ scopeJamoIds: scope4, rounds: 4, seed: 1 });
    for (const r of rounds) {
      expect(r.tiles).toHaveLength(4);
      expect(r.tiles.find((t) => t.id === r.promptJamo.id)).toBeTruthy();
    }
  });

  it('no jamo is duplicated within a round (F-001 §3.5)', () => {
    const rounds = buildMatchSoundRounds({ scopeJamoIds: scope6, rounds: 4, seed: 7 });
    for (const r of rounds) {
      const ids = r.tiles.map((t) => t.id);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });

  it('throws when scope is smaller than tileCount', () => {
    expect(() =>
      buildMatchSoundRounds({ scopeJamoIds: scope4.slice(0, 2), rounds: 2, tileCount: 4, seed: 1 }),
    ).toThrow();
  });
});

describe('buildBuildLetterRounds', () => {
  it('returns one round per syllable with the right component count', () => {
    const rounds = buildBuildLetterRounds({
      syllables: [
        { ko: '가', romanization: 'ga', jamoChars: ['ㄱ', 'ㅏ'] },
        { ko: '나', romanization: 'na', jamoChars: ['ㄴ', 'ㅏ'] },
      ],
      seed: 1,
    });
    expect(rounds).toHaveLength(2);
    for (const r of rounds) {
      expect(r.componentJamoIds.length).toBe(2);
      expect(r.tileJamoIds.length).toBe(4);
      // Tiles must include all components.
      for (const c of r.componentJamoIds) {
        expect(r.tileJamoIds).toContain(c);
      }
    }
  });
});

describe('buildTraceStrokeRounds', () => {
  it('caps rounds at scope length', () => {
    const rounds = buildTraceStrokeRounds({ scopeJamoIds: scope4, rounds: 10, seed: 1 });
    expect(rounds.length).toBeLessThanOrEqual(scope4.length);
  });
});

describe('buildOddOneOutRounds', () => {
  it('produces rounds of 4 tiles that include the odd jamo', () => {
    const rounds = buildOddOneOutRounds({ scopeJamoIds: oddScope, rounds: 4, seed: 3 });
    expect(rounds).toHaveLength(4);
    for (const r of rounds) {
      expect(r.tiles).toHaveLength(4);
      expect(r.tiles.find((t) => t.id === r.oddJamo.id)).toBeTruthy();
    }
  });

  it('the odd jamo is the only one of its kind in the round', () => {
    const rounds = buildOddOneOutRounds({ scopeJamoIds: oddScope, rounds: 4, seed: 9 });
    for (const r of rounds) {
      const sameKind = r.tiles.filter((t) => t.kind === r.oddJamo.kind);
      expect(sameKind).toHaveLength(1);
      expect(sameKind[0]?.id).toBe(r.oddJamo.id);
    }
  });

  it('throws when the scope lacks a minority kind', () => {
    const allConsonants = jamoConsonants.slice(0, 5).map((j) => j.id);
    expect(() => buildOddOneOutRounds({ scopeJamoIds: allConsonants, rounds: 2, seed: 1 })).toThrow();
  });
});

describe('buildCultureQuizRounds', () => {
  it('produces rounds with exactly one correct option out of four', () => {
    const rounds = buildCultureQuizRounds({ cardPairs: quizCardPairs, rounds: 3, seed: 5 });
    expect(rounds).toHaveLength(3);
    for (const r of rounds) {
      expect(r.options).toHaveLength(4);
      expect(r.options.filter((o) => o.isAnswer)).toHaveLength(1);
    }
  });

  it('the correct option matches the prompt card', () => {
    const rounds = buildCultureQuizRounds({ cardPairs: quizCardPairs, rounds: 5, seed: 2 });
    for (const r of rounds) {
      const answer = r.options.find((o) => o.isAnswer);
      const card = quizCardPairs.find((p) => p.ko === r.promptKo);
      expect(answer?.en).toBe(card?.en);
    }
  });

  it('throws when there are too few card pairs', () => {
    expect(() =>
      buildCultureQuizRounds({ cardPairs: quizCardPairs.slice(0, 2), rounds: 2, seed: 1 }),
    ).toThrow();
  });
});

describe('buildMatchSoundRounds: cyclic prompts and focus ids (F-QUEST-002 §3.4)', () => {
  const prompts = (rounds: ReturnType<typeof buildMatchSoundRounds>) => rounds.map((r) => r.promptJamo.id);

  it('keeps the old capped output when rounds <= pool size (same seed, same rounds)', () => {
    const rounds = buildMatchSoundRounds({ scopeJamoIds: scope6, rounds: 4, seed: 7 });
    expect(rounds).toHaveLength(4);
    expect(new Set(prompts(rounds)).size).toBe(4);
  });

  it('fills the requested rounds when rounds exceed the pool', () => {
    const rounds = buildMatchSoundRounds({ scopeJamoIds: scope4, rounds: 6, seed: 3 });
    expect(rounds).toHaveLength(6);
    for (const r of rounds) {
      expect(r.tiles).toHaveLength(4);
      expect(r.tiles.map((t) => t.id)).toContain(r.promptJamo.id);
    }
  });

  it('plays every pool symbol before any repeats', () => {
    const rounds = buildMatchSoundRounds({ scopeJamoIds: scope4, rounds: 8, seed: 11 });
    const first = prompts(rounds).slice(0, 4);
    expect(new Set(first)).toEqual(new Set(scope4));
  });

  it('never repeats the same prompt twice in a row, over many seeds and lengths', () => {
    for (let seed = 1; seed <= 200; seed++) {
      for (const n of [5, 7, 9, 12]) {
        const ids = prompts(buildMatchSoundRounds({ scopeJamoIds: scope4, rounds: n, seed }));
        for (let i = 1; i < ids.length; i++) {
          expect(ids[i], `seed ${seed} n ${n} idx ${i}`).not.toBe(ids[i - 1]);
        }
      }
    }
  });

  it('is deterministic for a seed', () => {
    const a = buildMatchSoundRounds({ scopeJamoIds: scope4, rounds: 9, seed: 5 });
    const b = buildMatchSoundRounds({ scopeJamoIds: scope4, rounds: 9, seed: 5 });
    expect(prompts(a)).toEqual(prompts(b));
  });

  it('asks every focus id at least once, also when rounds fit inside the pool', () => {
    const pool8 = jamoConsonants.slice(0, 8).map((j) => j.id);
    const focus = [pool8[6]!, pool8[7]!];
    for (let seed = 1; seed <= 100; seed++) {
      const ids = prompts(buildMatchSoundRounds({ scopeJamoIds: pool8, rounds: 6, focusJamoIds: focus, seed }));
      expect(ids).toHaveLength(6);
      expect(new Set(ids).size).toBe(6); // still no repeats inside one pass
      for (const f of focus) expect(ids, `seed ${seed}`).toContain(f);
    }
  });

  it('asks every focus id when the rounds cycle', () => {
    const focus = [scope4[2]!];
    const ids = prompts(buildMatchSoundRounds({ scopeJamoIds: scope4, rounds: 6, focusJamoIds: focus, seed: 2 }));
    expect(ids).toContain(focus[0]);
  });

  it('keeps a focus id that is already in the first pass where it is', () => {
    const pool8 = jamoConsonants.slice(0, 8).map((j) => j.id);
    const ids = prompts(buildMatchSoundRounds({ scopeJamoIds: pool8, rounds: 8, focusJamoIds: [pool8[0]!], seed: 4 }));
    expect(new Set(ids).size).toBe(8);
  });

  it('throws when more focus ids are asked for than there are rounds', () => {
    expect(() =>
      buildMatchSoundRounds({ scopeJamoIds: scope6, rounds: 2, focusJamoIds: scope6.slice(0, 3), seed: 1 }),
    ).toThrow(/focus/i);
  });

  it('throws when a focus id is not in the scope', () => {
    expect(() =>
      buildMatchSoundRounds({ scopeJamoIds: scope4, rounds: 4, focusJamoIds: ['jamo:a'], seed: 1 }),
    ).toThrow(/focus/i);
  });
});

describe('buildBuildLetterRounds: explicit jamoIds and batchim (F-QUEST-002 §3.7)', () => {
  const bap = { ko: '밥', romanization: 'bap', jamoChars: ['ㅂ', 'ㅏ', 'ㅂ'], jamoIds: ['jamo:bieup', 'jamo:a', 'jamo:bieup-batchim'] };
  const mul = { ko: '물', romanization: 'mul', jamoChars: ['ㅁ', 'ㅜ', 'ㄹ'], jamoIds: ['jamo:mieum', 'jamo:u', 'jamo:rieul-batchim'] };

  it('uses explicit jamoIds instead of the character lookup (final ㄹ is the batchim tile)', () => {
    const [r] = buildBuildLetterRounds({ syllables: [mul], seed: 3 });
    expect(r!.componentJamoIds).toEqual(['jamo:mieum', 'jamo:u', 'jamo:rieul-batchim']);
    expect(r!.tileJamoIds).toContain('jamo:rieul-batchim');
    expect(r!.tileJamoIds).not.toContain('jamo:rieul');
  });

  it('keeps a syllable that repeats a letter (밥) as three distinct tiles', () => {
    const [r] = buildBuildLetterRounds({ syllables: [bap], seed: 4 });
    expect(r!.componentJamoIds).toEqual(['jamo:bieup', 'jamo:a', 'jamo:bieup-batchim']);
    expect(new Set(r!.tileJamoIds).size).toBe(r!.tileJamoIds.length);
  });

  it('still uses the character lookup when jamoIds is absent', () => {
    const [r] = buildBuildLetterRounds({ syllables: [{ ko: '가', romanization: 'ga', jamoChars: ['ㄱ', 'ㅏ'] }], seed: 1 });
    expect(r!.componentJamoIds).toEqual(['jamo:giyeok', 'jamo:a']);
  });

  it('rejects a syllable that repeats a jamo id (explicit ids)', () => {
    expect(() =>
      buildBuildLetterRounds({
        syllables: [{ ko: '밥', romanization: 'bap', jamoChars: ['ㅂ', 'ㅏ', 'ㅂ'], jamoIds: ['jamo:bieup', 'jamo:a', 'jamo:bieup'] }],
        seed: 1,
      }),
    ).toThrow(/repeats/);
  });

  it('rejects a syllable that repeats a jamo id (character lookup)', () => {
    expect(() =>
      buildBuildLetterRounds({ syllables: [{ ko: '밥', romanization: 'bap', jamoChars: ['ㅂ', 'ㅏ', 'ㅂ'] }], seed: 1 }),
    ).toThrow(/repeats/);
  });

  it('rejects an unknown explicit jamo id', () => {
    expect(() =>
      buildBuildLetterRounds({
        syllables: [{ ko: '가', romanization: 'ga', jamoChars: ['ㄱ', 'ㅏ'], jamoIds: ['jamo:giyeok', 'jamo:nope'] }],
        seed: 1,
      }),
    ).toThrow(/jamo:nope/);
  });

  it('3-part syllables get 1 initial consonant + 1 other batchim distractor, for every seed', () => {
    for (let seed = 1; seed <= 40; seed++) {
      for (const s of [bap, mul]) {
        const [r] = buildBuildLetterRounds({ syllables: [s], seed });
        const distractors = r!.tileJamoIds.filter((id) => !r!.componentJamoIds.includes(id));
        expect(r!.tileJamoIds).toHaveLength(5);
        expect(distractors).toHaveLength(2);
        const kinds = distractors.map((id) => jamoAll.find((j) => j.id === id)!.kind).sort();
        expect(kinds).toEqual(['batchim', 'consonant']);
        // never a look-alike of a target tile (same glyph, other role)
        const targetChars = r!.componentJamoIds.map((id) => jamoAll.find((j) => j.id === id)!.char);
        for (const d of distractors) expect(targetChars).not.toContain(jamoAll.find((j) => j.id === d)!.char);
        expect(new Set(r!.tileJamoIds).size).toBe(5);
      }
    }
  });

  it('2-part rounds keep the vowel/consonant distractors', () => {
    const [r] = buildBuildLetterRounds({ syllables: [{ ko: '가', romanization: 'ga', jamoChars: ['ㄱ', 'ㅏ'] }], seed: 2 });
    expect(r!.tileJamoIds).toHaveLength(4);
  });
});

import { describe, expect, it } from 'vitest';
import { jamoConsonants, jamoVowels } from '../../content/jamo';
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

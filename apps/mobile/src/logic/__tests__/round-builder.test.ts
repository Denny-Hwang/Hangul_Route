import { describe, expect, it } from 'vitest';
import { jamoConsonants } from '../../content/jamo';
import {
  buildBuildLetterRounds,
  buildMatchSoundRounds,
  buildTraceStrokeRounds,
} from '../round-builder';

const scope4 = jamoConsonants.slice(0, 4).map((j) => j.id);
const scope6 = jamoConsonants.slice(0, 6).map((j) => j.id);

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

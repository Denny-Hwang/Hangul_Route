import fc from 'fast-check';
import type { MatchShapeRound } from '@hangul-route/content-schema';
import { describe, expect, it } from 'vitest';
import { minigameScopes } from '../../minigame-config';
import { fallbackScope, matchShapeToReadPick, scopeLetters } from '../fallback';
import { shapeLetter, soundValues, soundWords, soundsMeet } from '../letters';

/**
 * F-CURR-002 sections 7.1 F4 and 12.2, row CM-33 (match-shape.md, Fallback round): Read Pick, see the letter and pick its
 * sound, and the rule `read-pick-values-distinct`.
 */

const SCOPES = Object.entries(minigameScopes).filter(([, s]) => s.kind === 'match-shape');
const ROUNDS: MatchShapeRound[] = SCOPES.flatMap(([, s]) => s.matchShape?.rounds ?? []);

describe('the letters', () => {
  it('reads a letter of the symbol table: its jamo, its romanized name and its isolated-letter value', () => {
    expect(shapeLetter('jamo:bieup')).toEqual({ id: 'jamo:bieup', char: 'ㅂ', name: 'bieup', sound: 'b/p' });
    expect(shapeLetter('jamo:eo')).toEqual({ id: 'jamo:eo', char: 'ㅓ', name: 'eo', sound: 'eo' });
    expect(() => shapeLetter('jamo:bieup-batchim')).toThrow(/not a letter/);
    expect(() => shapeLetter('jamo:nope')).toThrow(/not a letter/);
  });

  it('every sound of a letter, its final value included', () => {
    expect([...soundValues('ㅂ')]).toEqual(['b', 'p']);
    expect([...soundValues('ㅇ')]).toEqual(['silent', 'ng']);
    expect([...soundValues('?')]).toEqual([]);
    expect(soundsMeet('ㅂ', 'ㅍ')).toBe(true);
    expect(soundsMeet('ㄷ', 'ㅌ')).toBe(true);
    expect(soundsMeet('ㄱ', 'ㅋ')).toBe(true);
    expect(soundsMeet('ㅓ', 'ㅗ')).toBe(false);
    expect(soundWords('g/k')).toBe('g or k');
  });
});

describe('matchShapeToReadPick (read-pick-values-distinct)', () => {
  it('ㅂ never offers ㅍ (p is a sound of ㅂ): its distractors come from the step, then the pool', () => {
    const r = matchShapeToReadPick({ id: 'ms:pair:bieup', shape: 'pair', target: 'jamo:bieup', lookAlike: 'jamo:pieup', layout: 'tlltlt', diffNoteEn: 'x' });
    expect(r.options).toEqual([
      { id: 'jamo:bieup', sound: 'b/p' },
      { id: 'jamo:mieum', sound: 'm' },
      { id: 'jamo:siot', sound: 's' },
    ]);
    expect(r).toMatchObject({ id: 'ms:pair:bieup', target: 'jamo:bieup', answerId: 'jamo:bieup' });
  });

  it('an origin round keeps its own letters when their sounds are their own; a vowel takes vowels only', () => {
    const r = matchShapeToReadPick(ROUNDS.find((x) => x.id === 'ms:origin:nieun')!);
    expect(r.options.map((o) => o.sound)).toEqual(['n', 'g/k', 'm']);
    const v = matchShapeToReadPick({ id: 'p', shape: 'pair', target: 'jamo:eo', lookAlike: 'jamo:o', layout: 'tltllt', diffNoteEn: 'x' }, ['jamo:bieup', 'jamo:a']);
    expect(v.options.map((o) => o.sound)).toEqual(['eo', 'o', 'a']);
  });

  it('over every Stage 1 round: 3 options, exactly one whose sounds hold the target first value, none sharing a sound', () => {
    expect(ROUNDS.length).toBeGreaterThan(0);
    for (const [, scope] of SCOPES) {
      const letters = scopeLetters(scope);
      for (const round of scope.matchShape!.rounds) {
        const r = matchShapeToReadPick(round, letters);
        expect(r.options, round.id).toHaveLength(3);
        const chars = r.options.map((o) => shapeLetter(o.id).char);
        const first = [...soundValues(shapeLetter(round.target).char)][0]!;
        expect(chars.filter((c) => soundValues(c).has(first)), round.id).toHaveLength(1);
        for (let i = 0; i < chars.length; i += 1) for (let j = i + 1; j < chars.length; j += 1) expect(soundsMeet(chars[i]!, chars[j]!), round.id).toBe(false);
      }
    }
  });

  it('holds for any taught letter as the target of a pair, whatever letters the step shows (property)', () => {
    const letters = ['giyeok', 'nieun', 'digeut', 'rieul', 'mieum', 'bieup', 'siot', 'ieung', 'jieut', 'chieut', 'kieuk', 'tieut', 'pieup', 'hieut', 'a', 'eo', 'o', 'u', 'eu', 'i', 'ya', 'yeo', 'yo', 'yu'].map((l) => `jamo:${l}`);
    fc.assert(
      fc.property(fc.constantFrom(...letters), fc.constantFrom(...letters), fc.subarray(letters), (target, lookAlike, step) => {
        fc.pre(target !== lookAlike);
        const r = matchShapeToReadPick({ id: 'x', shape: 'pair', target, lookAlike, layout: 'tltllt', diffNoteEn: 'x' }, step);
        const chars = r.options.map((o) => shapeLetter(o.id).char);
        expect(r.options[0]!.id).toBe(target);
        expect(new Set(r.options.map((o) => o.id)).size).toBe(r.options.length);
        expect(r.options.length).toBe(3);
        for (let i = 0; i < chars.length; i += 1) for (let j = i + 1; j < chars.length; j += 1) expect(soundsMeet(chars[i]!, chars[j]!)).toBe(false);
      }),
    );
  });

  it('a Match Shape scope falls back to Read Pick on the Listen & Pick cards, one round per round, ids kept', () => {
    const [, scope] = SCOPES[0]!;
    const played = fallbackScope(scope);
    expect(played.kind).toBe('listen-pick');
    expect(played.readPick?.rounds.map((r) => r.id)).toEqual(scope.matchShape!.rounds.map((r) => r.id));
    expect(fallbackScope({ kind: 'match-shape' })).toEqual({ kind: 'listen-pick', readPick: { rounds: [] } });
    expect(scopeLetters({ kind: 'match-shape' })).toEqual([]);
  });
});

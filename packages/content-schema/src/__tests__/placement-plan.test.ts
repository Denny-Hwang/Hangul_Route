import { describe, expect, it } from 'vitest';
import { nextRung, type PlanDone, type PlanRung } from '..';

type Len = 'quick' | 'full';
type Result = PlanDone['result'];

/** Plays the planner with a fixed result per rung; counts the questions asked (3 per asked rung). */
const play = (
  length: Len,
  results: Partial<Record<string, Result>>,
  unavailable: string[] = [],
): { path: string[]; asked: number } => {
  const done: PlanDone[] = [];
  const path: string[] = [];
  for (let guard = 0; guard < 20; guard += 1) {
    const step = nextRung({ length, done });
    if (step === null) break;
    const key = step.form === 'decode' ? step.gate : `${step.gate}:${step.form}`;
    path.push(key);
    const result: Result = unavailable.includes(key) ? 'not-run' : (results[key] ?? 'fail');
    done.push({ gate: step.gate, form: step.form, result });
  }
  const asked = path.filter((k) => !unavailable.includes(k)).length * 3;
  return { path, asked };
};

const PASS = (...keys: string[]): Partial<Record<string, Result>> => Object.fromEntries(keys.map((k) => [k, 'pass' as const]));

describe('nextRung', () => {
  it('starts with recognition, then sound-basic (the two entry rungs)', () => {
    expect(nextRung({ length: 'full', done: [] })).toEqual({ gate: 'recog', form: 'decode' });
    expect(nextRung({ length: 'full', done: [{ gate: 'recog', form: 'decode', result: 'fail' }] })).toEqual({
      gate: 'sound-basic',
      form: 'decode',
    });
  });

  it('asks the entry rungs whatever recog scored', () => {
    const done: PlanDone[] = [{ gate: 'recog', form: 'decode', result: 'pass' }];
    expect(nextRung({ length: 'quick', done })?.gate).toBe('sound-basic');
  });

  it('floor of 12: a learner who fails sound-basic gets the two oral rungs', () => {
    const { path, asked } = play('full', PASS('recog'));
    expect(path).toEqual(['recog', 'sound-basic', 'vocab:oral', 'sentence:oral']);
    expect(asked).toBe(12);
  });

  it('15: fails syl-cv', () => {
    const { path, asked } = play('full', PASS('sound-basic'));
    expect(path).toEqual(['recog', 'sound-basic', 'syl-cv', 'vocab:oral', 'sentence:oral']);
    expect(asked).toBe(15);
  });

  it('18: fails sound-rest', () => {
    const { path, asked } = play('full', PASS('sound-basic', 'syl-cv'));
    expect(path).toEqual(['recog', 'sound-basic', 'syl-cv', 'sound-rest', 'vocab:oral', 'sentence:oral']);
    expect(asked).toBe(18);
  });

  it('21: fails syl-cvc (15 decoding + 6 oral)', () => {
    const { path, asked } = play('full', PASS('sound-basic', 'syl-cv', 'sound-rest'));
    expect(path.slice(-3)).toEqual(['syl-cvc', 'vocab:oral', 'sentence:oral']);
    expect(asked).toBe(21);
  });

  it('21: passes syl-cvc, reads vocabulary, then reads sentences; no oral rung is needed', () => {
    const { path, asked } = play('full', PASS('sound-basic', 'syl-cv', 'sound-rest', 'syl-cvc', 'vocab:read', 'sentence:read'));
    expect(path).toEqual(['recog', 'sound-basic', 'syl-cv', 'sound-rest', 'syl-cvc', 'vocab:read', 'sentence:read']);
    expect(asked).toBe(21);
  });

  it('a failed sentence read ends the run (no listening rung)', () => {
    const { path, asked } = play('full', PASS('sound-basic', 'syl-cv', 'sound-rest', 'syl-cvc', 'vocab:read'));
    expect(path.at(-1)).toBe('sentence:read');
    expect(asked).toBe(21);
  });

  it('21: a failed vocab read asks vocab oral once and stops', () => {
    const { path, asked } = play('full', PASS('sound-basic', 'syl-cv', 'sound-rest', 'syl-cvc'));
    expect(path.slice(-2)).toEqual(['vocab:read', 'vocab:oral']);
    expect(path).not.toContain('sentence:oral');
    expect(asked).toBe(21);
  });

  it('quick: the ladder ends after syl-cv, then the oral rungs (at most 15)', () => {
    const { path, asked } = play('quick', PASS('sound-basic', 'syl-cv', 'sound-rest', 'syl-cvc', 'vocab:read'));
    expect(path).toEqual(['recog', 'sound-basic', 'syl-cv', 'vocab:oral', 'sentence:oral']);
    expect(asked).toBe(15);
  });

  it('quick still stops early when the ladder fails', () => {
    expect(play('quick', {}).asked).toBe(9 + 3);
    expect(play('quick', PASS('sound-basic')).asked).toBe(15);
  });

  it('visual false: recog is unavailable (skipped as not-run), the floor is 9', () => {
    const { path, asked } = play('full', {}, ['recog']);
    expect(path[0]).toBe('recog');
    expect(asked).toBe(9);
  });

  it('audio false: the oral rungs come back unavailable and the run ends there', () => {
    const { path } = play('full', PASS('sound-basic'), ['vocab:oral', 'sentence:oral']);
    expect(path).toEqual(['recog', 'sound-basic', 'syl-cv', 'vocab:oral', 'sentence:oral']);
  });

  it('an unavailable decoding rung is not a pass: the ladder ends there', () => {
    const { path } = play('full', PASS('sound-basic'), ['syl-cv']);
    expect(path).toEqual(['recog', 'sound-basic', 'syl-cv', 'vocab:oral', 'sentence:oral']);
  });

  it('an unavailable vocab read is treated like a failed one: vocab oral is asked once', () => {
    const { path } = play('full', PASS('sound-basic', 'syl-cv', 'sound-rest', 'syl-cvc'), ['vocab:read']);
    expect(path.slice(-2)).toEqual(['vocab:read', 'vocab:oral']);
  });

  it('never repeats a rung and always ends', () => {
    for (const length of ['quick', 'full'] as const) {
      const keys = ['recog', 'sound-basic', 'syl-cv', 'sound-rest', 'syl-cvc', 'vocab:read', 'sentence:read', 'vocab:oral', 'sentence:oral'];
      for (let mask = 0; mask < 1 << 9; mask += 1) {
        const results: Partial<Record<string, Result>> = {};
        keys.forEach((k, i) => {
          results[k] = mask & (1 << i) ? 'pass' : 'fail';
        });
        const { path } = play(length, results);
        expect(new Set(path).size).toBe(path.length);
        expect(path.length).toBeLessThanOrEqual(9);
      }
    }
  });
});

describe('asked-question bounds over all outcomes', () => {
  it('full is 12 to 21, quick 9 to 15 (12 to 15 with recog), counting every rung as three', () => {
    const keys = ['sound-basic', 'syl-cv', 'sound-rest', 'syl-cvc', 'vocab:read', 'sentence:read'];
    for (const length of ['quick', 'full'] as const) {
      for (let mask = 0; mask < 1 << keys.length; mask += 1) {
        const results: Partial<Record<string, Result>> = { recog: 'pass' };
        keys.forEach((k, i) => {
          results[k] = mask & (1 << i) ? 'pass' : 'fail';
        });
        const { asked } = play(length, results);
        expect(asked).toBeGreaterThanOrEqual(12);
        expect(asked).toBeLessThanOrEqual(length === 'quick' ? 15 : 21);
      }
    }
  });
});

const rung = (r: PlanRung | null): string | null => (r === null ? null : `${r.gate}:${r.form}`);
describe('nextRung is pure', () => {
  it('returns the same step for the same state and does not mutate it', () => {
    const done: PlanDone[] = [{ gate: 'recog', form: 'decode', result: 'pass' }];
    const before = JSON.stringify(done);
    expect(rung(nextRung({ length: 'full', done }))).toBe(rung(nextRung({ length: 'full', done })));
    expect(JSON.stringify(done)).toBe(before);
  });
});

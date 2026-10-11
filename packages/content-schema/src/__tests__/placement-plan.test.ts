import { describe, expect, it } from 'vitest';
import { nextRung, type PlacementMode, type PlanDone, type PlanRung } from '..';

type Result = PlanDone['result'];

/**
 * Plays the planner with a fixed result per rung; counts the questions asked (3 per asked draw).
 * A second draw is keyed `<rung>:2` and defaults to the first draw's result.
 */
const play = (
  mode: PlacementMode,
  results: Partial<Record<string, Result>>,
  unavailable: string[] = [],
): { path: string[]; asked: number } => {
  const done: PlanDone[] = [];
  const path: string[] = [];
  for (let guard = 0; guard < 30; guard += 1) {
    const step = nextRung({ mode, done });
    if (step === null) break;
    const base = step.form === 'decode' ? step.gate : `${step.gate}:${step.form}`;
    const key = step.draw === 2 ? `${base}:2` : base;
    path.push(key);
    const result: Result = unavailable.includes(key) ? 'not-run' : (results[key] ?? results[base] ?? 'fail');
    done.push({ gate: step.gate, form: step.form, result });
  }
  const asked = path.filter((k) => !unavailable.includes(k)).length * 3;
  return { path, asked };
};

const PASS = (...keys: string[]): Partial<Record<string, Result>> => Object.fromEntries(keys.map((k) => [k, 'pass' as const]));
const LADDER = ['sound-basic', 'syl-cv', 'sound-rest', 'syl-cvc'];

describe('nextRung: Standard (the default)', () => {
  it('starts with recognition, then sound-basic (the two entry rungs)', () => {
    expect(nextRung({ mode: 'standard', done: [] })).toEqual({ gate: 'recog', form: 'decode' });
    expect(nextRung({ mode: 'standard', done: [{ gate: 'recog', form: 'decode', result: 'fail' }] })).toEqual({
      gate: 'sound-basic',
      form: 'decode',
    });
  });

  it('floor of 12: a learner who fails sound-basic gets the two oral rungs', () => {
    const { path, asked } = play('standard', PASS('recog'));
    expect(path).toEqual(['recog', 'sound-basic', 'vocab:oral', 'sentence:oral']);
    expect(asked).toBe(12);
  });

  it('15, 18, 21: fails syl-cv, sound-rest, syl-cvc', () => {
    expect(play('standard', PASS('sound-basic')).asked).toBe(15);
    expect(play('standard', PASS('sound-basic', 'syl-cv')).asked).toBe(18);
    const { path, asked } = play('standard', PASS('sound-basic', 'syl-cv', 'sound-rest'));
    expect(path.slice(-3)).toEqual(['syl-cvc', 'vocab:oral', 'sentence:oral']);
    expect(asked).toBe(21);
  });

  it('24: a vocab read pass is confirmed by a second draw at once, then sentences are read; no oral rung', () => {
    const { path, asked } = play('standard', PASS(...LADDER, 'vocab:read', 'sentence:read'));
    expect(path).toEqual(['recog', ...LADDER, 'vocab:read', 'vocab:read:2', 'sentence:read']);
    expect(asked).toBe(24);
  });

  it('a vocab read that fails its second draw asks vocab oral once and stops (24)', () => {
    const { path, asked } = play('standard', { ...PASS(...LADDER, 'vocab:read'), 'vocab:read:2': 'fail' });
    expect(path.slice(-3)).toEqual(['vocab:read', 'vocab:read:2', 'vocab:oral']);
    expect(asked).toBe(24);
  });

  it('21: a failed vocab read asks vocab oral once and stops', () => {
    const { path, asked } = play('standard', PASS(...LADDER));
    expect(path.slice(-2)).toEqual(['vocab:read', 'vocab:oral']);
    expect(path).not.toContain('sentence:oral');
    expect(asked).toBe(21);
  });

  it('a failed sentence read ends the run (no listening rung)', () => {
    const { path } = play('standard', PASS(...LADDER, 'vocab:read'));
    expect(path.at(-1)).toBe('sentence:read');
  });

  it('visual false: recog is unavailable (skipped as not-run), the floor is 9', () => {
    const { path, asked } = play('standard', {}, ['recog']);
    expect(path[0]).toBe('recog');
    expect(asked).toBe(9);
  });

  it('audio false: the oral rungs come back unavailable and the run ends there', () => {
    const { path } = play('standard', PASS('sound-basic'), ['vocab:oral', 'sentence:oral']);
    expect(path).toEqual(['recog', 'sound-basic', 'syl-cv', 'vocab:oral', 'sentence:oral']);
  });

  it('an unavailable decoding rung is not a pass: the ladder ends there', () => {
    const { path } = play('standard', PASS('sound-basic'), ['syl-cv']);
    expect(path).toEqual(['recog', 'sound-basic', 'syl-cv', 'vocab:oral', 'sentence:oral']);
  });

  it('an unavailable vocab read is treated like a failed one: vocab oral is asked once', () => {
    const { path } = play('standard', PASS(...LADDER), ['vocab:read']);
    expect(path.slice(-2)).toEqual(['vocab:read', 'vocab:oral']);
  });

  it('an unavailable second vocab read keeps the first pass: sentences come next', () => {
    const { path } = play('standard', PASS(...LADDER, 'vocab:read'), ['vocab:read:2']);
    expect(path.slice(-3)).toEqual(['vocab:read', 'vocab:read:2', 'sentence:read']);
  });
});

describe('nextRung: Short', () => {
  it('asks sounds, then words, then CV syllables when the sounds passed (9)', () => {
    const { path, asked } = play('short', PASS('sound-basic', 'syl-cv'));
    expect(path).toEqual(['sound-basic', 'vocab:oral', 'syl-cv']);
    expect(asked).toBe(9);
  });

  it('6 when sound-basic does not pass; never recog, never past syl-cv', () => {
    const { path, asked } = play('short', PASS('recog', 'sound-rest', 'syl-cvc', 'vocab:read'));
    expect(path).toEqual(['sound-basic', 'vocab:oral']);
    expect(asked).toBe(6);
    expect(play('short', PASS(...LADDER, 'vocab:read', 'sentence:read')).path).toEqual(['sound-basic', 'vocab:oral', 'syl-cv']);
  });

  it('with no decoding item (sound guide shown), shapes come after the words: 6', () => {
    const { path, asked } = play('short', PASS('recog'), ['sound-basic']);
    expect(path).toEqual(['sound-basic', 'vocab:oral', 'recog']);
    expect(asked).toBe(6);
  });

  it('with no sound at all nothing can run (the app never starts Short then)', () => {
    const { asked } = play('short', {}, ['sound-basic', 'recog', 'vocab:oral']);
    expect(asked).toBe(0);
  });
});

describe('nextRung: Deep', () => {
  it('confirms each pass after the next rung’s first draw, so one format never runs six in a row', () => {
    const { path } = play('deep', PASS('recog', ...LADDER, 'vocab:read', 'sentence:read', 'sentence:oral'));
    expect(path).toEqual([
      'recog',
      'sound-basic',
      'syl-cv',
      'sound-basic:2',
      'sound-rest',
      'syl-cv:2',
      'syl-cvc',
      'sound-rest:2',
      'vocab:read',
      'syl-cvc:2',
      'sentence:read',
      'vocab:read:2',
      'sentence:read:2',
      'sentence:oral',
    ]);
  });

  it('a reader who passed vocab read hears sentences only: 42 at most', () => {
    const { path, asked } = play('deep', PASS(...LADDER, 'vocab:read', 'sentence:read'));
    expect(path).not.toContain('vocab:oral');
    expect(path.at(-1)).toBe('sentence:oral');
    expect(asked).toBe(42);
  });

  it('while no sentence draw is available, a reader hears words instead', () => {
    const { path } = play('deep', PASS(...LADDER, 'vocab:read'), ['sentence:read', 'sentence:oral']);
    expect(path.slice(-4)).toEqual(['sentence:read', 'vocab:read:2', 'sentence:oral', 'vocab:oral']);
  });

  it('a failed first draw ends the rung at once; a failed confirmation ends the ladder', () => {
    expect(play('deep', PASS('sound-basic')).path).toEqual(['recog', 'sound-basic', 'syl-cv', 'vocab:oral', 'sentence:oral']);
    const confirmFails = play('deep', { ...PASS(...LADDER), 'syl-cv:2': 'fail' });
    expect(confirmFails.path).toEqual([
      'recog',
      'sound-basic',
      'syl-cv',
      'sound-basic:2',
      'sound-rest',
      'syl-cv:2',
      'vocab:oral',
      'sentence:oral',
    ]);
  });

  it('does not confirm sound-basic when syl-cv did not pass (it sets no level alone)', () => {
    const { path, asked } = play('deep', PASS('sound-basic'));
    expect(path).not.toContain('sound-basic:2');
    expect(asked).toBe(15);
  });

  it('confirms a rung whose next rung failed when the rung itself sets a level', () => {
    const { path } = play('deep', PASS('sound-basic', 'syl-cv'));
    expect(path).toEqual(['recog', 'sound-basic', 'syl-cv', 'sound-basic:2', 'sound-rest', 'syl-cv:2', 'vocab:oral', 'sentence:oral']);
  });

  it('a failed second vocab read asks the oral pair', () => {
    const { path, asked } = play('deep', { ...PASS(...LADDER, 'vocab:read', 'sentence:read'), 'vocab:read:2': 'fail' });
    expect(path.slice(-4)).toEqual(['sentence:read', 'vocab:read:2', 'vocab:oral', 'sentence:oral']);
    expect(path).not.toContain('sentence:read:2');
    expect(asked).toBe(42);
  });

  it('an unavailable second draw keeps the first pass', () => {
    const { path } = play('deep', PASS(...LADDER), ['sound-basic:2']);
    expect(path).toContain('sound-rest');
  });
});

describe('every mode always ends, never repeats a draw, and stays within its bounds', () => {
  const keys = ['recog', ...LADDER, 'vocab:read', 'sentence:read', 'vocab:oral', 'sentence:oral'];
  const bounds: Record<PlacementMode, [number, number]> = { short: [6, 9], standard: [12, 24], deep: [12, 42] };
  for (const mode of ['short', 'standard', 'deep'] as const) {
    it(mode, () => {
      for (let mask = 0; mask < 1 << keys.length; mask += 1) {
        const results: Partial<Record<string, Result>> = {};
        keys.forEach((k, i) => {
          results[k] = mask & (1 << i) ? 'pass' : 'fail';
        });
        const { path, asked } = play(mode, results);
        expect(new Set(path).size).toBe(path.length);
        expect(asked).toBeGreaterThanOrEqual(bounds[mode][0]);
        expect(asked).toBeLessThanOrEqual(bounds[mode][1]);
      }
    });
  }
});

const rung = (r: PlanRung | null): string | null => (r === null ? null : `${r.gate}:${r.form}`);
describe('nextRung is pure', () => {
  it('returns the same step for the same state and does not mutate it', () => {
    const done: PlanDone[] = [{ gate: 'recog', form: 'decode', result: 'pass' }];
    const before = JSON.stringify(done);
    expect(rung(nextRung({ mode: 'standard', done }))).toBe(rung(nextRung({ mode: 'standard', done })));
    expect(JSON.stringify(done)).toBe(before);
  });
});

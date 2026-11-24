import { describe, expect, it } from 'vitest';
import { jamoStrokes, type JamoStrokePoint } from '../../content/jamo-strokes';
import { DEFAULT_PASS_THRESHOLD, scoreTrace, type ScoreTraceResult } from '../stroke-scoring';
import { TRACE_KEEP_GOING_MS, TRACE_READY_STROKE_MIN, isFinished, isLetterFinished, isLetterFinishedInForms, wouldPass } from '../trace-ready';

/**
 * AMENDMENTS-TRACE-IDLE §3.1 (TI-1): the one pass rule, and the "finished" rule the idle gate waits for.
 */

/** A learner's exact line: each authored stroke walked every 3 units or less. */
const drawn = (strokes: readonly JamoStrokePoint[][]): JamoStrokePoint[][] =>
  strokes.map((s) => {
    const out: JamoStrokePoint[] = [];
    for (let i = 0; i < s.length - 1; i++) {
      const a = s[i]!;
      const b = s[i + 1]!;
      const n = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / 3));
      for (let k = 0; k < n; k++) out.push({ x: a.x + ((b.x - a.x) * k) / n, y: a.y + ((b.y - a.y) * k) / n });
    }
    out.push({ ...s[s.length - 1]! });
    return out;
  });

const result = (over: Partial<ScoreTraceResult>): ScoreTraceResult => ({
  coverage: 0,
  perStrokeCoverage: [],
  visitedDrawn: true,
  ...over,
});

describe('wouldPass: the one pass rule (§3.1)', () => {
  it('matches the screen\'s former expression, strict and not strict', () => {
    // Former TraceStrokeGame: strictMode ? passWithOrder === true : coverage >= DEFAULT_PASS_THRESHOLD.
    const former = (r: ScoreTraceResult, strict: boolean): boolean =>
      strict ? r.passWithOrder === true : r.coverage >= DEFAULT_PASS_THRESHOLD;
    const cases: ScoreTraceResult[] = [
      result({ coverage: 0 }),
      result({ coverage: DEFAULT_PASS_THRESHOLD - 0.01 }),
      result({ coverage: DEFAULT_PASS_THRESHOLD }),
      result({ coverage: 1 }),
      result({ coverage: 1, passWithOrder: true }),
      result({ coverage: 1, passWithOrder: false }),
      result({ coverage: 0.2, passWithOrder: false }),
      result({ coverage: 0.2, passWithOrder: true }),
    ];
    for (const r of cases) {
      for (const strict of [false, true]) expect(wouldPass(r, strict)).toBe(former(r, strict));
    }
  });
});

describe('isFinished: pass and every stroke at the floor (§3.1)', () => {
  it('uses a 0.8 per-stroke floor', () => {
    expect(TRACE_READY_STROKE_MIN).toBe(0.8);
  });

  it('waits 3 s before the keep-going line (§3.2)', () => {
    expect(TRACE_KEEP_GOING_MS).toBe(3000);
  });

  it('a passing drawing with one stroke under the floor is not finished', () => {
    expect(isFinished(result({ coverage: 0.9, perStrokeCoverage: [1, 1, 0.79] }), false)).toBe(false);
    expect(isFinished(result({ coverage: 0.9, perStrokeCoverage: [1, 1, 0.8] }), false)).toBe(true);
  });

  it('every stroke at the floor but no pass is not finished', () => {
    expect(isFinished(result({ coverage: 0.9, perStrokeCoverage: [0.9, 0.9], passWithOrder: false }), true)).toBe(false);
    expect(isFinished(result({ coverage: 0.9, perStrokeCoverage: [0.9, 0.9], passWithOrder: true }), true)).toBe(true);
  });
});

describe('isLetterFinished over all of jamoStrokes (§6 test 5)', () => {
  for (const { jamoId, strokes } of jamoStrokes) {
    it(`${jamoId}: no proper prefix of its ${strokes.length} strokes is finished; the full letter is`, () => {
      for (let k = 0; k < strokes.length; k++) {
        const prefix = drawn(strokes.slice(0, k));
        expect(isLetterFinished(strokes, prefix, false), `${jamoId}, first ${k} strokes`).toBe(false);
        expect(isLetterFinished(strokes, prefix, true), `${jamoId}, first ${k} strokes, strict`).toBe(false);
      }
      expect(isLetterFinished(strokes, drawn(strokes), false)).toBe(true);
      expect(isLetterFinished(strokes, drawn(strokes), true)).toBe(true);
    });
  }

  // [SO] AMENDMENTS-STROKE-ORDER-STANDARD SO-2, OD-SO12: the idle gate reads every accepted form. A drawing is finished
  // when it is finished on one of them; no proper prefix of any form is finished on any form, so a learner writing
  // another accepted form (OD-SO11) is scored on idle once done, and never before.
  for (const { jamoId, strokes, altStrokes } of jamoStrokes) {
    const forms = [strokes, ...(altStrokes ?? [])];
    it(`${jamoId}: no proper prefix of any of its ${forms.length} accepted forms is finished on any form; every full form is`, () => {
      for (const form of forms) {
        for (let k = 0; k < form.length; k++) {
          expect(isLetterFinishedInForms(forms, drawn(form.slice(0, k)), false), `${jamoId}, first ${k} strokes`).toBe(false);
          expect(isLetterFinishedInForms(forms, drawn(form.slice(0, k)), true), `${jamoId}, first ${k} strokes, strict`).toBe(false);
        }
        expect(isLetterFinishedInForms(forms, drawn(form), false)).toBe(true);
        expect(isLetterFinishedInForms(forms, drawn(form), true)).toBe(true);
      }
    });
  }

  it('isLetterFinishedInForms: finished on a form other than the first; on one form it is isLetterFinished', () => {
    const across: JamoStrokePoint[][] = [[{ x: 30, y: 100 }, { x: 170, y: 100 }]];
    const down: JamoStrokePoint[][] = [[{ x: 100, y: 30 }, { x: 100, y: 170 }]];
    expect(isLetterFinished(across, drawn(down), false)).toBe(false);
    expect(isLetterFinishedInForms([across, down], drawn(down), false)).toBe(true);
    expect(isLetterFinishedInForms([across], drawn(down), false)).toBe(false);
    expect(isLetterFinishedInForms([across, down], drawn([[{ x: 30, y: 30 }, { x: 170, y: 170 }]]), false)).toBe(false);
    expect(isLetterFinishedInForms([], drawn(down), false)).toBe(false);
  });

  it('agrees with isFinished on scoreTrace', () => {
    const bieup = jamoStrokes.find((j) => j.jamoId === 'jamo:bieup')!.strokes;
    const half = drawn(bieup.slice(0, 2));
    // The case of §1: ㅂ's first two strokes already pass on coverage, so coverage alone is not "finished".
    const scored = scoreTrace({ target: bieup, drawn: half });
    expect(wouldPass(scored, false)).toBe(true);
    expect(isFinished(scored, false)).toBe(false);
    expect(isLetterFinished(bieup, half, false)).toBe(false);
  });
});

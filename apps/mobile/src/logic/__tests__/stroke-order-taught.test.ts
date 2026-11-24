import { getMessages } from '@hangul-route/i18n';
import { describe, expect, it } from 'vitest';
import { jamoStrokes, reviewedStrokeIds, strokeFormsForJamo, strokesForJamo, type JamoStrokePoint } from '../../content/jamo-strokes';
import { strokeOrderTaught, unitOrderTaught } from '../stroke-order-taught';
import { scoreTrace, scoreTraceForms } from '../stroke-scoring';
import { failMessage, loopNudgeFor, passMessage, traceCoaching } from '../trace-copy';
import { wouldPass } from '../trace-ready';

/**
 * [SO] AMENDMENTS-STROKE-ORDER-STANDARD §6 tests 1-6: one gate (`strokeOrderTaught`), and an untaught letter gets no
 * order and no open-stroke direction coaching (only the loop nudge), passes on coverage alone, even in strict mode.
 */

const COPY = getMessages('en').learner.minigame.trace;
type Pt = JamoStrokePoint;
const p = (x: number, y: number): Pt => ({ x, y });

function walk(points: Pt[]): Pt[] {
  const out: Pt[] = [];
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i]!;
    const b = points[i + 1]!;
    const steps = Math.max(1, Math.round(Math.hypot(b.x - a.x, b.y - a.y) / 4));
    for (let s = 0; s < steps; s++) out.push({ x: a.x + ((b.x - a.x) * s) / steps, y: a.y + ((b.y - a.y) * s) / steps });
  }
  out.push(points[points.length - 1]!);
  return out;
}

/**
 * The whole result a learner sees after drawing `drawn` over `jamoId`: pass or not, and the line. As Trace Stroke
 * scores it: against every accepted form of the letter (SO-2, `scoreTraceForms`).
 */
function play(jamoId: string, drawn: Pt[][], reviewed: readonly string[] = reviewedStrokeIds, strictMode = false) {
  const forms = strokeFormsForJamo(jamoId)!;
  const result = scoreTraceForms({ forms, drawn, checkOrder: true, checkDirection: true });
  const taught = strokeOrderTaught(jamoId, reviewed);
  const coaching = traceCoaching(result, taught);
  const passed = wouldPass(result, strictMode && taught);
  return {
    result,
    passed,
    line: passed ? passMessage(coaching.orderCorrect, coaching.directionNudge, COPY) : failMessage(strictMode && taught, coaching.orderCorrect, COPY),
  };
}

/** A ring round (cx, cy) from the top; `clockwise` on screen when true. */
function ring(cx: number, cy: number, rx: number, ry: number, clockwise: boolean): Pt[] {
  const pts: Pt[] = [];
  for (let i = 0; i <= 64; i++) {
    const t = (2 * Math.PI * i) / 64;
    pts.push(p(cx + (clockwise ? 1 : -1) * rx * Math.sin(t), cy - ry * Math.cos(t)));
  }
  return pts;
}

describe('strokeOrderTaught (§6 test 1)', () => {
  it('is false for every letter with the shipped list, which stays empty until a person reviews it (SO-3)', () => {
    expect(reviewedStrokeIds).toEqual([]);
    expect(strokeOrderTaught('jamo:o')).toBe(false);
  });
  it('is true for an id in the list it is given', () => {
    expect(strokeOrderTaught('jamo:o', ['jamo:o'])).toBe(true);
    expect(strokeOrderTaught('jamo:a', ['jamo:o'])).toBe(false);
  });
});

describe('unitOrderTaught (§3.1)', () => {
  it('needs every jamo id of every letter in the unit', () => {
    const ho = [{ jamoIds: ['jamo:hieut'] }, { jamoIds: ['jamo:o'] }];
    expect(unitOrderTaught(ho)).toBe(false);
    expect(unitOrderTaught(ho, ['jamo:o'])).toBe(false);
    expect(unitOrderTaught(ho, ['jamo:o', 'jamo:hieut'])).toBe(true);
    // ㅘ = ㅗ + ㅏ: both parts.
    expect(unitOrderTaught([{ jamoIds: ['jamo:o', 'jamo:a'] }], ['jamo:o'])).toBe(false);
    expect(unitOrderTaught([{ jamoIds: ['jamo:o', 'jamo:a'] }], ['jamo:o', 'jamo:a'])).toBe(true);
  });
  it('is false for an empty unit or a letter with no ids', () => {
    expect(unitOrderTaught([], ['jamo:o'])).toBe(false);
    expect(unitOrderTaught([{}], ['jamo:o'])).toBe(false);
    expect(unitOrderTaught([{ jamoIds: [] }], ['jamo:o'])).toBe(false);
  });
});

describe('Trace Stroke on the AU-14 data (§6 tests 2, 3)', () => {
  const [tick, bar] = strokesForJamo('jamo:o')!.map(walk);
  it('ㅗ drawn bar first passes with the praise while untaught', () => {
    const r = play('jamo:o', [bar!, tick!]);
    expect(r.result.orderCorrect).toBe(false);
    expect(r.passed).toBe(true);
    expect(r.line).toBe(COPY.pass.clean);
  });
  it('the order line comes back once ㅗ is taught', () => {
    const r = play('jamo:o', [bar!, tick!], ['jamo:o']);
    expect(r.passed).toBe(true);
    expect(r.line).toBe(COPY.pass.order);
  });
});

describe('other written forms never get order or open-stroke coaching while untaught (§6 test 4)', () => {
  it('ㅌ in 4 strokes (a separate upper-left vertical) → praise', () => {
    const drawn = [
      [p(40, 40), p(160, 40)],
      [p(50, 40), p(50, 95)],
      [p(40, 95), p(160, 95)],
      [p(50, 95), p(50, 150), p(160, 150)],
    ].map(walk);
    const r = play('jamo:tieut', drawn);
    expect(r.passed).toBe(true);
    expect(r.line).toBe(COPY.pass.clean);
    // Against the form shown alone (AU-14, the rule before SO-2), taught, it was coached.
    const target = strokesForJamo('jamo:tieut')!;
    expect(scoreTrace({ target, drawn, checkOrder: true }).orderCorrect).toBe(false);
  });
  // [SO] SO-2 (OD-SO11): ㅈ in 3 strokes and the left-to-right top stroke of ㅊ and ㅎ are accepted forms, so even
  // taught they get the praise; before SO-2 (the form shown alone) taught, they got the "left-to-right" line.
  it('ㅈ in 3 strokes (bar; left leg; right leg) → praise, taught or not (an accepted form)', () => {
    const drawn = [
      [p(40, 50), p(160, 50)],
      [p(160, 50), p(50, 150)],
      [p(116, 90), p(160, 150)],
    ].map(walk);
    const r = play('jamo:jieut', drawn);
    expect(r.passed).toBe(true);
    expect(r.line).toBe(COPY.pass.clean);
    expect(play('jamo:jieut', drawn, ['jamo:jieut']).line).toBe(COPY.pass.clean);
  });
  it('ㅊ with a horizontal top stroke → praise, taught or not (an accepted form)', () => {
    const [, bar, leg] = strokesForJamo('jamo:chieut')!.map(walk);
    const drawn = [walk([p(85, 42), p(115, 42)]), bar!, leg!];
    const r = play('jamo:chieut', drawn);
    expect(r.passed).toBe(true);
    expect(r.line).toBe(COPY.pass.clean);
    expect(play('jamo:chieut', drawn, ['jamo:chieut']).line).toBe(COPY.pass.clean);
  });
  it('ㅎ with a horizontal top stroke and a counter-clockwise ring → praise (the unmatched tick is ignored)', () => {
    const [, bar] = strokesForJamo('jamo:hieut')!.map(walk);
    const drawn = [walk([p(85, 40), p(115, 40)]), bar!, ring(100, 120, 60, 35, false)];
    // Against the form shown alone the tick is unmatched: loopNudgeFor must ignore it (the case of §3.2).
    const shownOnly = scoreTrace({ target: strokesForJamo('jamo:hieut')!, drawn, checkDirection: true });
    expect(shownOnly.directionsPerTarget).toEqual([false, true, true]);
    expect(shownOnly.closedPerTarget).toEqual([false, false, true]);
    expect(loopNudgeFor(shownOnly)).toBe('none');
    const r = play('jamo:hieut', drawn);
    expect(r.result.directionsPerTarget).toEqual([true, true, true]);
    expect(r.passed).toBe(true);
    expect(r.line).toBe(COPY.pass.clean);
    // Taught, it is an accepted form (SO-2), so the praise too, not the open-stroke line.
    expect(play('jamo:hieut', drawn, ['jamo:hieut']).line).toBe(COPY.pass.clean);
  });
  it('ㅌ Variant C (ㄷ first, then the middle bar; not accepted) → praise while untaught; the order line once taught', () => {
    const [top, middle, nieun] = strokesForJamo('jamo:tieut')!.map(walk);
    const drawn = [top!, nieun!, middle!];
    expect(play('jamo:tieut', drawn).line).toBe(COPY.pass.clean);
    expect(play('jamo:tieut', drawn, ['jamo:tieut']).line).toBe(COPY.pass.order);
  });
  it('ㅎ with a horizontal top stroke and a clockwise ring → the loop line, never the open-stroke one', () => {
    const [, bar] = strokesForJamo('jamo:hieut')!.map(walk);
    const r = play('jamo:hieut', [walk([p(85, 40), p(115, 40)]), bar!, ring(100, 120, 60, 35, true)]);
    expect(r.passed).toBe(true);
    expect(r.line).toBe(COPY.pass.loop);
  });
});

/**
 * [SO] SO-2: the other accepted forms only change what a taught letter coaches. While a letter is untaught (every
 * letter, until SO-3) the learner still gets the shape guide and the SO-1 coaching: scoring against every form gives
 * the same pass and the same line as scoring against the form shown alone.
 */
describe('an accepted other form changes no coaching while the letter is untaught (SO-1 holds after SO-2)', () => {
  const withAlternates = jamoStrokes.filter((j) => (j.altStrokes ?? []).length > 0).map((j) => j.jamoId);

  it('the letters with another form are the ones OD-SO11 accepts', () => {
    expect(withAlternates).toEqual(['jamo:jieut', 'jamo:chieut', 'jamo:tieut', 'jamo:hieut']);
  });

  it.each(withAlternates)('%s: each form, in order, backwards, strokes reversed, and with a reversed ring', (jamoId) => {
    const forms = strokeFormsForJamo(jamoId)!;
    const drawings = forms.flatMap((form) => [
      form.map(walk),
      form.map(walk).reverse(),
      form.map((s) => walk([...s].reverse())),
      form.map((s) => walk(s.length > 3 ? [...s].reverse() : s)),
    ]);
    for (const drawn of drawings) {
      const all = scoreTraceForms({ forms, drawn, checkOrder: true, checkDirection: true });
      const shown = scoreTrace({ target: forms[0]!, drawn, checkOrder: true, checkDirection: true });
      expect(traceCoaching(all, false)).toEqual(traceCoaching(shown, false));
      expect(wouldPass(all, false)).toBe(wouldPass(shown, false));
      expect(wouldPass(all, false)).toBe(true);
      expect(play(jamoId, drawn).line).toBe(passMessage(null, loopNudgeFor(shown), COPY));
    }
  });
});

describe('loops keep their nudge, open strokes lose theirs (§6 test 5)', () => {
  it('ㅁ drawn as one loop passes with the praise (no open-stroke nudge)', () => {
    const drawn = [walk([p(50, 40), p(50, 150), p(150, 150), p(150, 40), p(50, 40)])];
    const r = play('jamo:mieum', drawn);
    expect(r.passed).toBe(true);
    expect(r.line).toBe(COPY.pass.clean);
  });
  it.each(['jamo:ieung', 'jamo:ieung-batchim'])('%s drawn clockwise keeps the loop line', (id) => {
    const target = strokesForJamo(id)!;
    const r = play(id, target.map((s) => walk([...s].reverse())));
    expect(r.passed).toBe(true);
    expect(r.line).toBe(COPY.pass.loop);
  });
});

describe('strict mode never fails an untaught letter on order (§6 test 6)', () => {
  const [tick, bar] = strokesForJamo('jamo:o')!.map(walk);
  it('ㅗ bar first, full coverage, strict mode on → pass', () => {
    const r = play('jamo:o', [bar!, tick!], reviewedStrokeIds, true);
    expect(r.passed).toBe(true);
    expect(r.line).toBe(COPY.pass.clean);
  });
  it('once taught, strict mode asks for the order again', () => {
    const r = play('jamo:o', [bar!, tick!], ['jamo:o'], true);
    expect(r.passed).toBe(false);
    expect(r.line).toBe(COPY.retry.order);
  });
});

describe('loopNudgeFor (§3.2)', () => {
  it('is none without direction data', () => {
    expect(loopNudgeFor({})).toBe('none');
  });
  it('ignores an unmatched or wrong-way open target', () => {
    expect(loopNudgeFor({ directionsPerTarget: [false], closedPerTarget: [false] })).toBe('none');
    expect(loopNudgeFor({ directionsPerTarget: [false, true], closedPerTarget: [false, true] })).toBe('none');
    expect(loopNudgeFor({ directionsPerTarget: [false] })).toBe('none');
  });
  it('is loop when a closed target went the other way, whatever the open ones did', () => {
    expect(loopNudgeFor({ directionsPerTarget: [true, false], closedPerTarget: [false, true] })).toBe('loop');
    expect(loopNudgeFor({ directionsPerTarget: [false, false], closedPerTarget: [false, true] })).toBe('loop');
  });
});

describe('traceCoaching', () => {
  it('passes order and direction through when taught', () => {
    expect(traceCoaching({ orderCorrect: false, directionsPerTarget: [false], closedPerTarget: [false] }, true)).toEqual({
      orderCorrect: false,
      directionNudge: 'open',
    });
    expect(traceCoaching({}, true)).toEqual({ orderCorrect: null, directionNudge: 'none' });
  });
  it('drops order and keeps only the loop nudge when untaught', () => {
    expect(traceCoaching({ orderCorrect: false, directionsPerTarget: [false, false], closedPerTarget: [false, true] }, false)).toEqual({
      orderCorrect: null,
      directionNudge: 'loop',
    });
  });
});

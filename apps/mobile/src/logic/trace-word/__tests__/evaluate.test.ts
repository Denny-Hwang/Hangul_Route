import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { strokesForJamo, type JamoStrokePoint } from '../../../content/jamo-strokes';
import { TRACE_IDLE_MS } from '../../trace-evaluator';
import { placeBlockStrokes, type PlacedBlock } from '../block-strokes';
import {
  BLOCK_TOLERANCE,
  INK_MARGIN,
  LOOP_FILL_SPLIT,
  distanceToStrokes,
  SHORT_STROKE,
  createTraceWordGate,
  everyLetterInked,
  hullFill,
  letterHasInk,
  scoreTraceUnit,
  type UnitLetter,
} from '../evaluate';

const place = (s: string): PlacedBlock => placeBlockStrokes(s, strokesForJamo)!;
const lettersOf = (b: PlacedBlock): UnitLetter[] => b.letters;

/** A learner's line: the skeleton walked every 3 units or less, nudged off it by `dx`, `dy`. */
const trace = (strokes: JamoStrokePoint[][], dx = 0, dy = 0): JamoStrokePoint[][] =>
  strokes.map((s) => {
    const out: JamoStrokePoint[] = [];
    for (let i = 0; i < s.length - 1; i++) {
      const a = s[i]!;
      const b = s[i + 1]!;
      const n = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / 3));
      for (let k = 0; k < n; k++) out.push({ x: a.x + ((b.x - a.x) * k) / n + dx, y: a.y + ((b.y - a.y) * k) / n + dy });
    }
    const last = s[s.length - 1]!;
    out.push({ x: last.x + dx, y: last.y + dy });
    return out;
  });

/** A shaky hand: every point moved up to `a` units, deterministically. */
const wobble = (strokes: JamoStrokePoint[][], a: number): JamoStrokePoint[][] =>
  strokes.map((s, j) => s.map((p, i) => ({ x: p.x + a * Math.sin(i * 0.9 + j), y: p.y + a * Math.cos(i * 1.3 + j) })));

/** The whole drawing a little larger or smaller than the ghost (about its own centre). */
const scaled = (strokes: JamoStrokePoint[][], f: number): JamoStrokePoint[][] => {
  const pts = strokes.flat();
  const xs = pts.map((p) => p.x);
  const ys = pts.map((p) => p.y);
  const cx = (Math.min(...xs) + Math.max(...xs)) / 2;
  const cy = (Math.min(...ys) + Math.max(...ys)) / 2;
  return strokes.map((s) => s.map((p) => ({ x: cx + (p.x - cx) * f, y: cy + (p.y - cy) * f })));
};

/** A ring or a rounded square as a hand draws it: one closed stroke round the box. */
const ring = (box: { x: number; y: number; width: number; height: number }, squareness: number): JamoStrokePoint[][] => {
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  const out: JamoStrokePoint[] = [];
  for (let k = 0; k <= 72; k++) {
    const t = (k / 72) * 2 * Math.PI;
    // A superellipse: exponent 2 is an ellipse, a large one a square with rounded corners.
    const e = 2 / squareness;
    const c = Math.cos(t);
    const s = Math.sin(t);
    out.push({ x: cx + (box.width / 2) * Math.sign(c) * Math.abs(c) ** e, y: cy + (box.height / 2) * Math.sign(s) * Math.abs(s) ** e });
  }
  return [out];
};

/** The Stage 7 syllables of the prototype (F-CURR-001 §3.7 table, q1 words and the animal words). */
const STAGE7_SYLLABLES = [...new Set([...'호야이름한글아침점심저녁학교회사공원집설날추석생일먼저동물접어잘라그려개소말곰새닭뱀토끼여우사자돼지오리쥐양꽃의왜뭐'])];

describe('scoreTraceUnit at block size (open question 2: pass rates and near misses)', () => {
  it('passes a careful trace of every Stage 7 block, and a trace a little off the line', () => {
    for (const syllable of STAGE7_SYLLABLES) {
      const block = place(syllable);
      const target = block.strokes;
      expect(scoreTraceUnit(lettersOf(block), trace(target)).passed, syllable).toBe(true);
      expect(scoreTraceUnit(lettersOf(block), trace(target, 6, -6)).passed, `${syllable} off by 6`).toBe(true);
      expect(scoreTraceUnit(lettersOf(block), wobble(trace(target, -6, 6), 3)).passed, `${syllable} off by 6, shaky`).toBe(true);
      expect(scoreTraceUnit(lettersOf(block), wobble(scaled(trace(target, 4, -4), 0.92), 3)).passed, `${syllable} small`).toBe(true);
      expect(scoreTraceUnit(lettersOf(block), wobble(scaled(trace(target, -4, 4), 1.08), 3)).passed, `${syllable} large`).toBe(true);
    }
  });

  it('uses the block-size tolerance by default', () => {
    expect(BLOCK_TOLERANCE).toBe(12);
  });

  // Each pair: the target block, then the block the learner drew over its ghost instead. A
  // left-out stroke, a tick on the wrong side, a wrong final or initial: none is the word.
  const MINIMAL_PAIRS: Array<[string, string]> = [
    ['가', '기'], ['기', '가'], ['야', '여'], ['여', '야'], ['아', '야'], ['야', '아'], ['저', '져'], ['져', '저'],
    ['개', '게'], ['게', '개'], ['개', '계'], ['새', '세'], ['호', '후'], ['이', '어'], ['고', '교'], ['사', '샤'],
    ['한', '항'], ['항', '한'], ['공', '곰'], ['곰', '공'], ['뱀', '뱅'], ['뱅', '뱀'], ['집', '짐'], ['짐', '집'],
    ['말', '발'], ['발', '말'], ['학', '악'], ['름', '릅'], ['몸', '옹'], ['오', '모'],
    ['다', '타'], ['가', '카'], ['바', '파'], ['자', '차'],
  ];

  it('does not pass a near-miss letter: a stroke left out, added, or a different letter drawn', () => {
    for (const [target, drawn] of MINIMAL_PAIRS) {
      const letters = lettersOf(place(target));
      const strokes = place(drawn).strokes;
      expect(scoreTraceUnit(letters, trace(strokes)).passed, `${target} traced as ${drawn}`).toBe(false);
      expect(scoreTraceUnit(letters, wobble(trace(strokes, 4, -4), 2)).passed, `${target} traced as ${drawn}, off by 4`).toBe(false);
    }
  });

  it('does not pass a careful block with one stray stroke beside it', () => {
    const block = place('호');
    const stray = [{ x: 150, y: 20 }, { x: 190, y: 60 }];
    expect(scoreTraceUnit(lettersOf(block), [...trace(block.strokes), ...trace([stray])]).passed).toBe(false);
    // A tap or a slip shorter than STRAY_MIN_LENGTH is not judged on its own.
    expect(scoreTraceUnit(lettersOf(block), [...trace(block.strokes), [{ x: 190, y: 10 }, { x: 192, y: 12 }]]).passed).toBe(true);
  });

  it('tells a drawn ring from a drawn square in a final (ㅇ against ㅁ)', () => {
    for (const [target, square] of [['공', false], ['곰', true], ['뱅', false], ['뱀', true]] as const) {
      const block = place(target);
      const pts = block.letters[2]!.strokes.flat();
      const xs = pts.map((p) => p.x);
      const ys = pts.map((p) => p.y);
      const outline = { x: Math.min(...xs), y: Math.min(...ys), width: Math.max(...xs) - Math.min(...xs), height: Math.max(...ys) - Math.min(...ys) };
      const head = trace(block.letters.slice(0, 2).flatMap((l) => l.strokes));
      const asRing = ring(outline, 1);
      const asSquare = ring(outline, 8);
      expect(hullFill(asRing.flat())).toBeLessThan(LOOP_FILL_SPLIT);
      expect(hullFill(asSquare.flat())).toBeGreaterThanOrEqual(LOOP_FILL_SPLIT);
      expect(scoreTraceUnit(lettersOf(block), [...head, ...asRing]).passed, `${target} with a ring`).toBe(!square);
      expect(scoreTraceUnit(lettersOf(block), [...head, ...asSquare]).passed, `${target} with a square`).toBe(square);
    }
  });

  it('does not pass a block with only its first letter drawn', () => {
    for (const syllable of ['호', '야', '름', '한', '회', '닭']) {
      const block = place(syllable);
      expect(scoreTraceUnit(lettersOf(block), trace(block.letters[0]!.strokes)).passed, syllable).toBe(false);
      // Every letter but the last is not enough either.
      const most = block.letters.slice(0, -1).flatMap((l) => l.strokes);
      expect(scoreTraceUnit(lettersOf(block), trace(most)).passed, `${syllable} without its last letter`).toBe(false);
    }
  });

  it('does not pass a trace drawn well away from the ghost', () => {
    const block = place('호');
    expect(scoreTraceUnit(lettersOf(block), trace(block.strokes, 40, 40)).passed).toBe(false);
    expect(scoreTraceUnit([], trace(block.strokes)).passed).toBe(false);
  });

  it('coaches order and direction on a pass, never failing for them', () => {
    const block = place('야');
    const target = block.strokes;
    const letters = lettersOf(block);
    const reversed = scoreTraceUnit(letters, trace(target).map((s) => [...s].reverse()));
    expect(reversed.passed).toBe(true);
    expect(reversed.directionNudge).toBe('open');
    const backwards = scoreTraceUnit(letters, [...trace(target)].reverse());
    expect(backwards.passed).toBe(true);
    expect(backwards.orderCorrect).toBe(false);
    const clean = scoreTraceUnit(letters, trace(target));
    expect(clean.orderCorrect).toBe(true);
    expect(clean.directionNudge).toBe('none');
  });

  it('never coaches the direction of a stroke too short to read (ㅎ\'s top tick in a block)', () => {
    const block = place('호');
    const tick = block.letters[0]!.strokes[0]!;
    const drawn = trace(block.strokes).map((s, i) => (i === 0 ? [...s].reverse() : s));
    expect(Math.hypot(tick[1]!.x - tick[0]!.x, tick[1]!.y - tick[0]!.y)).toBeLessThan(SHORT_STROKE);
    expect(scoreTraceUnit(lettersOf(block), drawn).directionNudge).toBe('none');
  });

  it('takes a round\'s own tolerance', () => {
    const block = place('호');
    expect(scoreTraceUnit(lettersOf(block), trace(block.strokes, 10, 0), 4).passed).toBe(false);
    expect(scoreTraceUnit(lettersOf(block), trace(block.strokes, 10, 0), 24).passed).toBe(true);
    // A single letter in letter mode is one unit of its own.
    const h = block.letters[0]!;
    expect(scoreTraceUnit([h], trace(h.strokes)).passed).toBe(true);
    expect(scoreTraceUnit([h], trace(block.letters[1]!.strokes)).passed).toBe(false);
  });
});

describe('the geometry under the precision and outline checks', () => {
  it('measures a point against a one-point stroke and a zero-length segment', () => {
    expect(distanceToStrokes({ x: 3, y: 4 }, [[{ x: 0, y: 0 }]])).toBe(5);
    expect(distanceToStrokes({ x: 3, y: 4 }, [[{ x: 0, y: 0 }, { x: 0, y: 0 }]])).toBe(5);
    expect(distanceToStrokes({ x: 5, y: 3 }, [[{ x: 0, y: 0 }, { x: 10, y: 0 }]])).toBe(3);
    expect(distanceToStrokes({ x: 0, y: 0 }, [])).toBe(Number.POSITIVE_INFINITY);
  });

  it('reads no fill from a line or from fewer than three points', () => {
    expect(hullFill([{ x: 0, y: 0 }, { x: 1, y: 1 }])).toBe(0);
    expect(hullFill([{ x: 0, y: 0 }, { x: 5, y: 0 }, { x: 10, y: 0 }])).toBe(0);
    expect(hullFill([{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }])).toBeCloseTo(1);
  });

  it('skips the outline check for a letter given without its character, and a unit with no ink', () => {
    const final = place('공').letters[2]!;
    const square = [[{ x: final.zones[0]!.x, y: final.zones[0]!.y }, { x: final.zones[0]!.x + 100, y: final.zones[0]!.y + 50 }]];
    expect(scoreTraceUnit([{ strokes: final.strokes }], trace(final.strokes)).passed).toBe(true);
    expect(scoreTraceUnit([final], []).passed).toBe(false);
    expect(scoreTraceUnit([final], []).orderCorrect).toBe(false);
    expect(scoreTraceUnit([final], trace(square)).passed).toBe(false);
  });
});

describe('ink per letter zone', () => {
  const ho = place('호');

  it('a stroke mostly inside a letter\'s zone inks it; one outside does not', () => {
    const [h, o] = ho.letters;
    expect(letterHasInk(h!, trace(h!.strokes))).toBe(true);
    expect(letterHasInk(o!, trace(h!.strokes))).toBe(false);
    expect(letterHasInk(h!, [[]])).toBe(false);
    expect(letterHasInk(h!, [])).toBe(false);
  });

  it('forgives a finger that overshoots the zone by up to INK_MARGIN', () => {
    const zone = ho.letters[0]!.zones[0]!;
    const edge = [{ x: zone.x - INK_MARGIN, y: zone.y + 10 }, { x: zone.x + zone.width + INK_MARGIN, y: zone.y + 10 }];
    expect(letterHasInk(ho.letters[0]!, [edge])).toBe(true);
  });

  it('every letter of the block has ink only once each zone has a stroke', () => {
    const [h, o] = ho.letters;
    expect(everyLetterInked(ho.letters, trace(h!.strokes))).toBe(false);
    expect(everyLetterInked(ho.letters, [...trace(h!.strokes), ...trace(o!.strokes)])).toBe(true);
    expect(everyLetterInked([], [])).toBe(false);
  });
});

describe('createTraceWordGate: the idle gate of block mode (wireframe "Idle gate in block mode")', () => {
  let onEvaluate: ReturnType<typeof vi.fn<() => void>>;

  beforeEach(() => {
    vi.useFakeTimers();
    onEvaluate = vi.fn<() => void>();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('strokes in the first zone only, then a pause longer than TRACE_IDLE_MS: the block is not evaluated', () => {
    const ho = place('호');
    let strokes: JamoStrokePoint[][] = [];
    const gate = createTraceWordGate({ idleMs: TRACE_IDLE_MS, onEvaluate, ready: () => everyLetterInked(ho.letters, strokes) });
    strokes = trace(ho.letters[0]!.strokes);
    gate.strokeStarted();
    gate.strokeEnded();
    vi.advanceTimersByTime(TRACE_IDLE_MS * 3);
    expect(onEvaluate).not.toHaveBeenCalled();
    // Once ㅗ has ink too, the idle timer runs and evaluates once.
    strokes = [...strokes, ...trace(ho.letters[1]!.strokes)];
    gate.strokeStarted();
    gate.strokeEnded();
    vi.advanceTimersByTime(TRACE_IDLE_MS);
    expect(onEvaluate).toHaveBeenCalledTimes(1);
    gate.dispose();
  });

  it('a pause before every zone has ink also stops a countdown already running', () => {
    let ready = true;
    const gate = createTraceWordGate({ idleMs: TRACE_IDLE_MS, onEvaluate, ready: () => ready });
    gate.strokeEnded();
    ready = false;
    gate.strokeEnded();
    vi.advanceTimersByTime(TRACE_IDLE_MS * 2);
    expect(onEvaluate).not.toHaveBeenCalled();
  });

  it('Done evaluates at any time, once', () => {
    const gate = createTraceWordGate({
      idleMs: TRACE_IDLE_MS,
      onEvaluate,
      ready: () => false,
      scheduler: { setTimeout: (fn, ms) => setTimeout(fn, ms), clearTimeout: (h) => clearTimeout(h as ReturnType<typeof setTimeout>) },
    });
    expect(gate.done()).toBe(true);
    expect(gate.done()).toBe(false);
    expect(onEvaluate).toHaveBeenCalledTimes(1);
  });
});

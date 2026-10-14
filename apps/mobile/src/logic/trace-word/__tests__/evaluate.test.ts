import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { strokesForJamo, type JamoStrokePoint } from '../../../content/jamo-strokes';
import { TRACE_IDLE_MS } from '../../trace-evaluator';
import { placeBlockStrokes, type PlacedBlock } from '../block-strokes';
import { INK_MARGIN, SHORT_STROKE, createTraceWordGate, everyLetterInked, letterHasInk, scoreTraceUnit } from '../evaluate';

const place = (s: string): PlacedBlock => placeBlockStrokes(s, strokesForJamo)!;
const lettersOf = (b: PlacedBlock): JamoStrokePoint[][][] => b.letters.map((l) => l.strokes);

/** A learner's line: the skeleton walked point by point, nudged off it by `dx`, `dy`. */
const trace = (strokes: JamoStrokePoint[][], dx = 0, dy = 0): JamoStrokePoint[][] =>
  strokes.map((s) => {
    const out: JamoStrokePoint[] = [];
    for (let i = 0; i < s.length - 1; i++) {
      const a = s[i]!;
      const b = s[i + 1]!;
      for (let t = 0; t < 1; t += 0.1) out.push({ x: a.x + (b.x - a.x) * t + dx, y: a.y + (b.y - a.y) * t + dy });
    }
    const last = s[s.length - 1]!;
    out.push({ x: last.x + dx, y: last.y + dy });
    return out;
  });

/** The Stage 7 syllables of the prototype (F-CURR-001 §3.7 table, q1 words and the animal words). */
const STAGE7_SYLLABLES = [...new Set([...'호야이름한글아침점심저녁학교회사공원집설날추석생일먼저동물접어잘라그려개소말곰새닭뱀토끼여우사자돼지오리쥐양'])];

describe('scoreTraceUnit at the relaxed tolerance (open question 2: pass rates at block size)', () => {
  it('passes a careful trace of every Stage 7 block, and a trace a little off the line', () => {
    for (const syllable of STAGE7_SYLLABLES) {
      const block = place(syllable);
      const target = block.strokes;
      expect(scoreTraceUnit(lettersOf(block), trace(target)).passed, syllable).toBe(true);
      expect(scoreTraceUnit(lettersOf(block), trace(target, 6, -6)).passed, `${syllable} off by 6`).toBe(true);
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
    const h = block.letters[0]!.strokes;
    expect(scoreTraceUnit([h], trace(h)).passed).toBe(true);
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

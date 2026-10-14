import type { KoText, TraceWordRound } from '@hangul-route/content-schema';
import { describe, expect, it } from 'vitest';
import { strokesForJamo } from '../../../content/jamo-strokes';
import {
  answerOf,
  blocksPassed,
  initialTraceWordState,
  lettersPassed,
  traceWordReducer,
  type TraceWordAction,
  type TraceWordRoundShape,
  type TraceWordState,
} from '../flow';
import { buildTraceWordRounds, letterCounts } from '../rounds';

const kt = (ko: string, romanization: string, en: string): KoText => ({ ko, romanization, en });

describe('buildTraceWordRounds', () => {
  const rounds: TraceWordRound[] = [
    { id: 'r1', word: kt('호야', 'hoya', 'Hoya') },
    { id: 'r2', word: kt('이름', 'ireum', 'name'), mode: 'letter', tolerancePx: 20 },
  ];

  it('places each block and names it by its own sound (the chip plays it alone)', () => {
    const [hoya, ireum] = buildTraceWordRounds(rounds, strokesForJamo);
    expect(hoya!.mode).toBe('block');
    expect(hoya!.tolerance).toBeUndefined();
    expect(hoya!.blocks.map((b) => [b.syllable, b.romanization])).toEqual([
      ['호', 'ho'],
      ['야', 'ya'],
    ]);
    expect(ireum!.mode).toBe('letter');
    expect(ireum!.tolerance).toBe(20);
    expect(ireum!.blocks.map((b) => b.romanization)).toEqual(['i', 'reum']);
    expect(letterCounts(ireum!)).toEqual([2, 3]);
  });

  it('leaves out a word the stroke data cannot draw', () => {
    const noHieut = (id: string) => (id === 'jamo:hieut' ? undefined : strokesForJamo(id));
    expect(buildTraceWordRounds(rounds, noHieut).map((r) => r.id)).toEqual(['r2']);
    expect(buildTraceWordRounds([], strokesForJamo)).toEqual([]);
  });
});

const BLOCK: TraceWordRoundShape = { mode: 'block', letterCounts: [2, 2] };
const LETTER: TraceWordRoundShape = { mode: 'letter', letterCounts: [2, 3] };

function run(rounds: TraceWordRoundShape[], actions: TraceWordAction[]): TraceWordState[] {
  const states = [initialTraceWordState(rounds)];
  for (const a of actions) states.push(traceWordReducer(states[states.length - 1]!, a, rounds));
  return states;
}

const pass: TraceWordAction = { type: 'evaluated', passed: true };
const miss: TraceWordAction = { type: 'evaluated', passed: false };
const next: TraceWordAction = { type: 'continue' };

describe('traceWordReducer: block by block, one answer per word', () => {
  it('passes block 1, then block 2, then shows the whole word and moves on', () => {
    const s = run([BLOCK, BLOCK], [pass, next, pass, next]);
    expect(s.map((x) => [x.round, x.block, x.phase])).toEqual([
      [0, 0, 'drawing'],
      [0, 0, 'blockDone'],
      [0, 1, 'drawing'],
      [0, 1, 'wordDone'],
      [1, 0, 'drawing'],
    ]);
    expect(answerOf(s[2]!, s[3]!)).toEqual({ round: 0, correct: true });
  });

  it('a block that does not pass stays current; the round is then not right first time', () => {
    const s = run([BLOCK], [pass, next, miss, next, pass, next]);
    expect(s[3]!.phase).toBe('retry');
    expect(s[3]!.block).toBe(1);
    expect(s[4]!.phase).toBe('drawing');
    expect(s[4]!.block).toBe(1);
    expect(s[5]!.phase).toBe('wordDone');
    expect(answerOf(s[4]!, s[5]!)).toEqual({ round: 0, correct: false });
    expect(s[6]!.phase).toBe('finished');
  });

  it('starts each round on a fresh first try', () => {
    const s = run([BLOCK, BLOCK], [miss, next, pass, next, pass, next]);
    expect(s[6]!.round).toBe(1);
    expect(s[6]!.firstTry).toBe(true);
  });

  it('answers once: only on the step into wordDone', () => {
    const s = run([BLOCK], [pass, next, pass]);
    expect(answerOf(s[0]!, s[1]!)).toBeNull();
    expect(answerOf(s[3]!, s[3]!)).toBeNull();
  });

  it('ignores a result outside drawing and a continue while drawing', () => {
    const [start, done] = run([BLOCK], [pass]);
    expect(traceWordReducer(done!, pass, [BLOCK])).toBe(done);
    expect(traceWordReducer(start!, next, [BLOCK])).toBe(start);
  });

  it('is finished at once with no rounds, and stays put past the last round', () => {
    const empty = initialTraceWordState([]);
    expect(empty.phase).toBe('finished');
    expect(traceWordReducer(empty, pass, [])).toBe(empty);
  });

  it('counts the passed blocks for the word strip', () => {
    const s = run([BLOCK], [pass, next, miss, next, pass]);
    expect(s.map(blocksPassed)).toEqual([0, 1, 1, 1, 1, 2]);
  });
});

describe('traceWordReducer: letter by letter', () => {
  it('walks the letters of each block, then the next block', () => {
    const s = run([LETTER], [pass, next, pass, next, pass, next, miss, next, pass, next, pass]);
    expect(s.map((x) => [x.block, x.letter, x.phase])).toEqual([
      [0, 0, 'drawing'],
      [0, 0, 'letterDone'],
      [0, 1, 'drawing'],
      [0, 1, 'blockDone'],
      [1, 0, 'drawing'],
      [1, 0, 'letterDone'],
      [1, 1, 'drawing'],
      [1, 1, 'retry'],
      [1, 1, 'drawing'],
      [1, 1, 'letterDone'],
      [1, 2, 'drawing'],
      [1, 2, 'wordDone'],
    ]);
    expect(answerOf(s[10]!, s[11]!)).toEqual({ round: 0, correct: false });
  });

  it('counts the passed letters of the block for the part marks', () => {
    const s = run([LETTER], [pass, next, pass]);
    expect(lettersPassed(s[0]!, 2)).toBe(0);
    expect(lettersPassed(s[1]!, 2)).toBe(1);
    expect(lettersPassed(s[2]!, 2)).toBe(1);
    expect(lettersPassed(s[3]!, 2)).toBe(2);
  });

  it('treats a block with an unknown letter count as one letter', () => {
    const odd: TraceWordRoundShape = { mode: 'letter', letterCounts: [] };
    expect(traceWordReducer(initialTraceWordState([odd]), pass, [odd]).phase).toBe('wordDone');
  });
});

import { keysFor } from '@hangul-route/content-schema';
import { describe, expect, it } from 'vitest';
import {
  MAX_NAME_BLOCKS,
  MAX_TYPED,
  PASS_PAUSE_MS,
  SENTENCE_PAUSE_MS,
  blockCount,
  nameReady,
  pickedWords,
  startFlow,
  stepFlow,
  targetWord,
  type FrameInput,
  type WriteFrameEffect,
  type WriteFrameEvent,
  type WriteFrameState,
} from '../flow';

const food: FrameInput = { banks: [['떡볶이', '김밥', '라면']], entry: 'type', freeEntry: false };
const two: FrameInput = { banks: [['설날', '추석'], ['떡국', '사과']], entry: 'type', freeEntry: false };
const pickOnly: FrameInput = { banks: [['사과', '빵']], entry: 'pick', freeEntry: false };
const name: FrameInput = { banks: [[]], entry: 'type', freeEntry: true };

function run(state: WriteFrameState, events: WriteFrameEvent[]): { state: WriteFrameState; effects: WriteFrameEffect[] } {
  const effects: WriteFrameEffect[] = [];
  let s = state;
  for (const e of events) {
    const step = stepFlow(s, e);
    s = step.state;
    effects.push(...step.effects);
  }
  return { state: s, effects };
}

const type = (text: string): WriteFrameEvent[] => keysFor(text).map((jamo) => (jamo === ' ' ? { type: 'space' } : { type: 'key', jamo }));
const answers = (effects: WriteFrameEffect[]) => effects.filter((e) => e.type === 'answer');

describe('startFlow', () => {
  it('opens a word-bank frame on the pick and the name round on the field', () => {
    expect(startFlow([food])).toMatchObject({ phase: 'pick', picks: [null], total: 1, done: false });
    expect(startFlow([name])).toMatchObject({ phase: 'typing', keys: [] });
    expect(startFlow([name], keysFor('호야')).keys).toEqual(keysFor('호야'));
    expect(startFlow([]).done).toBe(true);
    expect(targetWord(startFlow([food]))).toBeNull();
    expect(pickedWords(startFlow([]))).toEqual([]);
  });
});

describe('a one-slot frame (behaviour 4)', () => {
  it('accepts any pick, then checks the typing against the word picked', () => {
    const { state, effects } = run(startFlow([food]), [{ type: 'pick', index: 1 }, ...type('김밥'), { type: 'done' }]);
    expect(pickedWords(state)).toEqual(['김밥']);
    expect(state.phase).toBe('sentence');
    expect(state.written).toEqual([{ roundIdx: 0, words: ['김밥'] }]);
    expect(effects).toEqual([
      { type: 'haptic', kind: 'success' },
      { type: 'answer', roundIdx: 0, correct: true },
      { type: 'schedule-advance', ms: SENTENCE_PAUSE_MS },
    ]);
  });

  it('a near miss nudges against the pick; Fix it and a pass count the frame as missed, once', () => {
    const clear = Array.from({ length: 12 }, () => ({ type: 'delete' }) as const);
    let { state, effects } = run(startFlow([food]), [{ type: 'pick', index: 0 }, ...type('떡보이'), { type: 'done' }]);
    expect(state.phase).toBe('miss');
    expect(state.score?.verdict).toBe('near');
    expect(state.score?.blocks.map((b) => b.target)).toEqual(['떡', '볶', '이']);
    expect(effects).toEqual([{ type: 'haptic', kind: 'nudge' }]);
    ({ state, effects } = run(state, [{ type: 'fix' }, ...clear, ...type('떡보이'), { type: 'done' }]));
    expect(state.phase).toBe('miss');
    expect(state.retries).toBe(1);
    expect(effects).toEqual([{ type: 'haptic', kind: 'nudge' }]);
    ({ state, effects } = run(state, [{ type: 'fix' }, ...clear, ...type('떡볶이'), { type: 'done' }]));
    expect(state.phase).toBe('sentence');
    expect(answers(effects)).toEqual([{ type: 'answer', roundIdx: 0, correct: false }]);
  });

  it('Change word goes back to the pick until the first Done, keeping the pick', () => {
    let { state } = run(startFlow([food]), [{ type: 'pick', index: 0 }, ...type('떡')]);
    ({ state } = run(state, [{ type: 'change-word' }]));
    expect(state).toMatchObject({ phase: 'pick', picks: [0], keys: [] });
    ({ state } = run(state, [{ type: 'pick', index: 2 }, ...type('라멘'), { type: 'done' }, { type: 'fix' }, { type: 'change-word' }]));
    expect(state.phase).toBe('typing');
    expect(targetWord(state)).toBe('라면');
  });

  it('ignores a pick outside the bank, a pick while typing and Done on an empty field', () => {
    const s0 = startFlow([food]);
    expect(stepFlow(s0, { type: 'pick', index: 9 }).state).toBe(s0);
    const typing = run(s0, [{ type: 'pick', index: 0 }]).state;
    expect(stepFlow(typing, { type: 'pick', index: 1 }).state).toBe(typing);
    expect(stepFlow(typing, { type: 'done' }).state).toBe(typing);
    expect(stepFlow(typing, { type: 'space' }).state).toBe(typing);
    expect(stepFlow(typing, { type: 'delete' }).state).toBe(typing);
    expect(stepFlow(typing, { type: 'tile', keys: ['ㅇ', 'ㅏ'] }).state).toBe(typing);
    expect(stepFlow(s0, { type: 'key', jamo: 'ㄱ' }).state).toBe(s0);
    expect(stepFlow(s0, { type: 'done' }).state).toBe(s0);
    expect(stepFlow(s0, { type: 'fix' }).state).toBe(s0);
    expect(stepFlow(s0, { type: 'advance' }).state).toBe(s0);
    expect(stepFlow(s0, { type: 'continue' }).state).toBe(s0);
    expect(stepFlow(s0, { type: 'change-word' }).state).toBe(s0);
  });

  it('keeps spaces single and the field inside its limit', () => {
    let { state } = run(startFlow([food]), [{ type: 'pick', index: 0 }, ...type('떡'), { type: 'space' }, { type: 'space' }]);
    expect(state.keys.filter((k) => k === ' ')).toHaveLength(1);
    ({ state } = run(state, Array.from({ length: 40 }, () => ({ type: 'key', jamo: 'ㅏ' }) as const)));
    expect(state.keys.length).toBeLessThanOrEqual(MAX_TYPED + 2);
    expect(state.lastEdit).toBe('key');
  });
});

describe('a two-slot frame (wireframe Scoring)', () => {
  const both = (first: string, second: string): { state: WriteFrameState; effects: WriteFrameEffect[] } => {
    let { state, effects } = run(startFlow([two]), [{ type: 'pick', index: 1 }, ...type(first), { type: 'done' }]);
    if (state.phase === 'miss') {
      const fixed = run(state, [{ type: 'fix' }, ...Array.from({ length: 10 }, () => ({ type: 'delete' }) as const), ...type('추석'), { type: 'done' }]);
      state = fixed.state;
      effects = [...effects, ...fixed.effects];
    }
    expect(state.phase).toBe('pass');
    expect(effects).toContainEqual({ type: 'schedule-advance', ms: PASS_PAUSE_MS });
    expect(answers(effects)).toEqual([]);
    const rest = run(state, [{ type: 'advance' }, { type: 'pick', index: 0 }, ...type(second), { type: 'done' }]);
    let after = rest;
    if (rest.state.phase === 'miss') {
      after = run(rest.state, [{ type: 'fix' }, ...Array.from({ length: 10 }, () => ({ type: 'delete' }) as const), ...type('떡국'), { type: 'done' }]);
      after = { state: after.state, effects: [...rest.effects, ...after.effects] };
    }
    return { state: after.state, effects: [...effects, ...after.effects] };
  };

  it('answers once, after the last slot: right when both slots pass on their first Done', () => {
    const { state, effects } = both('추석', '떡국');
    expect(answers(effects)).toEqual([{ type: 'answer', roundIdx: 0, correct: true }]);
    expect(state.written).toEqual([{ roundIdx: 0, words: ['추석', '떡국'] }]);
  });

  it('a first-try miss in slot 1 or slot 2 makes the frame a missed round', () => {
    expect(answers(both('추섞', '떡국').effects)).toEqual([{ type: 'answer', roundIdx: 0, correct: false }]);
    expect(answers(both('추석', '떡굮').effects)).toEqual([{ type: 'answer', roundIdx: 0, correct: false }]);
  });
});

describe('a pick-only frame', () => {
  it('finishes on the pick, unscored', () => {
    const { state, effects } = run(startFlow([pickOnly, food]), [{ type: 'pick', index: 1 }]);
    expect(state.phase).toBe('sentence');
    expect(state.written).toEqual([{ roundIdx: 0, words: ['빵'] }]);
    expect(answers(effects)).toEqual([]);
  });

  it('a two-slot pick-only frame moves from slot to slot', () => {
    const frame: FrameInput = { ...two, entry: 'pick' };
    const { state } = run(startFlow([frame]), [{ type: 'pick', index: 0 }]);
    expect(state).toMatchObject({ phase: 'pick', slotIdx: 1 });
  });
});

describe('frames, My page and the end of the step', () => {
  it('advances through the frames, then shows My page, then completes on Continue', () => {
    let { state } = run(startFlow([food, pickOnly]), [{ type: 'pick', index: 2 }, ...type('라면'), { type: 'done' }, { type: 'advance' }]);
    expect(state).toMatchObject({ roundIdx: 1, phase: 'pick', picks: [null], keys: [], missed: false, firstDone: false });
    ({ state } = run(state, [{ type: 'pick', index: 0 }, { type: 'advance' }]));
    expect(state.phase).toBe('myPage');
    expect(state.written.map((w) => w.words)).toEqual([['라면'], ['사과']]);
    const end = run(state, [{ type: 'continue' }, { type: 'continue' }, { type: 'skip' }]);
    expect(end.effects).toEqual([{ type: 'complete' }]);
    expect(end.state.done).toBe(true);
  });

  it('Skip completes once, at any point, and My page is not reached', () => {
    const { state, effects } = run(startFlow([food]), [{ type: 'pick', index: 0 }, { type: 'skip' }, { type: 'skip' }, { type: 'advance' }]);
    expect(effects).toEqual([{ type: 'complete' }]);
    expect(state.phase).not.toBe('myPage');
  });
});

describe('the name round (Write Your Name q3: free entry, unscored)', () => {
  it('takes keys and tiles into the same field; Done needs whole syllables', () => {
    let { state } = run(startFlow([name]), [{ type: 'key', jamo: 'ㅎ' }]);
    expect(nameReady('ㅎ')).toBe(false);
    expect(stepFlow(state, { type: 'done' }).state).toBe(state);
    ({ state } = run(state, [{ type: 'key', jamo: 'ㅗ' }, { type: 'tile', keys: ['ㅇ', 'ㅑ'] }]));
    const done = run(state, [{ type: 'done' }]);
    expect(done.state.phase).toBe('sentence');
    expect(done.state.written).toEqual([{ roundIdx: 0, words: ['호야'] }]);
    expect(answers(done.effects)).toEqual([]);
    expect(done.effects).toContainEqual({ type: 'schedule-advance', ms: SENTENCE_PAUSE_MS });
  });

  it('a lone vowel or consonant keeps Done off; a whole syllable after Del turns it on', () => {
    expect(nameReady('ㅏ')).toBe(false);
    expect(nameReady('')).toBe(false);
    expect(nameReady('마리아 김')).toBe(true);
    let { state } = run(startFlow([name]), [{ type: 'tile', keys: ['ㅁ', 'ㅏ'] }, { type: 'tile', keys: ['ㄴ'] }, { type: 'tile', keys: ['ㄹ'] }]);
    expect(stepFlow(state, { type: 'done' }).state).toBe(state);
    ({ state } = run(state, [{ type: 'delete' }, { type: 'done' }]));
    expect(state.written).toEqual([{ roundIdx: 0, words: ['만'] }]);
  });

  it('stops at eight blocks and says so; Del clears the line', () => {
    let { state } = run(startFlow([name]), Array.from({ length: MAX_NAME_BLOCKS }, () => ({ type: 'tile', keys: ['ㄴ', 'ㅏ'] }) as const));
    expect(blockCount('나나나나나나나나')).toBe(MAX_NAME_BLOCKS);
    expect(state.atLongest).toBe(false);
    ({ state } = run(state, [{ type: 'tile', keys: ['ㄴ', 'ㅏ'] }]));
    expect(state.atLongest).toBe(true);
    expect(blockCount(state.keys.join(''))).toBe(MAX_NAME_BLOCKS * 2);
    ({ state } = run(state, [{ type: 'delete' }]));
    expect(state.atLongest).toBe(false);
  });

  it('has no Change word; the preview opens on the cast name', () => {
    const s0 = startFlow([name], keysFor('호야'));
    expect(stepFlow(s0, { type: 'change-word' }).state).toBe(s0);
    expect(run(s0, [{ type: 'done' }]).state.written).toEqual([{ roundIdx: 0, words: ['호야'] }]);
  });
});

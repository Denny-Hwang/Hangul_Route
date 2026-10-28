import type { MatchShapeRound } from '@hangul-route/content-schema';
import { describe, expect, it } from 'vitest';
import { copiesOf, shapeHoyaLine, startShape, stepShape, type ShapeEffect, type ShapeEvent, type ShapeState } from '../flow';

/** F-CURR-002 section 7.1 F4, row CM-33 (match-shape.md, Interaction points and Scoring): the round reducer. */

const ORIGIN: MatchShapeRound = {
  id: 'ms:origin:nieun',
  shape: 'origin',
  target: 'jamo:nieun',
  options: ['jamo:giyeok', 'jamo:nieun', 'jamo:mieum'],
  picture: 'prop:shape-origin-nieun',
  noteEn: 'The tongue touches the upper gum.',
  fact: 'nieun',
};
const PAIR: MatchShapeRound = { id: 'ms:pair:bieup', shape: 'pair', target: 'jamo:bieup', lookAlike: 'jamo:pieup', layout: 'tlltlt', diffNoteEn: 'x' };

function run(round: MatchShapeRound, events: ShapeEvent[]): { state: ShapeState; effects: ShapeEffect[][] } {
  let state = startShape(round);
  const effects: ShapeEffect[][] = [];
  for (const e of events) {
    const next = stepShape(state, e, round);
    state = next.state;
    effects.push(next.effects);
  }
  return { state, effects };
}
const answers = (effects: ShapeEffect[][]): boolean[] => effects.flat().flatMap((e) => (e.type === 'answer' ? [e.correct] : []));

describe('an origin round', () => {
  it('a right first tap is the right answer, says the sound and waits for Continue (no timer)', () => {
    const { state, effects } = run(ORIGIN, [{ type: 'tap', id: 'jamo:nieun' }]);
    expect(state).toMatchObject({ status: 'found', scored: true });
    expect(effects[0]).toEqual([{ type: 'answer', correct: true }, { type: 'haptic', kind: 'success' }, { type: 'play' }]);
    expect(effects.flat().some((e) => e.type === 'solved')).toBe(false);
    const next = stepShape(state, { type: 'continue' }, ORIGIN);
    expect(next.effects).toEqual([{ type: 'solved' }]);
    expect(shapeHoyaLine(state)).toBe('found');
  });

  it('a wrong tile is locked with the nudge; the first tap is the scored one; the second miss rings the letter', () => {
    const { state, effects } = run(ORIGIN, [
      { type: 'tap', id: 'jamo:giyeok' },
      { type: 'tap', id: 'jamo:giyeok' },
      { type: 'tap', id: 'jamo:mieum' },
      { type: 'tap', id: 'jamo:nieun' },
    ]);
    expect(answers(effects)).toEqual([false]);
    expect(effects[0]).toEqual([{ type: 'answer', correct: false }, { type: 'haptic', kind: 'nudge' }]);
    expect(effects[1]).toEqual([]);
    expect(effects[2]).toEqual([{ type: 'haptic', kind: 'nudge' }]);
    expect(state).toMatchObject({ status: 'found', wrong: ['jamo:giyeok', 'jamo:mieum'], ring: false });
    const ringed = run(ORIGIN, [
      { type: 'tap', id: 'jamo:giyeok' },
      { type: 'tap', id: 'jamo:mieum' },
    ]).state;
    expect(ringed).toMatchObject({ ring: true, status: 'asking' });
    expect(shapeHoyaLine(ringed)).toBe('missOrigin');
  });

  it('ignores a tile that is no option, a tap once found, Continue and the sources before the letter is found', () => {
    expect(run(ORIGIN, [{ type: 'tap', id: 'jamo:siot' }]).effects).toEqual([[]]);
    expect(run(ORIGIN, [{ type: 'continue' }, { type: 'sources' }, { type: 'tap-tile', index: 0 }]).effects).toEqual([[], [], []]);
    const found = run(ORIGIN, [{ type: 'tap', id: 'jamo:nieun' }, { type: 'tap', id: 'jamo:giyeok' }]);
    expect(found.effects[1]).toEqual([]);
    expect(shapeHoyaLine(startShape(ORIGIN))).toBeNull();
  });

  it('Where this comes from opens and folds the sources in place, once the letter is found', () => {
    const { state } = run(ORIGIN, [{ type: 'tap', id: 'jamo:nieun' }, { type: 'sources' }]);
    expect(state).toMatchObject({ sourcesOpen: true });
    expect(stepShape(state, { type: 'sources' }, ORIGIN).state).toMatchObject({ sourcesOpen: false });
  });
});

describe('a pair round', () => {
  it('names the copies of the target in its layout', () => {
    expect(copiesOf('tlltlt')).toEqual([0, 3, 5]);
  });

  it('every copy found before any look-alike is right first try; the round then advances by itself', () => {
    const { state, effects } = run(PAIR, [
      { type: 'tap-tile', index: 0 },
      { type: 'tap-tile', index: 0 },
      { type: 'tap-tile', index: 3 },
      { type: 'tap-tile', index: 5 },
    ]);
    expect(effects[0]).toEqual([{ type: 'haptic', kind: 'success' }]);
    expect(effects[1]).toEqual([]);
    expect(effects[3]).toEqual([{ type: 'answer', correct: true }, { type: 'haptic', kind: 'success' }, { type: 'play' }, { type: 'solved' }]);
    expect(state).toMatchObject({ status: 'found', found: [0, 3, 5] });
    expect(shapeHoyaLine(state)).toBe('found');
  });

  it('the first look-alike tap is the missed answer; later taps are retries; a second miss rings the copies left', () => {
    const { state, effects } = run(PAIR, [
      { type: 'tap-tile', index: 0 },
      { type: 'tap-tile', index: 1 },
      { type: 'tap-tile', index: 1 },
      { type: 'tap-tile', index: 2 },
    ]);
    expect(answers(effects)).toEqual([false]);
    expect(state).toMatchObject({ wrong: [1, 2], ring: true, status: 'asking' });
    expect(shapeHoyaLine(state)).toBe('missPair');
    const done = [3, 5].reduce((s, index) => stepShape(s, { type: 'tap-tile', index }, PAIR).state, state);
    expect(done).toMatchObject({ status: 'found', ring: false });
    const last = stepShape(stepShape(state, { type: 'tap-tile', index: 3 }, PAIR).state, { type: 'tap-tile', index: 5 }, PAIR);
    expect(last.effects).toEqual([{ type: 'haptic', kind: 'success' }, { type: 'play' }, { type: 'solved' }]);
  });

  it('ignores taps once found, a tile outside the layout and the origin events', () => {
    const found = run(PAIR, [0, 3, 5].map((index) => ({ type: 'tap-tile' as const, index }))).state;
    expect(stepShape(found, { type: 'tap-tile', index: 1 }, PAIR).effects).toEqual([]);
    expect(run(PAIR, [{ type: 'tap-tile', index: 9 }, { type: 'tap', id: 'jamo:bieup' }, { type: 'continue' }]).effects).toEqual([[], [], []]);
  });

  it('a state of the other shape does nothing', () => {
    expect(stepShape(startShape(ORIGIN), { type: 'tap-tile', index: 0 }, PAIR).effects).toEqual([]);
  });
});

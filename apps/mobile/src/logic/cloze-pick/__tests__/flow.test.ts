import { describe, expect, it } from 'vitest';
import { LISTEN_PICK_TIMING } from '../../listen-pick-flow';
import { CLOZE_ADVANCE_MS, startCloze, stepCloze, type ClozeEvent, type ClozeFlowState } from '../flow';

const tap = (optionId: string, at: number): ClozeEvent => ({ type: 'tap', optionId, answerId: 'right', at });
const run = (state: ClozeFlowState, ...events: ClozeEvent[]) => events.reduce((acc, e) => stepCloze(acc.state, e), { state, effects: [] as ReturnType<typeof stepCloze>['effects'] });

describe('Cloze Pick flow', () => {
  it('starts on round 1, asking, or empty with no round', () => {
    expect(startCloze(2)).toMatchObject({ status: 'asking', roundIdx: 0, total: 2, hint: false });
    expect(startCloze(0).status).toBe('empty');
    expect(startCloze(1, true).hint).toBe(true);
    expect(stepCloze(startCloze(0), tap('right', 0)).effects).toEqual([]);
  });

  it('the right tile scores, says the completed sentence once and schedules the next round', () => {
    const out = stepCloze(startCloze(2), tap('right', 100));
    expect(out.state.status).toBe('resolved');
    expect(out.effects).toEqual([
      { type: 'answer', roundKey: 0, correct: true },
      { type: 'haptic', kind: 'success' },
      { type: 'say' },
      { type: 'schedule-advance', ms: CLOZE_ADVANCE_MS },
    ]);
    expect(CLOZE_ADVANCE_MS).toBe(LISTEN_PICK_TIMING.advanceDelayMs);
  });

  it('a tile that does not fit nudges and locks; nothing is said (it would answer the round)', () => {
    const out = stepCloze(startCloze(1), tap('w1', 100));
    expect(out.state).toMatchObject({ status: 'asking', wrongIds: ['w1'], hint: false });
    expect(out.effects).toEqual([
      { type: 'answer', roundKey: 0, correct: false },
      { type: 'haptic', kind: 'nudge' },
    ]);
    // The same locked tile again does nothing.
    expect(stepCloze(out.state, tap('w1', 500)).effects).toEqual([]);
  });

  it('the second miss rings the tile that fits', () => {
    const out = run(startCloze(1), tap('w1', 100), tap('w2', 400));
    expect(out.state.hint).toBe(true);
    expect(out.state.wrongIds).toEqual(['w1', 'w2']);
  });

  it('only the first touch in the 50 ms window counts', () => {
    const first = stepCloze(startCloze(1), tap('w1', 100));
    expect(stepCloze(first.state, tap('right', 100 + LISTEN_PICK_TIMING.touchWindowMs - 1)).effects).toEqual([]);
  });

  it('Hear it says the sentence only after the right tile', () => {
    expect(stepCloze(startCloze(1), { type: 'hear' }).effects).toEqual([]);
    const found = stepCloze(startCloze(1), tap('right', 100)).state;
    expect(stepCloze(found, { type: 'hear' })).toEqual({ state: found, effects: [{ type: 'say' }] });
  });

  it('advances to the next round with no sound, and completes after the last', () => {
    const next = run(startCloze(2), tap('right', 100), { type: 'advance' });
    expect(next.state).toMatchObject({ status: 'asking', roundIdx: 1, wrongIds: [], hint: false });
    expect(next.effects).toEqual([]);
    const done = run(next.state, tap('right', 900), { type: 'advance' });
    expect(done.state.status).toBe('done');
    expect(done.effects).toEqual([{ type: 'complete' }]);
    // Advancing while asking does nothing.
    expect(stepCloze(startCloze(1), { type: 'advance' }).effects).toEqual([]);
  });
});

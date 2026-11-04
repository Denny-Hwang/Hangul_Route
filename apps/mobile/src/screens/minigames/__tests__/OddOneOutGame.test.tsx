import type { ReactTestInstance, ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useQuestRunStore } from '../../../store/quest-run-store';
import { byTestId, press, render, unmount } from '../../../test-support/render';
import { OddOneOutGame } from '../OddOneOutGame';

/**
 * Odd One Out on its answer board (AMENDMENTS-TOUCH section 6, row KT-3, R3): a locked wrong tile is disabled, keeps
 * its amber look, and a tap or a bounce on it is never another `answerRound(false)` or nudge.
 */

(globalThis as { __DEV__?: boolean }).__DEV__ = false;

const haptics = vi.hoisted(() => ({ nudge: vi.fn(), success: vi.fn(), tapLight: vi.fn() }));
vi.mock('../../../platform/haptics', async (importOriginal) => ({ ...(await importOriginal<object>()), ...haptics }));

// Three vowels and one consonant: the consonant is the odd one in every round.
const SCOPE = { kind: 'odd-one-out' as const, jamoIds: ['jamo:a', 'jamo:eo', 'jamo:o', 'jamo:giyeok'], rounds: 1 };
const mounted: ReactTestRenderer[] = [];
const answers: Array<[number, boolean]> = [];

beforeEach(() => {
  answers.length = 0;
  haptics.nudge.mockClear();
  useQuestRunStore.setState({ answerRound: (i: number, correct: boolean) => void answers.push([i, correct]), markStepComplete: () => undefined } as never);
});
afterEach(async () => {
  for (const r of mounted.splice(0)) await unmount(r);
});

const host = (root: ReactTestInstance, id: string): ReactTestInstance[] => byTestId(root, `odd-one-out-tile-${id}`);
const pressable = (root: ReactTestInstance, id: string): ReactTestInstance | undefined => host(root, id).find((n) => typeof n.props.onClick === 'function');

describe('Odd One Out (AMENDMENTS-TOUCH row KT-3, R3)', () => {
  it('a miss locks that tile: disabled, and a tap and a bounce on it add no miss and no nudge', async () => {
    const r = await render(<OddOneOutGame scope={SCOPE} onFinish={() => undefined} />);
    mounted.push(r);
    expect(host(r.root, 'jamo:giyeok').length).toBeGreaterThan(0);
    await press(pressable(r.root, 'jamo:a')!);
    expect(answers).toEqual([[0, false]]);
    expect(haptics.nudge).toHaveBeenCalledTimes(1);
    expect(host(r.root, 'jamo:a').some((n) => n.props['aria-disabled'] === true)).toBe(true);
    const locked = pressable(r.root, 'jamo:a');
    if (locked) {
      await press(locked);
      await press(locked);
    }
    expect(answers).toEqual([[0, false]]);
    expect(haptics.nudge).toHaveBeenCalledTimes(1);
    // Another tile still answers.
    await press(pressable(r.root, 'jamo:giyeok')!);
    expect(answers).toEqual([
      [0, false],
      [0, true],
    ]);
  });
});

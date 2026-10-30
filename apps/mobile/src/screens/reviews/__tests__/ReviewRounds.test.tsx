import { LayoutProvider, layoutClassFor } from '@hangul-route/design-system';
import TestRenderer, { act, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { TypeRound } from '../../../logic/reviews/review-rounds';
import { byTestId, press, resetPlatform, textOf } from '../../../test-support/render';
import { getMessages } from '@hangul-route/i18n';
import { ROUND_WAITING_LINE_MS, RoundWaiting, TypeRoundView } from '../ReviewRounds';

/**
 * F-CURR-002 row CM-14 (review of #831): the Daily Review's Type Hangul round after a far miss. The field starts
 * empty and every key builds on the ones before, so a word of two or more letters can be typed again and the round
 * moves on once it is right; Hoya's bubble keeps the right answer in view while the learner types.
 */

// The picture art reads Metro's `__DEV__`, which the Node render lane does not define.
(globalThis as { __DEV__?: boolean }).__DEV__ = false;

const ROUND: TypeRound = {
  type: 'type',
  mode: 'see',
  target: '호야',
  question: { itemId: 'lex:hoya', kind: 'lex', rung: 'produce', format: 'type-see', theme: 'friends', stretch: false, voiceFallback: false },
  answer: { ko: { ko: '호야', romanization: 'hoya' }, gloss: 'Hoya' },
};

const mounted: ReactTestRenderer[] = [];

async function mount(onFirst: (a: unknown) => void, onSolved: () => void): Promise<ReactTestRenderer> {
  let r!: ReactTestRenderer;
  await act(async () => {
    r = TestRenderer.create(
      <LayoutProvider value={layoutClassFor({ width: 320, height: 568 })}>
        <TypeRoundView round={ROUND} reducedMotion onFirst={onFirst} onSolved={onSolved} grade={(target, typed) => (typed === target ? 'right' : 'miss')} />
      </LayoutProvider>,
      { createNodeMock: () => ({ focus: () => undefined, addEventListener: () => undefined, removeEventListener: () => undefined }) },
    );
  });
  mounted.push(r);
  return r;
}

const tap = async (root: ReactTestInstance, id: string): Promise<void> => {
  const node = byTestId(root, id).find((n) => typeof n.props.onClick === 'function');
  expect(node, id).toBeDefined();
  await press(node!);
};
const typeKeys = async (root: ReactTestInstance, jamo: string): Promise<void> => {
  for (const j of jamo) await tap(root, `hangul-key-${j}`);
};
const typedText = (root: ReactTestInstance): string => textOf(byTestId(root, 'daily-review-typed')[0]!);

afterEach(async () => {
  for (const r of mounted.splice(0)) {
    await act(async () => {
      r.unmount();
    });
  }
  vi.useRealTimers();
  resetPlatform();
});

describe('Daily Review: the Type Hangul round after a far miss', () => {
  it('builds a word of several letters again and moves on once it is right; only the first answer is scored', async () => {
    vi.useFakeTimers();
    const onFirst = vi.fn();
    const onSolved = vi.fn();
    const r = await mount(onFirst, onSolved);
    await typeKeys(r.root, 'ㄴㅏ');
    await tap(r.root, 'daily-review-type-done');
    expect(onFirst).toHaveBeenCalledWith({ correct: false });
    expect(byTestId(r.root, 'daily-review-miss').length).toBeGreaterThan(0);
    expect(typedText(r.root)).toBe('');

    await typeKeys(r.root, 'ㅎㅗㅇㅑ');
    expect(typedText(r.root)).toBe('호야');
    // Hoya keeps the right answer in view while the learner types.
    expect(byTestId(r.root, 'daily-review-miss').length).toBeGreaterThan(0);
    await tap(r.root, 'daily-review-type-done');
    await act(async () => {
      await vi.runOnlyPendingTimersAsync();
    });
    expect(onSolved).toHaveBeenCalledTimes(1);
    expect(onFirst).toHaveBeenCalledTimes(1);
  });

  it('a delete after a far miss takes back the last letter only', async () => {
    const r = await mount(vi.fn(), vi.fn());
    await typeKeys(r.root, 'ㄴㅏ');
    await tap(r.root, 'daily-review-type-done');
    await typeKeys(r.root, 'ㅎㅗㅇ');
    await tap(r.root, 'hangul-key-delete');
    expect(typedText(r.root)).toBe('호');
  });
});

describe('a Dictation round while its chunk loads (row CM-31 review)', () => {
  it('shows nothing at first, then the calm status line, in a polite live region', async () => {
    vi.useFakeTimers();
    let r!: ReactTestRenderer;
    await act(async () => {
      r = TestRenderer.create(<RoundWaiting />);
    });
    mounted.push(r);
    const region = byTestId(r.root, 'daily-review-round').find((n) => n.props['aria-live'] === 'polite');
    expect(region).toBeDefined();
    expect(byTestId(r.root, 'daily-review-round-waiting')).toHaveLength(0);
    await act(async () => {
      vi.advanceTimersByTime(ROUND_WAITING_LINE_MS);
    });
    expect(textOf(byTestId(r.root, 'daily-review-round-waiting')[0]!)).toBe(getMessages('en').learner.presenter.state.loading);
  });
});

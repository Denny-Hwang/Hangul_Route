import { touchTarget } from '@hangul-route/design-system';
import { act, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { MinigameScope } from '../../../logic/minigame-config';
import { byTestId, press, render, unmount } from '../../../test-support/render';
import { CardMatchGame } from '../CardMatchGame';

/**
 * AMENDMENTS-TOUCH 6.2 (row KT-4a, F3): Card Match through react-native-web. The wrong-flash timer only clears
 * the pick it was set for (a stale timer never un-selects the next pick); either side may be picked first, and
 * the round key stays the Korean card of the attempted pair; both columns are buttons at least `touchTarget.min`
 * tall; leaving the game clears the flash and the completion timers.
 */

(globalThis as { __DEV__?: boolean }).__DEV__ = false;

const audio = vi.hoisted(() => ({
  playPrompt: vi.fn((_spec: { text: string }) => Promise.resolve('played' as const)),
  stop: vi.fn(),
  hasClip: vi.fn(() => false),
}));
vi.mock('../../../platform/audio', async (importOriginal) => ({ ...(await importOriginal<object>()), ...audio }));
vi.mock('../../../platform/haptics', () => ({ success: vi.fn(), nudge: vi.fn(), tap: vi.fn() }));

const run = vi.hoisted(() => ({ answers: [] as Array<[string, boolean, unknown]>, completes: 0 }));
vi.mock('../../../store/quest-run-store', () => {
  const state = {
    answerRound: (key: string, correct: boolean, asked?: unknown) => void run.answers.push([key, correct, asked]),
    markStepComplete: () => {
      run.completes += 1;
    },
  };
  return { useQuestRunStore: Object.assign(<T,>(select: (s: typeof state) => T) => select(state), { getState: () => state }) };
});

/** The Playground Words pairs the owner played (content/episodes/stage-2 crafts, q1): geune, the slide, morae, gong. */
const PAIRS = [
  { ko: '그네', en: 'swing', romanization: 'geune' },
  { ko: '미끄럼틀', en: 'slide', romanization: 'mikkeureomteul' },
  { ko: '모래', en: 'sand', romanization: 'morae' },
  { ko: '공', en: 'ball', romanization: 'gong' },
];
const SCOPE = { kind: 'card-match', rounds: PAIRS.length, cardPairs: PAIRS } as unknown as MinigameScope;
const GEUNE = 0;
const MORAE = 2;

let finishes = 0;
const mounted: ReactTestRenderer[] = [];
async function play(): Promise<ReactTestRenderer> {
  const r = await render(<CardMatchGame scope={SCOPE} onFinish={() => void (finishes += 1)} />);
  mounted.push(r);
  return r;
}

/** The host button of a card (`ko` or `en`, by pair index). */
function card(r: ReactTestRenderer, side: 'ko' | 'en', idx: number): ReactTestInstance {
  const node = byTestId(r.root, `card-match-${side}-${idx}`).find((n) => n.props.role === 'button');
  expect(node, `${side}-${idx}`).toBeDefined();
  return node!;
}
const selected = (r: ReactTestRenderer, side: 'ko' | 'en', idx: number): boolean => card(r, side, idx).props['aria-selected'] === true;
const tap = (r: ReactTestRenderer, side: 'ko' | 'en', idx: number): Promise<void> => press(card(r, side, idx));
const wait = async (ms: number): Promise<void> => {
  await act(async () => {
    vi.advanceTimersByTime(ms);
  });
};

beforeEach(() => {
  vi.clearAllMocks();
  run.answers = [];
  run.completes = 0;
  finishes = 0;
  vi.useFakeTimers();
});
afterEach(async () => {
  for (const r of mounted.splice(0)) await unmount(r);
  vi.useRealTimers();
});

describe('Card Match: a stale wrong-flash timer (F3)', () => {
  it('does not un-select the next pick: geune, the wrong "sand", then morae 250 ms later stays selected past the flash', async () => {
    const r = await play();
    await tap(r, 'ko', GEUNE);
    await tap(r, 'en', MORAE);
    expect(run.answers.map(([key, correct]) => [key, correct])).toEqual([['pair-0', false]]);
    await wait(250);
    await tap(r, 'ko', MORAE);
    expect(selected(r, 'ko', MORAE)).toBe(true);
    await wait(700);
    expect(selected(r, 'ko', MORAE)).toBe(true);
    expect(selected(r, 'ko', GEUNE)).toBe(false);
    // The pick still makes its pair.
    await tap(r, 'en', MORAE);
    expect(run.answers.map(([key, correct]) => [key, correct])).toEqual([
      ['pair-0', false],
      ['pair-2', true],
    ]);
  });

  it('still lets go of the pick that missed when nothing else is tapped', async () => {
    const r = await play();
    await tap(r, 'ko', GEUNE);
    await tap(r, 'en', MORAE);
    expect(selected(r, 'ko', GEUNE)).toBe(true);
    await wait(600);
    expect(selected(r, 'ko', GEUNE)).toBe(false);
  });

  it('a bounce on the selected card keeps it selected', async () => {
    const r = await play();
    await tap(r, 'ko', GEUNE);
    await wait(120);
    await tap(r, 'ko', GEUNE);
    expect(selected(r, 'ko', GEUNE)).toBe(true);
    expect(run.answers).toEqual([]);
  });

  it('a second wrong pair inside the flash gets its own full flash', async () => {
    const r = await play();
    await tap(r, 'ko', GEUNE);
    await tap(r, 'en', MORAE);
    await wait(400);
    await tap(r, 'ko', MORAE);
    await tap(r, 'en', GEUNE);
    // 400 ms on, the first timer would have fired; the second pick is still the one that missed and stays selected.
    await wait(400);
    expect(selected(r, 'ko', MORAE)).toBe(true);
    await wait(200);
    expect(selected(r, 'ko', MORAE)).toBe(false);
  });
});

describe('Card Match: taps during the wrong flash (review #934)', () => {
  it('a bounce on the amber card of a miss is not a second miss', async () => {
    const r = await play();
    await tap(r, 'ko', GEUNE);
    await tap(r, 'en', MORAE);
    await wait(120);
    await tap(r, 'en', MORAE);
    expect(run.answers.map(([key, correct]) => [key, correct])).toEqual([['pair-0', false]]);
    expect(selected(r, 'en', MORAE)).toBe(false);
    expect(selected(r, 'ko', GEUNE)).toBe(true);
  });

  it('a bounce on the amber Korean card (meaning first) is not a second miss and does not replay the word', async () => {
    const r = await play();
    await tap(r, 'en', MORAE);
    await tap(r, 'ko', GEUNE);
    expect(audio.playPrompt).toHaveBeenCalledTimes(1);
    await wait(120);
    await tap(r, 'ko', GEUNE);
    expect(run.answers.map(([key, correct]) => [key, correct])).toEqual([['pair-0', false]]);
    expect(audio.playPrompt).toHaveBeenCalledTimes(1);
  });

  it('the amber card counts again once the flash is over', async () => {
    const r = await play();
    await tap(r, 'ko', GEUNE);
    await tap(r, 'en', MORAE);
    await wait(600);
    await tap(r, 'ko', GEUNE);
    await tap(r, 'en', MORAE);
    expect(run.answers.map(([key, correct]) => [key, correct])).toEqual([
      ['pair-0', false],
      ['pair-0', false],
    ]);
  });

  it('re-tapping the pick that missed during the flash keeps it selected after the flash, ready to pair', async () => {
    const r = await play();
    await tap(r, 'ko', GEUNE);
    await tap(r, 'en', MORAE);
    await wait(300);
    await tap(r, 'ko', GEUNE);
    await wait(400);
    expect(selected(r, 'ko', GEUNE)).toBe(true);
    await tap(r, 'en', GEUNE);
    expect(run.answers.map(([key, correct]) => [key, correct])).toEqual([
      ['pair-0', false],
      ['pair-0', true],
    ]);
  });
});

describe('Card Match: either side first', () => {
  it('a meaning tapped first is selected, and the Korean card then makes the pair under the Korean key', async () => {
    const r = await play();
    await tap(r, 'en', GEUNE);
    expect(selected(r, 'en', GEUNE)).toBe(true);
    await tap(r, 'ko', GEUNE);
    expect(run.answers).toEqual([['pair-0', true, { texts: ['그네'], rung: 'read' }]]);
    expect(card(r, 'ko', GEUNE).props['aria-disabled']).toBe(true);
    // The Korean card is said when it is tapped, whichever side came first.
    expect(audio.playPrompt).toHaveBeenCalledTimes(1);
  });

  it('a wrong pair started from the meaning scores the Korean card that was tapped', async () => {
    const r = await play();
    await tap(r, 'en', MORAE);
    await tap(r, 'ko', GEUNE);
    expect(run.answers.map(([key, correct]) => [key, correct])).toEqual([['pair-0', false]]);
  });

  it('a second meaning moves the selection; no pair is attempted on the same side', async () => {
    const r = await play();
    await tap(r, 'en', GEUNE);
    await tap(r, 'en', MORAE);
    expect(selected(r, 'en', GEUNE)).toBe(false);
    expect(selected(r, 'en', MORAE)).toBe(true);
    expect(run.answers).toEqual([]);
  });
});

describe('Card Match: targets and timers', () => {
  it('every card is a button at least touchTarget.min tall', async () => {
    const r = await play();
    for (const side of ['ko', 'en'] as const) {
      for (let i = 0; i < PAIRS.length; i += 1) {
        const node = card(r, side, i);
        // react-native-web writes the style as CSS: "64px".
        const minHeight = Number.parseFloat(String((node.props.style as { minHeight?: string } | undefined)?.minHeight));
        expect(minHeight, `${side}-${i}`).toBeGreaterThanOrEqual(touchTarget.min);
      }
    }
  });

  it('finishes 800 ms after the last pair, once', async () => {
    const r = await play();
    for (let i = 0; i < PAIRS.length; i += 1) {
      await tap(r, 'ko', i);
      await tap(r, 'en', i);
    }
    await wait(799);
    expect(finishes).toBe(0);
    await wait(1);
    expect([finishes, run.completes]).toEqual([1, 1]);
  });

  it('leaving before the end clears the completion and flash timers', async () => {
    const r = await play();
    for (let i = 0; i < PAIRS.length; i += 1) {
      await tap(r, 'ko', i);
      await tap(r, 'en', i);
    }
    await unmount(r);
    await wait(2000);
    expect([finishes, run.completes]).toEqual([0, 0]);

    const r2 = await play();
    await tap(r2, 'ko', GEUNE);
    await tap(r2, 'en', MORAE);
    await unmount(r2);
    expect(vi.getTimerCount()).toBe(0);
  });
});

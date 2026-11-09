import { LayoutProvider, layoutClassFor } from '@hangul-route/design-system';
import { act } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PlannedSession } from '../../../logic/reviews/daily-review';
import type { PickRound } from '../../../logic/reviews/review-rounds';
import { resetRemoteConfigForTests } from '../../../store/remote-config-store';
import { endVoiceCheckHold } from '../../../store/audio-store';
import { byTestId, cleanup, press, render, resetPlatform, screenTexts } from '../../../test-support/render';

/**
 * The Daily Review when the review store rejects: a session that cannot be written at the end, or planned at the start,
 * goes to the calm "Nothing is waiting right now" page with Back home (as the Stage Check does), never to a loading
 * frame with no way on (a lesson-chunk-style dead end: the learner could only press the close mark).
 */
(globalThis as { __DEV__?: boolean }).__DEV__ = false;

vi.mock('@react-navigation/native', () => ({ CommonActions: { reset: (state: unknown) => ({ type: 'RESET', payload: state }) } }));
const api = vi.hoisted(() => ({ finishFails: false, startFails: false, finished: 0 }));
vi.mock('../../../logic/memory/boot', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  memoryChunk: async () => ({
    dailyReviewApi: () => ({
      readWorld: async () => ({ kind: 'ready', world: {} }),
      openingKind: () => 'daily',
      doneTodayOffer: () => 'empty',
      startSession: async () => {
        if (api.startFails) throw new Error('store unreadable');
        return plan();
      },
      recordRound: async () => undefined,
      noteStopped: () => undefined,
      finishSession: async () => {
        api.finished += 1;
        if (api.finishFails) throw new Error('store full');
        return { finished: { stars: 3, stronger: 1, after: 'empty' }, world: {} };
      },
      gradeTyped: () => 'miss',
    }),
  }),
}));
vi.mock('../../../platform/motion', () => ({ useReducedMotion: () => true }));

const { DailyReviewScreen } = await import('../DailyReviewScreen');

function plan(): PlannedSession {
  const id = 'lex:w0';
  const round = {
    type: 'pick',
    heard: false,
    ask: 'meaning',
    prompt: { ko: '산', romanization: 'san' },
    options: [
      { id, label: 'right 0' },
      { id: 'lex:other0', label: 'other 0' },
    ],
    answerId: id,
    question: { itemId: id, kind: 'lex', rung: 'read', format: 'read-pick', theme: 'nature', stretch: false, voiceFallback: false },
    answer: { ko: { ko: '산', romanization: 'san' }, gloss: 'right 0' },
  } as PickRound;
  return { kind: 'daily', rounds: [round], soundNotice: false };
}

const nav = () => ({ dispatch: () => undefined, goBack: () => undefined, canGoBack: () => true, addListener: () => () => undefined }) as never;
const settle = async (): Promise<void> => {
  await act(async () => {
    for (let i = 0; i < 8; i += 1) await Promise.resolve();
  });
};
const open = async () => {
  const r = await render(
    <LayoutProvider value={layoutClassFor({ width: 320, height: 640 })}>
      <DailyReviewScreen navigation={nav()} route={{ key: 'DailyReview', name: 'DailyReview' } as never} />
    </LayoutProvider>,
  );
  await settle();
  return r;
};

beforeEach(() => {
  endVoiceCheckHold();
  vi.useFakeTimers();
  resetRemoteConfigForTests();
  api.finishFails = false;
  api.startFails = false;
  api.finished = 0;
});
afterEach(async () => {
  await cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
  resetPlatform();
});

async function answerRight(r: Awaited<ReturnType<typeof open>>): Promise<void> {
  const option = byTestId(r.root, 'daily-review-option-lex:w0').find((n) => typeof n.props.onClick === 'function');
  expect(option).toBeDefined();
  await press(option!);
  await act(async () => {
    await vi.advanceTimersByTimeAsync(10_000);
  });
  await settle();
}

describe('Daily Review when the store rejects', () => {
  it('ends on the result as ever when the session is written', async () => {
    const r = await open();
    expect(byTestId(r.root, 'daily-review-screen')).toHaveLength(1);
    await answerRight(r);
    expect(api.finished).toBe(1);
    expect(byTestId(r.root, 'daily-review-result')).toHaveLength(1);
  });

  it('a session that cannot be written ends on the calm page with Back home, not on a loading frame', async () => {
    api.finishFails = true;
    const r = await open();
    await answerRight(r);
    expect(api.finished).toBe(1);
    expect(byTestId(r.root, 'daily-review-nothing')).toHaveLength(1);
    expect(byTestId(r.root, 'daily-review-back-home').length).toBeGreaterThan(0);
    expect(byTestId(r.root, 'daily-review-screen')).toHaveLength(0);
    expect(screenTexts(r.root).length).toBeGreaterThan(0);
  });

  it('a session that cannot be planned opens the calm page too', async () => {
    api.startFails = true;
    const r = await open();
    expect(byTestId(r.root, 'daily-review-nothing')).toHaveLength(1);
    expect(byTestId(r.root, 'daily-review-back-home').length).toBeGreaterThan(0);
  });
});

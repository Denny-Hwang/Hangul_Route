import { ConfirmSheet, LayoutProvider, layoutClassFor, type ConfirmSheetProps } from '@hangul-route/design-system';
import type { Profile } from '@hangul-route/content-schema';
import { getMessages } from '@hangul-route/i18n';
import { act, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PlannedSession } from '../../../logic/reviews/daily-review';
import type { PickRound } from '../../../logic/reviews/review-rounds';
import { useProfileStore } from '../../../store/profile-store';
import { useProgressStore } from '../../../store/progress-store';
import { resetRemoteConfigForTests } from '../../../store/remote-config-store';
import { endVoiceCheckHold } from '../../../store/audio-store';
import { buttonsNamed, byTestId, cleanup, press, render, resetPlatform, screenTexts, setPlatform } from '../../../test-support/render';

/**
 * The Daily Review when the review store rejects: a session that cannot be planned at the start goes to the calm
 * "Nothing is waiting right now" page with Back home, never to a loading frame with no way on. A session that cannot be
 * saved at the end (AMENDMENTS-QUEST-LEAVE-RESUME section 3.5, row LR-4, tests 24, 26 and 28) is the failed page: it
 * says so, Try again finishes the same plan on the same answers, and a back asks first over a true line.
 */
(globalThis as { __DEV__?: boolean }).__DEV__ = false;

vi.mock('@react-navigation/native', () => ({ CommonActions: { reset: (state: unknown) => ({ type: 'RESET', payload: state }) } }));
const api = vi.hoisted(() => ({
  /** How many finishes reject before one works; a rejected finish awaits the recordings first, as the real one does. */
  finishFails: 0,
  rounds: 1,
  startFails: false,
  finished: 0,
  /** Round indexes whose first recording rejects (each only the first time it is recorded). */
  recordFails: new Set<number>(),
  recordLog: [] as number[],
  stopped: 0,
  /** Holds the next finish until the test lets it go. */
  hold: null as null | Promise<void>,
  /** Holds each recording started after it is set until the test lets it go. */
  recordHold: null as null | Promise<void>,
}));
const reader = vi.hoisted(() => ({ announce: vi.fn(), focus: vi.fn() }));
vi.mock('../../../platform/screen-reader', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  announceForScreenReader: reader.announce,
  focusForScreenReader: reader.focus,
}));
vi.mock('../../../logic/memory/boot', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  memoryChunk: async () => ({
    dailyReviewApi: () => ({
      readWorld: async () => ({ kind: 'ready', world: {} }),
      openingKind: () => 'daily',
      doneTodayOffer: () => 'empty',
      startSession: async () => {
        if (api.startFails) throw new Error('store unreadable');
        return plan(api.rounds);
      },
      recordRound: async (_w: unknown, _p: unknown, index: number) => {
        api.recordLog.push(index);
        if (api.recordHold !== null) await api.recordHold;
        if (api.recordFails.delete(index)) throw new Error('store full');
      },
      noteStopped: () => void (api.stopped += 1),
      finishSession: async (_w: unknown, _p: unknown, _a: unknown, recorded: readonly Promise<void>[]) => {
        api.finished += 1;
        if (api.hold !== null) await api.hold;
        await Promise.all(recorded);
        if (api.finishFails > 0) {
          api.finishFails -= 1;
          throw new Error('store full');
        }
        return { finished: { stars: 3, stronger: 1, after: 'empty' }, world: {} };
      },
      gradeTyped: () => 'miss',
    }),
  }),
}));
vi.mock('../../../platform/motion', () => ({ useReducedMotion: () => true }));

const { DailyReviewScreen } = await import('../DailyReviewScreen');

const ID = 'profile:mina';
const learner: Profile = { id: ID, displayName: 'Mina', ageGroup: '8-9', avatar: 'hoya-orange', role: 'learner', createdAt: '2026-10-01T00:00:00.000Z', learnerType: 'child' };
const EN = getMessages('en');
const failedCopy = EN.learner.dailyReview.saveFailed;

function round(i: number): PickRound {
  const id = `lex:w${i}`;
  return {
    type: 'pick',
    heard: false,
    ask: 'meaning',
    prompt: { ko: '산', romanization: 'san' },
    options: [
      { id, label: `right ${i}` },
      { id: `lex:other${i}`, label: `other ${i}` },
    ],
    answerId: id,
    question: { itemId: id, kind: 'lex', rung: 'read', format: 'read-pick', theme: 'nature', stretch: false, voiceFallback: false },
    answer: { ko: { ko: '산', romanization: 'san' }, gloss: `right ${i}` },
  } as PickRound;
}
function plan(rounds = 1): PlannedSession {
  return { kind: 'daily', rounds: Array.from({ length: rounds }, (_, i) => round(i)), soundNotice: false };
}

const nav = () => ({ dispatch: () => undefined, goBack: () => undefined, canGoBack: () => true, addListener: () => () => undefined }) as never;
/** A navigation whose `beforeRemove` listeners the test can fire, as a back does. */
function guardedNav() {
  const listeners: Array<(e: { preventDefault: () => void }) => void> = [];
  const goBack = vi.fn();
  const navigation = {
    dispatch: () => undefined,
    goBack,
    canGoBack: () => true,
    addListener: (_type: string, fn: (e: { preventDefault: () => void }) => void) => {
      listeners.push(fn);
      return () => undefined;
    },
  } as never;
  /** A back: true when a guard held it. */
  const back = async (): Promise<boolean> => {
    let held = false;
    await act(async () => {
      for (const fn of listeners) fn({ preventDefault: () => void (held = true) });
    });
    return held;
  };
  return { navigation, goBack, back };
}
/** The stop sheet the screen holds: a Modal the Node renderer cannot show, so its element is read (as NextLessonCard.test.tsx). */
const sheetOf = (r: ReactTestRenderer): ConfirmSheetProps => r.root.findAllByType(ConfirmSheet)[0]!.props as ConfirmSheetProps;
const sheetOpen = (r: ReactTestRenderer): boolean => r.root.findAllByType(ConfirmSheet).some((n) => (n.props as ConfirmSheetProps).visible);
const settle = async (): Promise<void> => {
  await act(async () => {
    for (let i = 0; i < 8; i += 1) await Promise.resolve();
  });
};
const open = async (navigation: never = nav(), rounds = 1) => {
  api.rounds = rounds;
  const r = await render(
    <LayoutProvider value={layoutClassFor({ width: 320, height: 640 })}>
      <DailyReviewScreen navigation={navigation} route={{ key: 'DailyReview', name: 'DailyReview' } as never} />
    </LayoutProvider>,
  );
  await settle();
  return r;
};

beforeEach(() => {
  endVoiceCheckHold();
  vi.useFakeTimers();
  resetRemoteConfigForTests();
  api.finishFails = 0;
  api.rounds = 1;
  api.startFails = false;
  api.finished = 0;
  api.recordFails.clear();
  api.recordLog.length = 0;
  api.stopped = 0;
  api.hold = null;
  api.recordHold = null;
  reader.announce.mockReset();
  reader.focus.mockReset();
  useProfileStore.setState({ profiles: [learner], activeId: ID, hydrated: true });
  useProgressStore.setState({ saveRetryFailedFor: new Set(), loadFailedFor: new Set() });
});
afterEach(async () => {
  await cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
  resetPlatform();
});

async function answerRight(r: Awaited<ReturnType<typeof open>>, index = 0): Promise<void> {
  const option = byTestId(r.root, `daily-review-option-lex:w${index}`).find((n) => typeof n.props.onClick === 'function');
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

  it('a session that cannot be planned opens the calm page', async () => {
    api.startFails = true;
    const r = await open();
    expect(byTestId(r.root, 'daily-review-nothing')).toHaveLength(1);
    expect(byTestId(r.root, 'daily-review-back-home').length).toBeGreaterThan(0);
  });
});

describe('a finish that cannot be saved (LR-4, tests 24, 26, 28)', () => {
  const tryAgainButton = (r: Awaited<ReturnType<typeof open>>): ReactTestInstance => buttonsNamed(r.root, EN.common.buttons.tryAgain)[0] as ReactTestInstance;
  const flush = async (): Promise<void> => {
    await act(async () => {
      for (let i = 0; i < 12; i += 1) await Promise.resolve();
    });
  };

  it('shows the failed page, never "All refreshed today": the title has focus and Try again is the one way on', async () => {
    api.finishFails = 1;
    const r = await open();
    await answerRight(r);
    expect(api.finished).toBe(1);
    expect(byTestId(r.root, 'daily-review-save-failed')).toHaveLength(1);
    expect(byTestId(r.root, 'daily-review-nothing')).toHaveLength(0);
    expect(byTestId(r.root, 'daily-review-screen')).toHaveLength(0);
    const texts = screenTexts(r.root);
    expect(texts).toContain(failedCopy.title);
    expect(texts).toContain(failedCopy.body);
    expect(texts).not.toContain(EN.learner.dailyReview.allRefreshed.title);
    expect(texts).not.toContain(failedCopy.stillStuck);
    expect(reader.focus).toHaveBeenCalled();
    expect(tryAgainButton(r)).toBeDefined();
  });

  it('Try again finishes the same session: the result with its stars, as if the first save had worked', async () => {
    api.finishFails = 1;
    const r = await open();
    await answerRight(r);
    await press(tryAgainButton(r));
    await flush();
    expect(api.finished).toBe(2);
    expect(byTestId(r.root, 'daily-review-result')).toHaveLength(1);
    expect(byTestId(r.root, 'daily-review-save-failed')).toHaveLength(0);
    expect(byTestId(r.root, 'daily-review-stars')).toHaveLength(1);
  });

  it('records again only the round whose recording rejected, by round index, then finishes', async () => {
    api.recordFails.add(1);
    const r = await open(nav(), 3);
    await answerRight(r, 0);
    await answerRight(r, 1);
    await answerRight(r, 2);
    expect(api.recordLog).toEqual([0, 1, 2]);
    expect(byTestId(r.root, 'daily-review-save-failed')).toHaveLength(1);
    await press(tryAgainButton(r));
    await flush();
    expect(api.recordLog).toEqual([0, 1, 2, 1]);
    expect(byTestId(r.root, 'daily-review-result')).toHaveLength(1);
  });

  it('Try again is busy while it runs and a second press is not a second try', async () => {
    api.finishFails = 1;
    const r = await open();
    await answerRight(r);
    let release!: () => void;
    api.hold = new Promise<void>((resolve) => (release = resolve));
    await press(tryAgainButton(r));
    expect(byTestId(r.root, 'daily-review-save-failed-body')[0]?.props['aria-busy']).toBe(true);
    await press(tryAgainButton(r));
    await flush();
    expect(api.finished).toBe(2);
    release();
    await flush();
    expect(byTestId(r.root, 'daily-review-result')).toHaveLength(1);
    expect(api.finished).toBe(2);
  });

  it('a try that fails again announces the title, and the still-stuck line shows after 3 tries in a row', async () => {
    setPlatform('ios');
    api.finishFails = 5;
    const r = await open();
    await answerRight(r);
    const stuck = (): string[] => screenTexts(byTestId(r.root, 'daily-review-save-failed-still-stuck')[0] as ReactTestInstance);
    for (let i = 0; i < 2; i += 1) {
      await press(tryAgainButton(r));
      await flush();
      expect(stuck()).toEqual([]);
    }
    await press(tryAgainButton(r));
    await flush();
    expect(stuck()).toEqual([failedCopy.stillStuck]);
    expect(reader.announce.mock.calls.map((c) => c[0])).toEqual([failedCopy.title, failedCopy.title, `${failedCopy.title} ${failedCopy.stillStuck}`]);
    expect(byTestId(r.root, 'daily-review-save-failed')).toHaveLength(1);
  });

  it('a back asks first, with the stay button first and a true body; Back to it keeps the page; Stop leaves and writes no entry', async () => {
    api.finishFails = 1;
    const { navigation, goBack, back } = guardedNav();
    const r = await open(navigation);
    await answerRight(r);
    expect(sheetOpen(r)).toBe(false);
    expect(await back()).toBe(true);
    expect(sheetOpen(r)).toBe(true);
    expect(sheetOf(r)).toMatchObject({
      testID: 'daily-review-leave',
      title: EN.learner.dailyReview.leave.title,
      message: failedCopy.leaveBody,
      cancelLabel: EN.learner.dailyReview.leave.stay.cta,
      confirmLabel: EN.learner.dailyReview.leave.stop.cta,
    });
    expect(failedCopy.leaveBody).toBe('This is not saved yet. Your stars and cards stay.');
    await act(async () => sheetOf(r).onCancel());
    expect(sheetOpen(r)).toBe(false);
    expect(byTestId(r.root, 'daily-review-save-failed')).toHaveLength(1);
    expect(goBack).not.toHaveBeenCalled();
    expect(await back()).toBe(true);
    expect(sheetOpen(r)).toBe(true);
    await act(async () => sheetOf(r).onConfirm());
    expect(goBack).toHaveBeenCalledTimes(1);
    expect(api.stopped).toBe(1);
    expect(api.finished).toBe(1);
  });

  // Stop while a Try again is running: it writes nothing more, and the day's 20 are counted once.
  it('Stop while a retry is still recording again: no result page, no further finish, the answered items counted once', async () => {
    api.recordFails.add(0);
    const { navigation, goBack, back } = guardedNav();
    const r = await open(navigation);
    await answerRight(r);
    expect(api.finished).toBe(1);
    let release!: () => void;
    api.recordHold = new Promise<void>((resolve) => (release = resolve));
    await press(tryAgainButton(r));
    expect(await back()).toBe(true);
    await act(async () => sheetOf(r).onConfirm());
    expect(goBack).toHaveBeenCalledTimes(1);
    expect(api.stopped).toBe(1);
    release();
    await flush();
    expect(api.finished).toBe(1);
    expect(byTestId(r.root, 'daily-review-result')).toHaveLength(0);
  });

  it('Stop while a retry\'s finish is in flight: its result is not shown, and noteStopped is skipped (the entry counts them)', async () => {
    api.finishFails = 1;
    const { navigation, goBack, back } = guardedNav();
    const r = await open(navigation);
    await answerRight(r);
    let release!: () => void;
    api.hold = new Promise<void>((resolve) => (release = resolve));
    await press(tryAgainButton(r));
    expect(api.finished).toBe(2);
    expect(await back()).toBe(true);
    await act(async () => sheetOf(r).onConfirm());
    expect(goBack).toHaveBeenCalledTimes(1);
    expect(api.stopped).toBe(0);
    release();
    await flush();
    expect(api.finished).toBe(2);
    expect(byTestId(r.root, 'daily-review-result')).toHaveLength(0);
  });

  it('during a round the stop sheet keeps its own line, and a back asks as ever', async () => {
    const { navigation, back } = guardedNav();
    const r = await open(navigation);
    expect(await back()).toBe(true);
    expect(sheetOpen(r)).toBe(true);
    expect(sheetOf(r).message).toBe(EN.learner.dailyReview.leave.body);
  });

  it('once the result shows, a back leaves without asking', async () => {
    const { navigation, back } = guardedNav();
    const r = await open(navigation);
    await answerRight(r);
    expect(byTestId(r.root, 'daily-review-result')).toHaveLength(1);
    expect(await back()).toBe(false);
    expect(sheetOpen(r)).toBe(false);
  });

  it('the result shows the save-later line only while the learner is in saveRetryFailedFor or loadFailedFor (OD-LR8)', async () => {
    const r = await open();
    await answerRight(r);
    expect(byTestId(r.root, 'daily-review-result')).toHaveLength(1);
    expect(byTestId(r.root, 'daily-review-save-later')).toHaveLength(0);
    await cleanup();
    for (const key of ['saveRetryFailedFor', 'loadFailedFor'] as const) {
      useProgressStore.setState({ saveRetryFailedFor: new Set(), loadFailedFor: new Set(), [key]: new Set([ID]) });
      const again = await open();
      await answerRight(again);
      const line = byTestId(again.root, 'daily-review-save-later');
      expect(line).toHaveLength(1);
      expect(screenTexts(line[0] as ReactTestInstance)).toEqual([EN.learner.results.saveLater]);
      await cleanup();
    }
  });
});

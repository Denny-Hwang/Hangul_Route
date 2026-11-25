import { ConfirmSheet, LayoutProvider, layoutClassFor, type ConfirmSheetProps } from '@hangul-route/design-system';
import type { Profile } from '@hangul-route/content-schema';
import { getMessages } from '@hangul-route/i18n';
import { act, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useProfileStore } from '../../../store/profile-store';
import { useProgressStore } from '../../../store/progress-store';
import { resetRemoteConfigForTests } from '../../../store/remote-config-store';
import { buttonsNamed, byTestId, cleanup, press, render, resetPlatform, screenTexts, setPlatform } from '../../../test-support/render';

/**
 * The Stage Check when its finish cannot be saved (AMENDMENTS-QUEST-LEAVE-RESUME section 3.5, row LR-4, tests 25, 26 and
 * 28): the failed page, never "This check is not open yet"; Try again on the same answers, recording again only the
 * rounds whose recording rejected; a finish that answers null (the check closed meanwhile) keeps its calm page; a back
 * asks first with a true line.
 */

(globalThis as { __DEV__?: boolean }).__DEV__ = false;

vi.mock('@react-navigation/native', () => ({ CommonActions: { reset: (state: unknown) => ({ type: 'RESET', payload: state }) } }));
vi.mock('../../../platform/motion', () => ({ useReducedMotion: () => true }));
vi.mock('../use-stage-offer', async (importOriginal) => ({ ...(await importOriginal<object>()), useStageOffer: () => ({ complete: true, open: true }) }));
const api = vi.hoisted(() => ({
  /** How many finishes reject before one works; a rejected finish awaits the recordings first, as the real one does. */
  finishFails: 0,
  /** The next finish answers null (switched off or the stage closed meanwhile). */
  finishNull: false,
  finished: 0,
  rounds: 2,
  recordFails: new Set<number>(),
  /** Holds each recording started after it is set, and the next finish, until the test lets them go. */
  recordHold: null as null | Promise<void>,
  finishHold: null as null | Promise<void>,
  recordLog: [] as number[],
}));
const reader = vi.hoisted(() => ({ announce: vi.fn(), focus: vi.fn() }));
vi.mock('../../../platform/screen-reader', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  announceForScreenReader: reader.announce,
  focusForScreenReader: reader.focus,
}));
const ROUND = {
  type: 'pick',
  heard: false,
  ask: 'meaning',
  prompt: { ko: '산', romanization: 'san' },
  options: [{ id: 'lex:w0', label: 'a' }, { id: 'lex:w1', label: 'b' }],
  answerId: 'lex:w0',
  question: { itemId: 'lex:w0', kind: 'lex', rung: 'read', format: 'read-pick', theme: 'nature', stretch: false, voiceFallback: false },
  answer: { ko: { ko: '산', romanization: 'san' }, gloss: 'mountain' },
};
vi.mock('../../reviews/DailyReviewRoute', async () => {
  const { createElement } = await import('react');
  const { SaveFailedPage } = await import('../../reviews/SaveFailedPage');
  return {
    dailyReviewChunk: async () => ({
      TopRow: () => createElement('div', { 'data-testid': 'top-row' }),
      DisplayHeadline: ({ children, testID }: { children?: unknown; testID?: string }) => createElement('div', { 'data-testid': testID }, children as never),
      // One tap answers the round and solves it, as a round that ends.
      RoundView: ({ onFirst, onSolved }: { onFirst: (a: { correct: boolean }) => void; onSolved: () => void }) =>
        createElement('button', { 'data-testid': 'round-stub', role: 'button', onClick: () => (onFirst({ correct: true }), onSolved()) }, 'answer'),
      SaveFailedPage,
    }),
  };
});
vi.mock('../../../logic/memory/boot', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  memoryChunk: async () => ({
    stageCheckApi: () => ({
      readWorld: async () => ({ kind: 'ready', world: {} }),
      startSession: async () => ({ stage: 'stage2', rounds: Array.from({ length: api.rounds }, () => ROUND), soundNotice: false }),
      begin: () => undefined,
      // [LR] Row LR-3b: nothing is stored here (the resume tests are in stage-check-resume.test.tsx).
      resumeSession: async () => ({ kind: 'none' }),
      savedRun: () => ({ v: 1, kind: 'stage' }),
      recordRound: async (_w: unknown, _p: unknown, index: number) => {
        api.recordLog.push(index);
        if (api.recordHold !== null) await api.recordHold;
        if (api.recordFails.delete(index)) throw new Error('store full');
      },
      finishSession: async (_w: unknown, _p: unknown, _a: unknown, recorded: readonly Promise<void>[]) => {
        api.finished += 1;
        if (api.finishHold !== null) await api.finishHold;
        await Promise.all(recorded);
        if (api.finishFails > 0) {
          api.finishFails -= 1;
          throw new Error('store full');
        }
        return api.finishNull ? null : { stars: 3, passed: true, missed: false };
      },
      gradeTyped: () => 'miss',
    }),
  }),
}));

const { StageCheckScreen } = await import('../StageCheckScreen');

const ID = 'profile:mina';
const learner: Profile = { id: ID, displayName: 'Mina', ageGroup: '8-9', avatar: 'hoya-orange', role: 'learner', createdAt: '2026-10-01T00:00:00.000Z', learnerType: 'child' };
const EN = getMessages('en');
const failedCopy = EN.learner.dailyReview.saveFailed;

function guardedNav() {
  const listeners: Array<(e: { preventDefault: () => void }) => void> = [];
  const goBack = vi.fn();
  const navigation = {
    navigate: () => undefined,
    dispatch: () => undefined,
    goBack,
    canGoBack: () => true,
    addListener: (_type: string, fn: (e: { preventDefault: () => void }) => void) => {
      listeners.push(fn);
      return () => undefined;
    },
  } as never;
  const back = async (): Promise<boolean> => {
    let held = false;
    await act(async () => {
      for (const fn of listeners) fn({ preventDefault: () => void (held = true) });
    });
    return held;
  };
  return { navigation, goBack, back };
}
const sheetOf = (r: ReactTestRenderer): ConfirmSheetProps => r.root.findAllByType(ConfirmSheet)[0]!.props as ConfirmSheetProps;
const sheetOpen = (r: ReactTestRenderer): boolean => r.root.findAllByType(ConfirmSheet).some((n) => (n.props as ConfirmSheetProps).visible);
const flush = async (): Promise<void> => {
  await act(async () => {
    for (let i = 0; i < 12; i += 1) await Promise.resolve();
  });
};
const tap = (r: ReactTestRenderer, id: string): Promise<void> => press(byTestId(r.root, id).find((n) => typeof n.props.onClick === 'function')!);
const tryAgainButton = (r: ReactTestRenderer): ReactTestInstance => buttonsNamed(r.root, EN.common.buttons.tryAgain)[0] as ReactTestInstance;

/** Opens the check, starts it and answers every round: the finish runs. */
async function playThrough(navigation: never): Promise<ReactTestRenderer> {
  const r = await render(
    <LayoutProvider value={layoutClassFor({ width: 320, height: 640 })}>
      <StageCheckScreen navigation={navigation} route={{ key: 'StageCheck', name: 'StageCheck', params: { stageKey: 'stage2' } } as never} />
    </LayoutProvider>,
  );
  await flush();
  await tap(r, 'stage-check-go');
  await flush();
  for (let i = 0; i < api.rounds; i += 1) {
    await tap(r, 'round-stub');
    await flush();
    // The Hoya pause between parts is not reached: a part is 5 rounds.
  }
  return r;
}

beforeEach(() => {
  resetRemoteConfigForTests();
  api.finishFails = 0;
  api.finishNull = false;
  api.finished = 0;
  api.rounds = 2;
  api.recordFails.clear();
  api.recordLog.length = 0;
  api.recordHold = null;
  api.finishHold = null;
  reader.announce.mockReset();
  reader.focus.mockReset();
  useProfileStore.setState({ profiles: [learner], activeId: ID, hydrated: true });
  useProgressStore.setState({ hydratedFor: new Set([ID]), saveRetryFailedFor: new Set(), loadFailedFor: new Set() });
});
afterEach(async () => {
  await cleanup();
  resetPlatform();
});

describe('the Stage Check when its finish cannot be saved (LR-4, tests 25, 26, 28)', () => {
  it('ends on the result as ever when the check is written', async () => {
    const r = await playThrough(guardedNav().navigation);
    expect(api.finished).toBe(1);
    expect(byTestId(r.root, 'stage-check-result')).toHaveLength(1);
    expect(byTestId(r.root, 'stage-check-save-later')).toHaveLength(0);
  });

  it('a rejected finish shows the failed page, never the not-ready line; the title has focus', async () => {
    api.finishFails = 1;
    const r = await playThrough(guardedNav().navigation);
    expect(byTestId(r.root, 'stage-check-save-failed')).toHaveLength(1);
    expect(byTestId(r.root, 'stage-check-nothing')).toHaveLength(0);
    expect(byTestId(r.root, 'stage-check-not-ready')).toHaveLength(0);
    const texts = screenTexts(r.root);
    expect(texts).toContain(failedCopy.title);
    expect(texts).toContain(failedCopy.body);
    expect(texts).not.toContain(EN.learner.stageCheck.notReady);
    expect(reader.focus).toHaveBeenCalled();
  });

  it('Try again finishes the same check: the result with its stars', async () => {
    api.finishFails = 1;
    const r = await playThrough(guardedNav().navigation);
    await press(tryAgainButton(r));
    await flush();
    expect(api.finished).toBe(2);
    expect(byTestId(r.root, 'stage-check-result')).toHaveLength(1);
    expect(byTestId(r.root, 'stage-check-save-failed')).toHaveLength(0);
    expect(byTestId(r.root, 'stage-check-stars')).toHaveLength(1);
  });

  it('records again only the round whose recording rejected, by round index', async () => {
    api.recordFails.add(1);
    const r = await playThrough(guardedNav().navigation);
    expect(api.recordLog).toEqual([0, 1]);
    expect(byTestId(r.root, 'stage-check-save-failed')).toHaveLength(1);
    await press(tryAgainButton(r));
    await flush();
    expect(api.recordLog).toEqual([0, 1, 1]);
    expect(byTestId(r.root, 'stage-check-result')).toHaveLength(1);
  });

  it('a try that fails again announces the title, and the still-stuck line shows after 3 tries in a row', async () => {
    setPlatform('ios');
    api.finishFails = 5;
    const r = await playThrough(guardedNav().navigation);
    for (let i = 0; i < 3; i += 1) {
      await press(tryAgainButton(r));
      await flush();
    }
    expect(screenTexts(byTestId(r.root, 'stage-check-save-failed-still-stuck')[0] as ReactTestInstance)).toEqual([failedCopy.stillStuck]);
    expect(reader.announce.mock.calls.map((c) => c[0])).toEqual([failedCopy.title, failedCopy.title, `${failedCopy.title} ${failedCopy.stillStuck}`]);
  });

  it('a finish that answers null (the check closed meanwhile) keeps the calm page: that line is true', async () => {
    api.finishNull = true;
    const r = await playThrough(guardedNav().navigation);
    expect(byTestId(r.root, 'stage-check-nothing')).toHaveLength(1);
    expect(byTestId(r.root, 'stage-check-save-failed')).toHaveLength(0);
    expect(screenTexts(r.root)).toContain(EN.learner.stageCheck.notReady);
  });

  it('a Try again whose finish answers null shows the calm page too', async () => {
    api.finishFails = 1;
    const r = await playThrough(guardedNav().navigation);
    api.finishNull = true;
    await press(tryAgainButton(r));
    await flush();
    expect(byTestId(r.root, 'stage-check-nothing')).toHaveLength(1);
  });

  it('a back asks first, the stay button first, over "This is not saved yet. Your stars and cards stay."; Stop leaves', async () => {
    api.finishFails = 1;
    const { navigation, goBack, back } = guardedNav();
    const r = await playThrough(navigation);
    expect(sheetOpen(r)).toBe(false);
    expect(await back()).toBe(true);
    expect(sheetOpen(r)).toBe(true);
    expect(sheetOf(r)).toMatchObject({
      testID: 'stage-check-leave',
      title: EN.learner.stageReview.leave.title,
      message: 'This is not saved yet. Your stars and cards stay.',
      cancelLabel: EN.learner.stageReview.leave.stay.cta,
      confirmLabel: EN.learner.stageReview.leave.stop.cta,
    });
    await act(async () => sheetOf(r).onCancel());
    expect(sheetOpen(r)).toBe(false);
    expect(byTestId(r.root, 'stage-check-save-failed')).toHaveLength(1);
    expect(await back()).toBe(true);
    await act(async () => sheetOf(r).onConfirm());
    expect(goBack).toHaveBeenCalledTimes(1);
    expect(api.finished).toBe(1);
  });

  // Stop while a Try again is running: it writes nothing more.
  it('Stop while a retry is still recording again: no result page and no further finish', async () => {
    api.recordFails.add(0);
    const { navigation, goBack, back } = guardedNav();
    const r = await playThrough(navigation);
    expect(api.finished).toBe(1);
    let release!: () => void;
    api.recordHold = new Promise<void>((resolve) => (release = resolve));
    await press(tryAgainButton(r));
    expect(await back()).toBe(true);
    await act(async () => sheetOf(r).onConfirm());
    expect(goBack).toHaveBeenCalledTimes(1);
    release();
    await flush();
    expect(api.finished).toBe(1);
    expect(byTestId(r.root, 'stage-check-result')).toHaveLength(0);
  });

  it('Stop while a retry\'s finish is in flight: its result is not shown', async () => {
    api.finishFails = 1;
    const { navigation, goBack, back } = guardedNav();
    const r = await playThrough(navigation);
    let release!: () => void;
    api.finishHold = new Promise<void>((resolve) => (release = resolve));
    await press(tryAgainButton(r));
    expect(api.finished).toBe(2);
    expect(await back()).toBe(true);
    await act(async () => sheetOf(r).onConfirm());
    expect(goBack).toHaveBeenCalledTimes(1);
    release();
    await flush();
    expect(api.finished).toBe(2);
    expect(byTestId(r.root, 'stage-check-result')).toHaveLength(0);
    expect(byTestId(r.root, 'stage-check-nothing')).toHaveLength(0);
  });

  it('during a round the stop sheet keeps its own line', async () => {
    const { navigation, back } = guardedNav();
    const r = await render(
      <LayoutProvider value={layoutClassFor({ width: 320, height: 640 })}>
        <StageCheckScreen navigation={navigation} route={{ key: 'StageCheck', name: 'StageCheck', params: { stageKey: 'stage2' } } as never} />
      </LayoutProvider>,
    );
    await flush();
    await tap(r, 'stage-check-go');
    await flush();
    expect(await back()).toBe(true);
    expect(sheetOf(r).message).toBe(EN.learner.stageReview.leave.body);
  });

  it('the result shows the save-later line only while the learner is in saveRetryFailedFor or loadFailedFor (OD-LR8)', async () => {
    for (const key of ['saveRetryFailedFor', 'loadFailedFor'] as const) {
      useProgressStore.setState({ saveRetryFailedFor: new Set(), loadFailedFor: new Set(), [key]: new Set([ID]) });
      const r = await playThrough(guardedNav().navigation);
      const line = byTestId(r.root, 'stage-check-save-later');
      expect(line).toHaveLength(1);
      expect(screenTexts(line[0] as ReactTestInstance)).toEqual([EN.learner.results.saveLater]);
      await cleanup();
    }
  });
});

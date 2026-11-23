import { Button, HoyaBubble } from '@hangul-route/design-system';
import { getMessages } from '@hangul-route/i18n';
import { act, type ReactTestInstance } from 'react-test-renderer';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const reader = vi.hoisted(() => ({ announce: vi.fn(), focus: vi.fn() }));
vi.mock('../../../platform/screen-reader', () => ({ announceForScreenReader: reader.announce, focusForScreenReader: reader.focus }));
const asked = vi.hoisted(() => ({ calls: [] as unknown[], answer: null as null | ((yes: boolean) => void) }));
vi.mock('../../../platform/dialog', () => ({
  confirm: vi.fn(
    (opts: unknown) =>
      new Promise<boolean>((resolve) => {
        asked.calls.push(opts);
        asked.answer = resolve;
      }),
  ),
}));

import { useAccountStore } from '../../../store/account-store';
import { useUiStore } from '../../../store/ui-store';
import { buttonsNamed, press, render, screenTexts } from '../../../test-support/render';
import { RecoverHoldScreen } from '../RecoverHoldScreen';
import { resetReadFailedTriesForTests } from '../ProgressReadFailedScreen';

/**
 * [DP] AMENDMENTS-DURABLE-PROGRESS sections 3.5 and 3.6 (row DP-1d; test 12, the grown-up button; design
 * `design/screens/system/progress-read-failed/` frame B, `mock/sheet.html` frames H and I, D5): the read-failed screen
 * of a damaged profile list whose copy was kept. A grown-up can help opens the grown-up gate (the PIN screen, for the
 * RecoverRecord destination); after a correct PIN the screen shows the RecoverRecord sheet (a ConfirmSheet: Not now
 * first and focused, Start fresh primary, never danger). The session the PIN opened is for this one action, and Start
 * fresh needs a PIN entered in the last 2 minutes (as Remove from this device, CS-12).
 */
const m = getMessages('en');
const read = m.learner.progressReadFailed;
const sheet = m.caregiver.recoverRecord;

function fakeNavigation() {
  const focus: (() => void)[] = [];
  return {
    navigate: vi.fn(),
    addListener: vi.fn((type: string, listener: () => void) => {
      if (type === 'focus') focus.push(listener);
      return () => void focus.splice(focus.indexOf(listener), 1);
    }),
    /** The hold is in front again (the PIN screen went back). */
    focus: async (): Promise<void> => {
      await act(async () => {
        for (const listener of [...focus]) listener();
      });
    },
  };
}

/** The PIN screen accepted a PIN: the gate opened and one return is marked (PinEntry's `back()`). */
const pinAccepted = (): void => useUiStore.setState({ parentGateOpenedAt: Date.now(), lastPinVerifiedAt: Date.now(), gateReturnPending: true });

async function show(onStartFresh = vi.fn(async () => true)) {
  const navigation = fakeNavigation();
  const r = await render(<RecoverHoldScreen navigation={navigation} onTryAgain={async () => false} onStartFresh={onStartFresh} />, {
    createNodeMock: () => ({ focus: vi.fn(), addEventListener: () => undefined, removeEventListener: () => undefined }),
  });
  return { r, navigation, onStartFresh };
}

const grownUp = (root: ReactTestInstance): ReactTestInstance => buttonsNamed(root, read.grownUpHelp)[0] as ReactTestInstance;

beforeEach(() => {
  resetReadFailedTriesForTests();
  reader.focus.mockReset();
  asked.calls.length = 0;
  asked.answer = null;
  useAccountStore.setState({ parentPinHash: 'h:1234', pinHashReadFailed: false });
  useUiStore.setState({ parentGateOpenedAt: null, lastPinVerifiedAt: null, lastPinTypedAt: null, gateReturnPending: false });
});

describe('RecoverHoldScreen: the grown-up way out (frame B)', () => {
  it('the list screen with Try again and A grown-up can help; no Choose another learner', async () => {
    const { r } = await show();
    const texts = screenTexts(r.root);
    expect(texts).toContain(read.title);
    expect(buttonsNamed(r.root, read.tryAgain)).toHaveLength(1);
    expect(buttonsNamed(r.root, read.grownUpHelp)).toHaveLength(1);
    expect(texts).not.toContain(read.chooseAnother);
  });

  it('A grown-up can help opens the grown-up gate for RecoverRecord', async () => {
    const { r, navigation } = await show();
    await press(grownUp(r.root));
    expect(navigation.navigate).toHaveBeenCalledWith('PinEntry', { next: 'RecoverRecord' });
  });

  it("fails closed when the gate's own record cannot be read: nothing opens", async () => {
    useAccountStore.setState({ parentPinHash: null, pinHashReadFailed: true });
    const { r, navigation } = await show();
    await press(grownUp(r.root));
    expect(navigation.navigate).not.toHaveBeenCalled();
  });
});

describe('the RecoverRecord sheet (frames H, I; D5)', () => {
  it('after a correct PIN: the sheet, Not now first, Start fresh as the confirm, the O2 line as its detail, never danger', async () => {
    const { r, navigation } = await show();
    await press(grownUp(r.root));
    pinAccepted();
    await navigation.focus();
    expect(asked.calls).toEqual([{ title: sheet.title, message: sheet.body, detail: sheet.comeBack, cancelLabel: sheet.notNow, confirmLabel: sheet.fresh }]);
    // Focus is on A grown-up can help as the sheet opens, so the sheet gives it back there when it closes (D5).
    expect(reader.focus).toHaveBeenCalled();
  });

  it('Not now: nothing starts, the grown-up session the PIN opened ends, and focus goes back to A grown-up can help', async () => {
    const { r, navigation, onStartFresh } = await show();
    await press(grownUp(r.root));
    pinAccepted();
    await navigation.focus();
    reader.focus.mockClear();
    await act(async () => asked.answer?.(false));
    expect(onStartFresh).not.toHaveBeenCalled();
    expect(useUiStore.getState()).toMatchObject({ parentGateOpenedAt: null, lastPinVerifiedAt: null, gateReturnPending: false });
    expect(reader.focus).toHaveBeenCalledTimes(1);
  });

  it('Start fresh: starts the list fresh once, the screen is held while it runs, and the session ends', async () => {
    let finish!: (opened: boolean) => void;
    const onStartFresh = vi.fn(
      () =>
        new Promise<boolean>((resolve) => {
          finish = resolve;
        }),
    );
    const { r, navigation } = await show(onStartFresh);
    await press(grownUp(r.root));
    pinAccepted();
    await navigation.focus();
    await act(async () => asked.answer?.(true));
    expect(onStartFresh).toHaveBeenCalledTimes(1);
    expect(useUiStore.getState()).toMatchObject({ parentGateOpenedAt: null, lastPinVerifiedAt: null });
    // Held as a try is (D2): nothing can start the gate or a try while the list is written and read.
    const soft = (label: string): unknown => (r.root.findAll((n) => n.type === Button && n.props.label === label)[0]?.props as { softDisabled?: boolean }).softDisabled;
    expect(soft(read.tryAgain)).toBe(true);
    expect(soft(read.grownUpHelp)).toBe(true);
    navigation.navigate.mockClear();
    await press(grownUp(r.root));
    expect(navigation.navigate).not.toHaveBeenCalled();
    await act(async () => finish(true));
  });

  it('a Start fresh that did not open the app answers: the bubble is said again and focus goes back to the button', async () => {
    const { r, navigation } = await show(vi.fn(async () => false));
    const before = r.root.findByType(HoyaBubble).props.message as string;
    await press(grownUp(r.root));
    pinAccepted();
    await navigation.focus();
    reader.focus.mockClear();
    await act(async () => asked.answer?.(true));
    expect(r.root.findByType(HoyaBubble).props.message).not.toBe(before);
    expect(reader.focus).toHaveBeenCalledTimes(1);
    expect((r.root.findAll((n) => n.type === Button && n.props.label === read.tryAgain)[0]?.props as { softDisabled?: boolean }).softDisabled).toBe(false);
  });

  it('CS-12: a PIN older than 2 minutes opens no sheet (a PIN set at the end of a reset, a session only); the next press asks it again', async () => {
    const { r, navigation } = await show();
    await press(grownUp(r.root));
    useUiStore.setState({ parentGateOpenedAt: Date.now(), lastPinVerifiedAt: null, gateReturnPending: true });
    await navigation.focus();
    expect(asked.calls).toEqual([]);
    // The session that return opened is not kept for a later press.
    expect(useUiStore.getState().parentGateOpenedAt).toBeNull();
    await press(grownUp(r.root));
    expect(navigation.navigate).toHaveBeenCalledTimes(2);
  });

  it('CS-12: a sheet left open past 2 minutes starts nothing', async () => {
    const { r, navigation, onStartFresh } = await show();
    await press(grownUp(r.root));
    pinAccepted();
    await navigation.focus();
    useUiStore.setState({ lastPinVerifiedAt: Date.now() - 3 * 60_000 });
    await act(async () => asked.answer?.(true));
    expect(onStartFresh).not.toHaveBeenCalled();
  });

  it('the PIN screen left with Cancel or Close (no return marked): no sheet, focus back on the button', async () => {
    const { r, navigation } = await show();
    await press(grownUp(r.root));
    reader.focus.mockClear();
    await navigation.focus();
    expect(asked.calls).toEqual([]);
    expect(reader.focus).toHaveBeenCalledTimes(1);
  });

  it('a focus that did not come back from the gate shows nothing, even with a stale return mark', async () => {
    const { navigation } = await show();
    pinAccepted();
    await navigation.focus();
    expect(asked.calls).toEqual([]);
  });

  it('a session that ended before the return (or while the sheet was open) starts nothing', async () => {
    const { r, navigation, onStartFresh } = await show();
    await press(grownUp(r.root));
    useUiStore.setState({ parentGateOpenedAt: null, lastPinVerifiedAt: null, gateReturnPending: true });
    await navigation.focus();
    expect(asked.calls).toEqual([]);

    await press(grownUp(r.root));
    pinAccepted();
    await navigation.focus();
    // 5 minutes in the background close the session while the sheet waits (OA-D16).
    useUiStore.setState({ parentGateOpenedAt: null, lastPinVerifiedAt: null });
    await act(async () => asked.answer?.(true));
    expect(onStartFresh).not.toHaveBeenCalled();
  });

  it('a session older than 15 minutes is not open: no sheet', async () => {
    const { r, navigation } = await show();
    await press(grownUp(r.root));
    useUiStore.setState({ parentGateOpenedAt: Date.now() - 16 * 60_000, lastPinVerifiedAt: null, gateReturnPending: true });
    await navigation.focus();
    expect(asked.calls).toEqual([]);
  });

  it('while the sheet is open, the button opens nothing more', async () => {
    const { r, navigation } = await show();
    await press(grownUp(r.root));
    pinAccepted();
    await navigation.focus();
    navigation.navigate.mockClear();
    await press(grownUp(r.root));
    expect(navigation.navigate).not.toHaveBeenCalled();
    await act(async () => asked.answer?.(false));
  });
});

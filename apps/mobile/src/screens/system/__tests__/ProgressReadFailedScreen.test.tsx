import { Button, HoyaBubble, Screen, colors } from '@hangul-route/design-system';
import { getMessages } from '@hangul-route/i18n';
import { isValidElement } from 'react';
import { act, type ReactTestInstance } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const reader = vi.hoisted(() => ({ announce: vi.fn(), focus: vi.fn() }));
vi.mock('../../../platform/screen-reader', () => ({ announceForScreenReader: reader.announce, focusForScreenReader: reader.focus }));

import { byTestId, buttonsNamed, press, render, resetPlatform, screenTexts, setPlatform, unmount } from '../../../test-support/render';
import { ProgressReadFailedScreen, resetReadFailedTriesForTests } from '../ProgressReadFailedScreen';

/**
 * [DP] AMENDMENTS-DURABLE-PROGRESS section 3.5 (row DP-1c; design `design/screens/system/progress-read-failed/`
 * frames A to F, D2, D3, D12): the screen's words, its buttons, a try (busy, never twice, an answer when it did not
 * work) and the still-stuck line after 3 tries in the session.
 */
const m = getMessages('en').learner.progressReadFailed;

/** A try the test settles by hand. */
function deferred(): { promise: Promise<boolean>; resolve: (worked: boolean) => void } {
  let resolve!: (worked: boolean) => void;
  const promise = new Promise<boolean>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

const buttonProps = (root: ReactTestInstance, label: string): { softDisabled?: boolean; tone?: string; size?: string } =>
  root.findAll((n) => n.type === Button && n.props.label === label)[0]?.props as { softDisabled?: boolean; tone?: string; size?: string };

const flush = async (): Promise<void> => {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
};

beforeEach(() => {
  resetReadFailedTriesForTests();
  reader.announce.mockReset();
  reader.focus.mockReset();
});

afterEach(() => {
  resetPlatform();
});

describe('ProgressReadFailedScreen: what it shows (frames A, C)', () => {
  it('draws the title, the body, the bubble and Try again (hero, in the footer); nothing else to press', async () => {
    const r = await render(<ProgressReadFailedScreen onTryAgain={async () => false} minBusyMs={0} />);
    const texts = screenTexts(r.root);
    expect(texts).toContain(m.title);
    expect(texts).toContain(m.body);
    expect(texts).toContain(m.bubble);
    expect(texts).not.toContain(m.stillStuck);
    expect(texts).not.toContain(m.chooseAnother);
    expect(buttonsNamed(r.root, m.tryAgain)).toHaveLength(1);
    expect(r.root.findAll((n) => typeof n.type === 'string' && n.props.role === 'button')).toHaveLength(1);
    expect(buttonProps(r.root, m.tryAgain)).toMatchObject({ tone: 'primary', size: 'hero' });
    const footer = r.root.findByType(Screen).props.footer as unknown;
    expect(isValidElement(footer)).toBe(true);
    expect(r.root.findByType(HoyaBubble).props.tone).toBe('thinking');
  });

  it('the title is the screen heading and takes the first focus (D12)', async () => {
    const node = (): object => ({ focus: vi.fn(), addEventListener: () => undefined, removeEventListener: () => undefined });
    const title = node();
    // The title's wrapper is the one node focusable by script only (tabIndex -1).
    const createNodeMock = (element: { props: Record<string, unknown> }): object => (element.props.tabIndex === -1 ? title : node());
    const r = await render(<ProgressReadFailedScreen onTryAgain={async () => false} minBusyMs={0} />, { createNodeMock });
    const headings = r.root.findAll((n) => typeof n.type === 'string' && n.props.role === 'heading');
    expect(headings.map((h) => screenTexts(h).join(''))).toEqual([m.title]);
    expect(reader.focus).toHaveBeenCalledTimes(1);
    expect(reader.focus).toHaveBeenCalledWith(title);
  });

  it('native: the first focus moves on the next tick, to the one header element', async () => {
    setPlatform('ios');
    const r = await render(<ProgressReadFailedScreen onTryAgain={async () => false} minBusyMs={0} />);
    expect(reader.focus).not.toHaveBeenCalled();
    await flush();
    expect(reader.focus).toHaveBeenCalledTimes(1);
    expect(r.root.findAll((n) => typeof n.type === 'string' && n.props.role === 'heading').length).toBeGreaterThan(0);
  });

  it('never uses the danger colour', async () => {
    const r = await render(<ProgressReadFailedScreen onTryAgain={async () => false} onChooseAnother={() => undefined} minBusyMs={0} />);
    expect(JSON.stringify(r.toJSON())).not.toContain(colors.feedback.danger);
  });
});

describe('Choose another learner (frame D)', () => {
  it('shows when given, as the secondary button under Try again, and opens the chooser', async () => {
    const choose = vi.fn();
    const r = await render(<ProgressReadFailedScreen onTryAgain={async () => false} onChooseAnother={choose} minBusyMs={0} />);
    expect(buttonProps(r.root, m.chooseAnother)).toMatchObject({ tone: 'secondary', size: 'lg' });
    await press(buttonsNamed(r.root, m.chooseAnother)[0] as ReactTestInstance);
    expect(choose).toHaveBeenCalledTimes(1);
  });
});

describe('a try (frame E, D2)', () => {
  it('every button is soft-disabled and the column busy while a try runs; Try again cannot start a second try', async () => {
    const run = deferred();
    const onTryAgain = vi.fn(() => run.promise);
    const choose = vi.fn();
    const r = await render(<ProgressReadFailedScreen onTryAgain={onTryAgain} onChooseAnother={choose} minBusyMs={0} />);
    await press(buttonsNamed(r.root, m.tryAgain)[0] as ReactTestInstance);
    expect(buttonProps(r.root, m.tryAgain).softDisabled).toBe(true);
    expect(buttonProps(r.root, m.chooseAnother).softDisabled).toBe(true);
    expect(byTestId(r.root, 'read-failed-body')[0]?.props['aria-busy']).toBe(true);
    await press(buttonsNamed(r.root, m.tryAgain)[0] as ReactTestInstance);
    await press(buttonsNamed(r.root, m.chooseAnother)[0] as ReactTestInstance);
    expect(onTryAgain).toHaveBeenCalledTimes(1);
    expect(choose).not.toHaveBeenCalled();
    run.resolve(false);
    await flush();
    expect(buttonProps(r.root, m.tryAgain).softDisabled).toBe(false);
    expect(byTestId(r.root, 'read-failed-body')[0]?.props['aria-busy']).toBeFalsy();
  });

  it('holds the busy state for the minimum time, so a read that answers at once does not flash', async () => {
    vi.useFakeTimers();
    try {
      const r = await render(<ProgressReadFailedScreen onTryAgain={async () => false} minBusyMs={600} />);
      await press(buttonsNamed(r.root, m.tryAgain)[0] as ReactTestInstance);
      await act(async () => {
        await vi.advanceTimersByTimeAsync(500);
      });
      expect(buttonProps(r.root, m.tryAgain).softDisabled).toBe(true);
      await act(async () => {
        await vi.advanceTimersByTimeAsync(100);
      });
      expect(buttonProps(r.root, m.tryAgain).softDisabled).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });

  it('a try that did not work says the bubble again: its live region text changes (web, Android), VoiceOver is told (iOS)', async () => {
    setPlatform('ios');
    const r = await render(<ProgressReadFailedScreen onTryAgain={async () => false} minBusyMs={0} />);
    const before = r.root.findByType(HoyaBubble).props.message as string;
    await press(buttonsNamed(r.root, m.tryAgain)[0] as ReactTestInstance);
    await flush();
    const after = r.root.findByType(HoyaBubble).props.message as string;
    expect(after).not.toBe(before);
    expect(after.trim().replace(/​/g, '')).toBe(m.bubble);
    expect(reader.announce).toHaveBeenCalledWith(m.bubble);
  });

  it('iOS: the third try that did not work says the still-stuck line with the bubble (no live regions there)', async () => {
    setPlatform('ios');
    const r = await render(<ProgressReadFailedScreen onTryAgain={async () => false} minBusyMs={0} />);
    for (let i = 0; i < 3; i += 1) {
      await press(buttonsNamed(r.root, m.tryAgain)[0] as ReactTestInstance);
      await flush();
    }
    expect(reader.announce.mock.calls.map((c) => c[0])).toEqual([m.bubble, m.bubble, `${m.bubble} ${m.stillStuck}`]);
  });

  it('a try that worked says nothing more; a rejected try counts as one that did not work', async () => {
    const r = await render(<ProgressReadFailedScreen onTryAgain={async () => true} minBusyMs={0} />);
    await press(buttonsNamed(r.root, m.tryAgain)[0] as ReactTestInstance);
    await flush();
    expect(reader.announce).not.toHaveBeenCalled();
    await unmount(r);
    const r2 = await render(<ProgressReadFailedScreen onTryAgain={() => Promise.reject(new Error('x'))} minBusyMs={0} />);
    await press(buttonsNamed(r2.root, m.tryAgain)[0] as ReactTestInstance);
    await flush();
    expect(buttonProps(r2.root, m.tryAgain).softDisabled).toBe(false);
  });
});

describe('the still-stuck line (frame F, D3)', () => {
  it('fills its polite live region when the third try of the session ends without success, and stays', async () => {
    const r = await render(<ProgressReadFailedScreen onTryAgain={async () => false} minBusyMs={0} />);
    const region = (): ReactTestInstance => byTestId(r.root, 'read-failed-still-stuck')[0] as ReactTestInstance;
    expect(region().props['aria-live']).toBe('polite');
    for (let i = 0; i < 2; i += 1) {
      await press(buttonsNamed(r.root, m.tryAgain)[0] as ReactTestInstance);
      await flush();
    }
    expect(screenTexts(region())).toEqual([]);
    await press(buttonsNamed(r.root, m.tryAgain)[0] as ReactTestInstance);
    await flush();
    expect(screenTexts(region())).toEqual([m.stillStuck]);
    // The count is per session, not per mount: the screen shown again keeps the line.
    await unmount(r);
    const again = await render(<ProgressReadFailedScreen onTryAgain={async () => false} minBusyMs={0} />);
    expect(screenTexts(byTestId(again.root, 'read-failed-still-stuck')[0] as ReactTestInstance)).toEqual([m.stillStuck]);
  });

  it('a try that worked is not counted', async () => {
    const r = await render(<ProgressReadFailedScreen onTryAgain={async () => true} minBusyMs={0} />);
    for (let i = 0; i < 3; i += 1) {
      await press(buttonsNamed(r.root, m.tryAgain)[0] as ReactTestInstance);
      await flush();
    }
    expect(screenTexts(byTestId(r.root, 'read-failed-still-stuck')[0] as ReactTestInstance)).toEqual([]);
  });
});

import { Button } from '@hangul-route/design-system';
import { getMessages } from '@hangul-route/i18n';
import { createElement, Fragment } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CantHear } from '../../components/CantHear';
import { byTestId, press, render, textOf, unmount } from '../../test-support/render';

/**
 * The guidance-only variant of "Can't hear it?" (AMENDMENTS-AUDIO-CANT-HEAR sections 3.1 and 3.3: the cue rule and
 * Discover): the sheet has the device line and Hear it, no Show the letters, and Hear it is the primary button. `Modal` is
 * a stand-in that draws its children while visible (react-native-web's needs a document).
 */

vi.mock('../../platform/device-family', () => ({ currentDeviceFamily: () => 'apple' }));
vi.mock('../../platform/screen-reader', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  focusForScreenReader: () => undefined,
  announceAndWait: async () => undefined,
}));
vi.mock('react-native', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-native')>();
  const Modal = ({ visible, children }: { visible?: boolean; children?: unknown }) => (visible === true ? createElement(Fragment, null, children as never) : null);
  return { ...actual, Modal };
});

const T = getMessages('en').learner.audio;

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
});
afterEach(() => {
  vi.useRealTimers();
});

const pressable = (root: Parameters<typeof byTestId>[0], id: string) => byTestId(root, id).find((n) => typeof n.props.onClick === 'function')!;

describe('CantHear, guidance only', () => {
  it('the sheet has the device line and Hear it, no Show the letters, and Hear it is the primary button', async () => {
    const onHear = vi.fn();
    const r = await render(<CantHear guidanceOnly round={1} active onHear={onHear} />);
    await press(pressable(r.root, 'cant-hear'));
    expect(textOf(byTestId(r.root, 'cant-hear-line')[0]!)).toBe(T.cantHear.lines.apple);
    expect(byTestId(r.root, 'cant-hear-show-letters')).toHaveLength(0);
    expect(textOf(byTestId(r.root, 'cant-hear-sheet')[0]!)).not.toContain(T.cantHear.showLetters.cta);
    const hear = r.root.findAllByType(Button).find((b) => b.props.testID === 'cant-hear-hear')!;
    expect(hear.props.label).toBe(T.hearIt.cta);
    expect(hear.props.tone).toBe('primary');
    await unmount(r);
  });

  it('Hear it closes the sheet and plays once', async () => {
    const onHear = vi.fn();
    const r = await render(<CantHear guidanceOnly round={1} active onHear={onHear} />);
    await press(pressable(r.root, 'cant-hear'));
    await press(pressable(r.root, 'cant-hear-hear'));
    expect(byTestId(r.root, 'cant-hear-sheet')).toHaveLength(0);
    // This Modal stand-in reports no onDismiss, so the step after the sheet goes on at the fallback wait.
    await vi.advanceTimersByTimeAsync(700);
    expect(onHear).toHaveBeenCalledTimes(1);
    await unmount(r);
  });

  it('the full sheet, for comparison, has Show the letters first (primary) and Hear it second (secondary)', async () => {
    const r = await render(<CantHear round={1} active onHear={() => undefined} onShowLetters={() => undefined} focusAfter={{ current: null }} />);
    await press(pressable(r.root, 'cant-hear'));
    const tones = r.root.findAllByType(Button).filter((b) => String(b.props.testID).startsWith('cant-hear-') && b.props.testID !== 'cant-hear');
    expect(tones.map((b) => [b.props.testID, b.props.tone])).toEqual([
      ['cant-hear-show-letters', 'primary'],
      ['cant-hear-hear', 'secondary'],
    ]);
    await unmount(r);
  });
});

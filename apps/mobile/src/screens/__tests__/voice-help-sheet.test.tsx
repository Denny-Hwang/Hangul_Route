import { LayoutProvider, layoutClassFor, layout } from '@hangul-route/design-system';
import { getMessages } from '@hangul-route/i18n';
import { createElement, Fragment } from 'react';
import { act } from 'react-test-renderer';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { VoiceHelpSheet } from '../../components/VoiceHelpSheet';
import type { DeviceFamily } from '../../logic/device-family';
import { byTestId, render, textOf, unmount } from '../../test-support/render';

/**
 * "Add a Korean voice" shows this device's one section, its scrim leaves the accessibility tree, focus starts on its
 * title, and from window class `regular` it is capped at the reading width (AMENDMENTS-AUDIO-CANT-HEAR section 3.9 and
 * 3.3, test 17; P2-22). `Modal` is a stand-in that draws its children while visible (react-native-web's needs a
 * document).
 */

const device = vi.hoisted(() => ({ family: 'computer' as DeviceFamily }));
const familyReads = vi.hoisted(() => ({ count: 0 }));
vi.mock('../../platform/device-family', () => ({
  currentDeviceFamily: () => {
    familyReads.count += 1;
    return device.family;
  },
}));
const focused = vi.hoisted(() => [] as string[]);
vi.mock('../../platform/screen-reader', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  focusForScreenReader: (node: { testId?: string } | null) => void focused.push(node?.testId ?? 'none'),
}));
vi.mock('react-native', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-native')>();
  const Modal = ({ visible, children }: { visible?: boolean; children?: unknown }) => (visible === true ? createElement(Fragment, null, children as never) : null);
  return { ...actual, Modal };
});

const T = getMessages('en');
const nodeMock = (el: { props?: Record<string, unknown> }): object | null =>
  el.props?.['data-testid'] === 'voice-help-sheet-title' ? { testId: 'voice-help-sheet-title', focus: () => undefined } : null;

beforeEach(() => {
  device.family = 'computer';
  familyReads.count = 0;
  focused.length = 0;
});

const FAMILIES = [
  ['apple', 'iPhone or iPad'],
  ['android', 'Android'],
  ['computer', 'Computer'],
] as const;

describe('VoiceHelpSheet', () => {
  it.each(FAMILIES)('%s: exactly one section, this device\'s', async (family, title) => {
    device.family = family;
    const r = await render(<VoiceHelpSheet visible onClose={() => undefined} />, { createNodeMock: nodeMock as never });
    const sections = ['apple', 'android', 'computer'].filter((f) => byTestId(r.root, `voice-help-sheet-${f}`).length > 0);
    expect(sections).toEqual([family]);
    const text = textOf(byTestId(r.root, `voice-help-sheet-${family}`)[0]!);
    expect(text).toContain(title);
    for (const step of T.learner.audio.voiceHelp.sections[family].steps) expect(text).toContain(step);
    // The title, note and footer are as they were.
    const all = textOf(byTestId(r.root, 'voice-help-sheet')[0]!);
    expect(all).toContain(T.learner.audio.voiceHelp.title);
    expect(all).toContain(T.learner.audio.voiceHelp.note);
    expect(all).toContain(T.learner.audio.voiceHelp.footer);
    await unmount(r);
  });

  it('its scrim is not an accessibility element, and focus starts on its title', async () => {
    const r = await render(<VoiceHelpSheet visible onClose={() => undefined} />, { createNodeMock: nodeMock as never });
    const scrim = byTestId(r.root, 'voice-help-sheet-scrim')[0]!;
    expect(scrim.props['aria-hidden']).toBe(true);
    expect(scrim.props.role).toBeUndefined();
    expect(scrim.props.tabIndex).toBe(-1);
    expect(scrim.props['aria-label']).toBeUndefined();
    expect(focused).toEqual(['voice-help-sheet-title']);
    await unmount(r);
  });

  it('OK and the close button both close it', async () => {
    const onClose = vi.fn();
    const r = await render(<VoiceHelpSheet visible onClose={onClose} />, { createNodeMock: nodeMock as never });
    for (const id of ['voice-help-sheet-ok', 'voice-help-sheet-close', 'voice-help-sheet-scrim']) {
      const node = byTestId(r.root, id).find((n) => typeof n.props.onClick === 'function')!;
      await act(async () => {
        node.props.onClick({ altKey: false, currentTarget: { getAttribute: () => null, tagName: 'DIV' }, nativeEvent: {}, preventDefault: () => undefined, stopPropagation: () => undefined });
      });
    }
    expect(onClose.mock.calls.length).toBeGreaterThanOrEqual(2);
    await unmount(r);
  });

  it('reads the device family when the sheet opens, not on every render', async () => {
    device.family = 'apple';
    const r = await render(<VoiceHelpSheet visible={false} onClose={() => undefined} />, { createNodeMock: nodeMock as never });
    const afterMount = familyReads.count;
    await act(async () => {
      r.update(<VoiceHelpSheet visible={false} onClose={() => undefined} testID="voice-help-sheet" />);
    });
    expect(familyReads.count).toBe(afterMount);
    device.family = 'android';
    await act(async () => {
      r.update(<VoiceHelpSheet visible onClose={() => undefined} />);
    });
    expect(byTestId(r.root, 'voice-help-sheet-android')).toHaveLength(1);
    const afterOpen = familyReads.count;
    // More renders while it is open read nothing again.
    device.family = 'computer';
    await act(async () => {
      r.update(<VoiceHelpSheet visible onClose={() => undefined} testID="voice-help-sheet" />);
    });
    expect(familyReads.count).toBe(afterOpen);
    expect(byTestId(r.root, 'voice-help-sheet-android')).toHaveLength(1);
    await unmount(r);
  });

  it('draws nothing while it is closed', async () => {
    const r = await render(<VoiceHelpSheet visible={false} onClose={() => undefined} />);
    expect(byTestId(r.root, 'voice-help-sheet')).toHaveLength(0);
    await unmount(r);
  });

  it('is full width on a phone and capped at the reading width, centred, from window class regular', async () => {
    for (const [width, capped] of [[360, false], [600, true], [1024, true]] as const) {
      const value = layoutClassFor({ width, height: 800 });
      const r = await render(
        <LayoutProvider value={value}>
          <VoiceHelpSheet visible onClose={() => undefined} />
        </LayoutProvider>,
        { createNodeMock: nodeMock as never },
      );
      const dialog = r.root.findAll((n) => typeof n.type === 'string' && n.props.role === 'dialog')[0]!;
      const style = dialog.props.style as Record<string, unknown>;
      if (capped) {
        expect(style.maxWidth).toBe(`${layout.maxWidth.reading}px`);
        expect(style.alignSelf).toBe('center');
      } else {
        expect(style.maxWidth).toBeUndefined();
      }
      await unmount(r);
    }
  });
});

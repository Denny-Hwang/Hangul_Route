import { ConfirmSheet, ConfirmSheetBody } from '@hangul-route/design-system';
import { getMessages, type UiLocale } from '@hangul-route/i18n';
import React from 'react';
import { Modal } from 'react-native';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';
import TestRenderer, { act, type ReactTestInstance } from 'react-test-renderer';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { buttonsNamed, hostNodes, press, render, resetPlatform, screenTexts, setPlatform, unmount } from '../../../test-support/render';

/**
 * The app's one confirm (design/components/ConfirmSheet/as-built.md), as the quest player's leave confirm uses it:
 * the app's own words in the UI language (the browser's confirm() showed OK / Cancel in the browser's language),
 * Keep playing first and focused, Escape keeps, and Tab stays on the two buttons.
 */

const LOCALES: readonly UiLocale[] = ['en', 'es', 'ko'];

function leaveCopy(locale: UiLocale): { title: string; message: string; keep: string; leave: string } {
  const leave = getMessages(locale).learner.quest.leave;
  return { title: leave.title, message: leave.message, keep: leave.keep.cta, leave: leave.confirm.cta };
}

afterEach(() => {
  resetPlatform();
  vi.unstubAllGlobals();
});

describe('the leave confirm sheet in every UI language', () => {
  it.each(LOCALES)('%s: the title, the line and both buttons in that language, Keep playing first', async (locale) => {
    const copy = leaveCopy(locale);
    const renderer = await render(
      <ConfirmSheetBody layout="sheet" title={copy.title} message={copy.message} keepLabel={copy.keep} confirmLabel={copy.leave} onKeep={() => undefined} onConfirm={() => undefined} testID="sheet" />,
    );
    const texts = screenTexts(renderer.root);
    for (const text of [copy.title, copy.message, copy.keep, copy.leave]) expect(texts, text).toContain(text);
    expect(texts.join(' ')).not.toMatch(/\bOK\b|\bCancel\b/);
    const buttons = hostNodes(renderer.root, (n) => n.props.role === 'button');
    expect(buttons.map((b) => b.props['data-testid'])).toEqual(['sheet-keep', 'sheet-confirm']);
    expect(hostNodes(renderer.root, (n) => n.props.role === 'alertdialog')).toHaveLength(1);
    await unmount(renderer);
  });

  it('Keep keeps and Leave leaves, each once, however often it is pressed', async () => {
    const copy = leaveCopy('en');
    const onKeep = vi.fn();
    const onConfirm = vi.fn();
    const keepFirst = await render(<ConfirmSheetBody layout="dialog" title={copy.title} keepLabel={copy.keep} confirmLabel={copy.leave} onKeep={onKeep} onConfirm={onConfirm} />);
    await press(buttonsNamed(keepFirst.root, copy.keep)[0] as ReactTestInstance);
    await press(buttonsNamed(keepFirst.root, copy.keep)[0] as ReactTestInstance);
    await press(buttonsNamed(keepFirst.root, copy.leave)[0] as ReactTestInstance);
    expect(onKeep).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
    await unmount(keepFirst);

    const leaveFirst = await render(<ConfirmSheetBody layout="sheet" title={copy.title} keepLabel={copy.keep} confirmLabel={copy.leave} onKeep={onKeep} onConfirm={onConfirm} />);
    await press(buttonsNamed(leaveFirst.root, copy.leave)[0] as ReactTestInstance);
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onKeep).toHaveBeenCalledTimes(1);
    await unmount(leaveFirst);
  });

  it('the modal closes as Keep: Escape and the Android back button call onKeep, once with every other way out', async () => {
    const onKeep = vi.fn();
    const onConfirm = vi.fn();
    const copy = leaveCopy('ko');
    const renderer = await render(<ConfirmSheet visible title={copy.title} keepLabel={copy.keep} confirmLabel={copy.leave} onKeep={onKeep} onConfirm={onConfirm} />);
    const modal = renderer.root.findByType(Modal);
    expect(modal.props.transparent).toBe(true);
    // Escape's keydown keeps, then the modal's own close asks again: one answer.
    await act(async () => {
      (modal.props.onRequestClose as () => void)();
      (modal.props.onRequestClose as () => void)();
    });
    // The sheet's own buttons answer through the same guard (the body the modal is given).
    const body = renderer.root.findByType(Modal).props.children as React.ReactElement<{ onKeep: () => void; onConfirm: () => void }>;
    expect(body.type).toBe(ConfirmSheetBody);
    await act(async () => {
      body.props.onKeep();
      body.props.onConfirm();
    });
    expect(onKeep).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
    await unmount(renderer);
  });

  it('a new opening takes a new answer', async () => {
    const onKeep = vi.fn();
    const copy = leaveCopy('en');
    const sheet = (visible: boolean) => <ConfirmSheet visible={visible} title={copy.title} keepLabel={copy.keep} confirmLabel={copy.leave} onKeep={onKeep} onConfirm={() => undefined} />;
    const renderer = await render(sheet(true));
    await act(async () => (renderer.root.findByType(Modal).props.onRequestClose as () => void)());
    await act(async () => renderer.update(sheet(false)));
    await act(async () => renderer.update(sheet(true)));
    await act(async () => (renderer.root.findByType(Modal).props.onRequestClose as () => void)());
    expect(onKeep).toHaveBeenCalledTimes(2);
    await unmount(renderer);
  });

  it('is labelled by its title and described by its message (section 8 anatomy); no message, no description', async () => {
    const copy = leaveCopy('en');
    const withLine = await render(<ConfirmSheetBody layout="sheet" title={copy.title} message={copy.message} keepLabel={copy.keep} confirmLabel={copy.leave} onKeep={() => undefined} onConfirm={() => undefined} />);
    const dialog = hostNodes(withLine.root, (n) => n.props.role === 'alertdialog')[0] as ReactTestInstance;
    const described = hostNodes(withLine.root, (n) => n.props.id === dialog.props['aria-describedby'])[0] as ReactTestInstance;
    expect(screenTexts(described)).toEqual([copy.message]);
    const labelled = hostNodes(withLine.root, (n) => n.props.id === dialog.props['aria-labelledby'])[0] as ReactTestInstance;
    expect(screenTexts(labelled)).toEqual([copy.title]);
    await unmount(withLine);
    const titleOnly = await render(<ConfirmSheetBody layout="sheet" title={copy.title} keepLabel={copy.keep} confirmLabel={copy.leave} onKeep={() => undefined} onConfirm={() => undefined} />);
    expect((hostNodes(titleOnly.root, (n) => n.props.role === 'alertdialog')[0] as ReactTestInstance).props['aria-describedby']).toBeUndefined();
    await unmount(titleOnly);
  });

  it('the bottom sheet clears the home indicator (the safe-area bottom inset); the centred dialog needs none', async () => {
    const copy = leaveCopy('en');
    const bottom = 34;
    const insets = { top: 47, right: 0, bottom, left: 0 };
    const sheetOf = async (layout: 'sheet' | 'dialog'): Promise<number> => {
      const renderer = await render(
        <SafeAreaInsetsContext.Provider value={insets}>
          <ConfirmSheetBody layout={layout} title={copy.title} keepLabel={copy.keep} confirmLabel={copy.leave} onKeep={() => undefined} onConfirm={() => undefined} />
        </SafeAreaInsetsContext.Provider>,
      );
      const dialog = hostNodes(renderer.root, (n) => n.props.role === 'alertdialog')[0] as ReactTestInstance;
      // react-native-web writes the style in px.
      const padding = Number.parseFloat(String((dialog.props.style as { paddingBottom?: string }).paddingBottom));
      await unmount(renderer);
      return padding;
    };
    const sheet = await sheetOf('sheet');
    const dialog = await sheetOf('dialog');
    expect(sheet - dialog).toBe(bottom);
  });
});

describe('the keyboard on the web', () => {
  type Listener = (event: { key: string; shiftKey?: boolean; preventDefault: () => void }) => void;

  /** A document that hands out its keydown listener and reports the focused node. */
  function fakeDocument(): { doc: { activeElement: unknown; addEventListener: (t: string, l: Listener) => void; removeEventListener: () => void }; key: (key: string, shiftKey?: boolean) => void } {
    const listeners: Listener[] = [];
    const doc = {
      activeElement: null as unknown,
      addEventListener: (_type: string, listener: Listener) => void listeners.push(listener),
      removeEventListener: () => undefined,
    };
    return { doc, key: (key, shiftKey = false) => listeners.forEach((l) => l({ key, shiftKey, preventDefault: () => undefined })) };
  }

  it('focuses Keep on open, cycles Tab and Shift+Tab between the two buttons, and Escape keeps', async () => {
    vi.useFakeTimers();
    setPlatform('web');
    const { doc, key } = fakeDocument();
    vi.stubGlobal('document', doc);
    const nodes = new Map<string, { focus: () => void }>();
    const onKeep = vi.fn();
    const copy = leaveCopy('es');
    let renderer!: TestRenderer.ReactTestRenderer;
    await act(async () => {
      renderer = TestRenderer.create(
        <ConfirmSheetBody layout="sheet" title={copy.title} keepLabel={copy.keep} confirmLabel={copy.leave} onKeep={onKeep} onConfirm={() => undefined} testID="sheet" />,
        {
          createNodeMock: (element) => {
            const id = (element.props as { 'data-testid'?: string })['data-testid'] ?? '';
            const node = { focus: vi.fn(() => void (doc.activeElement = node)), setAttribute: () => undefined, removeAttribute: () => undefined, addEventListener: () => undefined, removeEventListener: () => undefined };
            if (id) nodes.set(id, node);
            return node;
          },
        },
      );
    });
    await act(async () => {
      vi.runAllTimers();
    });
    const keep = nodes.get('sheet-keep');
    const leave = nodes.get('sheet-confirm');
    expect(doc.activeElement).toBe(keep);
    key('Tab');
    expect(doc.activeElement).toBe(leave);
    key('Tab');
    expect(doc.activeElement).toBe(keep);
    key('Tab', true);
    expect(doc.activeElement).toBe(leave);
    // A focus that slipped outside comes back in.
    doc.activeElement = null;
    key('Tab');
    expect(doc.activeElement).toBe(keep);
    expect(onKeep).not.toHaveBeenCalled();
    await act(async () => {
      key('Escape');
    });
    expect(onKeep).toHaveBeenCalledTimes(1);
    await act(async () => {
      renderer.unmount();
    });
    vi.useRealTimers();
  });
});

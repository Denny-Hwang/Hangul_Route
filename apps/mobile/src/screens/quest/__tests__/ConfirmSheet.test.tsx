import { ConfirmSheet, ConfirmSheetBody } from '@hangul-route/design-system';
import { getMessages, type UiLocale } from '@hangul-route/i18n';
import React from 'react';
import { Modal } from 'react-native';
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

  it('the modal closes as Keep: Escape and the Android back button call onKeep', async () => {
    const onKeep = vi.fn();
    const copy = leaveCopy('ko');
    const renderer = await render(<ConfirmSheet visible title={copy.title} keepLabel={copy.keep} confirmLabel={copy.leave} onKeep={onKeep} onConfirm={() => undefined} />);
    const modal = renderer.root.findByType(Modal);
    expect(modal.props.onRequestClose).toBe(onKeep);
    expect(modal.props.transparent).toBe(true);
    await unmount(renderer);
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

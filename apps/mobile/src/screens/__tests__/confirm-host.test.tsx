import { ConfirmSheet, type ConfirmSheetProps } from '@hangul-route/design-system';
import React from 'react';
import { act } from 'react-test-renderer';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ConfirmHost } from '../../components/ConfirmHost';
import { render, unmount } from '../../test-support/render';

/**
 * AMENDMENTS-DISPLAY-NAV section 8 (row DN-4): on the web, `confirm()` draws its question in the
 * ConfirmSheet the app's `ConfirmHost` holds, with the caller's title, message and both labels,
 * instead of the browser's `confirm()`; one question at a time; a host that goes away answers the
 * safe choice. The web variant of `platform/dialog` is used here (the render project resolves the
 * native one).
 */
vi.mock('../../platform/dialog', async () => import('../../platform/dialog.web'));

const dialog = await import('../../platform/dialog');

const sheetOf = (renderer: Awaited<ReturnType<typeof render>>): ConfirmSheetProps => renderer.root.findByType(ConfirmSheet).props as ConfirmSheetProps;

afterEach(() => vi.unstubAllGlobals());

describe('ConfirmHost (the web confirm step)', () => {
  it('draws the caller\'s question and labels, and answers with the choice', async () => {
    const renderer = await render(<ConfirmHost />);
    expect(sheetOf(renderer).visible).toBe(false);
    let answer: Promise<boolean> | null = null;
    await act(async () => {
      answer = dialog.confirm({ title: 'Leave this quest?', message: 'Stars from this try will not be saved.', confirmLabel: 'Leave', cancelLabel: 'Keep playing', destructive: true });
    });
    const shown = sheetOf(renderer);
    expect(shown).toMatchObject({ visible: true, title: 'Leave this quest?', message: 'Stars from this try will not be saved.', confirmLabel: 'Leave', cancelLabel: 'Keep playing' });
    await act(async () => shown.onConfirm());
    await expect(answer).resolves.toBe(true);
    expect(sheetOf(renderer).visible).toBe(false);
    await unmount(renderer);
  });

  it('cancel answers false; a second question waits for the first', async () => {
    const renderer = await render(<ConfirmHost />);
    let first: Promise<boolean> | null = null;
    let second: Promise<boolean> | null = null;
    await act(async () => {
      first = dialog.confirm({ title: 'A?', confirmLabel: 'Yes A', cancelLabel: 'No' });
      second = dialog.confirm({ title: 'B?', confirmLabel: 'Yes B', cancelLabel: 'No' });
    });
    expect(sheetOf(renderer).title).toBe('A?');
    await act(async () => sheetOf(renderer).onCancel());
    await expect(first).resolves.toBe(false);
    expect(sheetOf(renderer)).toMatchObject({ visible: true, title: 'B?' });
    await act(async () => sheetOf(renderer).onConfirm());
    await expect(second).resolves.toBe(true);
    // A stale press after the last answer does nothing.
    await act(async () => sheetOf(renderer).onConfirm());
    await unmount(renderer);
  });

  it('one Escape press answers only the question it was pressed on: the next one waits for its own answer', async () => {
    const keydown: ((event: { key?: string; repeat?: boolean; stopPropagation?: () => void }) => void)[] = [];
    vi.stubGlobal('document', {
      activeElement: null,
      addEventListener: (type: string, fn: (typeof keydown)[number]) => {
        if (type === 'keydown') keydown.push(fn);
      },
      removeEventListener: (type: string, fn: (typeof keydown)[number]) => {
        if (type === 'keydown') keydown.splice(keydown.indexOf(fn), 1);
      },
    });
    const renderer = await render(<ConfirmHost />);
    let first: Promise<boolean> | null = null;
    let second: Promise<boolean> | null = null;
    await act(async () => {
      first = dialog.confirm({ title: 'A?', confirmLabel: 'Yes A', cancelLabel: 'No' });
      second = dialog.confirm({ title: 'B?', confirmLabel: 'Yes B', cancelLabel: 'No' });
    });
    // The press: its keydown cancels A ...
    await act(async () => {
      for (const fn of [...keydown]) fn({ key: 'Escape', stopPropagation: () => undefined });
    });
    await expect(first).resolves.toBe(false);
    expect(sheetOf(renderer)).toMatchObject({ visible: true, title: 'B?' });
    // ... and its keyup, which react-native-web's Modal answers with onRequestClose, cancels nothing more.
    const modal = renderer.root.find((n) => typeof (n.props as { onRequestClose?: unknown }).onRequestClose === 'function');
    await act(async () => (modal.props as { onRequestClose: () => void }).onRequestClose());
    expect(sheetOf(renderer)).toMatchObject({ visible: true, title: 'B?' });
    await act(async () => sheetOf(renderer).onConfirm());
    await expect(second).resolves.toBe(true);
    await unmount(renderer);
  });

  it('a host that goes away answers every open question with the safe choice; then the browser confirm is the fallback', async () => {
    const renderer = await render(<ConfirmHost />);
    let open: Promise<boolean> | null = null;
    let waiting: Promise<boolean> | null = null;
    await act(async () => {
      open = dialog.confirm({ title: 'A?', confirmLabel: 'Yes', cancelLabel: 'No' });
      waiting = dialog.confirm({ title: 'B?', confirmLabel: 'Yes', cancelLabel: 'No' });
    });
    await unmount(renderer);
    await expect(open).resolves.toBe(false);
    await expect(waiting).resolves.toBe(false);
    const browserConfirm = vi.fn(() => true);
    vi.stubGlobal('confirm', browserConfirm);
    await expect(dialog.confirm({ title: 'C?', message: 'Sure?', confirmLabel: 'Yes', cancelLabel: 'No' })).resolves.toBe(true);
    expect(browserConfirm).toHaveBeenCalledWith('C?\n\nSure?');
  });
});

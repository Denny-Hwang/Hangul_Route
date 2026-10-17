import { touchTarget } from '../../tokens';
import type { WidthClass } from '../../layout';

/**
 * The pure rules behind `ConfirmSheet` (design/components/ConfirmSheet/spec.md): which action comes first, how
 * each looks, where it sits on a window and what a key does. React-free, so the rules are unit-tested without a
 * renderer.
 *
 * - **Keep** is the safe choice ("Keep playing", "Stay", "Keep this code"): first in reading and tab order, the
 *   filled button, focused when the sheet opens, and what Escape, the Android back button and a tap on the scrim pick.
 * - **Confirm** is the other choice ("Leave"): an outline button under it. It is never the reserved red, on the
 *   learner side or anywhere else: a confirm that loses nothing earned is not a warning.
 */

export type ConfirmSheetAction = 'keep' | 'confirm';

/** Reading, tab and focus order: Keep first. */
export const CONFIRM_SHEET_ORDER: readonly ConfirmSheetAction[] = ['keep', 'confirm'];

/** The `Button` tone of each action: one filled button, one outline. */
export const CONFIRM_SHEET_TONE: Readonly<Record<ConfirmSheetAction, 'primary' | 'ghost'>> = {
  keep: 'primary',
  confirm: 'ghost',
};

/** A bottom sheet on a phone-width window, a centred dialog from the regular class up. */
export type ConfirmSheetLayout = 'sheet' | 'dialog';

export function confirmSheetLayout(width: WidthClass): ConfirmSheetLayout {
  return width === 'compact' ? 'sheet' : 'dialog';
}

/** The dialog's widest box (32rem): eight minimum touch targets. */
export const CONFIRM_SHEET_DIALOG_MAX = touchTarget.min * 8;

export interface ConfirmSheetKeyEvent {
  key: string;
  shiftKey?: boolean;
  ctrlKey?: boolean;
  metaKey?: boolean;
  altKey?: boolean;
}

/** What a key does while the sheet is open: keep (Escape), move focus (Tab), or nothing. */
export type ConfirmSheetKeyResult = { kind: 'keep' } | { kind: 'focus'; index: number } | null;

/**
 * Escape keeps. Tab and Shift+Tab cycle through the sheet's `count` buttons and never leave it: from the last
 * button Tab goes back to the first, from the first Shift+Tab goes to the last, and a focus outside the sheet
 * (`focused` -1) comes back to the first (or, with Shift, the last). A Tab with Ctrl, Meta or Alt is the
 * browser's own and is left alone, as is every other key.
 */
export function confirmSheetKey(event: ConfirmSheetKeyEvent, focused: number, count: number): ConfirmSheetKeyResult {
  if (event.key === 'Escape') return { kind: 'keep' };
  if (event.key !== 'Tab' || event.ctrlKey === true || event.metaKey === true || event.altKey === true || count <= 0) return null;
  const back = event.shiftKey === true;
  if (focused < 0 || focused >= count) return { kind: 'focus', index: back ? count - 1 : 0 };
  return { kind: 'focus', index: (focused + (back ? count - 1 : 1)) % count };
}

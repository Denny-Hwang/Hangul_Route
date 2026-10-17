import { describe, expect, it } from 'vitest';
import { colors, touchTarget } from '../../../tokens';
import {
  CONFIRM_SHEET_DIALOG_MAX,
  CONFIRM_SHEET_ORDER,
  CONFIRM_SHEET_TONE,
  confirmSheetKey,
  confirmSheetLayout,
} from '../logic';

/** design/components/ConfirmSheet/as-built.md: order, looks, layout and keys. */
describe('ConfirmSheet rules', () => {
  it('Keep comes first and is the one filled button; Confirm is an outline under it', () => {
    expect(CONFIRM_SHEET_ORDER).toEqual(['keep', 'confirm']);
    expect(CONFIRM_SHEET_TONE).toEqual({ keep: 'primary', confirm: 'ghost' });
  });

  it('never names the reserved red: neither tone is a danger tone', () => {
    expect(Object.values(CONFIRM_SHEET_TONE)).not.toContain('danger');
    expect(JSON.stringify(CONFIRM_SHEET_TONE)).not.toContain(colors.feedback.danger);
  });

  it('a bottom sheet at the compact class, a centred dialog from regular up, at most 32rem wide', () => {
    expect(confirmSheetLayout('compact')).toBe('sheet');
    expect(confirmSheetLayout('regular')).toBe('dialog');
    expect(confirmSheetLayout('wide')).toBe('dialog');
    expect(CONFIRM_SHEET_DIALOG_MAX).toBe(touchTarget.min * 8);
    expect(CONFIRM_SHEET_DIALOG_MAX).toBe(512);
  });

  it('Escape keeps, wherever the focus is', () => {
    expect(confirmSheetKey({ key: 'Escape' }, 0, 2)).toEqual({ kind: 'keep' });
    expect(confirmSheetKey({ key: 'Escape' }, 1, 2)).toEqual({ kind: 'keep' });
    expect(confirmSheetKey({ key: 'Escape' }, -1, 2)).toEqual({ kind: 'keep' });
  });

  it('traps the focus: Tab and Shift+Tab cycle through the buttons and never leave the sheet', () => {
    expect(confirmSheetKey({ key: 'Tab' }, 0, 2)).toEqual({ kind: 'focus', index: 1 });
    expect(confirmSheetKey({ key: 'Tab' }, 1, 2)).toEqual({ kind: 'focus', index: 0 });
    expect(confirmSheetKey({ key: 'Tab', shiftKey: true }, 0, 2)).toEqual({ kind: 'focus', index: 1 });
    expect(confirmSheetKey({ key: 'Tab', shiftKey: true }, 1, 2)).toEqual({ kind: 'focus', index: 0 });
  });

  it('brings a focus that slipped outside back in: to Keep with Tab, to the last button with Shift+Tab', () => {
    expect(confirmSheetKey({ key: 'Tab' }, -1, 2)).toEqual({ kind: 'focus', index: 0 });
    expect(confirmSheetKey({ key: 'Tab', shiftKey: true }, -1, 2)).toEqual({ kind: 'focus', index: 1 });
    expect(confirmSheetKey({ key: 'Tab' }, 5, 2)).toEqual({ kind: 'focus', index: 0 });
  });

  it('leaves other keys and the browser Tab chords alone', () => {
    expect(confirmSheetKey({ key: 'Enter' }, 0, 2)).toBeNull();
    expect(confirmSheetKey({ key: 'a' }, 0, 2)).toBeNull();
    expect(confirmSheetKey({ key: 'Tab', ctrlKey: true }, 0, 2)).toBeNull();
    expect(confirmSheetKey({ key: 'Tab', metaKey: true }, 0, 2)).toBeNull();
    expect(confirmSheetKey({ key: 'Tab', altKey: true }, 0, 2)).toBeNull();
    expect(confirmSheetKey({ key: 'Tab' }, 0, 0)).toBeNull();
  });
});

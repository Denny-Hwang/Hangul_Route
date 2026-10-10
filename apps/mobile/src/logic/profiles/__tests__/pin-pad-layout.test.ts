import { describe, expect, it } from 'vitest';
import { PIN_PAD_KEY_COUNT, pinPadBudget, pinPadLayout } from '../pin-pad-layout';

const KEYS = { minKey: 64, maxKey: 80, gap: 8 };

describe('pinPadLayout — PIN keypad sized from the space it has (audit p1-L1)', () => {
  it('lays out 1-9, 0 and delete', () => {
    expect(PIN_PAD_KEY_COUNT).toBe(11);
  });

  it('uses the familiar 3-column pad at full size on a roomy phone', () => {
    expect(pinPadLayout({ ...KEYS, width: 358, height: 500 })).toEqual({
      columns: 3,
      rows: 4,
      keySize: 80,
      fits: true,
    });
  });

  it('shrinks the keys before changing the arrangement (iPhone SE in Safari)', () => {
    // 4 rows × 69 + 3 gaps = 300.
    expect(pinPadLayout({ ...KEYS, width: 343, height: 300 })).toEqual({
      columns: 3,
      rows: 4,
      keySize: 69,
      fits: true,
    });
  });

  it('goes to 4 columns × 3 rows when 4 rows would drop below the 64pt floor (320×568)', () => {
    const layout = pinPadLayout({ ...KEYS, width: 288, height: 259 });
    expect(layout).toEqual({ columns: 4, rows: 3, keySize: 66, fits: true });
    expect(layout.keySize).toBeGreaterThanOrEqual(KEYS.minKey);
  });

  it('goes to 6 columns × 2 rows in phone landscape', () => {
    expect(pinPadLayout({ ...KEYS, width: 448, height: 137 })).toEqual({
      columns: 6,
      rows: 2,
      keySize: 64,
      fits: true,
    });
  });

  it('never goes below the floor: falls back to the shortest arrangement that fits the width, and scrolls', () => {
    expect(pinPadLayout({ ...KEYS, width: 448, height: 90 })).toEqual({
      columns: 6,
      rows: 2,
      keySize: 64,
      fits: false,
    });
    expect(pinPadLayout({ ...KEYS, width: 288, height: 90 })).toEqual({
      columns: 4,
      rows: 3,
      keySize: 64,
      fits: false,
    });
  });

  it('keeps 3 columns at the floor when even that is wider than the screen', () => {
    expect(pinPadLayout({ ...KEYS, width: 150, height: 90 })).toEqual({
      columns: 3,
      rows: 4,
      keySize: 64,
      fits: false,
    });
  });

  it('every fitting layout fits inside the box it was given', () => {
    for (const width of [200, 288, 343, 448]) {
      for (const height of [137, 200, 259, 300, 400]) {
        const l = pinPadLayout({ ...KEYS, width, height });
        if (!l.fits) continue;
        expect(l.columns * l.keySize + (l.columns - 1) * KEYS.gap).toBeLessThanOrEqual(width);
        expect(l.rows * l.keySize + (l.rows - 1) * KEYS.gap).toBeLessThanOrEqual(height);
        expect(l.columns * l.rows).toBeGreaterThanOrEqual(PIN_PAD_KEY_COUNT);
      }
    }
  });
});

describe('pinPadBudget — height left for the keys once the screen chrome is placed', () => {
  it('subtracts the safe-area insets, the measured header and the fixed chrome', () => {
    expect(pinPadBudget({ windowHeight: 553, insetTop: 0, insetBottom: 0, header: 85, chrome: 168 })).toBe(300);
    expect(pinPadBudget({ windowHeight: 844, insetTop: 47, insetBottom: 34, header: 85, chrome: 168 })).toBe(510);
  });

  it('never goes negative', () => {
    expect(pinPadBudget({ windowHeight: 200, insetTop: 0, insetBottom: 0, header: 300, chrome: 168 })).toBe(0);
  });
});

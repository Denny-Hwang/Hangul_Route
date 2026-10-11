import { describe, expect, it } from 'vitest';
import { detailPaneWidth, layoutClassFor, scaleMedia } from '../layout';
import { layout, spacing, tokens } from '../tokens';

/** F-LAYOUT-001 §3.1: the six viewports are also the e2e viewports. */
const SIX = [
  { w: 320, h: 568, width: 'compact', short: false, orientation: 'portrait', form: 'phone', panes: 1, sideBySide: false, mediaScale: 1 },
  { w: 375, h: 553, width: 'compact', short: false, orientation: 'portrait', form: 'phone', panes: 1, sideBySide: false, mediaScale: 1 },
  { w: 390, h: 844, width: 'compact', short: false, orientation: 'portrait', form: 'phone', panes: 1, sideBySide: false, mediaScale: 1 },
  { w: 768, h: 1024, width: 'regular', short: false, orientation: 'portrait', form: 'tablet', panes: 1, sideBySide: false, mediaScale: 1.2 },
  { w: 1180, h: 820, width: 'wide', short: false, orientation: 'landscape', form: 'tablet', panes: 2, sideBySide: true, mediaScale: 1.4 },
  { w: 844, h: 390, width: 'regular', short: true, orientation: 'landscape', form: 'phone', panes: 1, sideBySide: true, mediaScale: 1 },
] as const;

describe('layout tokens', () => {
  it('match the F-LAYOUT-001 §3.1 table and join the aggregate', () => {
    expect(layout).toEqual({
      breakpoint: { regular: 600, wide: 900 },
      shortHeight: 480,
      phoneShortSide: 600,
      phoneMaxLongSide: 1000,
      sideBySideMin: 700,
      maxWidth: { reading: 720, full: 1120 },
      gutter: { compact: spacing.lg, regular: spacing.xl, wide: spacing.xxl },
      pane: { master: 400, gap: spacing.xl },
      mediaScale: { compact: 1, regular: 1.2, wide: 1.4 },
      columns: { cards: { compact: 2, regular: 3, wide: 3 }, journeyCellMax: 112 },
    });
    expect(tokens.layout).toBe(layout);
  });
});

describe('layoutClassFor: the six viewports', () => {
  for (const row of SIX) {
    it(`${row.w}x${row.h}`, () => {
      const c = layoutClassFor({ width: row.w, height: row.h });
      expect(c).toMatchObject({
        width: row.width,
        short: row.short,
        orientation: row.orientation,
        form: row.form,
        panes: row.panes,
        sideBySide: row.sideBySide,
        mediaScale: row.mediaScale,
        windowWidth: row.w,
        windowHeight: row.h,
      });
    });
  }

  it('carries gutter, caps and card columns for the class', () => {
    expect(layoutClassFor({ width: 390, height: 844 })).toMatchObject({
      gutter: spacing.lg,
      maxWidth: { reading: 720, full: 1120 },
      cardColumns: 2,
    });
    expect(layoutClassFor({ width: 768, height: 1024 })).toMatchObject({ gutter: spacing.xl, cardColumns: 3 });
    expect(layoutClassFor({ width: 1180, height: 820 })).toMatchObject({ gutter: spacing.xxl, cardColumns: 3 });
  });
});

describe('layoutClassFor: boundaries (inclusive on the upper class)', () => {
  it('599 compact, 600 regular, 899 regular, 900 wide', () => {
    expect(layoutClassFor({ width: 599, height: 900 }).width).toBe('compact');
    expect(layoutClassFor({ width: 600, height: 900 }).width).toBe('regular');
    expect(layoutClassFor({ width: 899, height: 900 }).width).toBe('regular');
    expect(layoutClassFor({ width: 900, height: 900 }).width).toBe('wide');
  });

  it('479 high is short, 480 is not', () => {
    expect(layoutClassFor({ width: 1000, height: 479 }).short).toBe(true);
    expect(layoutClassFor({ width: 1000, height: 480 }).short).toBe(false);
  });

  it('sideBySide needs landscape and width >= 700 (699 no, 700 yes)', () => {
    expect(layoutClassFor({ width: 699, height: 400 }).sideBySide).toBe(false);
    expect(layoutClassFor({ width: 700, height: 400 }).sideBySide).toBe(true);
    // portrait never, even when wide enough
    expect(layoutClassFor({ width: 720, height: 1000 }).sideBySide).toBe(false);
    // square is not landscape
    expect(layoutClassFor({ width: 800, height: 800 }).sideBySide).toBe(false);
  });

  it('panes need wide and not short', () => {
    expect(layoutClassFor({ width: 900, height: 480 }).panes).toBe(2);
    expect(layoutClassFor({ width: 900, height: 479 }).panes).toBe(1);
    expect(layoutClassFor({ width: 899, height: 800 }).panes).toBe(1);
  });
});

describe('layoutClassFor: named devices', () => {
  it('932x430 (iPhone Pro Max landscape): wide, short, one pane, side by side, scale 1, phone', () => {
    expect(layoutClassFor({ width: 932, height: 430 })).toMatchObject({
      width: 'wide',
      short: true,
      panes: 1,
      sideBySide: true,
      mediaScale: 1,
      form: 'phone',
    });
  });

  it('960x600 (Android tablet landscape): wide, two panes, tablet', () => {
    expect(layoutClassFor({ width: 960, height: 600 })).toMatchObject({ width: 'wide', panes: 2, form: 'tablet' });
  });

  it('678x1024 (iPad Split View): regular, one pane, tablet', () => {
    expect(layoutClassFor({ width: 678, height: 1024 })).toMatchObject({
      width: 'regular',
      panes: 1,
      form: 'tablet',
      orientation: 'portrait',
    });
  });

  it('1100x500 (desktop window): tablet form, not short', () => {
    expect(layoutClassFor({ width: 1100, height: 500 })).toMatchObject({ form: 'tablet', short: false, panes: 2 });
  });

  it('phone vs desktop-short: long side <= 1000 is a phone, 1001 is not', () => {
    expect(layoutClassFor({ width: 1000, height: 400 }).form).toBe('phone');
    expect(layoutClassFor({ width: 1001, height: 400 }).form).toBe('tablet');
    expect(layoutClassFor({ width: 599, height: 599 }).form).toBe('phone');
    expect(layoutClassFor({ width: 600, height: 600 }).form).toBe('tablet');
  });

  it('short forces mediaScale 1 and panes 1 but leaves sideBySide', () => {
    const c = layoutClassFor({ width: 1200, height: 400 });
    expect(c).toMatchObject({ width: 'wide', short: true, mediaScale: 1, panes: 1, sideBySide: true });
  });
});

describe('layoutClassFor: unknown or invalid sizes (first web frame can report 0)', () => {
  it('0x0 is compact, not short, portrait, one pane', () => {
    expect(layoutClassFor({ width: 0, height: 0 })).toMatchObject({
      width: 'compact',
      short: false,
      orientation: 'portrait',
      panes: 1,
      sideBySide: false,
      mediaScale: 1,
      windowWidth: 0,
      windowHeight: 0,
    });
  });

  it('NaN and negative sizes behave like 0', () => {
    expect(layoutClassFor({ width: Number.NaN, height: Number.NaN })).toEqual(layoutClassFor({ width: 0, height: 0 }));
    expect(layoutClassFor({ width: -5, height: -5 })).toEqual(layoutClassFor({ width: 0, height: 0 }));
    expect(layoutClassFor({ width: Number.POSITIVE_INFINITY, height: 800 }).width).toBe('compact');
  });

  it('an unknown height is never short and never makes the window landscape', () => {
    expect(layoutClassFor({ width: 1000, height: 0 })).toMatchObject({
      width: 'wide',
      short: false,
      orientation: 'portrait',
      sideBySide: false,
      panes: 2,
    });
  });

  it('an unknown width is compact even with a known height', () => {
    expect(layoutClassFor({ width: 0, height: 300 })).toMatchObject({ width: 'compact', short: true, orientation: 'portrait' });
  });
});

describe('scaleMedia (the only way a size scales)', () => {
  it('rounds base * scale', () => {
    expect(scaleMedia(80, 1)).toBe(80);
    expect(scaleMedia(80, 1.2)).toBe(96);
    expect(scaleMedia(80, 1.4)).toBe(112);
    expect(scaleMedia(75, 1.4)).toBe(105);
    expect(scaleMedia(7, 1.2)).toBe(8);
  });
});

describe('detailPaneWidth (F-LAYOUT-001 §3.7)', () => {
  it('is windowWidth - 2 wide gutters - master - gap, so 412 at 900 and 536 at 1024', () => {
    expect(detailPaneWidth(900)).toBe(412);
    expect(detailPaneWidth(1024)).toBe(536);
  });

  it('stops growing where the full-width cap binds (from 1184)', () => {
    expect(detailPaneWidth(1184)).toBe(layout.maxWidth.full - layout.pane.master - layout.pane.gap);
    expect(detailPaneWidth(2000)).toBe(detailPaneWidth(1184));
  });

  it('is 0 for an unknown or too-small window, never negative', () => {
    expect(detailPaneWidth(0)).toBe(0);
    expect(detailPaneWidth(Number.NaN)).toBe(0);
    expect(detailPaneWidth(400)).toBe(0);
  });

  it('takes the master width as a second argument', () => {
    expect(detailPaneWidth(1024, 300)).toBe(1024 - 2 * layout.gutter.wide - 300 - layout.pane.gap);
  });
});

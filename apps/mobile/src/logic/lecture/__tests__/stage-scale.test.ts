import { layout, presenter, spacing, touchTarget, typography } from '@hangul-route/design-system/tokens';
import { describe, expect, it } from 'vitest';
import { NO_INSETS, PHONE_STAGE_MIN, barBand, phoneRail, phoneRailCompact, railButtonWidth, railNeed, railNextHeight, stageBox, type StageInsets } from '../stage-constants';
import {
  isPhoneWindow,
  navLayout,
  railLabelsFit,
  railSize,
  railWidth,
  stageScale,
  stageText,
  stageView,
  type PhoneRule,
  type RailRule,
  type RailSize,
  type StageBounds,
} from '../stage-scale';

// The presenter passes `presenter.stage` and the compact breakpoint from the design tokens (F-TCH-004 §3.6).
const STAGE: StageBounds = { width: 1280, minHeight: 600, maxHeight: 960, compactWidth: layout.breakpoint.regular };
const FLOOR = typography.size.body;

describe('stageScale (F-TCH-004 §3.6)', () => {
  it('16:9 fills the window: logical height 720, one unit = width / 1280', () => {
    const s = stageScale({ width: 1920, height: 1080 }, STAGE);
    expect(s.logicalHeight).toBe(720);
    expect(s.unit).toBe(1.5);
    expect(s).toMatchObject({ stageWidth: 1920, stageHeight: 1080, offsetX: 0, offsetY: 0, letterboxed: false, portrait: false });
  });

  it('1280x720 is exactly one pixel per unit', () => {
    expect(stageScale({ width: 1280, height: 720 }, STAGE)).toMatchObject({ unit: 1, logicalHeight: 720, letterboxed: false });
  });

  it('4:3 grows the stage taller instead of letterboxing (logical height 960)', () => {
    const s = stageScale({ width: 1024, height: 768 }, STAGE);
    expect(s.logicalHeight).toBe(960);
    expect(s.unit).toBe(0.8);
    expect(s).toMatchObject({ stageWidth: 1024, stageHeight: 768, letterboxed: false });
  });

  it('16:10 sits between the bounds (logical height 800)', () => {
    const s = stageScale({ width: 1280, height: 800 }, STAGE);
    expect(s.logicalHeight).toBe(800);
    expect(s.unit).toBe(1);
    expect(s.letterboxed).toBe(false);
  });

  it('21:9 clamps to the minimum height and letterboxes left and right, centred', () => {
    const s = stageScale({ width: 2560, height: 1080 }, STAGE);
    expect(s.logicalHeight).toBe(600);
    expect(s.unit).toBe(1.8);
    expect(s.stageWidth).toBe(2304);
    expect(s.stageHeight).toBe(1080);
    expect(s.offsetX).toBe(128);
    expect(s.offsetY).toBe(0);
    expect(s.letterboxed).toBe(true);
    expect(s.portrait).toBe(false);
  });

  it('portrait clamps to the maximum height and letterboxes top and bottom, keeping the full width', () => {
    // iPad portrait: 768 wide -> unit 0.6 (the §3.6 example).
    const s = stageScale({ width: 768, height: 1024 }, STAGE);
    expect(s.logicalHeight).toBe(960);
    expect(s.unit).toBe(0.6);
    expect(s.stageWidth).toBe(768);
    expect(s.stageHeight).toBe(576);
    expect(s.offsetX).toBe(0);
    expect(s.offsetY).toBe(224);
    expect(s.letterboxed).toBe(true);
    expect(s.portrait).toBe(true);
  });

  it('the stage never overflows the window, whatever the shape', () => {
    for (const [width, height] of [
      [320, 568],
      [568, 320],
      [1366, 768],
      [3440, 1440],
      [800, 1280],
      [1, 1],
    ] as const) {
      const s = stageScale({ width, height }, STAGE);
      expect(s.stageWidth).toBeLessThanOrEqual(width + 1e-9);
      expect(s.stageHeight).toBeLessThanOrEqual(height + 1e-9);
      expect(s.logicalHeight).toBeGreaterThanOrEqual(STAGE.minHeight);
      expect(s.logicalHeight).toBeLessThanOrEqual(STAGE.maxHeight);
      expect(s.offsetX * 2 + s.stageWidth).toBeCloseTo(width, 6);
      expect(s.offsetY * 2 + s.stageHeight).toBeCloseTo(height, 6);
    }
  });

  it('a 0x0 window (before layout) gives a zero stage, not NaN', () => {
    const s = stageScale({ width: 0, height: 0 }, STAGE);
    expect(s).toEqual({
      unit: 0,
      logicalWidth: 1280,
      logicalHeight: 600,
      stageWidth: 0,
      stageHeight: 0,
      offsetX: 0,
      offsetY: 0,
      letterboxed: false,
      portrait: false,
      tooSmall: false,
    });
  });

  it('a negative or non-finite size is treated like 0x0', () => {
    expect(stageScale({ width: -10, height: 500 }, STAGE).unit).toBe(0);
    expect(stageScale({ width: 500, height: Number.NaN }, STAGE).unit).toBe(0);
    expect(stageScale({ width: Number.POSITIVE_INFINITY, height: 500 }, STAGE).unit).toBe(0);
  });
});

/** What the presenter does in a phone window (owner report 2026-10-16 item 1): no bar band, the safe area out, the phone width. */
const PHONE: StageBounds = { ...STAGE, compactWidth: PHONE_STAGE_MIN };
const PHONE_RULE: PhoneRule = { shortSide: layout.phoneShortSide, maxLongSide: layout.phoneMaxLongSide };
/** A window on a phone: a phone-sized screen (portrait dimensions, as iOS reports them) and a coarse pointer. */
const onPhone = (w: number, h: number) => isPhoneWindow({ w, h, screenW: 390, screenH: 844, coarse: true }, PHONE_RULE);
const phoneStage = (width: number, height: number, insets = NO_INSETS) => stageScale(stageBox({ width, height }, 0, insets), PHONE);

describe('a phone window (owner report 2026-10-16 item 1)', () => {
  it.each([
    [568, 320],
    [640, 360],
    [667, 375],
    [740, 360],
    [844, 390],
    [932, 430],
  ])('landscape %i x %i gets a stage, with text never below the 18 px floor', (width, height) => {
    expect(onPhone(width, height)).toBe(true);
    const s = phoneStage(width, height);
    expect(s.tooSmall).toBe(false);
    expect(stageView({ phone: true, window: { width, height }, tooSmall: s.tooSmall })).toBe('slide');
    expect(s.portrait).toBe(false);
    expect(s.stageWidth).toBeLessThanOrEqual(width);
    expect(s.stageHeight).toBeLessThanOrEqual(height);
    expect(stageText(s.unit, presenter.size.caption, FLOOR)).toBeGreaterThanOrEqual(typography.size.body);
  });

  it('640 x 360 was too small with the fixed 120 px band (unit 0.4, a 512 px stage); without it, unit 0.5 and the whole window', () => {
    const band = barBand(touchTarget.hero, spacing.md);
    expect(band).toBe(120);
    const old = stageScale(stageBox({ width: 640, height: 360 }, band, NO_INSETS), STAGE);
    expect(old.unit).toBeCloseTo(0.4);
    expect(old.stageWidth).toBeCloseTo(512);
    expect(old.tooSmall).toBe(true);
    expect(phoneStage(640, 360)).toMatchObject({ unit: 0.5, stageWidth: 640, stageHeight: 360, tooSmall: false });
  });

  it('portrait 360 x 640 shows the rotate page, never a letterboxed slide', () => {
    expect(onPhone(360, 640)).toBe(true);
    const s = phoneStage(360, 640);
    expect(s.portrait).toBe(true);
    expect(stageView({ phone: true, window: { width: 360, height: 640 }, tooSmall: s.tooSmall })).toBe('rotate');
    // Even a stage wide enough is the rotate page while upright.
    expect(stageView({ phone: true, window: { width: 430, height: 932 }, tooSmall: false })).toBe('rotate');
  });

  it('the phone gate PHONE_STAGE_MIN (560): 568 x 320 draws the slide, 540 x 300 is too small', () => {
    expect(PHONE_STAGE_MIN).toBe(560);
    expect(phoneStage(568, 320).tooSmall).toBe(false);
    const narrow = phoneStage(540, 300);
    expect(narrow.tooSmall).toBe(true);
    expect(stageView({ phone: true, window: { width: 540, height: 300 }, tooSmall: narrow.tooSmall })).toBe('too-small');
  });

  it('the non-phone path is unchanged: 1280 x 720 is unit 1 on a 1280 x 600 box', () => {
    const box = stageBox({ width: 1280, height: 720 }, barBand(touchTarget.hero, spacing.md), NO_INSETS);
    expect(box).toEqual({ width: 1280, height: 600 });
    expect(stageScale(box, STAGE)).toMatchObject({ unit: 1, tooSmall: false });
    expect(stageView({ phone: false, window: { width: 1280, height: 720 }, tooSmall: false })).toBe('slide');
    // A tablet upright keeps its letterboxed stage (it is not a phone).
    expect(stageView({ phone: false, window: { width: 768, height: 1024 }, tooSmall: false })).toBe('slide');
    expect(stageView({ phone: false, window: { width: 320, height: 744 }, tooSmall: true })).toBe('too-small');
  });

  it('the safe-area insets come out of the stage box, and the phone width is judged inside them', () => {
    expect(stageBox({ width: 844, height: 390 }, 0, { top: 0, right: 47, bottom: 21, left: 47 })).toEqual({ width: 750, height: 369 });
    expect(stageBox({ width: 1280, height: 720 }, 120, { top: 10, right: 0, bottom: 20, left: 0 })).toEqual({ width: 1280, height: 570 });
    expect(stageBox({ width: 100, height: 50 }, 0, { top: 40, right: 60, bottom: 40, left: 60 })).toEqual({ width: 0, height: 0 });
    // A bad inset (NaN, negative) counts as none.
    expect(stageBox({ width: 640, height: 360 }, 0, { top: Number.NaN, right: -4, bottom: 0, left: 0 })).toEqual({ width: 640, height: 360 });
    const notch = phoneStage(844, 390, { top: 0, right: 47, bottom: 21, left: 47 });
    expect(notch.tooSmall).toBe(false);
    expect(notch.stageWidth).toBeLessThanOrEqual(750);
    // 568 wide with notch insets on both sides leaves 474: too small even for a phone.
    expect(phoneStage(568, 320, { top: 0, right: 47, bottom: 0, left: 47 }).tooSmall).toBe(true);
  });
});

describe('isPhoneWindow: window, screen and pointer (F-TCH-004 section 3.6)', () => {
  it('reads the layout tokens', () => {
    expect(PHONE_RULE).toEqual({ shortSide: 600, maxLongSide: 1000 });
  });

  it.each([
    [568, 320],
    [640, 360],
    [844, 390],
    [932, 430],
    [360, 640],
  ])('%i x %i with a coarse pointer on a phone-sized screen is a phone', (w, h) => {
    expect(onPhone(w, h)).toBe(true);
  });

  it.each([
    [1024, 768],
    [1100, 500],
    [1280, 720],
    [600, 1000],
  ])('%i x %i is not a phone', (w, h) => {
    expect(onPhone(w, h)).toBe(false);
  });

  it('an 800 x 500 desktop window with a fine pointer is not a phone', () => {
    expect(isPhoneWindow({ w: 800, h: 500, screenW: 1920, screenH: 1080, coarse: false }, PHONE_RULE)).toBe(false);
    expect(isPhoneWindow({ w: 800, h: 500, screenW: 390, screenH: 844, coarse: false }, PHONE_RULE)).toBe(false);
  });

  it('an iPad in split view (320 x 744 on a 1024 x 1366 screen) is not a phone, so it never shows the rotate page', () => {
    expect(isPhoneWindow({ w: 320, h: 744, screenW: 1024, screenH: 1366, coarse: true }, PHONE_RULE)).toBe(false);
  });

  it('an unknown screen counts as the window; an unknown window is not a phone', () => {
    expect(isPhoneWindow({ w: 640, h: 360, coarse: true }, PHONE_RULE)).toBe(true);
    expect(isPhoneWindow({ w: 640, h: 360, screenW: null, screenH: 0, coarse: true }, PHONE_RULE)).toBe(true);
    for (const [w, h] of [
      [0, 0],
      [Number.NaN, 300],
      [-1, 300],
    ]) {
      expect(isPhoneWindow({ w: w!, h: h!, screenW: 390, screenH: 844, coarse: true }, PHONE_RULE)).toBe(false);
    }
  });
});

describe('tooSmall: the stage is narrower than the compact breakpoint (§3.6 "about 640 px")', () => {
  it('a desktop window below the breakpoint is too small: the presenter asks for a bigger window', () => {
    expect(stageScale({ width: 320, height: 568 }, STAGE).tooSmall).toBe(true);
    expect(stageScale({ width: 568, height: 320 }, STAGE).tooSmall).toBe(true);
  });

  it('a short wide window is too small when the height clamp shrinks the stage', () => {
    const s = stageScale({ width: 1280, height: 280 }, STAGE);
    expect(s.stageWidth).toBeLessThan(layout.breakpoint.regular);
    expect(s.tooSmall).toBe(true);
  });

  it('the breakpoint itself, an iPad in portrait and every projector size are not', () => {
    expect(layout.breakpoint.regular).toBe(600);
    expect(stageScale({ width: 600, height: 450 }, STAGE).tooSmall).toBe(false);
    expect(stageScale({ width: 599, height: 450 }, STAGE).tooSmall).toBe(true);
    for (const [width, height] of [
      [768, 1024],
      [1024, 768],
      [1280, 720],
      [1920, 1080],
      [2560, 1080],
    ] as const) {
      expect(stageScale({ width, height }, STAGE).tooSmall).toBe(false);
    }
  });
});

describe('stageText', () => {
  it('scales by the unit and rounds to whole pixels', () => {
    expect(stageText(1.5, 40, FLOOR)).toBe(60);
    expect(stageText(0.8, 56, FLOOR)).toBe(45);
  });

  it('never goes below the body floor (18): an iPad portrait caption (28 units at 0.6) is 18, not 17', () => {
    expect(typography.size.body).toBe(18);
    expect(stageText(0.6, 28, FLOOR)).toBe(typography.size.body);
    expect(stageText(0, 380, FLOOR)).toBe(typography.size.body);
  });
});

describe('navLayout (AMENDMENTS-PRESENTER-NAV section 4, row PN-2)', () => {
  it('a phone window floats the compact bar over the stage; every other window docks the bar under it', () => {
    expect(navLayout(true)).toBe('overlay');
    expect(navLayout(false)).toBe('docked');
  });
});

/** The rail's numbers with the design tokens applied, as `screens/presenter/stage-metrics.ts` does (section 5.2). */
const RAIL: RailRule = {
  full: phoneRail(touchTarget.hero, spacing.sm),
  compact: phoneRailCompact(touchTarget.min, spacing.md, spacing.xs),
  stageMin: PHONE_STAGE_MIN,
};
const NOTCH_844: StageInsets = { top: 0, right: 47, bottom: 21, left: 47 };
const NOTCH_932: StageInsets = { top: 0, right: 59, bottom: 21, left: 59 };

/** What the presenter decides for a window on a phone (or not): the rail size, the layout and the stage box. */
function plan(width: number, height: number, insets: StageInsets = NO_INSETS, opts: { enabled?: boolean; labelsFit?: boolean; screen?: { w: number; h: number } } = {}) {
  const screen = opts.screen ?? { w: 390, h: 844 };
  const phone = isPhoneWindow({ w: width, h: height, screenW: screen.w, screenH: screen.h, coarse: true }, PHONE_RULE);
  const rail = railSize({ phone, window: { width, height }, insets, enabled: opts.enabled ?? true, ...(opts.labelsFit !== undefined ? { labelsFit: opts.labelsFit } : {}) }, RAIL);
  const box = stageBox({ width, height }, 0, insets, railWidth(rail, RAIL));
  return { phone, rail, layout: navLayout(phone, rail), box, scale: stageScale(box, PHONE) };
}

describe('the phone rail (AMENDMENTS-PRESENTER-NAV section 5.2, row PN-4)', () => {
  it('the rail numbers come from the tokens: 104 full, 80 compact, the 88 px button, Next 96 tall unless the rail is under 328 px', () => {
    expect(RAIL.full).toBe(104);
    expect(RAIL.full).toBe(touchTarget.hero + spacing.sm);
    expect(RAIL.compact).toBe(80);
    expect(RAIL.compact).toBe(touchTarget.min + spacing.md + spacing.xs);
    expect(railButtonWidth(RAIL.full, spacing.md, spacing.xs)).toBe(88);
    expect(railButtonWidth(RAIL.compact, spacing.md, spacing.xs)).toBe(touchTarget.min);
    expect(railNeed(touchTarget.min, spacing.sm)).toBe(328);
    expect(railNextHeight(328, touchTarget.min, spacing.sm)).toBe(96);
    expect(railNextHeight(375, touchTarget.min, spacing.sm)).toBe(96);
    expect(railNextHeight(327, touchTarget.min, spacing.sm)).toBe(touchTarget.min);
  });

  // The table of section 5.2, row by row: window, insets, layout, rail, stage box, unit (rounded to 2 places).
  const ROWS: ReadonlyArray<[string, number, number, StageInsets, 'overlay' | 'rail', RailSize | null, number, number, number]> = [
    ['568 x 320', 568, 320, NO_INSETS, 'overlay', null, 568, 320, 0.44],
    ['640 x 360', 640, 360, NO_INSETS, 'rail', 'compact', 560, 360, 0.44],
    ['667 x 375 (iPhone SE 2 / 3, 8)', 667, 375, NO_INSETS, 'rail', 'full', 563, 375, 0.44],
    ['780 x 360 (common Android)', 780, 360, NO_INSETS, 'rail', 'full', 676, 360, 0.53],
    ['844 x 390, no insets', 844, 390, NO_INSETS, 'rail', 'full', 740, 390, 0.58],
    ['844 x 390, notch 47 / 47 / 21', 844, 390, NOTCH_844, 'rail', 'full', 646, 369, 0.5],
    ['932 x 430, notch 59 / 59 / 21', 932, 430, NOTCH_932, 'rail', 'full', 710, 409, 0.55],
  ];
  it.each(ROWS)('%s: %s, rail %s, stage box %i x %i, unit %f', (_label, width, height, insets, layout, rail, boxW, boxH, unit) => {
    const p = plan(width, height, insets);
    expect(p.phone).toBe(true);
    expect(p.layout).toBe(layout);
    expect(p.rail).toBe(rail);
    expect(p.box).toEqual({ width: boxW, height: boxH });
    expect(Math.round(p.scale.unit * 100) / 100).toBe(unit);
    // No new stage minimum: a rail stage is never narrower than the phone gate allows, so the slide is drawn.
    expect(p.scale.tooSmall).toBe(false);
    expect(p.box.width).toBeGreaterThanOrEqual(PHONE_STAGE_MIN);
  });

  it('the stage box is the window minus the four insets minus 104 (full) or 80 (compact)', () => {
    for (const [width, height, insets] of [
      [667, 375, NO_INSETS],
      [844, 390, NOTCH_844],
      [932, 430, { top: 10, right: 59, bottom: 21, left: 59 }],
    ] as const) {
      const p = plan(width, height, insets);
      expect(p.rail).toBe('full');
      expect(p.box).toEqual({ width: width - insets.left - insets.right - 104, height: height - insets.top - insets.bottom });
    }
    const compact = plan(640, 360);
    expect(compact.box).toEqual({ width: 640 - 80, height: 360 });
  });

  it('the gate is exact: full at free - 104 = 560, compact at free - 80 = 560, the overlay one pixel below', () => {
    expect(plan(664, 360).rail).toBe('full');
    expect(plan(663, 360).rail).toBe('compact');
    expect(plan(640, 360).rail).toBe('compact');
    expect(plan(639, 360).rail).toBeNull();
    expect(plan(639, 360).layout).toBe('overlay');
    // The insets count: 664 px of 844 are free with side insets of 90, 660 with 92, 638 with 103.
    expect(plan(844, 390, { top: 0, right: 90, bottom: 0, left: 90 }).rail).toBe('full');
    expect(plan(844, 390, { top: 0, right: 92, bottom: 0, left: 92 }).rail).toBe('compact');
    expect(plan(844, 390, { top: 0, right: 103, bottom: 0, left: 103 }).rail).toBeNull();
  });

  it('docked windows (1180 x 820, 1024 x 768, upright 820 x 1180, 1920 x 1080) have no rail', () => {
    for (const [width, height] of [
      [1180, 820],
      [1024, 768],
      [820, 1180],
      [1920, 1080],
    ] as const) {
      const p = plan(width, height, NO_INSETS, { screen: { w: width, h: height } });
      expect(p.phone, `${width} x ${height}`).toBe(false);
      expect(p.rail).toBeNull();
      expect(p.layout).toBe('docked');
      expect(railWidth(p.rail, RAIL)).toBe(0);
    }
  });

  it('an upright phone keeps the rotate page: no rail is drawn for it', () => {
    for (const [width, height] of [
      [390, 844],
      [360, 640],
      [430, 932],
    ] as const) {
      const p = plan(width, height);
      expect(p.phone).toBe(true);
      expect(p.rail).toBeNull();
      expect(stageView({ phone: p.phone, window: { width, height }, tooSmall: p.scale.tooSmall })).toBe('rotate');
    }
  });

  it('the kill switch off (EXPO_PUBLIC_PRESENTER_RAIL=0) gives the overlay on every phone window, whole-window stage', () => {
    for (const [, width, height, insets] of ROWS) {
      const p = plan(width, height, insets, { enabled: false });
      expect(p.rail).toBeNull();
      expect(p.layout).toBe('overlay');
      expect(p.box).toEqual(stageBox({ width, height }, 0, insets));
    }
    expect(plan(844, 390, NO_INSETS, { enabled: false }).box).toEqual({ width: 844, height: 390 });
  });

  it('the label fallback: a full-rail word wider than its room turns a full rail compact; it never widens a compact or an overlay one', () => {
    expect(plan(844, 390, NO_INSETS, { labelsFit: false }).rail).toBe('compact');
    expect(plan(844, 390, NO_INSETS, { labelsFit: false }).box).toEqual({ width: 764, height: 390 });
    expect(plan(844, 390, NO_INSETS, { labelsFit: true }).rail).toBe('full');
    expect(plan(640, 360, NO_INSETS, { labelsFit: false }).rail).toBe('compact');
    expect(plan(568, 320, NO_INSETS, { labelsFit: false }).rail).toBeNull();
  });

  it('a window of unknown size, or not a phone, gives no rail', () => {
    expect(railSize({ phone: true, window: { width: 0, height: 0 }, insets: NO_INSETS, enabled: true }, RAIL)).toBeNull();
    expect(railSize({ phone: true, window: { width: Number.NaN, height: 390 }, insets: NO_INSETS, enabled: true }, RAIL)).toBeNull();
    expect(railSize({ phone: false, window: { width: 844, height: 390 }, insets: NO_INSETS, enabled: true }, RAIL)).toBeNull();
    // A bad inset reads as none.
    expect(railSize({ phone: true, window: { width: 664, height: 360 }, insets: { top: 0, right: Number.NaN, bottom: 0, left: -5 }, enabled: true }, RAIL)).toBe('full');
  });

  it('railWidth: the column the rail takes from the stage box', () => {
    expect(railWidth('full', RAIL)).toBe(104);
    expect(railWidth('compact', RAIL)).toBe(80);
    expect(railWidth(null, RAIL)).toBe(0);
  });

  it('stageBox takes the rail from the width only; a bad rail reads as none', () => {
    expect(stageBox({ width: 844, height: 390 }, 0, NOTCH_844, 104)).toEqual({ width: 646, height: 369 });
    expect(stageBox({ width: 844, height: 390 }, 0, NO_INSETS, Number.NaN)).toEqual({ width: 844, height: 390 });
    expect(stageBox({ width: 90, height: 390 }, 0, NO_INSETS, 104)).toEqual({ width: 0, height: 390 });
  });
});

describe('railLabelsFit (the rail label fallback, PN-0b N8)', () => {
  const ROOM = { full: 84, more: 52 };
  it('every word of every full-rail label inside 84 px: full; More inside 52 px: text', () => {
    expect(railLabelsFit({ full: [44, 56.7, 40.2, 74.7, 55.2], more: [44] }, ROOM)).toEqual({ full: true, moreText: true });
    expect(railLabelsFit({ full: [81.4, 84], more: [52] }, ROOM)).toEqual({ full: true, moreText: true });
  });
  it('one word wider than its room: the full rail goes compact; More shows its icon', () => {
    expect(railLabelsFit({ full: [44, 93], more: [55] }, ROOM)).toEqual({ full: false, moreText: false });
    expect(railLabelsFit({ full: [84.8], more: [35.7] }, ROOM)).toEqual({ full: false, moreText: true });
  });
  it('nothing measured yet counts as fitting (the first frame draws the rail the gate gives)', () => {
    expect(railLabelsFit({ full: [], more: [] }, ROOM)).toEqual({ full: true, moreText: true });
    expect(railLabelsFit({ full: [Number.NaN], more: [-1] }, ROOM)).toEqual({ full: true, moreText: true });
  });
});

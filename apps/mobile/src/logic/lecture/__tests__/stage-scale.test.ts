import { layout, presenter, spacing, touchTarget, typography } from '@hangul-route/design-system/tokens';
import { describe, expect, it } from 'vitest';
import { NO_INSETS, PHONE_STAGE_MIN, barBand, phoneBarStrip, stageBox } from '../stage-constants';
import { isPhoneWindow, stageScale, stageText, stageView, type PhoneRule, type StageBounds } from '../stage-scale';

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

  it("the compact bar's strip is touchTarget.min + 2 x spacing.sm (80)", () => {
    expect(phoneBarStrip(touchTarget.min, spacing.sm)).toBe(80);
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

import { layout, typography } from '@hangul-route/design-system/tokens';
import { describe, expect, it } from 'vitest';
import { stageScale, stageText, type StageBounds } from '../stage-scale';

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

describe('tooSmall: the stage is narrower than the compact breakpoint (§3.6 "about 640 px")', () => {
  it('a phone in portrait or landscape is too small: the presenter shows the bigger-window hint', () => {
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

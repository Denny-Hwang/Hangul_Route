import { layoutClassFor } from '@hangul-route/design-system/layout';
import { layout, spacing } from '@hangul-route/design-system/tokens';
import { describe, expect, it } from 'vitest';
import {
  TRACE_CANVAS_CEILING,
  TRACE_CANVAS_MAX,
  TRACE_CANVAS_MIN,
  traceCanvasMax,
  traceCanvasSize,
  traceLayoutMode,
  traceScreenWidth,
  traceSidePanelWidth,
} from '../trace-layout';

describe('traceLayoutMode', () => {
  it('keeps the stacked layout on a tall phone', () => {
    expect(traceLayoutMode({ width: 358, height: 844 - 47 - 34 - 32 })).toBe('roomy');
    expect(traceLayoutMode({ width: 448, height: 1024 - 32 })).toBe('roomy');
  });

  it('goes compact on short portrait phones', () => {
    expect(traceLayoutMode({ width: 343, height: 667 - 32 })).toBe('compact');
    expect(traceLayoutMode({ width: 343, height: 553 - 32 })).toBe('compact');
    expect(traceLayoutMode({ width: 288, height: 568 - 32 })).toBe('compact');
  });

  it('puts the controls beside the canvas on a landscape phone', () => {
    // Native landscape: the full width. Web: the 480px column on a wide window.
    expect(traceLayoutMode({ width: 844 - 32, height: 390 - 32 })).toBe('side');
    expect(traceLayoutMode({ width: 480 - 32, height: 390 - 32 })).toBe('side');
    expect(traceLayoutMode({ width: 1024 - 32, height: 768 - 32 })).toBe('side');
  });

  it('does not use the side layout for a narrow window that is merely wider than tall', () => {
    expect(traceLayoutMode({ width: 400, height: 380 })).toBe('compact');
  });
});

describe('traceCanvasSize', () => {
  it('fills the slot up to the ceiling', () => {
    expect(traceCanvasSize(358, 259)).toBe(259);
    expect(traceCanvasSize(358, 600)).toBe(TRACE_CANVAS_MAX);
  });

  it('is limited by the narrower side and floored at the minimum', () => {
    expect(traceCanvasSize(200, 500)).toBe(200);
    expect(traceCanvasSize(300, 90)).toBe(TRACE_CANVAS_MIN);
  });

  it('floors fractional measurements', () => {
    expect(traceCanvasSize(250.9, 300)).toBe(250);
  });
});

describe('traceSidePanelWidth', () => {
  it('takes under half the width, capped for tablets', () => {
    expect(traceSidePanelWidth(780)).toBe(351);
    expect(traceSidePanelWidth(1200)).toBe(380);
  });

  it('keeps room for two buttons in a row on the 480px web column', () => {
    expect(traceSidePanelWidth(448)).toBe(240);
  });
});

/** F-LAYOUT-001 §3.6 Trace row: the canvas grows with the window class, never past 448. */
describe('traceCanvasMax', () => {
  const at = (width: number, height: number) => layoutClassFor({ width, height });

  it('is 320 on a phone, in portrait and on its side', () => {
    expect(traceCanvasMax(at(390, 844))).toBe(TRACE_CANVAS_MAX);
    expect(traceCanvasMax(at(320, 568))).toBe(320);
    expect(traceCanvasMax(at(844, 390))).toBe(320);
  });

  it('is 320 x mediaScale on a tablet: 384 regular, 448 wide', () => {
    expect(traceCanvasMax(at(768, 1024))).toBe(384);
    expect(traceCanvasMax(at(1180, 820))).toBe(448);
    expect(TRACE_CANVAS_CEILING).toBe(448);
  });

  it('never passes the 448 ceiling, whatever the scale', () => {
    expect(traceCanvasMax({ mediaScale: 2 })).toBe(TRACE_CANVAS_CEILING);
  });

  it('is what traceCanvasSize clamps to when it is passed', () => {
    expect(traceCanvasSize(700, 756, traceCanvasMax(at(1180, 820)))).toBe(448);
    expect(traceCanvasSize(704, 500, traceCanvasMax(at(768, 1024)))).toBe(384);
    expect(traceCanvasSize(704, 300, traceCanvasMax(at(768, 1024)))).toBe(300);
  });
});

describe('traceScreenWidth and the side mode on a wide window', () => {
  const at = (width: number, height: number) => layoutClassFor({ width, height });
  /** The content box of a `Screen` of the given width on this window (gutter only, no insets). */
  const box = (width: number, height: number, cap: number) => {
    const c = at(width, height);
    return { width: Math.min(cap, width - 2 * c.gutter), height: height - 2 * c.gutter };
  };

  it('asks for the full width on a wide landscape window, so 1180 x 820 gets the side mode', () => {
    expect(traceScreenWidth(at(1180, 820))).toBe('full');
    const content = box(1180, 820, layout.maxWidth.full);
    expect(traceLayoutMode(content)).toBe('side');
    // The reading column alone (720 x 756) is taller than wide and would stack.
    expect(traceLayoutMode(box(1180, 820, layout.maxWidth.reading))).toBe('roomy');
  });

  it('gives the canvas its 448 ceiling beside the controls at 1180 x 820', () => {
    const content = box(1180, 820, layout.maxWidth.full);
    const slotWidth = content.width - traceSidePanelWidth(content.width) - spacing.lg; // TraceStrokeGame's side row gap
    expect(traceCanvasSize(slotWidth, content.height, traceCanvasMax(at(1180, 820)))).toBe(448);
  });

  it('keeps the reading column on phones, a portrait tablet and a landscape phone (side mode as today)', () => {
    expect(traceScreenWidth(at(390, 844))).toBe('reading');
    expect(traceScreenWidth(at(768, 1024))).toBe('reading');
    expect(traceScreenWidth(at(844, 390))).toBe('reading');
    expect(traceLayoutMode(box(844, 390, layout.maxWidth.reading))).toBe('side');
    expect(traceLayoutMode(box(768, 1024, layout.maxWidth.reading))).toBe('roomy');
  });
});

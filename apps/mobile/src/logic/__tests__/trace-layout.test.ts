import { describe, expect, it } from 'vitest';
import {
  TRACE_CANVAS_MAX,
  TRACE_CANVAS_MIN,
  traceCanvasSize,
  traceLayoutMode,
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

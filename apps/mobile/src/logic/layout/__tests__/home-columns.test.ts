import { layoutClassFor } from '@hangul-route/design-system/layout';
import { describe, expect, it } from 'vitest';
import { homeColumns } from '../home-columns';

const at = (width: number, height: number) => homeColumns(layoutClassFor({ width, height }));

/** F-LAYOUT-001 §3.6, Home row: two columns on regular and wide, one on phones and short windows. */
describe('homeColumns', () => {
  it('is one column on phones in portrait (320, 375, 390)', () => {
    expect(at(320, 568)).toBe(1);
    expect(at(375, 667)).toBe(1);
    expect(at(390, 844)).toBe(1);
  });

  it('is two columns on a regular tablet in portrait and on a wide window', () => {
    expect(at(768, 1024)).toBe(2);
    expect(at(600, 900)).toBe(2);
    expect(at(1180, 820)).toBe(2);
    expect(at(960, 600)).toBe(2);
  });

  it('is one column on a short window, even a wide one (844x390, 932x430)', () => {
    expect(at(844, 390)).toBe(1);
    expect(at(932, 430)).toBe(1);
  });

  it('is one column just below the regular breakpoint and on an unknown first frame', () => {
    expect(at(599, 900)).toBe(1);
    expect(at(590, 410)).toBe(1);
    expect(at(0, 0)).toBe(1);
  });
});

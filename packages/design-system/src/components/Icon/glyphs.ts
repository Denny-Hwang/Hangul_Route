import type { IconName } from './types';

/**
 * Icon glyph geometry — pure data, no React / react-native-svg imports,
 * so the set stays unit-testable in a node environment.
 *
 * Grid: 24×24. Stroked parts use round caps/joins at width 2 (2.2–2.6 for
 * hairline-risk glyphs). Filled parts are solid silhouettes. A glyph is a
 * list of parts drawn in order; `Icon.tsx` maps them onto `<Path>`.
 */

export interface IconStrokePart {
  readonly kind: 'stroke';
  readonly d: string;
  readonly width?: number; // defaults to 2 in Icon.tsx
}

export interface IconFillPart {
  readonly kind: 'fill';
  readonly d: string;
}

export type IconGlyphPart = IconStrokePart | IconFillPart;

const fill = (d: string): IconFillPart => ({ kind: 'fill', d });
const stroke = (d: string, width?: number): IconStrokePart =>
  width === undefined ? { kind: 'stroke', d } : { kind: 'stroke', d, width };

/** Full circle as a path (two arcs), usable for fills and stroke rings. */
const circle = (cx: number, cy: number, r: number): string =>
  `M${cx - r} ${cy} A${r} ${r} 0 1 0 ${cx + r} ${cy} A${r} ${r} 0 1 0 ${cx - r} ${cy} Z`;

export const iconGlyphs: Record<IconName, readonly IconGlyphPart[]> = {
  play: [fill('M8 5 L19 12 L8 19 Z')],
  pause: [fill('M6.5 5 H10 V19 H6.5 Z'), fill('M14 5 H17.5 V19 H14 Z')],
  speaker: [
    fill('M4 9 H8 L13 5 V19 L8 15 H4 Z'),
    stroke('M16.5 9 Q18.5 12 16.5 15'),
    stroke('M19 7 Q22 12 19 17'),
  ],
  replay: [
    // Clockwise three-quarter arc ending at 12 o'clock, arrowhead pointing
    // along the direction of travel.
    stroke('M19.5 12 A7.5 7.5 0 1 1 12 4.5', 2.2),
    fill('M12 1 L17 4.5 L12 8 Z'),
  ],
  check: [stroke('M5 12.5 L10 17.5 L19 6.5', 2.6)],
  close: [stroke('M6.5 6.5 L17.5 17.5', 2.6), stroke('M17.5 6.5 L6.5 17.5', 2.6)],
  'arrow-left': [stroke('M14.5 6 L8.5 12 L14.5 18', 2.6)],
  'arrow-right': [stroke('M9.5 6 L15.5 12 L9.5 18', 2.6)],
  lock: [
    stroke('M8.5 11 V8 A3.5 3.5 0 0 1 15.5 8 V11', 2.2),
    fill(
      'M7.5 11 H16.5 Q18 11 18 12.5 V18.5 Q18 20 16.5 20 H7.5 Q6 20 6 18.5 V12.5 Q6 11 7.5 11 Z',
    ),
  ],
  star: [
    fill(
      'M12 2 L14.94 8.26 L22 9.27 L17 14.14 L18.18 21 L12 17.77 L5.82 21 L7 14.14 L2 9.27 L9.06 8.26 Z',
    ),
  ],
  card: [stroke('M4 6.5 H20 V17.5 H4 Z'), stroke('M4 10.5 H20')],
  home: [fill('M3 12 L12 4 L21 12 V20 H14 V14 H10 V20 H3 Z')],
  // Winding route between two map dots — the Heritage Journey grid.
  journey: [
    stroke('M5.5 18.5 C5.5 13.5 12 15.5 12 11 C12 7 18.5 9 18.5 5.5', 2.2),
    fill(circle(5.5, 18.5, 2.2)),
    fill(circle(18.5, 5.5, 2.2)),
  ],
  library: [
    fill('M4 4 H8 V20 H4 Z'),
    fill('M10 4 H14 V20 H10 Z'),
    fill('M16 6 L20 7 L18 21 L14 20 Z'),
  ],
  // Adult and child standing together.
  parent: [
    fill(circle(9, 6.5, 3)),
    fill('M4 20 A5 5 0 0 1 14 20 Z'),
    fill(circle(17, 10.5, 2.4)),
    fill('M13.5 20 A3.5 3.5 0 0 1 20.5 20 Z'),
  ],
  // Gear: wide hub ring with 8 stubby teeth attached to its rim.
  settings: [
    stroke(circle(12, 12, 5), 2.4),
    stroke(
      'M18.4 12 L21.2 12 M16.53 16.53 L18.51 18.51 M12 18.4 L12 21.2 M7.47 16.53 L5.49 18.51 ' +
        'M5.6 12 L2.8 12 M7.47 7.47 L5.49 5.49 M12 5.6 L12 2.8 M16.53 7.47 L18.51 5.49',
      2.8,
    ),
  ],
  profile: [fill('M12 12 A4 4 0 1 1 12 4 A4 4 0 0 1 12 12 Z'), fill('M4 21 A8 8 0 0 1 20 21 Z')],
  plus: [stroke('M12 5 V19', 2.6), stroke('M5 12 H19', 2.6)],
  sparkle: [fill('M12 2 L13 9 L20 10 L13 11 L12 18 L11 11 L4 10 L11 9 Z')],
};

export const iconNames = Object.keys(iconGlyphs) as readonly IconName[];

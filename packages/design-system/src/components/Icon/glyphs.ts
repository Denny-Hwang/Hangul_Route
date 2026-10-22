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
  // Mute sign: the speaker cone with a small cross where the waves were.
  // Drawn in the muted text colour by its callers, never red (F-AUDIO-004 §3.13).
  'speaker-off': [
    fill('M4 9 H8 L13 5 V19 L8 15 H4 Z'),
    stroke('M16 9.5 L21 14.5', 2.6),
    stroke('M21 9.5 L16 14.5', 2.6),
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
  // F-ROUTE-001 R-2a (design/components/Icon/spec.md). Map pin: an outlined
  // drop with a solid centre dot ("You started here").
  pin: [
    stroke('M12 21.5 C9.5 18.5 5 14 5 9.5 A7 7 0 0 1 19 9.5 C19 14 14.5 18.5 12 21.5 Z', 2.2),
    fill(circle(12, 9.5, 2.6)),
  ],
  // The Complete badge: the check inside a closed ring (never the bare check).
  'check-circle': [stroke(circle(12, 12, 9), 2.2), stroke('M7.5 12.5 L10.5 15.5 L16.5 8.5', 2.4)],
  // Read: an open book with its spine.
  book: [
    stroke('M12 6.5 C10 5 7 4.5 3.5 5 V18.5 C7 18 10 18.5 12 20 C14 18.5 17 18 20.5 18.5 V5 C17 4.5 14 5 12 6.5 Z', 2.2),
    stroke('M12 6.5 V20', 2),
  ],
  // Listen: an ear seen from the side, a rim and an inner curl that closes on
  // itself (no free hook, so it never reads as a question mark), with two
  // sound waves beside it.
  ear: [
    stroke('M9 10 A5.5 5.5 0 0 1 20 10 C20 13.5 17 14.5 17 17.5 A3 3 0 0 1 11.5 19', 2.2),
    stroke('M12.5 13 V10.5 A2.5 2.5 0 0 1 17.5 10.5 C17.5 12 15.5 12.5 14 13.5'),
    stroke('M6.5 8.5 Q4.5 12 6.5 15.5'),
    stroke('M3.5 6.5 Q1 12 3.5 17.5'),
  ],
  // Write: a pencil on the diagonal with its tip and ferrule marked.
  pencil: [
    stroke('M4 20 L5 15 L15 5 L19 9 L9 19 Z', 2.2),
    stroke('M5 15 L9 19', 2),
    stroke('M13 7 L17 11', 2),
  ],
  // F-VOC-004 §3.6, §3.8: the non-colour mark of a locked miss (the Speed Round has no retry, so it
  // is not `replay`). One short level bar, never a cross or an X.
  dash: [stroke('M7 12 H17', 2.6)],
  // F-FEEDBACK-001 FB-6 (design/components/Icon/spec.md). A note from a grown-up: a sheet with its
  // top-right corner folded down and two lines of writing. Portrait, so it never reads as `card`.
  note: [
    stroke('M5.5 3 L13 3 L18.5 8.5 L18.5 21 L5.5 21 Z', 2.2),
    stroke('M13 3 L13 8.5 L18.5 8.5'),
    stroke('M9 13 L15 13'),
    stroke('M9 17 L13 17'),
  ],
  // The Thank you answer to a note: an outlined heart, two round lobes and a tip, never filled
  // (a solid heart reads as a game "life"; the picked answer shows a check beside its word).
  heart: [
    stroke('M12 20.5 C9 17.5 3.5 13.5 3.5 8.75 A4.25 4.25 0 0 1 12 8.75 A4.25 4.25 0 0 1 20.5 8.75 C20.5 13.5 15 17.5 12 20.5 Z', 2.2),
  ],
  // AMENDMENTS-ROUTE-LEARNING-ROUTE LR-2 (design/components/Icon/learning-route-glyphs.md). The Route
  // tab: a road from a start dot that bends back up to a solid map pin. The pin's hole is a second
  // subpath drawn the other way round, so the default nonzero fill rule leaves it open.
  route: [
    fill(circle(5, 20, 2.2)),
    stroke('M5 20 H15.75 A3.25 3.25 0 0 0 15.75 13.5 H11.5', 2.2),
    fill(
      'M8.5 14.6 C6.4 12.4 3.4 9.6 3.4 6.8 A5.1 5.1 0 0 1 13.6 6.8 C13.6 9.6 10.6 12.4 8.5 14.6 Z ' +
        'M6.7 6.8 A1.8 1.8 0 1 0 10.3 6.8 A1.8 1.8 0 1 0 6.7 6.8 Z',
    ),
  ],
  // The goal stage: a pole with a solid swallow-tail pennant. A destination, never a warning: callers
  // draw it in text.primary, never feedback.danger or feedback.nudge.
  flag: [stroke('M6 21.5 V3', 2.2), fill('M6 3.5 H18.5 L15.5 8 L18.5 12.5 H6 Z')],
  // F-CURR-001 G-3 (design/components/Icon/spec.md): the in-app Hangul keyboard's action keys.
  // Shift: an outlined arrow with a stem; `shift-on` is the same arrow filled (Shift is on).
  shift: [stroke('M12 4 L20.5 12.5 H15.5 V20 H8.5 V12.5 H3.5 Z', 2.2)],
  'shift-on': [fill('M12 4 L20.5 12.5 H15.5 V20 H8.5 V12.5 H3.5 Z')],
  // Delete the last letter: a key cap pointing left with a small cross inside (a key face, never a miss mark).
  backspace: [stroke('M9 5.5 H20.5 V18.5 H9 L3 12 Z', 2.2), stroke('M12 9.5 L16.5 14.5 M16.5 9.5 L12 14.5', 2.2)],
  // F-CURR-002 row CM-17 (design/screens/goal-ring-weekly-dots/README.md): a granted rest day on the Home week
  // strip, a crescent outline. It marks a rest day the app gave, never a missed one.
  rest: [stroke('M15.5 3.5 A8.5 8.5 0 1 0 20.5 15.5 A7 7 0 0 1 15.5 3.5 Z', 2.2)],
  // The Heritage Journey theme glyphs (design/components/Icon/theme-glyphs.md): the art of a grid cell
  // and the mark beside each column label, one per theme. Decorative: the theme's words are always in
  // the cell's label and the column header. Every separate part keeps a visible gap at 20 dp.
  // Letters & Books: a letter tile with the syllable ga (U+AC00: giyeok, then the vowel a), never a romanized letter.
  'hangul-tile': [
    stroke('M6 3 H18 A3 3 0 0 1 21 6 V18 A3 3 0 0 1 18 21 H6 A3 3 0 0 1 3 18 V6 A3 3 0 0 1 6 3 Z'),
    stroke('M6.5 7.5 H11 C11 11.5 9.5 14.5 7 16.5', 2.2),
    stroke('M15 6.5 V17.5', 2.2),
    stroke('M15 12 H18', 2.2),
  ],
  // Food & Daily Life: a solid rice bowl, the mound of rice above its rim and its foot below.
  'rice-bowl': [
    fill('M3 11 H21 C21 16 17 19.5 12 19.5 C7 19.5 3 16 3 11 Z'),
    stroke('M5.5 9 C6.5 5 10 4.5 12 6 C14 4.5 17.5 5 18.5 9'),
    stroke('M9 21.8 H15', 2.2),
  ],
  // Holidays & Traditions: a hanging lantern (a hook, a cap, the round body, a base, a tassel); no rib
  // through the body, so it never reads as the letter phi.
  lantern: [
    stroke('M12 1.5 V3.5'),
    fill('M8.5 4 H15.5 V6 H8.5 Z'),
    stroke('M8.5 8 H15.5 C19.5 10 19.5 15.5 15.5 17.5 H8.5 C4.5 15.5 4.5 10 8.5 8 Z', 2.2),
    fill('M9.5 19.5 H14.5 V21 H9.5 Z'),
    stroke('M12 21 V22.5'),
  ],
  // Nature & Animals: one leaf on the diagonal, its vein and a short stem. The tip points up-left and the
  // stem down-right, so the story count mark (top-right of a 320 px cell) never covers the tip.
  leaf: [
    stroke('M19.5 19.5 C20 11 15 4.5 4 4 C4 14 10.5 20 19.5 19.5 Z', 2.2),
    stroke('M19.5 19.5 L9 9'),
    stroke('M19.5 19.5 L21.5 21.5', 2.2),
  ],
  // Play & Crafts: a whip top (paengi): a solid flat top over a solid cone, with a clear gap between them
  // and no handle (a paengi is spun by a whip, not by a stem).
  'spinning-top': [
    fill('M4 3.5 H20 V6.5 H4 Z'),
    fill('M4.5 8.5 H19.5 C19 13 15.5 17 12 20.5 C8.5 17 5 13 4.5 8.5 Z'),
  ],
};

export const iconNames = Object.keys(iconGlyphs) as readonly IconName[];

/** The path attributes for one glyph part: a solid fill, or an outline at width 2 (unless set) with round caps and joins. */
export type IconPartProps =
  | { readonly d: string; readonly fill: string }
  | {
      readonly d: string;
      readonly fill: 'none';
      readonly stroke: string;
      readonly strokeWidth: number;
      readonly strokeLinecap: 'round';
      readonly strokeLinejoin: 'round';
    };

/**
 * The stroke rules (design/components/Icon/spec.md) in one place, shared by the
 * react-native-svg `Icon.tsx` and the plain-DOM `dom.tsx`, so the two cannot drift.
 * Filled and stroked parts are tinted independently so filled silhouettes are not
 * thickened by an extra stroke outline.
 */
export function iconPartProps(part: IconGlyphPart, tint: string): IconPartProps {
  return part.kind === 'fill'
    ? { d: part.d, fill: tint }
    : { d: part.d, fill: 'none', stroke: tint, strokeWidth: part.width ?? 2, strokeLinecap: 'round', strokeLinejoin: 'round' };
}

/**
 * WCAG 2.x contrast math (audit UX-10). Used by the token contrast contract
 * test so a palette change that drops a text/fill pair below AA fails CI.
 * https://www.w3.org/TR/WCAG21/#dfn-contrast-ratio
 */

/** AA minimum for body text. */
export const WCAG_AA_NORMAL = 4.5;
/** AA minimum for large text (≥ 24px, or ≥ 18.66px bold) and UI graphics. */
export const WCAG_AA_LARGE = 3;

const HEX = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i;

function channel(hex2: string): number {
  const c = parseInt(hex2, 16) / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

/** Relative luminance (0 = black, 1 = white) of an opaque `#RRGGBB` color. */
export function relativeLuminance(hex: string): number {
  const m = HEX.exec(hex);
  if (!m) throw new Error(`relativeLuminance expects an opaque #RRGGBB color, got "${hex}"`);
  return 0.2126 * channel(m[1]!) + 0.7152 * channel(m[2]!) + 0.0722 * channel(m[3]!);
}

/** Contrast ratio between two opaque colors, 1 (none) to 21 (black on white). */
export function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const [hi, lo] = la >= lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

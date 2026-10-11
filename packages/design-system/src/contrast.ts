/**
 * WCAG 2.x contrast math (audit UX-10). Used by the token contrast contract
 * test so a palette change that drops a text/fill pair below AA fails CI.
 * https://www.w3.org/TR/WCAG21/#dfn-contrast-ratio
 */

/** AA minimum for body text. */
export const WCAG_AA_NORMAL = 4.5;
/** AAA minimum for body text; the lecture presenter's bar for projected text (F-TCH-004 §3.6). */
export const WCAG_AAA_NORMAL = 7;
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

/**
 * The opaque colour that `fg` drawn at `alpha` opacity produces over an opaque
 * `bg`, blended per sRGB channel the way a browser composites `opacity`. Lets
 * the contrast contract check a dimmed pair (the lecture presenter's
 * non-correct quiz options, F-TCH-004 §3.10) as it actually lands on screen.
 */
export function compositeOver(fg: string, bg: string, alpha: number): string {
  if (!Number.isFinite(alpha) || alpha < 0 || alpha > 1) throw new Error(`compositeOver expects an alpha in 0..1, got ${alpha}`);
  const f = HEX.exec(fg);
  const b = HEX.exec(bg);
  if (!f || !b) throw new Error(`compositeOver expects opaque #RRGGBB colors, got "${fg}" and "${bg}"`);
  const mix = (i: 1 | 2 | 3): string =>
    Math.round(parseInt(f[i]!, 16) * alpha + parseInt(b[i]!, 16) * (1 - alpha))
      .toString(16)
      .toUpperCase()
      .padStart(2, '0');
  return `#${mix(1)}${mix(2)}${mix(3)}`;
}

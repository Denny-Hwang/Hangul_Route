import { typography } from './tokens';

/**
 * The text size engine (owner items 6 and 7): one display text size per device, chosen on the
 * Display (Aa) sheet and stored in the device record (`device:settings.textSize`). Pure, so the
 * table is unit-tested without a renderer; `components/TextSize` is the thin React layer, and
 * the grown-up pages (DOM) apply the same factor as `--hr-text-scale` on `<html>`.
 *
 * - Reading sizes (caption, bodySm, body, bodyLg, prompt) scale by the step factor `f`.
 * - Large type (title, display, hero) scales by `1 + (f - 1) / 2`: it is already big, so it
 *   grows half as much and a headline still fits a phone.
 * - Every size is rounded to a whole point; line heights come from the scaled size.
 * - `standard` (f = 1) is the token scale exactly, so nothing moves for a device that never chose.
 *
 * The OS text size still applies on top on native (`effectiveFontScale`), and the layouts that
 * read the OS scale use the product of both.
 */

/** The four steps of the Text size control, smallest first (same ids as content-schema `TEXT_SIZES`). */
export const TEXT_SIZE_STEPS = ['standard', 'large', 'larger', 'largest'] as const;
export type TextSizeStep = (typeof TEXT_SIZE_STEPS)[number];
export const DEFAULT_TEXT_SIZE_STEP: TextSizeStep = 'standard';

/** The factor of each step. */
export const TEXT_SIZE_FACTORS: Readonly<Record<TextSizeStep, number>> = {
  standard: 1,
  large: 1.15,
  larger: 1.3,
  largest: 1.5,
};

/** The factor of a step; an unknown, missing or damaged step is `standard` (1). */
export function textSizeFactor(step: string | null | undefined): number {
  if (step === null || step === undefined) return 1;
  return Object.prototype.hasOwnProperty.call(TEXT_SIZE_FACTORS, step) ? TEXT_SIZE_FACTORS[step as TextSizeStep] : 1;
}

/** A factor the engine accepts: finite and at least 1, else 1. */
function safeFactor(f: number): number {
  return Number.isFinite(f) && f >= 1 ? f : 1;
}

export type TypeSizeName = keyof typeof typography.size;

/** The sizes that scale by the full factor; the rest (title, display, hero) take half the growth. */
const READING_SIZES: ReadonlySet<TypeSizeName> = new Set<TypeSizeName>(['caption', 'bodySm', 'body', 'bodyLg', 'prompt']);

export interface TypeScale {
  /** The step factor this scale was built from. */
  factor: number;
  /** `typography.size` at this factor, whole points. */
  size: Readonly<Record<TypeSizeName, number>>;
  /** Line height of a scaled size at a leading token (`typography.leading`). */
  lineHeight: (size: number, leading?: keyof typeof typography.leading) => number;
}

const lineHeightOf = (size: number, leading: keyof typeof typography.leading = 'normal'): number => size * typography.leading[leading];

/** The multiplier one size name takes at factor `f`. */
export function sizeMultiplier(name: TypeSizeName, f: number): number {
  const factor = safeFactor(f);
  return READING_SIZES.has(name) ? factor : 1 + (factor - 1) / 2;
}

const cache = new Map<number, TypeScale>();

/** The type scale at factor `f` (memoised per factor; a factor below 1 or not finite is 1). */
export function typeScale(f: number): TypeScale {
  const factor = safeFactor(f);
  const hit = cache.get(factor);
  if (hit !== undefined) return hit;
  const size = {} as Record<TypeSizeName, number>;
  for (const name of Object.keys(typography.size) as TypeSizeName[]) {
    size[name] = Math.round(typography.size[name] * sizeMultiplier(name, factor));
  }
  const scale: TypeScale = { factor, size: Object.freeze(size), lineHeight: lineHeightOf };
  cache.set(factor, scale);
  return scale;
}

/** The scale of the standard step: the tokens as they are. */
export const STANDARD_TYPE_SCALE: TypeScale = typeScale(1);

/** OS text size x the chosen step, for the layouts that switch on a larger text (columns, stacking). */
export function effectiveFontScale(osFontScale: number, f: number): number {
  const os = Number.isFinite(osFontScale) && osFontScale > 0 ? osFontScale : 1;
  return os * safeFactor(f);
}

/**
 * A native `maxFontSizeMultiplier` cap for text already drawn at the chosen step: the cap is a
 * budget for OS x step together, so it is divided by the step. React Native ignores a cap
 * below 1 (it means no cap at all), so it never goes under 1: at a step past the cap the text
 * keeps the step's size and the OS adds nothing.
 */
export function scaledFontCap(cap: number, f: number): number {
  return Math.max(1, cap / safeFactor(f));
}

export interface CappedFont {
  fontSize: number;
  maxFontSizeMultiplier: number;
}

/**
 * A text with a native `maxFontSizeMultiplier` cap, drawn at the chosen step: the cap stays a
 * budget for the step and the OS text size together (`base x cap` at most). The size is the
 * step's size, but never above `base x cap`, and the native cap becomes what is left of the
 * budget (`scaledFontCap` when nothing is clamped). At standard this is the token size and the
 * cap as written, so nothing changes for a device that never chose.
 */
export function cappedFont(name: TypeSizeName, f: number, cap: number): CappedFont {
  const base = typography.size[name];
  const ceiling = base * Math.max(1, cap);
  const fontSize = Math.round(Math.min(typeScale(f).size[name], ceiling));
  return { fontSize, maxFontSizeMultiplier: Math.max(1, ceiling / fontSize) };
}

/** The CSS custom property the grown-up pages read on `<html>` (`font-size: calc(100% * var(--hr-text-scale, 1))`). */
export const TEXT_SCALE_CSS_VAR = '--hr-text-scale';

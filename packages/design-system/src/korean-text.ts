import { touchTarget, typography } from './tokens';

/**
 * Pure view model behind `KoreanText` (F-I18N-001 §3.5). The component only
 * paints what this returns, so the rules (label default, romanization
 * visibility, speaker affordance, size tiers) are unit-tested without a
 * renderer. No i18n dependency: the caller passes the localised
 * `accessibilityLabel` and the boolean `romanizationShown`.
 */

/** BCP 47 speech language for taught Korean: iOS `accessibilityLanguage`, web `lang`. */
export const KOREAN_LANGUAGE = 'ko';

export type KoreanTextSize = 'sm' | 'md' | 'lg';

export type KoreanTextSizes = Record<KoreanTextSize, { hangul: number; romanization: number }>;

/** The type sizes a tier is built from (`typography.size`, or a text size step's `typeScale(f).size`). */
type SizeScale = Readonly<Record<'title' | 'display' | 'hero' | 'bodySm' | 'bodyLg' | 'body', number>>;

/**
 * Font sizes per tier at a type scale (owner items 6 and 7): the Hangul follows the large type
 * (half the step's growth), the romanization the reading sizes (the full step), so taught Korean
 * grows with the chosen text size and never drops below the 18 body floor.
 */
export function koreanTextSizes(scale: SizeScale): KoreanTextSizes {
  return {
    sm: { hangul: scale.title, romanization: scale.bodySm },
    md: { hangul: scale.display, romanization: scale.bodySm },
    lg: { hangul: scale.hero, romanization: scale.bodyLg },
  };
}

/** Font sizes per tier at the standard text size, all from the type scale (Hangul never below the 18 body floor). */
export const KOREAN_TEXT_SIZES = {
  sm: { hangul: typography.size.title, romanization: typography.size.bodySm },
  md: { hangul: typography.size.display, romanization: typography.size.bodySm },
  lg: { hangul: typography.size.hero, romanization: typography.size.bodyLg },
} as const satisfies KoreanTextSizes;

export interface KoreanTextViewInput {
  ko: string;
  romanization: string;
  gloss?: string;
  size?: KoreanTextSize;
  /** `false` hides only the romanization line; the gloss stays. Default `true` (D2). */
  romanizationShown?: boolean;
  /** `true` when the component has an `onPress`. */
  pressable?: boolean;
  accessibilityLabel?: string;
  /** The chosen text size's type scale (`useTypeScale().size`); absent = the standard scale. */
  scale?: SizeScale;
}

export interface KoreanTextView {
  label: string;
  showRomanization: boolean;
  showGloss: boolean;
  pressable: boolean;
  showSpeaker: boolean;
  hangulSize: number;
  romanizationSize: number;
  /** The gloss line's size (the body size at the scale). */
  glossSize: number;
  /** Touch target floor for a pressable item, 0 when it is plain content. */
  minTarget: number;
}

function present(value: string | undefined): value is string {
  return value !== undefined && value.trim().length > 0;
}

/**
 * Screen reader label: the caller's localised label (from `m.a11y.koreanItem`)
 * when given, else "ko, romanization" (just "ko" without a romanization).
 */
export function koreanTextLabel(ko: string, romanization: string, accessibilityLabel?: string): string {
  if (present(accessibilityLabel)) return accessibilityLabel;
  return present(romanization) ? `${ko}, ${romanization}` : ko;
}

export function koreanTextView(input: KoreanTextViewInput): KoreanTextView {
  const tier = (input.scale ? koreanTextSizes(input.scale) : KOREAN_TEXT_SIZES)[input.size ?? 'md'];
  const pressable = input.pressable === true;
  return {
    label: koreanTextLabel(input.ko, input.romanization, input.accessibilityLabel),
    showRomanization: (input.romanizationShown ?? true) && present(input.romanization),
    showGloss: present(input.gloss),
    pressable,
    showSpeaker: pressable,
    hangulSize: tier.hangul,
    romanizationSize: tier.romanization,
    glossSize: input.scale?.body ?? typography.size.body,
    minTarget: pressable ? touchTarget.min : 0,
  };
}

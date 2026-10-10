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

/** Font sizes per tier, all from the type scale (Hangul never below the 18 body floor). */
export const KOREAN_TEXT_SIZES = {
  sm: { hangul: typography.size.title, romanization: typography.size.bodySm },
  md: { hangul: typography.size.display, romanization: typography.size.bodySm },
  lg: { hangul: typography.size.hero, romanization: typography.size.bodyLg },
} as const satisfies Record<KoreanTextSize, { hangul: number; romanization: number }>;

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
}

export interface KoreanTextView {
  label: string;
  showRomanization: boolean;
  showGloss: boolean;
  pressable: boolean;
  showSpeaker: boolean;
  hangulSize: number;
  romanizationSize: number;
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
  const tier = KOREAN_TEXT_SIZES[input.size ?? 'md'];
  const pressable = input.pressable === true;
  return {
    label: koreanTextLabel(input.ko, input.romanization, input.accessibilityLabel),
    showRomanization: (input.romanizationShown ?? true) && present(input.romanization),
    showGloss: present(input.gloss),
    pressable,
    showSpeaker: pressable,
    hangulSize: tier.hangul,
    romanizationSize: tier.romanization,
    minTarget: pressable ? touchTarget.min : 0,
  };
}

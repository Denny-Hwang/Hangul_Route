/**
 * Screen-reader text for a romanization (F-CNT-002 §3.3): a jamo sound value such
 * as 'silent/ng' or 'g/k' is read as 'silent or ng' / 'g or k', so VoiceOver does
 * not say "slash". Callers pass the result as the accessibilityLabel of KoreanText.
 *
 * [SO] AMENDMENTS-STROKE-ORDER-STANDARD OD-SO10 (row SO-1b): `or` is the word of the
 * label's own language, `a11y.romanizationOr` of packages/i18n ('or', 'o', '또는'), so a
 * Spanish or Korean label never says the English word. This package has no i18n
 * dependency, so the caller passes it.
 */
export function a11yRomanization(romanization: string, or: string): string {
  return romanization.replace(/\s*\/\s*/g, ` ${or} `);
}

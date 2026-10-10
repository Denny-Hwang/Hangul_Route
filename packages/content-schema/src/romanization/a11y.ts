/**
 * Screen-reader text for a romanization (F-CNT-002 §3.3): a jamo sound value such
 * as 'silent/ng' or 'g/k' is read as 'silent or ng' / 'g or k', so VoiceOver does
 * not say "slash". Callers pass the result as the accessibilityLabel of KoreanText.
 */
export function a11yRomanization(romanization: string): string {
  return romanization.replace(/\s*\/\s*/g, ' or ');
}

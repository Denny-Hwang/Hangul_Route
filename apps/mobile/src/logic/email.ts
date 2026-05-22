/**
 * Minimal email-shape check for the optional parent email captured at
 * onboarding. Intentionally permissive — we only guard against obvious
 * typos, not deliverability.
 */
export function isValidEmail(value: string): boolean {
  const v = value.trim();
  if (v.length === 0 || v.length > 254) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

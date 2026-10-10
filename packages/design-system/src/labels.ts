/**
 * Accessibility label defaults for components that used to hard-code English
 * (F-I18N-001 §3.2). The design system takes no copy dependency: callers pass
 * the already-localised label (`m.a11y.stars(n)`, `m.a11y.hoyaDismiss`) and
 * the English below stays the default, so there is no visual or API break.
 * Pure and React-free so it is testable without a renderer.
 */

/** Default `HoyaBubble` dismiss-button label. */
export const DEFAULT_DISMISS_LABEL = 'Close Hoya message';

function present(value: string | undefined): value is string {
  return value !== undefined && value.trim().length > 0;
}

/** `StarRow` label: the caller's localised label, else "N of 3 stars earned". */
export function starRowLabel(stars: 0 | 1 | 2 | 3, accessibilityLabel?: string): string {
  return present(accessibilityLabel) ? accessibilityLabel : `${stars} of 3 stars earned`;
}

/** `HoyaBubble` dismiss label: the caller's `dismissLabel`, else the English default. */
export function hoyaDismissLabel(dismissLabel?: string): string {
  return present(dismissLabel) ? dismissLabel : DEFAULT_DISMISS_LABEL;
}

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

/**
 * [AU] AMENDMENTS-AUDIT-2026-11 AU-17d (audit A11Y-3): what a `Progress` meter is called and how its value is read
 * ("Progress", "2 of 6"), so no progress bar is without an accessible name. The app passes its localised pair once
 * through `ProgressLabelsContext`; the English below is the default, as for the labels above.
 */
export interface ProgressLabels {
  /** The meter's accessible name. */
  name: string;
  /** The value as words: `now` of `max`. Counts only, the same numbers the meter draws. */
  value: (now: number, max: number) => string;
}

export const DEFAULT_PROGRESS_LABELS: ProgressLabels = {
  name: 'Progress',
  value: (now, max) => `${now} of ${max}`,
};

/** The accessible name and value text of one `Progress`: the caller's own words first, then the labels' pair. */
export function progressA11y(
  labels: ProgressLabels,
  now: number,
  max: number,
  own: { accessibilityLabel?: string; accessibilityValueText?: string; label?: string } = {},
): { name: string; valueText: string } {
  return {
    name: present(own.accessibilityLabel) ? own.accessibilityLabel : present(labels.name) ? labels.name : DEFAULT_PROGRESS_LABELS.name,
    // A meter that draws its own line (`label`) is read with that line, so the spoken value is what the screen shows.
    valueText: present(own.accessibilityValueText) ? own.accessibilityValueText : present(own.label) ? own.label : labels.value(now, max),
  };
}

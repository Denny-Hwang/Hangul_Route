import { findBannedWord } from '../banned';
import type { UiLocale } from '../locales';

/**
 * The public site (`landing`) is read by parents too, so it is checked against the caregiver list
 * (learner words plus "behind", "lazy" and their es / ko equivalents) like every other namespace.
 * The only exception: these English sentences use "behind" spatially ("behind a simple
 * multiplication question", "behind a parent-gate"), never about progress. The exemption is per
 * path and per word, English only, so a new "behind" anywhere else in `landing`, or any banned word
 * in an es / ko overlay, still fails.
 */
export const SPATIAL_BEHIND_PATHS: ReadonlySet<string> = new Set([
  'landing.about.promises.gate',
  'landing.legal.privacy.sections.account.paragraphs.p1',
  'landing.legal.terms.sections.accounts.paragraphs.p1',
]);

/** The first caregiver-banned word in a landing string at `path`, after the spatial "behind" exemption. */
export function landingBannedWord(text: string, locale: UiLocale, path: string): string | null {
  const checked = locale === 'en' && SPATIAL_BEHIND_PATHS.has(path) ? text.replace(/\bbehind\b/gi, ' ') : text;
  return findBannedWord(checked, locale, 'caregiver');
}

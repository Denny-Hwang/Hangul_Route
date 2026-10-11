import type { UiLocale } from '@hangul-route/content-schema';
import { findBannedWord } from '@hangul-route/i18n';
import { findBannedWord as findHomeworkBanned } from '../../homework/banned-text';
import { MY_ROUTE_BANNED } from './banned-fixture';

/**
 * The copy rules of F-ROUTE-001 section 3.13 as one checker, so R-3 / R-9
 * run the same rules on the real dictionary in en / es / ko that this PR
 * runs on the Appendix B drafts.
 */

export type Surface = 'learner' | 'caregiver' | 'a11y';

/** Emoji and emoji-capable symbols (arrows, geometric shapes such as U+25B6 / U+25C0 / U+25BC, dingbats). */
const SYMBOL = /[\p{Extended_Pictographic}←-⇿⌀-⏿■-◿☀-➿️]/u;
const RATIO = /\d+ ?\/ ?\d+/;

const words = (text: string): string => ` ${text.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim()} `;
const has = (text: string, word: string, locale: UiLocale): boolean =>
  locale === 'ko' ? text.includes(word) : words(text).includes(words(word));

/**
 * Violations for one rendered string. `args` are the values the message was
 * called with: digits may appear only where an argument put them (plural
 * counts, Stage {n}, Week {n}, dates); a11y strings may carry digits.
 */
export function copyViolations(text: string, locale: UiLocale, surface: Surface, args: readonly unknown[] = []): string[] {
  const out: string[] = [];
  const fixture = MY_ROUTE_BANNED[locale];
  const banned = surface === 'caregiver' ? fixture.learner : [...fixture.learner, ...fixture.learnerOnly];
  for (const word of banned) if (has(text, word, locale)) out.push(`banned "${word}"`);
  for (const word of fixture.speaking) if (has(text, word, locale)) out.push(`speaking word "${word}"`);
  const shared = findBannedWord(text, locale, surface === 'caregiver' ? 'caregiver' : 'learner');
  if (shared !== null) out.push(`shared banned "${shared}"`);
  if (locale === 'en' && surface !== 'caregiver' && findHomeworkBanned(text) !== null) out.push('homework banned word');
  if (SYMBOL.test(text)) out.push('emoji-capable symbol');
  if (text.includes('%')) out.push('percent');
  if (RATIO.test(text)) out.push('ratio');
  if (surface !== 'a11y') {
    let rest = text;
    for (const arg of args) if (typeof arg === 'number') rest = rest.split(String(arg)).join('');
    if (/\d/.test(rest)) out.push('digit not from an argument');
  }
  return out;
}

import { findBannedWord } from '../banned';
import type { UiLocale } from '../locales';

/**
 * The public site (`landing`) is read by parents too, so it is checked against the caregiver list
 * (learner words plus "behind", "lazy" and their es / ko equivalents) like every other namespace.
 * The only exception: these English sentences use "behind" spatially ("behind a parent-gate"),
 * never about progress. The exemption is per path and per word, English only, so a new "behind"
 * anywhere else in `landing`, or any banned word in an es / ko overlay, still fails.
 */
export const SPATIAL_BEHIND_PATHS: ReadonlySet<string> = new Set([
  'landing.legal.privacy.sections.account.paragraphs.p1',
  'landing.legal.terms.sections.accounts.paragraphs.p1',
]);

/**
 * Words of an older site that must not come back (F-SITE-002 site facts, 2026-10-21), in every locale: the v1.0
 * multiplication gate (the grown-up PIN replaced it), the pre-launch invite and "when Hangul Route launches" (the
 * app is live; the list sends launch news only), "nothing to install" (the app offers Install), and the romanized
 * greeting with no Hangul and no gloss (CLAUDE.md §1). Checked outside `legal.*`, whose English-authoritative text
 * names a school admin "invite link" on purpose.
 */
export const STALE_SITE_WORDS =
  /multiplic|곱셈|invite|invitaci[oó]n|초대|Hangul Route launches|Hangul Route se lance|Hangul Route가 출시|Nothing to install|instalar nada|설치할 것이 없|Annyeong/i;

/**
 * [SN] The schools section of `/teachers` (AMENDMENTS-SITE-NEWUSER §3.6) names the live school invite link on purpose,
 * as the legal text does: in these paths only the invite words are allowed; every other stale word is still checked.
 */
export const SCHOOL_INVITE_PATHS: ReadonlySet<string> = new Set([
  'landing.persona.teachers.schools.space',
  'landing.persona.teachers.schools.admins',
]);

/** Whether a landing string at `path` holds a word of an older site (`STALE_SITE_WORDS`), after the school invite exemption. */
export function staleSiteWord(text: string, path: string): boolean {
  const checked = SCHOOL_INVITE_PATHS.has(path) ? text.replace(/invite|invitaci[oó]n|초대/gi, ' ') : text;
  return STALE_SITE_WORDS.test(checked);
}

/** The first caregiver-banned word in a landing string at `path`, after the spatial "behind" exemption. */
export function landingBannedWord(text: string, locale: UiLocale, path: string): string | null {
  const checked = locale === 'en' && SPATIAL_BEHIND_PATHS.has(path) ? text.replace(/\bbehind\b/gi, ' ') : text;
  return findBannedWord(checked, locale, 'caregiver');
}

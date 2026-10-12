import { BANNED_WORDS, findBannedWord } from './banned';
import type { UiLocale } from './locales';

/**
 * The text guard for the optional free text of a note (F-FEEDBACK-001 §6.4).
 * Pure, and the only check: the console runs it before sending and the Worker
 * runs it on every send (the Worker is the authority).
 *
 * Imported through the subpath `@hangul-route/i18n/note-text`. It imports only
 * the banned-word finder, so the Worker bundle never pulls in the dictionaries.
 * Explicit character ranges, no property escapes and no look-behind (F-I18N-001 §3.1).
 */

/** At most 120 characters (code points) after normalising (OD-4). */
export const NOTE_TEXT_MAX = 120;

export type NoteTextProblem = 'empty' | 'too_long' | 'line_break' | 'link' | 'contact' | 'emoji' | 'tone' | 'invalid';

export type NoteTextResult = { ok: true; text: string } | { ok: false; problem: NoteTextProblem; word?: string };

/** A domain-shaped token ending in one of these is a link (§6.4 rule 5). Fixed list. */
export const NOTE_LINK_TLDS = [
  'com', 'net', 'org', 'io', 'co', 'kr', 'me', 'app', 'ly', 'gg', 'tv', 'info', 'biz', 'xyz', 'link',
  'site', 'online', 'us', 'uk', 'ca', 'es', 'mx', 'edu', 'gov', 'page', 'dev', 'to', 'so',
] as const;

/**
 * Words that contain a banned word but are fine (§6.4 rule 8). Korean matches
 * substrings, so `뒤처리` ("cleaning up") must not trip `뒤처`. Every entry needs
 * its own test.
 */
export const NOTE_TONE_ALLOW: Readonly<Record<UiLocale, readonly string[]>> = {
  en: [],
  es: [],
  ko: ['뒤처리'],
};

// U+0000-U+001F except tab, CR and LF (CR and LF are `line_break`), U+007F-U+009F,
// and the bidi embeddings, overrides and isolates.
const INVALID_CHARS = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/;
const LINE_BREAKS = /[\r\n\u2028\u2029]/;
const SPACE_RUNS = /[ \t]+/g;
const LINK_DOMAIN = new RegExp(`(?:[a-z0-9-]{2,}\\.)+(?:${NOTE_LINK_TLDS.join('|')})(?![a-z0-9à-ɏ-])`, 'i');
// Spaces, dots, dashes, plus signs and brackets are removed before counting digits.
const DIGIT_SEPARATORS = /[\s.\-+()[\]{}]+/g;
// U+1F000-U+1FAFF as surrogate pairs, U+2600-U+27BF, U+FE0F and U+200D: explicit ranges, no `u` flag.
const EMOJI = /\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|\uD83E[\uDC00-\uDEFF]|[\u2600-\u27BF\uFE0F\u200D]/;
// The whole space-separated token around `://` or `www.`.
const LINK_MARKER = /[^ ]*(?::\/\/|www\.)[^ ]*/i;
// ASCII and full-width digits and at signs, so a full-width keyboard does not slip past.
const SEVEN_DIGITS = /[0-9\uff10-\uff19]{7,}/;
const AT_SIGN = /[@\uff20]/;

function hasLoneSurrogate(text: string): boolean {
  for (let i = 0; i < text.length; i += 1) {
    const code = text.charCodeAt(i);
    if (code >= 0xd800 && code <= 0xdbff) {
      const next = text.charCodeAt(i + 1);
      if (!(next >= 0xdc00 && next <= 0xdfff)) return true;
      i += 1;
    } else if (code >= 0xdc00 && code <= 0xdfff) {
      return true;
    }
  }
  return false;
}

function composeNfc(text: string): string {
  // The guard runs in the Worker and the console; on a runtime without the
  // method (Hermes is unverified, F-I18N-001 §10) the code points stay as typed.
  return typeof String.prototype.normalize === 'function' ? text.normalize('NFC') : text;
}

/** Trim, compose to NFC, and fold runs of spaces and tabs into one space. Idempotent. */
export function normalizeNoteText(raw: string): string {
  return composeNfc(raw).replace(SPACE_RUNS, ' ').trim();
}

/** The link token as typed (case-insensitive match), so the console quotes what the adult wrote. */
function findLink(text: string): string | null {
  const match = LINK_MARKER.exec(text) ?? LINK_DOMAIN.exec(text);
  return match === null ? null : match[0];
}

function hasContact(text: string): boolean {
  return AT_SIGN.test(text) || SEVEN_DIGITS.test(text.replace(DIGIT_SEPARATORS, ''));
}

function findTone(text: string): string | null {
  for (const locale of Object.keys(BANNED_WORDS) as UiLocale[]) {
    let masked = text.toLowerCase();
    for (const allowed of NOTE_TONE_ALLOW[locale]) masked = masked.split(allowed).join(' ');
    const hit = findBannedWord(masked, locale, 'caregiver');
    if (hit !== null) return hit;
  }
  return null;
}

/**
 * Check a note's free text. The first problem found, in the order of §6.4, is
 * returned; `word` names the matched token for `link` and `tone` so the console
 * can quote it. The guard does not judge meaning (§8 covers that).
 */
export function checkNoteText(raw: string): NoteTextResult {
  if (INVALID_CHARS.test(raw) || hasLoneSurrogate(raw)) return { ok: false, problem: 'invalid' };
  if (LINE_BREAKS.test(raw)) return { ok: false, problem: 'line_break' };

  const text = normalizeNoteText(raw);
  if (text === '') return { ok: false, problem: 'empty' };
  if (Array.from(text).length > NOTE_TEXT_MAX) return { ok: false, problem: 'too_long' };

  const link = findLink(text);
  if (link !== null) return { ok: false, problem: 'link', word: link };
  if (hasContact(text)) return { ok: false, problem: 'contact' };
  if (EMOJI.test(text)) return { ok: false, problem: 'emoji' };

  const tone = findTone(text);
  if (tone !== null) return { ok: false, problem: 'tone', word: tone };

  return { ok: true, text };
}

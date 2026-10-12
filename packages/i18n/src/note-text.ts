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
  'be', 'gl', 'ai', 'ru', 'jp', 'live', 'chat', 'club', 'gd', 'cc',
] as const;

/**
 * Words and phrases that contain a banned word but are fine (§6.4 rule 8).
 * Korean matches substrings, so `뒤처리` ("cleaning up") must not trip `뒤처`;
 * English and Spanish entries match whole tokens, so "We missed you" passes
 * while "You missed your chance" does not. Every entry needs its own test.
 */
export const NOTE_TONE_ALLOW: Readonly<Record<UiLocale, readonly string[]>> = {
  en: ['missed you', 'behind you'],
  es: [],
  ko: ['뒤처리'],
};

// Rule 1. C0 controls except tab, CR and LF (CR and LF are `line_break`), DEL and C1;
// invisible and format characters that would hide a link or a number from the other
// rules: soft hyphen, combining grapheme joiner, Arabic letter mark, Hangul fillers,
// Khmer inherent vowels, Mongolian selectors and vowel separator, zero-width space and
// non-joiner, direction marks, bidi embeddings, overrides and isolates, word joiner and
// invisible operators, deprecated format characters, Braille blank, variation selectors
// 1-15, byte order mark, interlinear annotations; then tag characters and supplementary
// variation selectors (U+E0000-U+E007F, U+E0100-U+E01EF) and the mathematical letters
// and digits (U+1D400-U+1D7FF) as surrogate pairs. U+200D is left to the emoji rule.
const INVALID_CHARS =
  /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f\u00ad\u034f\u061c\u115f\u1160\u17b4\u17b5\u180b-\u180f\u200b\u200c\u200e\u200f\u202a-\u202e\u2060-\u2064\u2066-\u206f\u2800\u3164\ufe00-\ufe0e\ufeff\uffa0\ufff9-\ufffb]|\uDB40[\uDC00-\uDC7F\uDD00-\uDDEF]|\uD835[\uDC00-\uDFFF]/;
// Combining marks: a run of more than two is `invalid` (stacked marks spill over the
// note); single ones are dropped from the copy the link, contact and tone rules read.
const MARK_RANGES = '\\u0300-\\u036f\\u1ab0-\\u1aff\\u1dc0-\\u1dff\\u20d0-\\u20ff\\ufe20-\\ufe2f';
const STACKED_MARKS = new RegExp(`[${MARK_RANGES}]{3,}`);
const LINE_BREAKS = /[\r\n\u2028\u2029]/;
const SPACE_RUNS = /[ \t]+/g;

// Rule 5, read on the folded copy. `://` anywhere, or `www.` at the start of a token
// ("Awww." is not a link); the console quotes the whole space-separated token.
const LINK_MARKER = /:\/\/|(?:^|[^a-z0-9])www\./i;
const LINK_DOMAIN = new RegExp(`(?:[a-z0-9-]+\\.)+(?:${NOTE_LINK_TLDS.join('|')})(?![a-z0-9à-ɏ-])`, 'i');

// Rule 6, read on the folded copy. Removed anywhere before counting digits:
// whitespace, dots, dashes, plus signs and brackets.
const SEPARATOR_CHARS = '\\s.\\-+()[\\]{}';
// Removed only when one sits between two digits ("010,1234,5678"), so a spaced list
// ("Day 3, 4, 5") still passes: commas, slashes, underscores, tildes, middle dots,
// bullets, hyphens and dashes, minus signs, wave dashes and katakana middle dots.
const JOIN_CHARS =
  ',/_~\\u00b7\\u2010-\\u2015\\u2022\\u2027\\u2043\\u2212\\u2219\\u22c5\\u301c\\u30fb\\ufe58\\ufe63\\uff65';
const DIGIT_SEPARATORS = new RegExp(`[${SEPARATOR_CHARS}]+`, 'g');
const DIGIT_JOINS = new RegExp(`(\\d)[${JOIN_CHARS}](?=\\d)`, 'g');
// A calendar date (2026.10.11, 2026. 10. 11., 2026-10-11, 10/12/2026, 12.10.2026) is
// not a phone number, so it is set aside before counting, but only when no other digit
// touches it through separators ("Call 010 2026.10.11" is still a contact).
const DAY = '(?:0?[1-9]|[12]\\d|3[01])';
const MONTH = '(?:0?[1-9]|1[0-2])';
const YEAR = '(?:19|20)\\d\\d';
const DATE = new RegExp(
  `(^|[^0-9${SEPARATOR_CHARS}${JOIN_CHARS}])[${SEPARATOR_CHARS}${JOIN_CHARS}]*` +
    `(?:${YEAR}([./-]) ?${MONTH}\\2 ?${DAY}|${DAY}([./-]) ?${DAY}\\3 ?${YEAR})` +
    `(?![${SEPARATOR_CHARS}${JOIN_CHARS}]*[0-9])`,
  'g',
);
const SEVEN_DIGITS = /\d{7,}/;
const AT_SIGN = /[@\ufe6b]/;

// Rule 7. U+1F000-U+1FAFF as surrogate pairs; U+2600-U+27BF; the emoji-presentation
// symbols outside it (watch, hourglass, media keys, small squares, curved and plain
// arrows, large squares, star, circle, wavy dash, part alternation mark, circled
// ideographs); the keycap U+20E3, U+FE0F and U+200D. Explicit ranges, no `u` flag.
const EMOJI =
  /\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|\uD83E[\uDC00-\uDEFF]|[\u200d\u20e3\u231a\u231b\u23e9-\u23f3\u23f8-\u23fa\u25fd\u25fe\u2600-\u27bf\u2934\u2935\u2b05-\u2b07\u2b1b\u2b1c\u2b50\u2b55\u3030\u303d\u3297\u3299\ufe0f]/;

// Rule 8. The same token split as `banned.ts`, for whole-token allow-list phrases.
const TOKEN_SPLIT = /[^a-zà-ɏ0-9]+/;

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

const SUPERSCRIPT_DIGITS: Readonly<Record<number, string>> = { 0x2070: '0', 0x00b9: '1', 0x00b2: '2', 0x00b3: '3' };

function isMark(code: number): boolean {
  return (
    (code >= 0x0300 && code <= 0x036f) ||
    (code >= 0x1ab0 && code <= 0x1aff) ||
    (code >= 0x1dc0 && code <= 0x1dff) ||
    (code >= 0x20d0 && code <= 0x20ff) ||
    (code >= 0xfe20 && code <= 0xfe2f)
  );
}

/** The ASCII look-alike a reader would see, or null to keep the character as typed. */
function foldChar(code: number): string | null {
  if (code >= 0xff01 && code <= 0xff5e) return String.fromCharCode(code - 0xfee0); // full-width ASCII
  if (code === 0x3002 || code === 0xff61) return '.'; // ideographic and halfwidth full stops
  if (code >= 0x2460 && code <= 0x2468) return String.fromCharCode(code - 0x2460 + 0x31); // circled 1-9
  if (code === 0x24ea) return '0'; // circled 0
  if (code >= 0x24b6 && code <= 0x24cf) return String.fromCharCode(code - 0x24b6 + 0x41); // circled A-Z
  if (code >= 0x24d0 && code <= 0x24e9) return String.fromCharCode(code - 0x24d0 + 0x61); // circled a-z
  if (code >= 0x2074 && code <= 0x2079) return String.fromCharCode(code - 0x2074 + 0x34); // superscript 4-9
  if (code >= 0x2080 && code <= 0x2089) return String.fromCharCode(code - 0x2080 + 0x30); // subscript 0-9
  return SUPERSCRIPT_DIGITS[code] ?? null;
}

/**
 * The copy the link, contact and tone rules read: look-alike characters folded to
 * ASCII and lone combining marks dropped, so a full-width "kim.com" or one with a
 * stroke mark over a letter reads as "kim.com". `at[i]` is the index in `text` of folded character `i` (and
 * `at[folded.length]` is `text.length`), so a match is quoted as the adult typed it.
 */
function foldForCheck(text: string): { folded: string; at: number[] } {
  let folded = '';
  const at: number[] = [];
  for (let i = 0; i < text.length; i += 1) {
    const code = text.charCodeAt(i);
    if (isMark(code)) continue;
    folded += foldChar(code) ?? text.charAt(i);
    at.push(i);
  }
  at.push(text.length);
  return { folded, at };
}

/** The link token as typed, so the console quotes what the adult wrote. */
function findLink(text: string, folded: string, at: readonly number[]): string | null {
  const marker = LINK_MARKER.exec(folded);
  if (marker !== null) {
    // The last character of the marker ('/' or '.') is never a space.
    const anchor = at[marker.index + marker[0].length - 1] as number;
    const end = text.indexOf(' ', anchor);
    return text.slice(text.lastIndexOf(' ', anchor) + 1, end === -1 ? text.length : end);
  }
  const domain = LINK_DOMAIN.exec(folded);
  if (domain === null) return null;
  return text.slice(at[domain.index], at[domain.index + domain[0].length]);
}

function hasContact(folded: string): boolean {
  if (AT_SIGN.test(folded)) return true;
  const digits = folded.replace(DATE, '$1 ').replace(DIGIT_JOINS, '$1').replace(DIGIT_SEPARATORS, '');
  return SEVEN_DIGITS.test(digits);
}

function tokenLine(text: string): string {
  return ` ${text.toLowerCase().split(TOKEN_SPLIT).filter((t) => t !== '').join(' ')} `;
}

/** The text with this locale's allow-list entries blanked out (substrings in Korean, whole tokens otherwise). */
function maskAllowed(text: string, locale: UiLocale): string {
  if (locale === 'ko') {
    let masked = text.toLowerCase();
    for (const allowed of NOTE_TONE_ALLOW.ko) masked = masked.split(allowed).join(' ');
    return masked;
  }
  let line = tokenLine(text);
  for (const allowed of NOTE_TONE_ALLOW[locale]) {
    const phrase = tokenLine(allowed);
    while (line.includes(phrase)) line = line.split(phrase).join(' ');
  }
  return line;
}

function findTone(folded: string): string | null {
  for (const locale of Object.keys(BANNED_WORDS) as UiLocale[]) {
    const hit = findBannedWord(maskAllowed(folded, locale), locale, 'caregiver');
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
  if (INVALID_CHARS.test(raw) || STACKED_MARKS.test(raw) || hasLoneSurrogate(raw)) {
    return { ok: false, problem: 'invalid' };
  }
  if (LINE_BREAKS.test(raw)) return { ok: false, problem: 'line_break' };

  const text = normalizeNoteText(raw);
  if (text === '') return { ok: false, problem: 'empty' };
  if (Array.from(text).length > NOTE_TEXT_MAX) return { ok: false, problem: 'too_long' };

  const { folded, at } = foldForCheck(text);
  const link = findLink(text, folded, at);
  if (link !== null) return { ok: false, problem: 'link', word: link };
  if (hasContact(folded)) return { ok: false, problem: 'contact' };
  if (EMOJI.test(text)) return { ok: false, problem: 'emoji' };

  const tone = findTone(folded);
  if (tone !== null) return { ok: false, problem: 'tone', word: tone };

  return { ok: true, text };
}

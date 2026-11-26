/**
 * The reviewed romanization (AMENDMENTS-ROMANIZER-GAPS §3.3): `romanize()` with the reviewed
 * exceptions applied, for every place that composes a romanization a learner sees or that must
 * agree with a stored one. Pure; imports `rr.ts` and `exceptions.ts` only (F-CNT-002 C1).
 *
 * A whole-string entry (its `ko` equals the text, both without their edge marks and spaces) gives its first allowed value. Otherwise the
 * text is split and stripped exactly as `romanize()` does, and a token that is a word entry (an
 * entry whose `ko` has no whitespace) gives that entry's first allowed value; every other token
 * is read by the converter. With no matching entry the result is `romanize(text)`.
 */
import { ROMANIZATION_EXCEPTIONS, type RomanizationException } from './exceptions';
import { romanizeWord } from './rr';

/** The characters `romanize()` removes from a token before it is read (kept equal to rr.ts; a test pins it). */
const STRIPPED = /[-!?.,~·…"'“”‘’]/g;

/** The same characters at the two edges of a text, and whitespace: a whole-string entry is compared without them. */
const EDGE = /^[-!?.,~·…"'“”‘’\s]+|[-!?.,~·…"'“”‘’\s]+$/g;

/** The key a whole-string entry is looked up by: the text without its edge marks (`…쪄요.` and `…쪄요` are one entry). */
export function wholeEntryKey(text: string): string {
  return text.replace(EDGE, '');
}

/** The shape `romanize()` returns: NFC, lower case, no marks, apostrophes or hyphens, single spaces. */
function normalizeValue(value: string): string {
  return value
    .normalize('NFC')
    .toLowerCase()
    .replace(/['’‘]/g, '')
    .replace(/[.,!?~·…"“”]/g, '')
    .replace(/-/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

interface EntryIndex {
  /** Trimmed `ko` to the entry's normalised first allowed value. */
  whole: ReadonlyMap<string, string>;
  /** The same for the entries whose `ko` is one word, keyed by the word with sentence marks stripped. */
  word: ReadonlyMap<string, string>;
}

const INDEXES = new WeakMap<readonly RomanizationException[], EntryIndex>();

/** The first entry for a key wins; an entry with no allowed value is ignored. */
function indexOf(exceptions: readonly RomanizationException[]): EntryIndex {
  const cached = INDEXES.get(exceptions);
  if (cached !== undefined) return cached;
  const whole = new Map<string, string>();
  const word = new Map<string, string>();
  for (const e of exceptions) {
    const first = e.allowed[0];
    if (first === undefined) continue;
    const value = normalizeValue(first);
    const ko = e.ko.trim();
    const key = wholeEntryKey(ko);
    if (!whole.has(key)) whole.set(key, value);
    const core = ko.replace(STRIPPED, '');
    if (!/\s/.test(ko) && !word.has(core)) word.set(core, value);
  }
  const index = { whole, word };
  INDEXES.set(exceptions, index);
  return index;
}

/**
 * `romanize(text)` with the reviewed exceptions applied (see the file comment). `unknown` lists the
 * tokens the converter cannot read, as `romanize()` does; they stay in `text` as written.
 */
export function romanizeReviewed(
  text: string,
  exceptions: readonly RomanizationException[] = ROMANIZATION_EXCEPTIONS,
): { text: string; unknown: string[] } {
  const index = indexOf(exceptions);
  const whole = index.whole.get(wholeEntryKey(text));
  if (whole !== undefined) return { text: whole, unknown: [] };
  const words: string[] = [];
  const unknown: string[] = [];
  for (const token of text.split(/\s+/)) {
    const core = token.replace(STRIPPED, '');
    if (core === '') continue;
    const reviewed = index.word.get(core);
    if (reviewed !== undefined) {
      words.push(reviewed);
      continue;
    }
    const rr = romanizeWord(core);
    if (rr === null) {
      unknown.push(token);
      words.push(token);
    } else {
      words.push(rr);
    }
  }
  return { text: words.join(' '), unknown };
}

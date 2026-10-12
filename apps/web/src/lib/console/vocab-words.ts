import type { MessageLocale } from '@hangul-route/i18n';
import { VOCAB_CATALOG, type VocabCatalogEntry } from '../../data/vocab-catalog';
import type { RosterVocab } from './api';
import { parseVocabSummary } from './vocab-summary';

/**
 * The console's vocabulary words — F-VOC-005 P-4 (section 3.8, behaviour 14).
 *
 * A word on a teacher or family surface always travels with its romanization and its gloss in
 * the UI language (CLAUDE.md section 1), looked up in the generated catalogue
 * (`data/vocab-catalog.ts`, F-VOC-001 section 3.7), so the web app needs no vocabulary logic.
 * The gloss also tells the two senses of a homonym apart (`vocab:nun-eye` reads nun (eye), `vocab:nun-snow` nun (snow)).
 */

export interface ConsoleWord {
  id: string;
  /** The Hangul, drawn with `lang="ko"`; null for an id this build does not know. */
  ko: string | null;
  romanization: string;
  /**
   * The gloss in the UI language, English when the catalogue has none for it, shaped by
   * `consoleGloss` (no second romanization, no nested brackets); null for an unknown id.
   */
  gloss: string | null;
}

const BY_ID: ReadonlyMap<string, VocabCatalogEntry> = new Map(VOCAB_CATALOG.map((entry) => [entry.id, entry]));
const ID_PREFIX = 'vocab:';

/** One word for the console. An unknown id (a newer app) is shown by its romanized slug with no Hangul. */
export function consoleWord(id: string, locale: MessageLocale): ConsoleWord {
  const entry = BY_ID.get(id);
  if (!entry) return { id, ko: null, romanization: id.startsWith(ID_PREFIX) ? id.slice(ID_PREFIX.length) : id, gloss: null };
  const glosses: Readonly<Partial<Record<string, string>>> = entry.glosses;
  return { id, ko: entry.ko, romanization: entry.romanization, gloss: consoleGloss(glosses[locale] ?? entry.en, entry.romanization) };
}

/** "head (inner)": a gloss that carries its own parenthetical. */
const PARENTHETICAL = /^(.+?)\s*\(([^()]+)\)$/;

/**
 * A catalogue gloss as the console draws it after "<Hangul> <romanization>", inside the one pair
 * of brackets of `wordGloss`. Some glosses were written to stand alone, so they open with the word
 * itself ("tteokbokki (spicy rice cakes)") or carry a note of their own ("older sister (said by a
 * woman or girl)"). Wrapped as they are, the card would read "tteokbokki (tteokbokki (...))". So a
 * gloss whose head is the romanization keeps only its explanation, and any other parenthetical
 * becomes a comma: one level of brackets, the romanization said once.
 */
export function consoleGloss(gloss: string, romanization: string): string {
  const match = PARENTHETICAL.exec(gloss);
  if (!match) return gloss;
  const head = match[1] ?? '';
  const inner = match[2] ?? '';
  return namesTheWord(head, romanization) ? inner : `${head}, ${inner}`;
}

/** The romanization shortest at which a one-letter spelling difference still names the same word. */
const FUZZY_MIN_LENGTH = 5;

/**
 * True when a gloss head is the romanized word, in any case, or its usual English spelling one
 * letter away ("Hangul" for hangeul). Short words must match exactly, so "i" never stands for "a".
 */
function namesTheWord(head: string, romanization: string): boolean {
  const a = head.toLowerCase();
  const b = romanization.toLowerCase();
  if (a === b) return true;
  return Math.min(a.length, b.length) >= FUZZY_MIN_LENGTH && withinOneEdit(a, b);
}

/** Levenshtein distance of at most one. */
function withinOneEdit(a: string, b: string): boolean {
  if (Math.abs(a.length - b.length) > 1) return false;
  let i = 0;
  let j = 0;
  let edits = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      i += 1;
      j += 1;
      continue;
    }
    edits += 1;
    if (edits > 1) return false;
    if (a.length > b.length) i += 1;
    else if (b.length > a.length) j += 1;
    else {
      i += 1;
      j += 1;
    }
  }
  return edits + (a.length - i) + (b.length - j) <= 1;
}

export function consoleWords(ids: readonly string[], locale: MessageLocale): ConsoleWord[] {
  return ids.map((id) => consoleWord(id, locale));
}

export interface StudentWords {
  collected: number;
  strong: number;
  /** Up to three words to look at together, each once, in the order the learner's device sent them. */
  revisit: ConsoleWord[];
}

/**
 * A student card's word lines, or null when the roster carries no readable `summary.vocab`.
 *
 * The Worker projects a roster summary to the teacher allow-list, and `vocab` stays on
 * `TEACHER_HIDDEN_SUMMARY_KEYS` until a consent item covers it, so today no roster carries it and
 * the card shows no word line. The first-try rate is never read here: it stays off the roster
 * (section 3.8).
 */
export function studentWords(summary: { vocab?: RosterVocab } | null | undefined, locale: MessageLocale): StudentWords | null {
  const vocab = parseVocabSummary(summary?.vocab);
  if (!vocab) return null;
  const { collected, strong, needsPractice } = vocab;
  // A word listed twice is shown once (the roll-up counts it once too), first-seen order kept.
  return { collected, strong, revisit: consoleWords([...new Set(needsPractice)], locale) };
}

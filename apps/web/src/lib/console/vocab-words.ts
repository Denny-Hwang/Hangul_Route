import type { ProgressSummary } from '@hangul-route/content-schema';
import type { MessageLocale } from '@hangul-route/i18n';
import { VOCAB_CATALOG, type VocabCatalogEntry } from '../../data/vocab-catalog';
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
  /** The gloss in the UI language, English when the catalogue has none for it; null for an unknown id. */
  gloss: string | null;
}

const BY_ID: ReadonlyMap<string, VocabCatalogEntry> = new Map(VOCAB_CATALOG.map((entry) => [entry.id, entry]));
const ID_PREFIX = 'vocab:';

/** One word for the console. An unknown id (a newer app) is shown by its romanized slug with no Hangul. */
export function consoleWord(id: string, locale: MessageLocale): ConsoleWord {
  const entry = BY_ID.get(id);
  if (!entry) return { id, ko: null, romanization: id.startsWith(ID_PREFIX) ? id.slice(ID_PREFIX.length) : id, gloss: null };
  const glosses: Readonly<Partial<Record<string, string>>> = entry.glosses;
  return { id, ko: entry.ko, romanization: entry.romanization, gloss: glosses[locale] ?? entry.en };
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
export function studentWords(summary: Partial<Pick<ProgressSummary, 'vocab'>> | null | undefined, locale: MessageLocale): StudentWords | null {
  const vocab = parseVocabSummary(summary?.vocab);
  if (!vocab) return null;
  const { collected, strong, needsPractice } = vocab;
  // A word listed twice is shown once (the roll-up counts it once too), first-seen order kept.
  return { collected, strong, revisit: consoleWords([...new Set(needsPractice)], locale) };
}

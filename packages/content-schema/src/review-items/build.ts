import { z } from 'zod';
import { lessonOccurrences, stage1Occurrences, storyOccurrences, type ItemOccurrence, type LessonSource, type ReviewSymbol, type Stage1Data } from './extract';
import { buildReviewItems, vocabIndex, type ReviewItemsBuild, type SenseGroup, type StableIdSnapshot, type TopicWord } from './stable-ids';

/**
 * The three extraction sources merged into one set of review items (F-CURR-002 §4.2, row CM-10):
 * scripts/build-review-items.mjs writes the lazy `review-items` chunk from it, and the
 * `items-stable-id` rule of the lesson lint runs it over the content tree. Build time only.
 */

const OccurrenceSchema = z
  .object({
    kind: z.enum(['sym', 'syl', 'lex', 'pat', 'exc', 'rea']),
    ko: z.string().min(1),
    romanization: z.string(),
    en: z.string().optional(),
    glossKey: z.string().optional(),
    picture: z.string().optional(),
    ref: z.string().optional(),
    cell: z.string().min(1),
    home: z.string().min(1),
    stage: z.number().int().min(1).max(7),
    volume: z.number().int().min(1),
    source: z.enum(['discover', 'round']),
    at: z.string().min(1),
  })
  .strict();

const SymbolSchema = z.object({ id: z.string().regex(/^jamo:[a-z0-9-]+$/), char: z.string().length(1), kind: z.enum(['consonant', 'vowel', 'batchim']), romanization: z.string().min(1) }).strict();

/**
 * `stage1-items.json`: the frozen Stage 1 table. `symbols` is the app's symbol table (`jamoKnown`:
 * the 30 Stage 1 symbols and Word Builder's), which every source reads a letter's character from;
 * `occurrences` are Stage 1's symbols, syllable blocks and words (`stage1Occurrences`).
 */
export const Stage1TableSchema = z
  .object({
    schemaVersion: z.literal(1),
    symbols: z.array(SymbolSchema).min(1),
    occurrences: z.array(OccurrenceSchema),
  })
  .strict();
export type Stage1Table = z.output<typeof Stage1TableSchema>;

/** The frozen Stage 1 table of the Stage 1 data: what `stage1-items.json` must hold (the parity test). */
export function stage1Table(data: Stage1Data): Stage1Table {
  return {
    schemaVersion: 1,
    symbols: data.symbols.map(({ id, char, kind, romanization }) => ({ id, char, kind, romanization })),
    occurrences: stage1Occurrences(data),
  };
}

export interface StorySource {
  file: string;
  story: unknown;
}

export interface ReviewItemSources {
  stage1: Stage1Table;
  /** The shipped lesson cells (and ready pack levels), in route order. */
  lessons: readonly LessonSource[];
  /** The shipped (ready) stories. */
  stories: readonly StorySource[];
  /** Every topic word of content/vocab/<topic>.json. */
  topicWords: readonly TopicWord[];
  /** content/vocab/_senses.json `groups`. */
  senseGroups: readonly SenseGroup[];
  snapshot: StableIdSnapshot;
}

/** Every occurrence of the three sources: Stage 1, the lessons, the stories. */
export function allOccurrences(sources: Pick<ReviewItemSources, 'stage1' | 'lessons' | 'stories'>): ItemOccurrence[] {
  const symbols: readonly ReviewSymbol[] = sources.stage1.symbols;
  return [
    ...(sources.stage1.occurrences as ItemOccurrence[]),
    ...sources.lessons.flatMap((l) => lessonOccurrences(l, symbols)),
    ...sources.stories.flatMap((s) => storyOccurrences(s.story, s.file, symbols)),
  ];
}

export function reviewItemsOf(sources: ReviewItemSources): ReviewItemsBuild {
  return buildReviewItems(allOccurrences(sources), sources.snapshot, vocabIndex(sources.topicWords, sources.senseGroups), sources.stage1.symbols);
}

// ---- the committed files, one entry per line (small diffs, few conflicts) -----------------------------

const lines = (entries: readonly string[], indent: string): string => (entries.length === 0 ? '' : `\n${entries.map((e) => `${indent}${e}`).join(',\n')}\n  `);

/** `items-stable-id.json` as committed: one key and its frozen id, alias or retired id per line, sorted by id. */
export function serializeSnapshot(snapshot: StableIdSnapshot): string {
  const byId = (a: [string, string], b: [string, string]): number => (a[1] < b[1] ? -1 : a[1] > b[1] ? 1 : a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0);
  const pairs = (record: Readonly<Record<string, string>>): string[] =>
    Object.entries(record)
      .sort(byId)
      .map(([k, v]) => `${JSON.stringify(k)}: ${JSON.stringify(v)}`);
  return (
    '{\n' +
    '  "schemaVersion": 1,\n' +
    `  "ids": {${lines(pairs(snapshot.ids), '    ')}},\n` +
    `  "alias": {${lines(pairs(snapshot.alias), '    ')}},\n` +
    `  "retired": [${lines([...snapshot.retired].sort().map((id) => JSON.stringify(id)), '    ')}]\n` +
    '}\n'
  );
}

/** `stage1-items.json` as committed: one symbol or occurrence per line, in extraction order. */
export function serializeStage1Table(table: Stage1Table): string {
  return (
    '{\n' +
    '  "schemaVersion": 1,\n' +
    `  "symbols": [${lines(table.symbols.map((s) => JSON.stringify(s)), '    ')}],\n` +
    `  "occurrences": [${lines(table.occurrences.map((o) => JSON.stringify(o)), '    ')}]\n` +
    '}\n'
  );
}

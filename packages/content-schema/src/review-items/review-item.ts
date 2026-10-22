import { z } from 'zod';
import { romanize } from '../romanization/rr';
import { ThemeKeySchema } from '../schemas/heritage-card';
import { PictureRefSchema } from '../schemas/ko-text';
import { VocabIdSchema } from '../schemas/vocab';

/**
 * Review items (F-CURR-002 §4.2, row CM-10): every taught unit, with a stable id the build
 * creates. The runtime half: the item shape, its id grammar, the formats it allows (the rungs
 * by kind of §4.3) and the compact rows of the lazy `review-items` chunk. Build-time extraction
 * and the frozen-id checks are `./extract.ts` and `./stable-ids.ts`, which only the build and
 * the lint load (through `@hangul-route/content-schema/lint`), so the app never carries them.
 *
 * This module is reached through `@hangul-route/content-schema/review-items`, never through
 * the package barrel: the barrel is in the start bundle, and nothing learner-visible reads
 * review items before row CM-13.
 */

export const REVIEW_ITEM_KINDS = ['sym', 'syl', 'lex', 'pat', 'exc', 'rea'] as const;
export const ReviewItemKindSchema = z.enum(REVIEW_ITEM_KINDS);
export type ReviewItemKind = z.infer<typeof ReviewItemKindSchema>;

/**
 * `<kind>:<slug>` with an optional `~<sense or variant>` (`lex:sagwa`, `lex:bae~pear`,
 * `pat:n-juseyo`, `sym:bieup-batchim`). The slug is the F-CNT-002 romanization of the item;
 * the part after `~` keeps apart a homograph (its sense from content/vocab/_senses.json) or
 * a second spelling with the same romanization (`lex:nat~2`).
 */
export const REVIEW_ITEM_ID_RE = /^(sym|syl|lex|pat|exc|rea):[a-z0-9]+(?:-[a-z0-9]+)*(?:~[a-z0-9]+(?:-[a-z0-9]+)*)?$/;

/** A review item id: the grammar above, or a topic word's own `vocab:` id (it stays one item, not two). */
export const ReviewItemIdSchema = z.union([z.string().regex(REVIEW_ITEM_ID_RE), VocabIdSchema]);
export type ReviewItemId = z.infer<typeof ReviewItemIdSchema>;

/** The kind an id names: its prefix, and `lex` for a topic word. Undefined for anything that is not an id. */
export function kindOfId(id: string): ReviewItemKind | undefined {
  if (VocabIdSchema.safeParse(id).success) return 'lex';
  return REVIEW_ITEM_ID_RE.test(id) ? (id.slice(0, 3) as ReviewItemKind) : undefined;
}

/**
 * The review formats, one per way of asking (§4.3 rungs by kind, §7.1 new formats). The rung
 * a format serves is `FORMAT_RUNG`; the review engine (row CM-13) picks among an item's formats.
 */
export const REVIEW_FORMATS = [
  'hear-pick', // recognize: hear it, pick it (a symbol, block, word, sentence, or a line's reply)
  'read-pick', // read: see it, pick its sound, picture or meaning (a realia card: answer its question)
  'type-see', // produce: Type Hangul `see`
  'type-picture', // produce: Type Hangul `picture` (only an item with a picture)
  'dictation', // produce: Type Hangul `hear` (only an item that passes `dictation-unambiguous`)
  'syllable-build', // produce: Syllable Build
  'match-shape', // produce: Match Shape (a symbol)
  'cloze-pick', // produce: Cloze Pick
  'sentence-builder', // produce: Sentence Builder (a sentence, or the words of a reply)
] as const;
export const ReviewFormatSchema = z.enum(REVIEW_FORMATS);
export type ReviewFormat = z.infer<typeof ReviewFormatSchema>;

export type ReviewRung = 'recognize' | 'read' | 'produce';
export const FORMAT_RUNG: Readonly<Record<ReviewFormat, ReviewRung>> = {
  'hear-pick': 'recognize',
  'read-pick': 'read',
  'type-see': 'produce',
  'type-picture': 'produce',
  dictation: 'produce',
  'syllable-build': 'produce',
  'match-shape': 'produce',
  'cloze-pick': 'produce',
  'sentence-builder': 'produce',
};

/** The formats each kind may ever use (§4.3 rungs by kind); an item allows a subset (`allowedFormats`). */
export const FORMATS_BY_KIND: Readonly<Record<ReviewItemKind, readonly ReviewFormat[]>> = {
  sym: ['hear-pick', 'read-pick', 'syllable-build', 'match-shape'],
  syl: ['hear-pick', 'read-pick', 'syllable-build'],
  lex: ['hear-pick', 'read-pick', 'type-see', 'type-picture', 'dictation', 'syllable-build'],
  pat: ['hear-pick', 'read-pick', 'cloze-pick', 'sentence-builder'],
  exc: ['hear-pick', 'read-pick', 'sentence-builder'],
  // Two rungs only: a realia card has nothing to hear.
  rea: ['read-pick', 'cloze-pick'],
};

const PACK_RE = /^pack:[a-z0-9]+(?:-[a-z0-9]+)*$/;
/** A cell that teaches an item: a grid episode (Stage 1 and the lesson cells, Volume 2, pack levels) or a story. */
export const TEACHING_CELL_RE = /^(?:episode:[a-z0-9]+(?:-[a-z0-9]+)*|story:[a-z0-9]+(?:-[a-z0-9]+)*)$/;

const KoLineSchema = z.object({
  ko: z.string().min(1),
  romanization: z.string().min(1),
  en: z.string().min(1).optional(),
  glossKey: z.string().min(1).optional(),
});

export const ReviewItemSchema = z
  .object({
    id: ReviewItemIdSchema,
    kind: ReviewItemKindSchema,
    /** The Korean the item shows: a symbol, a block, a word, a sentence or frame, an exchange's line, a realia card's word. */
    ko: z.string().min(1),
    romanization: z.string().min(1),
    /** The English gloss as authored; a symbol and a bare syllable block have none. */
    en: z.string().min(1).optional(),
    /** Where the gloss is localized: `<entity id>#<overlay field>` (F-I18N-001), e.g. `vocab:sagwa-apple#gloss`. */
    glossKey: z.string().regex(/^[a-z0-9-]+:[^#\s]+#[^\s]+$/).optional(),
    /** An exchange's reply (kind `exc` only). */
    reply: KoLineSchema.optional(),
    /** A picture that shows the item (Type Hangul `picture`, a picture option). */
    picture: PictureRefSchema.optional(),
    /** The grid theme of the first cell that teaches it, or the pack (`pack:<key>`) for an item a pack teaches first. */
    home: z.union([ThemeKeySchema, z.string().regex(PACK_RE)]),
    /** The first stage that teaches it (1-7). */
    stage: z.number().int().min(1).max(7),
    /** The first volume that teaches it (Volume 2 is row CM-40). */
    volume: z.number().int().min(1),
    /** Every cell or story that teaches it or asks it in a scored round, in route order. */
    cells: z.array(z.string().regex(TEACHING_CELL_RE)).min(1),
    formats: z.array(ReviewFormatSchema).min(1),
    /** The standard pronunciation differs from the spelling (§4.5): the item stays out of hear-mode rounds until recordings A-9 and A-10. */
    soundChange: z.boolean(),
    /** Taught items with another spelling and the same pronunciation (낫 / 낮 / 낯): a heard round never asks them apart (§4.5). */
    homophoneOf: z.array(ReviewItemIdSchema),
  })
  .superRefine((item, ctx) => {
    const issue = (path: string, message: string) => ctx.addIssue({ code: z.ZodIssueCode.custom, path: [path], message });
    if (kindOfId(item.id) !== item.kind) issue('id', `the id ${item.id} does not name a ${item.kind} item`);
    if ((item.reply !== undefined) !== (item.kind === 'exc')) issue('reply', 'an exchange (exc) carries its reply, and no other kind does');
    const allowed = FORMATS_BY_KIND[item.kind];
    item.formats.forEach((f) => {
      if (!allowed.includes(f)) issue('formats', `a ${item.kind} item is never asked as ${f}`);
    });
    if (new Set(item.formats).size !== item.formats.length) issue('formats', 'a format is listed once');
    if (new Set(item.cells).size !== item.cells.length) issue('cells', 'a cell is listed once');
    if (item.homophoneOf.includes(item.id)) issue('homophoneOf', 'an item is not its own homophone');
  });
export type ReviewItem = z.infer<typeof ReviewItemSchema>;

// ---- the compact rows of the chunk (F-CURR-002 §10: 150,000 B raw / 30,000 B gzip) ----------------------

/**
 * One item as the chunk holds it, positional so the index fits its budget line:
 * [id, ko, romanization, en, glossKey, home, meta, cells, formats, homophoneOf, reply, picture].
 *   - romanization: '' when it is the F-CNT-002 converter's reading of `ko` (`romanize`);
 *   - en, glossKey, picture: '' when absent; glossKey abbreviated (`packGlossKey`), '=' for `<id>#gloss`;
 *   - home: an index into the chunk's `homes`; cells: indexes into its `cells`;
 *   - meta: stage | volume << 3 | soundChange << 8; formats: a bitmask over REVIEW_FORMATS;
 *   - reply: 0, or [ko, romanization, en, glossKey] packed the same way.
 */
export type ReviewItemRow = readonly [
  id: string,
  ko: string,
  romanization: string,
  en: string,
  glossKey: string,
  home: number,
  meta: number,
  cells: readonly number[],
  formats: number,
  homophoneOf: readonly string[],
  reply: 0 | readonly [ko: string, romanization: string, en: string, glossKey: string],
  picture: string,
];

/** The shared strings of the rows: the cells (an episode without its `episode:` prefix, or a story) and the homes. */
export interface ReviewItemTables {
  cells: readonly string[];
  homes: readonly string[];
}

/** The module of the `review-items` chunk (`__generated__/review-item-chunks/review-items.ts`). */
export interface ReviewItemsChunk {
  CHUNK_HASH: string;
  REVIEW_ITEM_TABLES: ReviewItemTables;
  REVIEW_ITEM_ROWS: readonly ReviewItemRow[];
  /** The retired ids (§4.2): in no row, as nothing teaches them; a learner's state for them stays, out of selection and denominators. */
  REVIEW_RETIRED_IDS: readonly string[];
}

/**
 * Reversible abbreviations of a gloss key. `^` never occurs in an entity id or an overlay field
 * (F-I18N-001 grammar), so each `^x` stands for exactly one string.
 */
const GLOSS_KEY_TOKENS: readonly (readonly [long: string, short: string])[] = [
  ['quest:stage', '^q'],
  ['minigame:s', '^m'],
  ['story:', '^y'],
  ['#steps.', '^s'],
  ['.discover.pages.', '^d'],
  ['.items.', '^i'],
  ['#listenPick.rounds.', '^l'],
  ['#picWord.boards.', '^p'],
  ['#cardPairs.', '^c'],
  ['#orderIt.rounds.', '^o'],
  ['#realiaRead.', '^r'],
  ['#typeHangul.rounds.', '^t'],
  ['#writeFrame.rounds.', '^w'],
  ['#traceWord.rounds.', '^x'],
  ['#dialogue.', '^a'],
  ['#storySteps.', '^e'],
  ['#keywords.', '^k'],
  ['#checks.', '^h'],
  ['.gloss', '^g'],
];

export function packGlossKey(glossKey: string | undefined, id: string): string {
  if (glossKey === undefined) return '';
  if (glossKey === `${id}#gloss`) return '=';
  return GLOSS_KEY_TOKENS.reduce((key, [long, short]) => key.split(long).join(short), glossKey);
}

export function unpackGlossKey(packed: string, id: string): string | undefined {
  if (packed === '') return undefined;
  if (packed === '=') return `${id}#gloss`;
  return packed.replace(/\^[a-z]/g, (token) => GLOSS_KEY_TOKENS.find(([, short]) => short === token)?.[0] ?? token);
}

const EPISODE = 'episode:';
const packCell = (cell: string): string => (cell.startsWith(EPISODE) ? cell.slice(EPISODE.length) : cell);
const unpackCell = (cell: string): string => (cell.startsWith('story:') ? cell : `${EPISODE}${cell}`);
const opt = (value: string): string | undefined => (value === '' ? undefined : value);
const reading = (ko: string): string => romanize(ko).text;
const packRomanization = (romanization: string, ko: string): string => (romanization === reading(ko) ? '' : romanization);

export function formatMask(formats: readonly ReviewFormat[]): number {
  return formats.reduce((mask, f) => mask | (1 << REVIEW_FORMATS.indexOf(f)), 0);
}

export function formatsOfMask(mask: number): ReviewFormat[] {
  return REVIEW_FORMATS.filter((_, i) => (mask & (1 << i)) !== 0);
}

/** The items as the chunk's tables and rows (the inverse of `decodeReviewItems`). */
export function encodeReviewItems(items: readonly ReviewItem[]): { tables: ReviewItemTables; rows: ReviewItemRow[] } {
  const cells: string[] = [];
  const homes: string[] = [];
  const indexIn = (list: string[], value: string): number => {
    const at = list.indexOf(value);
    if (at >= 0) return at;
    list.push(value);
    return list.length - 1;
  };
  const rows = items.map((item): ReviewItemRow => {
    const { reply } = item;
    return [
      item.id,
      item.ko,
      packRomanization(item.romanization, item.ko),
      item.en ?? '',
      packGlossKey(item.glossKey, item.id),
      indexIn(homes, item.home),
      item.stage | (item.volume << 3) | ((item.soundChange ? 1 : 0) << 8),
      item.cells.map((cell) => indexIn(cells, packCell(cell))),
      formatMask(item.formats),
      item.homophoneOf,
      reply === undefined ? 0 : [reply.ko, packRomanization(reply.romanization, reply.ko), reply.en ?? '', packGlossKey(reply.glossKey, item.id)],
      item.picture ?? '',
    ];
  });
  return { tables: { cells, homes }, rows };
}

/** One chunk row as its item. */
export function decodeReviewItem(row: ReviewItemRow, tables: ReviewItemTables): ReviewItem {
  const [id, ko, romanization, en, glossKey, home, meta, cells, formats, homophoneOf, reply, picture] = row;
  const item: ReviewItem = {
    id,
    kind: kindOfId(id) as ReviewItemKind,
    ko,
    romanization: opt(romanization) ?? reading(ko),
    home: tables.homes[home] as string,
    stage: meta & 7,
    volume: (meta >> 3) & 31,
    cells: cells.map((i) => unpackCell(tables.cells[i] as string)),
    formats: formatsOfMask(formats),
    soundChange: ((meta >> 8) & 1) === 1,
    homophoneOf: [...homophoneOf],
  };
  if (opt(en) !== undefined) item.en = en;
  const key = unpackGlossKey(glossKey, id);
  if (key !== undefined) item.glossKey = key;
  if (reply !== 0) {
    const [rKo, rRom, rEn, rKey] = reply;
    item.reply = { ko: rKo, romanization: opt(rRom) ?? reading(rKo) };
    if (opt(rEn) !== undefined) item.reply.en = rEn;
    const replyKey = unpackGlossKey(rKey, id);
    if (replyKey !== undefined) item.reply.glossKey = replyKey;
  }
  if (opt(picture) !== undefined) item.picture = picture;
  return item;
}

/** Every item of a loaded chunk. */
export function decodeReviewItems(chunk: Pick<ReviewItemsChunk, 'REVIEW_ITEM_TABLES' | 'REVIEW_ITEM_ROWS'>): ReviewItem[] {
  return chunk.REVIEW_ITEM_ROWS.map((row) => decodeReviewItem(row, chunk.REVIEW_ITEM_TABLES));
}

// ---- retired items (§4.2) --------------------------------------------------------------------------------

/**
 * Retired ids: items a re-authoring row removed from every round. A retired id is never selected
 * for review, keeps its learner state for reports, and stays out of every mastery denominator.
 */
export type RetiredIds = ReadonlySet<string> | readonly string[];

const asSet = (retired: RetiredIds): ReadonlySet<string> => (retired instanceof Set ? retired : new Set(retired as readonly string[]));

export function isRetired(id: string, retired: RetiredIds): boolean {
  return asSet(retired).has(id);
}

/** The ids that may be selected for review: every id but the retired ones, in the order given. */
export function selectableIds(ids: readonly string[], retired: RetiredIds): string[] {
  const out = asSet(retired);
  return ids.filter((id) => !out.has(id));
}

/**
 * The mastery denominator of a cell (§4.4): the items its started volumes teach, minus the
 * retired ones. `volumes` are the cell's volumes the learner has started (a volume not started,
 * or one that ships later, never holds a level back).
 */
export function masteryDenominator(
  items: readonly Pick<ReviewItem, 'id' | 'cells' | 'volume'>[],
  cell: string,
  volumes: readonly number[],
  retired: RetiredIds,
): string[] {
  const started = new Set(volumes);
  const out = asSet(retired);
  return items.filter((item) => item.cells.includes(cell) && started.has(item.volume) && !out.has(item.id)).map((item) => item.id);
}

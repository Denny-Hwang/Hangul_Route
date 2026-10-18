import {
  LECTURE_DECK_VERSION,
  LECTURE_MAX_BLOCKS,
  LECTURE_TITLE_RE,
  LectureDeckSchema,
  jamoSetBlocks,
  presetMinutesOf,
  rowState,
  selectionBlocks,
  selectionEntries,
  toggleLesson,
  toggleRow,
  CATALOG,
  type ChooserEpisodeRow,
  type ChooserGroup,
  type ChooserRow,
  type ChooserSelection,
  type LectureDeck,
} from '@hangul-route/content-schema';

/**
 * Customize on the presenter home (AMENDMENTS-LECTURE-V2 sections 4.6 and 18.3, row LV-3): the
 * grouped chooser over content-schema's shared model (`lesson-chooser.ts`, the console's too),
 * and [ Build lesson ] -> a deck with `source: 'quick'`, a time seed, no language (the slides
 * follow the presenting device) and no helper picker (`picker: null`, LV-D7). Pure: the groups
 * come in from `quick-source.ts`, which reads the bundle.
 *
 * The presenter's rules on top of the model:
 * - an episode and its lessons are one tri-state choice: checking the episode chooses it whole
 *   (one block) and locks its lessons; some lessons chosen make the episode mixed, and checking
 *   the mixed episode puts the whole episode in the place of the first of them (`toggleRow`'s
 *   merge), so no quest is ever in the deck twice;
 * - a press that would take the deck past 30 blocks does nothing (its box is off); a press that
 *   removes always works.
 *
 * No name can be entered here; the deck has no field for one.
 */

/** A deck holds at most 30 blocks; a letter set over 12 letters costs more than one. */
export const QUICK_MAX_BLOCKS = LECTURE_MAX_BLOCKS;
const TITLE_MAX = 60;
const ID_CHARS = 'abcdefghijklmnopqrstuvwxyz0123456789';
const DECK_ID_LENGTH = 10;

/** A fresh deck id (`lecture:` and 10 characters) from a uniform source in [0, 1). */
export function deckIdFrom(rng: () => number): string {
  let id = 'lecture:';
  for (let i = 0; i < DECK_ID_LENGTH; i += 1) id += ID_CHARS[Math.min(ID_CHARS.length - 1, Math.floor(rng() * ID_CHARS.length))];
  return id;
}

const blockCount = (selection: ChooserSelection, groups: readonly ChooserGroup[]): number => selectionBlocks(selection, groups).length;

/** A press is allowed when the result still fits, or when it does not add (a press that removes is never off). */
function allowed(before: ChooserSelection, after: ChooserSelection, groups: readonly ChooserGroup[]): boolean {
  const n = blockCount(after, groups);
  return n <= QUICK_MAX_BLOCKS || n <= blockCount(before, groups);
}

/** The selection after a row's checkbox, or null when that press would not fit. */
export function pressRow(selection: ChooserSelection, row: ChooserRow, groups: readonly ChooserGroup[]): string[] | null {
  const next = toggleRow(selection, row);
  return allowed(selection, next, groups) ? next : null;
}

/** While its whole episode is chosen, a lesson's box is locked (checked and off): the episode is one block. */
export function lessonLocked(selection: ChooserSelection, row: ChooserEpisodeRow): boolean {
  return selection.includes(row.key);
}

/** The selection after a lesson's checkbox, or null when it is locked or would not fit. */
export function pressLesson(selection: ChooserSelection, row: ChooserEpisodeRow, lessonKey: string, groups: readonly ChooserGroup[]): string[] | null {
  if (lessonLocked(selection, row)) return null;
  const next = toggleLesson(selection, row, lessonKey);
  return allowed(selection, next, groups) ? next : null;
}

/** The tray's remove button: the entry goes, nothing else moves. */
export function removeChoice(selection: ChooserSelection, key: string): string[] {
  return selection.filter((k) => k !== key);
}

/** The draw state of a row's box: checked, mixed (some of its lessons) or not. */
export const rowCheck = (selection: ChooserSelection, row: ChooserRow): 'true' | 'mixed' | 'false' => {
  const state = rowState(selection, row);
  return state === 'all' ? 'true' : state === 'some' ? 'mixed' : 'false';
};

/**
 * The lesson is full when some box that would add no longer fits: a 2-block letter set can be out
 * of reach before 30 blocks, so the status line explains every box that is off.
 */
export function chooserFull(selection: ChooserSelection, groups: readonly ChooserGroup[]): boolean {
  for (const group of groups) {
    for (const row of group.rows) {
      if (pressRow(selection, row, groups) === null) return true;
      if (row.kind !== 'episode' || lessonLocked(selection, row)) continue;
      for (const lesson of row.lessons) if (pressLesson(selection, row, lesson.key, groups) === null) return true;
    }
  }
  return false;
}

/** About-minutes of one chosen thing: its row's or lesson's minutes; a letter set by its sets (rule 12, one per two letters). */
export function choiceMinutes(key: string, groups: readonly ChooserGroup[]): number {
  for (const group of groups) {
    for (const row of group.rows) {
      if (row.key === key) return row.kind === 'letters' ? presetMinutesOf(jamoSetBlocks(row.jamoIds), CATALOG) : row.minutes;
      if (row.kind === 'episode') {
        const lesson = row.lessons.find((l) => l.key === key);
        if (lesson) return lesson.minutes;
      }
    }
  }
  return 0;
}

/** The tray's rows: the chosen things in order with their titles and minutes. */
export function chooserTray(selection: ChooserSelection, groups: readonly ChooserGroup[]): { key: string; title: string; minutes: number }[] {
  return selectionEntries(selection, groups).map((e) => ({ key: e.key, title: e.title, minutes: choiceMinutes(e.key, groups) }));
}

/** A content title reduced to the deck title class (TD8): other characters dropped, spaces collapsed. */
function cleanTitle(title: string): string {
  return [...title]
    .filter((ch) => LECTURE_TITLE_RE.test(ch))
    .join('')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Cuts at the last space at or before the limit; '' when one word is longer. */
function cutAtWord(text: string, max: number): string {
  if (text.length <= max) return text;
  const space = text.lastIndexOf(' ', max);
  return space > 0 ? text.slice(0, space).trim() : '';
}

/**
 * The chosen titles joined by " / " while they fit in 60 characters (the titles are bundle
 * content, so the deck needs no typing); `fallback` (the localised "Your lesson") when nothing
 * usable is left.
 */
export function quickDeckTitle(titles: readonly string[], fallback: string): string {
  const parts = titles.map(cleanTitle).filter((t) => t.length > 0);
  let title = '';
  for (const part of parts) {
    const next = title === '' ? part : `${title} / ${part}`;
    if (next.length > TITLE_MAX) break;
    title = next;
  }
  if (title === '' && parts.length > 0) title = cutAtWord(parts[0]!, TITLE_MAX);
  return title === '' ? fallback : title;
}

export interface QuickDeckInput {
  now: Date;
  /** Uniform in [0, 1): the deck id. */
  rng: () => number;
  fallbackTitle: string;
}

/** The deck for the chosen things in the order chosen; null with nothing (or too much) chosen. */
export function buildQuickDeck(selection: ChooserSelection, groups: readonly ChooserGroup[], input: QuickDeckInput): LectureDeck | null {
  const entries = selectionEntries(selection, groups);
  const blocks = entries.flatMap((e) => e.blocks);
  if (blocks.length === 0 || blocks.length > QUICK_MAX_BLOCKS) return null;
  const parsed = LectureDeckSchema.safeParse({
    v: LECTURE_DECK_VERSION,
    id: deckIdFrom(input.rng),
    title: quickDeckTitle(
      entries.map((e) => e.title),
      input.fallbackTitle,
    ),
    createdAt: input.now.toISOString(),
    seed: input.now.getTime() % 2 ** 31,
    blocks,
    // No language in the deck: it opens in the language of the device that presents it.
    options: {},
    picker: null,
    source: 'quick',
  });
  return parsed.success ? parsed.data : null;
}

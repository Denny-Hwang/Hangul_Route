import { cellIsReady, storyIsReady, type Catalog } from '../catalog/schema';
import { romanize } from '../romanization/rr';
import { StageKeySchema, ThemeKeySchema, type StageKey } from './heritage-card';
import { LECTURE_MAX_BLOCKS, type LectureBlock } from './lecture';
import { presetMinutesOf } from './lecture-presets';

/**
 * The grouped lesson chooser (owner report 2026-10-16 item 5; AMENDMENTS-LECTURE-V2
 * row LV-3): one pure model over `CATALOG` behind the presenter's Customize, the
 * console plan builder and the console lecture catalogue, so the three show the same
 * groups in the same order and search the same way.
 *
 * - **Stage groups 1 to 7**: one row per ready cell (theme order), each holding its
 *   3 to 6 lessons; the row's checkbox chooses the whole episode. Stage 1 also holds
 *   the two letter sets when the surface offers them (the presenter does).
 * - **Stories** (the ready stories the surface can show) and **Word topics** (the ready
 *   topics it lists), each only when the surface passes its ids.
 * - **Search** matches the title in the UI language, the Korean title (Hangul), the
 *   Revised Romanization of that Korean title and, for a lesson, the letters it teaches.
 *
 * Titles come from the caller (`title(id)`, already in the UI language with its own
 * English fallback): the content titles are overlays the two apps read differently.
 * Selection keys are content ids (`episode:*`, `quest:*`, `story:*`,
 * `vocab-topic:*`, `letters:consonants`, `letters:vowels`), so a surface maps them
 * to deck blocks or plan items without a second table. Nothing here can hold a
 * person's name.
 */

export type ChooserGroupId = StageKey | 'stories' | 'topics';

export const LETTER_SET_KEYS = { consonants: 'letters:consonants', vowels: 'letters:vowels' } as const;
export type LetterSet = keyof typeof LETTER_SET_KEYS;

/** One lesson of an episode row: its quest id is its key. */
export interface ChooserLesson {
  key: string;
  title: string;
  minutes: number;
  /** Normalized search text (`normalizeSearch`). */
  search: string;
}

interface RowBase {
  key: string;
  title: string;
  search: string;
}

export interface ChooserEpisodeRow extends RowBase {
  kind: 'episode';
  minutes: number;
  lessons: readonly ChooserLesson[];
}

export interface ChooserLettersRow extends RowBase {
  kind: 'letters';
  set: LetterSet;
  jamoIds: readonly string[];
}

export interface ChooserStoryRow extends RowBase {
  kind: 'story';
  minutes: number;
}

export interface ChooserTopicRow extends RowBase {
  kind: 'topic';
  minutes: number;
}

export type ChooserRow = ChooserEpisodeRow | ChooserLettersRow | ChooserStoryRow | ChooserTopicRow;

export interface ChooserGroup {
  id: ChooserGroupId;
  /** 1 to 7 for a stage group; null for Stories and Word topics. */
  stage: number | null;
  rows: readonly ChooserRow[];
  /** What the group label counts: a stage's lessons, the stories, the topics. */
  count: number;
}

export interface ChooserOptions {
  catalog: Catalog;
  /** A content title in the UI language (episode, quest, story or `vocab-topic:*` id); the caller falls back to English. */
  title: (id: string) => string;
  /** The Korean (Hangul) title of an id, searched with its romanization; null when there is none. */
  koTitle?: (id: string) => string | null;
  /** The stages to list; default every stage, each drawn only when it has a ready cell. */
  stages?: readonly StageKey[];
  /** Stage 1's letter sets (the presenter): compatibility jamo ids and the row titles. */
  letters?: {
    consonants: readonly string[];
    vowels: readonly string[];
    titles: Readonly<Record<LetterSet, string>>;
    /** The letters as Hangul, searched (`ㄱ` finds the consonants). */
    chars?: Partial<Readonly<Record<LetterSet, readonly string[]>>>;
  } | null;
  /** Story ids the surface can show; absent or empty: no Stories group. */
  stories?: readonly string[] | null;
  /** Topic ids (`vocab-topic:<key>`) the surface lists (ready topics only); absent or empty: no Word topics group. */
  topics?: readonly string[] | null;
}

// ---- search text --------------------------------------------------------------------------------

/** The Latin letters with an accent the three UI languages type; folded so "leccion" finds "lección". Hermes-safe (no `normalize`). */
const FOLD: Readonly<Record<string, string>> = { á: 'a', à: 'a', â: 'a', ä: 'a', é: 'e', è: 'e', ê: 'e', ë: 'e', í: 'i', ì: 'i', î: 'i', ï: 'i', ó: 'o', ò: 'o', ô: 'o', ö: 'o', ú: 'u', ù: 'u', û: 'u', ü: 'u', ñ: 'n', ç: 'c' };

/** Lower case, accents folded, punctuation and runs of spaces to one space. Hangul is kept as typed. */
export function normalizeSearch(text: string): string {
  let out = '';
  for (const ch of text.toLowerCase()) out += FOLD[ch] ?? ch;
  return out
    .replace(/[\s.,:;!?'"()\-–—/·&+]+/g, ' ')
    .trim();
}

function searchText(parts: readonly (string | null | undefined)[]): string {
  return parts
    .filter((p): p is string => typeof p === 'string' && p.length > 0)
    .map(normalizeSearch)
    .join(' | ');
}

/** The search parts of a content id: its UI title, its Korean title and that title's romanization. */
function termsOf(id: string, title: string, options: ChooserOptions, extra: readonly string[] = []): string {
  const ko = options.koTitle?.(id) ?? null;
  const roman = ko === null ? null : romanize(ko).text;
  return searchText([title, ko, roman, ...extra]);
}

// ---- the groups ---------------------------------------------------------------------------------

const themeRank = (theme: string): number => ThemeKeySchema.options.indexOf(theme as (typeof ThemeKeySchema.options)[number]);

function stageGroup(stage: StageKey, options: ChooserOptions): ChooserGroup | null {
  const { catalog } = options;
  const quests = new Map(catalog.quests.map((q) => [q.id, q]));
  const episodes = catalog.cells
    .filter((cell) => cell.stage === stage && cellIsReady(cell))
    .sort((a, b) => themeRank(a.theme) - themeRank(b.theme))
    .flatMap((cell): ChooserEpisodeRow[] => {
      const lessons = cell.questIds.flatMap((id): ChooserLesson[] => {
        const quest = quests.get(id);
        if (!quest) return [];
        const title = options.title(id);
        return [{ key: id, title, minutes: quest.minutes, search: termsOf(id, title, options, quest.teaches.map((t) => t.split('/')[0]!)) }];
      });
      if (lessons.length === 0) return [];
      const title = options.title(cell.episodeId);
      return [{ kind: 'episode', key: cell.episodeId, title, minutes: cell.minutes, lessons, search: termsOf(cell.episodeId, title, options) }];
    });
  const lessonCount = episodes.reduce((n, row) => n + row.lessons.length, 0);
  const rows: ChooserRow[] = [...episodes];
  if (stage === 'stage1' && options.letters) {
    const { letters } = options;
    for (const set of ['consonants', 'vowels'] as const) {
      const jamoIds = letters[set];
      if (jamoIds.length === 0) continue;
      const title = letters.titles[set];
      rows.push({ kind: 'letters', key: LETTER_SET_KEYS[set], set, jamoIds, title, search: searchText([title, ...(letters.chars?.[set] ?? [])]) });
    }
  }
  if (rows.length === 0) return null;
  return { id: stage, stage: StageKeySchema.options.indexOf(stage) + 1, rows, count: lessonCount };
}

function storiesGroup(options: ChooserOptions): ChooserGroup | null {
  const allowed = new Set(options.stories ?? []);
  const rows: ChooserRow[] = options.catalog.stories
    .filter((s) => allowed.has(s.id) && storyIsReady(s))
    .sort((a, b) => a.order - b.order)
    .map((s) => {
      const title = options.title(s.id);
      return { kind: 'story', key: s.id, title, minutes: s.minutes, search: termsOf(s.id, title, options) };
    });
  return rows.length === 0 ? null : { id: 'stories', stage: null, rows, count: rows.length };
}

function topicsGroup(options: ChooserOptions): ChooserGroup | null {
  const allowed = new Set(options.topics ?? []);
  const rows: ChooserRow[] = options.catalog.topics
    .map((t) => ({ topic: t, key: `vocab-topic:${t.key}` }))
    .filter(({ key }) => allowed.has(key))
    .sort((a, b) => a.topic.order - b.topic.order)
    .map(({ topic, key }) => {
      const title = options.title(key);
      return { kind: 'topic', key, title, minutes: topic.minutes, search: termsOf(key, title, options) };
    });
  return rows.length === 0 ? null : { id: 'topics', stage: null, rows, count: rows.length };
}

/** The chooser's groups in display order: Stage 1 to 7, then Stories, then Word topics (each only when it has rows). */
export function chooserGroups(options: ChooserOptions): ChooserGroup[] {
  const stages = options.stages ?? StageKeySchema.options;
  const groups: (ChooserGroup | null)[] = StageKeySchema.options.filter((s) => stages.includes(s)).map((s) => stageGroup(s, options));
  groups.push(storiesGroup(options), topicsGroup(options));
  return groups.filter((g): g is ChooserGroup => g !== null);
}

// ---- search -------------------------------------------------------------------------------------

/** Every word of the query appears somewhere in the text. */
function matches(search: string, words: readonly string[]): boolean {
  return words.every((w) => search.includes(w));
}

/**
 * The groups narrowed to a query: a row stays when it or one of its lessons matches
 * (a matching episode keeps all its lessons, otherwise only the matching ones);
 * empty groups drop out and counts follow what is left. An empty query changes nothing.
 */
export function searchChooser(groups: readonly ChooserGroup[], query: string): ChooserGroup[] {
  const words = normalizeSearch(query).split(' ').filter((w) => w.length > 0);
  if (words.length === 0) return [...groups];
  return groups.flatMap((group): ChooserGroup[] => {
    const rows = group.rows.flatMap((row): ChooserRow[] => {
      if (matches(row.search, words)) return [row];
      if (row.kind !== 'episode') return [];
      const lessons = row.lessons.filter((l) => matches(l.search, words));
      return lessons.length === 0 ? [] : [{ ...row, lessons }];
    });
    if (rows.length === 0) return [];
    const count = group.stage === null ? rows.length : rows.reduce((n, r) => n + (r.kind === 'episode' ? r.lessons.length : 0), 0);
    return [{ ...group, rows, count }];
  });
}

// ---- the selection ------------------------------------------------------------------------------

/** The chosen keys, in the order they were chosen (the deck or plan order). */
export type ChooserSelection = readonly string[];

export type RowState = 'all' | 'some' | 'none';

/** One chosen thing: its key, its title and the deck blocks it adds. */
export interface ChooserEntry {
  key: string;
  title: string;
  blocks: readonly LectureBlock[];
}

/** A `jamo-set` holds at most 12 letters (`LectureBlockSchema`). */
const JAMO_SET_MAX = 12;

/** The letters in the fewest even `jamo-set` blocks of at most 12 (14 consonants: 7 + 7). */
export function jamoSetBlocks(ids: readonly string[]): LectureBlock[] {
  if (ids.length === 0) return [];
  const parts = Math.ceil(ids.length / JAMO_SET_MAX);
  const size = Math.ceil(ids.length / parts);
  const blocks: LectureBlock[] = [];
  for (let i = 0; i < ids.length; i += size) blocks.push({ kind: 'jamo-set', jamoIds: ids.slice(i, i + size) });
  return blocks;
}

function rowBlocks(row: ChooserRow): LectureBlock[] {
  switch (row.kind) {
    case 'episode':
      return [{ kind: 'episode', id: row.key }];
    case 'letters':
      return jamoSetBlocks(row.jamoIds);
    case 'story':
      return [{ kind: 'story', storyId: row.key, checks: true }];
    case 'topic':
      return [{ kind: 'vocab', topicId: row.key }];
  }
}

/** Every key the groups can choose (rows and lessons), with its entry and the row that holds it. */
function index(groups: readonly ChooserGroup[]): Map<string, { entry: ChooserEntry; row: ChooserRow }> {
  const out = new Map<string, { entry: ChooserEntry; row: ChooserRow }>();
  for (const group of groups) {
    for (const row of group.rows) {
      out.set(row.key, { entry: { key: row.key, title: row.title, blocks: rowBlocks(row) }, row });
      if (row.kind !== 'episode') continue;
      for (const lesson of row.lessons) out.set(lesson.key, { entry: { key: lesson.key, title: lesson.title, blocks: [{ kind: 'quest', id: lesson.key }] }, row });
    }
  }
  return out;
}

/** 'all' when the row is chosen whole or every lesson is; 'some' when a few of its lessons are. */
export function rowState(selection: ChooserSelection, row: ChooserRow): RowState {
  if (selection.includes(row.key)) return 'all';
  if (row.kind !== 'episode') return 'none';
  const chosen = row.lessons.filter((l) => selection.includes(l.key)).length;
  if (chosen === 0) return 'none';
  return chosen === row.lessons.length ? 'all' : 'some';
}

/** A lesson is chosen on its own or as part of its whole episode. */
export function lessonChosen(selection: ChooserSelection, row: ChooserEpisodeRow, lessonKey: string): boolean {
  return selection.includes(row.key) || selection.includes(lessonKey);
}

/**
 * The row's checkbox: a fully chosen row is cleared (the episode and any of its
 * lessons); otherwise the whole episode is chosen, in place of the lessons already
 * chosen (at the first one's place, else at the end), so it is one deck block.
 */
export function toggleRow(selection: ChooserSelection, row: ChooserRow): string[] {
  const own = new Set([row.key, ...(row.kind === 'episode' ? row.lessons.map((l) => l.key) : [])]);
  if (rowState(selection, row) === 'all') return selection.filter((k) => !own.has(k));
  const at = selection.findIndex((k) => own.has(k));
  const rest = selection.filter((k) => !own.has(k));
  if (at < 0) return [...rest, row.key];
  return [...rest.slice(0, at), row.key, ...rest.slice(at)];
}

/**
 * A lesson's checkbox. While its whole episode is chosen, unticking one lesson keeps
 * the others, in cell order at the episode's place; otherwise the lesson is added at
 * the end or removed.
 */
export function toggleLesson(selection: ChooserSelection, row: ChooserEpisodeRow, lessonKey: string): string[] {
  const at = selection.indexOf(row.key);
  if (at >= 0) {
    const others = row.lessons.map((l) => l.key).filter((k) => k !== lessonKey && !selection.includes(k));
    return [...selection.slice(0, at), ...others, ...selection.slice(at + 1)];
  }
  return selection.includes(lessonKey) ? selection.filter((k) => k !== lessonKey) : [...selection, lessonKey];
}

/** The chosen things in order (keys the groups no longer hold drop out, e.g. after a language switch). */
export function selectionEntries(selection: ChooserSelection, groups: readonly ChooserGroup[]): ChooserEntry[] {
  const all = index(groups);
  return selection.flatMap((key) => {
    const hit = all.get(key);
    return hit ? [hit.entry] : [];
  });
}

/** The selection without the keys the groups do not hold. */
export function pruneSelection(selection: ChooserSelection, groups: readonly ChooserGroup[]): string[] {
  const all = index(groups);
  return selection.filter((key) => all.has(key));
}

/** The deck blocks of the selection, in order. */
export function selectionBlocks(selection: ChooserSelection, groups: readonly ChooserGroup[]): LectureBlock[] {
  return selectionEntries(selection, groups).flatMap((e) => e.blocks);
}

/** About-minutes of the selection, by the presets' rule (`presetMinutesOf`: catalogue minutes, letters 1 per two). */
export function selectionMinutes(selection: ChooserSelection, groups: readonly ChooserGroup[], catalog: Catalog): number {
  return presetMinutesOf(selectionBlocks(selection, groups), catalog);
}

/** Whether a selection fits in one deck (`LECTURE_MAX_BLOCKS` blocks; a letter set can take two). */
export function selectionFits(selection: ChooserSelection, groups: readonly ChooserGroup[], max: number = LECTURE_MAX_BLOCKS): boolean {
  return selectionBlocks(selection, groups).length <= max;
}

/** The group that holds a key (a row or a lesson), so a surface can open it; null when none does. */
export function groupOfKey(groups: readonly ChooserGroup[], key: string): ChooserGroupId | null {
  for (const group of groups) {
    for (const row of group.rows) {
      if (row.key === key) return group.id;
      if (row.kind === 'episode' && row.lessons.some((l) => l.key === key)) return group.id;
    }
  }
  return null;
}

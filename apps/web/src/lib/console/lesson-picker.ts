import {
  CATALOG,
  applyChooserSelection,
  presetMinutesOf,
  chooserGroups,
  lessonChosen,
  rowState,
  selectionBlocks,
  selectionOf,
  type ChooserGroup,
  type ChooserRow,
  type ChooserSelection,
  type LectureBlock,
  type PlanItem,
  type UiLocale,
} from '@hangul-route/content-schema';
import type { Messages } from '@hangul-route/i18n';
import { catalogTitle } from '@/data/catalog';
import { CATALOGUE_TITLES } from '@/data/catalogue-titles.generated';
import { LECTURE_STORIES, LECTURE_VOCAB_TOPICS } from '@/data/lecture-catalogue.generated';

/**
 * The console's grouped lesson picker (owner report 2026-10-16 item 5, AMENDMENTS-LECTURE-V2
 * row LV-3): `chooserGroups` from content-schema, as the plan builder and the lecture page's
 * catalogue draw it. Titles are in the console's language (`catalogTitle`); the Korean title
 * is searched with its romanization in every language. The plan builder lists every ready
 * stage (episodes and lessons only, as a plan holds); the lecture catalogue adds the stories
 * and word topics the presenter can show (the lecture mirror's review gate).
 */

export type PickerUse = 'plan' | 'lecture';

type ChooserWords = Messages['console']['chooser'];

const koTitle = (id: string): string | null => CATALOGUE_TITLES.ko?.[id] ?? null;

/** The groups the console draws for a use, in `locale`. */
export function consoleChooserGroups(locale: UiLocale, use: PickerUse): ChooserGroup[] {
  return chooserGroups({
    catalog: CATALOG,
    title: (id) => catalogTitle(id, locale),
    koTitle,
    stories: use === 'lecture' ? LECTURE_STORIES.map((s) => s.id) : null,
    topics: use === 'lecture' ? LECTURE_VOCAB_TOPICS.map((t) => t.id) : null,
  });
}

/** Every key the groups can choose (rows and their lessons). */
export function chooserKeys(groups: readonly ChooserGroup[]): Set<string> {
  const keys = new Set<string>();
  for (const group of groups) {
    for (const row of group.rows) {
      keys.add(row.key);
      if (row.kind === 'episode') for (const lesson of row.lessons) keys.add(lesson.key);
    }
  }
  return keys;
}

/** A group's heading: "Stage 2 · 18 lessons", "Stories · 24 stories", "Word topics · 12 topics". */
export function groupHeading(group: ChooserGroup, words: ChooserWords): string {
  if (group.id === 'stories') return words.heading.stories(group.count);
  if (group.id === 'topics') return words.heading.topics(group.count);
  return words.heading.stage(group.stage ?? 0, group.count);
}

/** A group's chip: "Stage 2", "Stories", "Word topics". */
export function groupChip(group: ChooserGroup, words: ChooserWords): string {
  if (group.id === 'stories') return words.chip.stories;
  if (group.id === 'topics') return words.chip.topics;
  return words.chip.stage(group.stage ?? 0);
}

/** A row's detail line: an episode's lessons and minutes, a story's or topic's minutes (the console lists no letter sets). */
export function rowDetail(row: ChooserRow, words: ChooserWords): string {
  if (row.kind === 'episode') return words.episodeDetail(row.lessons.length, row.minutes);
  return row.kind === 'letters' ? '' : words.minutes(row.minutes);
}

/** How many checkboxes a list of groups draws: every row and every lesson under it ("4 matches"). */
export function visibleCount(groups: readonly ChooserGroup[]): number {
  return groups.reduce((n, g) => n + g.rows.reduce((m, r) => m + 1 + (r.kind === 'episode' ? r.lessons.length : 0), 0), 0);
}

/** The chip the picker opens on: the group of the first chosen key, else the first group. */
export function initialGroup(groups: readonly ChooserGroup[], selection: ChooserSelection): ChooserGroup['id'] | null {
  const keys = new Set(selection);
  for (const group of groups) {
    for (const row of group.rows) {
      if (keys.has(row.key)) return group.id;
      if (row.kind === 'episode' && row.lessons.some((l) => keys.has(l.key))) return group.id;
    }
  }
  return groups[0]?.id ?? null;
}

/**
 * How many items a press adds to the list (one per key on the console: an episode, a lesson,
 * a story or a topic is one plan item or one deck block); zero or less for a press that
 * removes, which is always allowed.
 */
export function addsItems(selection: ChooserSelection, row: ChooserRow, lessonKey?: string): number {
  if (lessonKey === undefined || row.kind !== 'episode') {
    const state = rowState(selection, row);
    if (state === 'all') return -1;
    const chosenLessons = row.kind === 'episode' ? row.lessons.filter((l) => selection.includes(l.key)).length : 0;
    return 1 - chosenLessons;
  }
  if (selection.includes(row.key)) return row.lessons.filter((l) => l.key !== lessonKey && !selection.includes(l.key)).length - 1;
  return lessonChosen(selection, row, lessonKey) ? -1 : 1;
}

// ---- the plan builder ---------------------------------------------------------------------------

/** A plan's items as a selection: episode and quest ids the groups hold (a story's listen quest from a route stays out). */
export function planSelection(items: readonly PlanItem[], keys: ReadonlySet<string>): string[] {
  return selectionOf(items, (item) => (keys.has(item.id) ? item.id : null));
}

/** A plan with a new selection applied in place: other items keep their place, dates and notes. */
export function applyToPlan(items: readonly PlanItem[], keys: ReadonlySet<string>, next: ChooserSelection): PlanItem[] {
  return applyChooserSelection(items, (item) => (keys.has(item.id) ? item.id : null), next, (key): PlanItem[] =>
    keys.has(key) ? [{ kind: key.startsWith('episode:') ? 'episode' : 'quest', id: key }] : [],
  );
}

/** About-minutes of a plan's items from the catalogue (an unknown id counts 0), for the builder's sticky bar. */
export function planMinutes(items: readonly PlanItem[]): number {
  return presetMinutesOf(
    items.map((item): LectureBlock => ({ kind: item.kind, id: item.id })),
    CATALOG,
  );
}

// ---- the lecture outline ------------------------------------------------------------------------

/** The chooser key of an outline block, or null for a block the catalogue does not add (quiz, activity, letters, code). */
export function blockKey(block: LectureBlock, keys: ReadonlySet<string>): string | null {
  const key = block.kind === 'episode' || block.kind === 'quest' ? block.id : block.kind === 'story' ? block.storyId : block.kind === 'vocab' ? block.topicId : null;
  return key !== null && keys.has(key) ? key : null;
}

/** The outline's catalogue blocks as a selection. */
export function outlineSelection(blocks: readonly LectureBlock[], keys: ReadonlySet<string>): string[] {
  return selectionOf(blocks, (b) => blockKey(b, keys));
}

/** An outline with a new selection applied in place: quizzes, activities and the class code keep their place. */
export function applyToOutline(blocks: readonly LectureBlock[], groups: readonly ChooserGroup[], keys: ReadonlySet<string>, next: ChooserSelection): LectureBlock[] {
  return applyChooserSelection(blocks, (b) => blockKey(b, keys), next, (key) => selectionBlocks([key], groups));
}

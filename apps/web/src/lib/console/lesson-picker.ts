import {
  CATALOG,
  CURRICULUM_MAX_ITEMS,
  PLAN_MAX_ITEMS,
  StageKeySchema,
  applyChooserSelection,
  cellIsReady,
  presetMinutesOf,
  chooserGroups,
  groupOfKey,
  selectionBlocks,
  selectionOf,
  shownLessons,
  toggleLesson,
  toggleRow,
  type ChooserGroup,
  type ChooserRow,
  type ChooserSelection,
  type CurriculumMeta,
  type LectureBlock,
  type PlanItem,
  type SpaceKind,
  type StageKey,
  type ToggleRowOptions,
  type UiLocale,
} from '@hangul-route/content-schema';
import { getMessages, type Messages } from '@hangul-route/i18n';
import { catalogTitle } from '@/data/catalog';
import { CATALOGUE_TITLES } from '@/data/catalogue-titles.generated';
import { LECTURE_STORIES, LECTURE_VOCAB_TOPICS } from '@/data/lecture-catalogue.generated';
import type { SpaceCoverage } from './curriculum';
import { ROUTES } from './routing';

/**
 * The console's grouped lesson picker (owner report 2026-10-16 item 5; spec
 * `docs/specs/AMENDMENTS-LESSON-CHOOSER.md`, row LV-3a): `chooserGroups` from content-schema,
 * as the plan builder and the lecture page's catalogue draw it. Titles are in the console's
 * language (`catalogTitle`); the Korean title is searched with its romanization in every
 * language. The plan builder lists the stages the space's learners can open (episodes and
 * lessons only, as a plan holds; `planStages`); the lecture catalogue lists every ready stage
 * and adds the stories and word topics the presenter can show (the lecture mirror's review gate).
 */

export type PickerUse = 'plan' | 'lecture';

type ChooserWords = Messages['console']['chooser'];

const koTitle = (id: string): string | null => CATALOGUE_TITLES.ko?.[id] ?? null;

/** The groups the console draws for a use, in `locale`; `stages` narrows the stage groups (default every stage). */
export function consoleChooserGroups(locale: UiLocale, use: PickerUse, stages?: readonly StageKey[]): ChooserGroup[] {
  return chooserGroups({
    catalog: CATALOG,
    title: (id) => catalogTitle(id, locale),
    koTitle,
    stages,
    stories: use === 'lecture' ? LECTURE_STORIES.map((s) => s.id) : null,
    topics: use === 'lecture' ? LECTURE_VOCAB_TOPICS.map((t) => t.id) : null,
  });
}

/**
 * The stages the plan builder lists (AMENDMENTS-LESSON-CHOOSER section 4, the curriculum
 * wizard's rule): `unlockedStagesForSpace` once the entitlement list is read, Stage 1 until
 * then or when the read fails. Learner devices derive a plan item past Stage 1 only for a
 * learner a Family Plan or a Group License covers (F-ENT-003 section 3.4), so a space this
 * viewer cannot see covered is offered Stage 1 only, never items its learners would not get.
 */
export function planStages(unlocked: readonly StageKey[] | null): StageKey[] {
  return unlocked === null ? ['stage1'] : StageKeySchema.options.filter((s) => unlocked.includes(s));
}

/** The lessons of the stages the plan builder does not list (Stage 2 and later for an uncovered space): the count its line names. */
export function lessonsPastStages(stages: readonly StageKey[]): number {
  const listed = new Set(stages);
  return CATALOG.cells.filter((cell) => !listed.has(cell.stage) && cellIsReady(cell)).reduce((n, cell) => n + cell.questIds.length, 0);
}

export interface StagesNotice {
  text: string;
  /** The console's Billing route, named **Open billing** (free-plan words) or **See plans** (today's words); null for none. */
  link: { label: string; href: string } | null;
}

/**
 * The line under the plan builder's chips while it lists fewer stages than are ready
 * (AMENDMENTS-LESSON-CHOOSER section 4): the curriculum wizard's left-out line, word for word,
 * so the two grown-up planners say the same thing (F-ENT-003 sections 3.9.3 and 3.11). With
 * the free-plan switch on, the owner of an uncovered space reads the free plan and the product
 * by space kind with **Open billing**, anyone else the neutral product words and no link; with
 * the switch off, today's wizard line, **See plans** for a class. Null before the entitlement
 * list is read (`unlocked` null) and when every ready stage is listed. Never a price.
 */
export function planStagesNotice(
  input: { unlocked: readonly StageKey[] | null; gating: boolean; coverage: SpaceCoverage; kind: SpaceKind | null },
  locale: UiLocale,
): StagesNotice | null {
  if (input.unlocked === null) return null;
  const count = lessonsPastStages(planStages(input.unlocked));
  if (count === 0) return null;
  const c = getMessages(locale).console;
  const family = input.kind === 'family';
  if (input.gating && input.coverage === 'uncovered') {
    return { text: c.curriculum.freeDays.warningNoLessons(count, c.access.product[family ? 'family' : 'class']), link: { label: c.access.openBilling.cta, href: ROUTES.billing } };
  }
  if (input.gating) return { text: c.curriculum.freeDays.warningNeutral(count), link: null };
  return { text: c.curriculum.preview.warnings.premium(count), link: family ? null : { label: c.curriculum.preview.warnings.seePlans.cta, href: ROUTES.billing } };
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

/** How many checkboxes a list of groups draws: every row and every lesson shown under it ("4 matches"). */
export function visibleCount(groups: readonly ChooserGroup[]): number {
  return groups.reduce((n, g) => n + g.rows.reduce((m, r) => m + 1 + (r.kind === 'episode' ? shownLessons(r).length : 0), 0), 0);
}

/** The chip the picker opens on: the group of the first chosen key (in the list's order) the groups hold, else the first group. */
export function initialGroup(groups: readonly ChooserGroup[], selection: ChooserSelection): ChooserGroup['id'] | null {
  for (const key of selection) {
    const id = groupOfKey(groups, key);
    if (id !== null) return id;
  }
  return groups[0]?.id ?? null;
}

/**
 * How many items a press adds to the list (one per key on the console: an episode, a lesson,
 * a story or a topic is one plan item or one deck block): the selection's length after the
 * press minus before. Zero or less for a press that removes; more than the room left and the
 * box is off, a chosen lesson's too (unticking one lesson of a whole episode adds the others).
 */
export function addsItems(selection: ChooserSelection, row: ChooserRow, lessonKey?: string, options: ToggleRowOptions = {}): number {
  const next = lessonKey === undefined || row.kind !== 'episode' ? toggleRow(selection, row, options) : toggleLesson(selection, row, lessonKey);
  return next.length - selection.length;
}

// ---- the plan builder ---------------------------------------------------------------------------

/** A plan's items as a selection: episode and quest ids the groups hold (a story's listen quest from a route stays out). */
export function planSelection(items: readonly PlanItem[], keys: ReadonlySet<string>): string[] {
  return selectionOf(items, (item) => (keys.has(item.id) ? item.id : null));
}

/** An item's week and date (a route item's schedule), for an item that takes its place. */
const scheduleOf = (item: PlanItem): Pick<PlanItem, 'targetDate' | 'week'> => ({
  ...(item.targetDate === undefined ? {} : { targetDate: item.targetDate }),
  ...(item.week === undefined ? {} : { week: item.week }),
});

/**
 * A plan with a new selection applied in place: other items keep their place, dates and notes
 * (AMENDMENTS-LESSON-CHOOSER section 5). An item that stands in for others carries their
 * fields over: the lessons that come out of a whole episode each keep the episode item's date,
 * week and note; a whole episode that takes the place of its lessons keeps the first one's (the
 * plan builder never merges, `merge: false`, so that path is a deck's). A lesson added beside
 * lessons of its own episode on a route takes the week and date of the last of them, so it
 * lands in their week rather than under "Not in a week yet". `parentOf` is `lessonParents`.
 */
export function applyToPlan(items: readonly PlanItem[], keys: ReadonlySet<string>, next: ChooserSelection, parentOf: (key: string) => string | null): PlanItem[] {
  const make = (key: string, replaced: readonly PlanItem[]): PlanItem[] => {
    if (!keys.has(key)) return [];
    const item: PlanItem = { kind: key.startsWith('episode:') ? 'episode' : 'quest', id: key };
    const from = replaced[0];
    if (from) return [{ ...item, ...scheduleOf(from), ...(from.note === undefined ? {} : { note: from.note }) }];
    const parent = parentOf(key);
    const sibling = parent === null ? undefined : [...items].reverse().find((i) => i.id !== key && i.week !== undefined && parentOf(i.id) === parent);
    return [sibling ? { ...item, ...scheduleOf(sibling) } : item];
  };
  return applyChooserSelection(items, (item) => (keys.has(item.id) ? item.id : null), next, make, parentOf);
}

/** How many more items the open draft holds: a route (with `meta`) up to `CURRICULUM_MAX_ITEMS`, a classic plan up to `PLAN_MAX_ITEMS`. */
export function planRoom(items: readonly PlanItem[], meta: CurriculumMeta | null): number {
  return (meta ? CURRICULUM_MAX_ITEMS : PLAN_MAX_ITEMS) - items.length;
}

/** The sticky bar's count line: "2 chosen · about 17 min", the draft's items with their catalogue minutes. */
export function planBarLine(items: readonly PlanItem[], words: ChooserWords): string {
  return words.chosen(items.length, planMinutes(items));
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

/** An outline with a new selection applied in place: quizzes, activities and the class code keep their place (a block has no date or note to carry over). */
export function applyToOutline(blocks: readonly LectureBlock[], groups: readonly ChooserGroup[], keys: ReadonlySet<string>, next: ChooserSelection): LectureBlock[] {
  return applyChooserSelection(blocks, (b) => blockKey(b, keys), next, (key) => selectionBlocks([key], groups));
}

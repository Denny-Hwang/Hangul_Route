import { routeCatalogOf } from '../catalog/route-catalog';
import {
  FESTIVAL_DATES,
  cellIsReady,
  storyIsReady,
  type Catalog,
  type CatalogCell,
  type CatalogQuest,
  type CatalogStory,
  type FestivalAnchor,
} from '../catalog/schema';
import { placementStageNumber, questsPlacedOutAtLevel } from '../placement/level-map';
import type { PlacementLevel } from '../schemas/placement';
import { themeOrderFor } from '../placement/route-seed';
import { StageKeySchema, ThemeKeySchema, type StageKey, type ThemeKey } from '../schemas/heritage-card';
import type { PlanItem } from '../schemas/plan-item';
import { addDays, daysBetween, isDateKey, spreadDates, weekdayOf } from './dates';
import {
  WARNING_CODES,
  type CurriculumDraft,
  type CurriculumItem,
  type CurriculumMeta,
  type CurriculumStats,
  type CurriculumWarning,
  type WeekExtra,
  type WeekKind,
  type WeekMeta,
} from './draft';
import {
  CurriculumParamsSchema,
  DateKeySchema,
  sessionsPerWeekOf,
  type CurriculumParams,
  type CurriculumParamsInput,
  type DateKey,
  type StoredCurriculumParams,
} from './params';
import {
  COMING_SOON_MAX,
  COMING_SOON_NOTE,
  CULTURE_EVERY,
  CURRICULUM_MAX_ITEMS,
  DEFAULT_REVIEW_EVERY,
  DEFAULT_REVIEW_MIN_WEEKS,
  HORIZON_DAYS,
  SESSION_TOO_SHORT_FACTOR,
  STORIES_PER_CULTURE_WEEK_MAX,
  VOCAB_EVERY,
} from './presets';

/**
 * The curriculum generator (F-PLAN-002 section 3.3). Pure and deterministic: no
 * clock, no randomness, no locale and no catalogue import, so the same
 * `(params, catalog)` always gives the same draft. Every step of the algorithm
 * is a unit test in `curriculum-generate.test.ts`; the worked examples of
 * section 3.4 are the golden tests.
 */
export const GENERATOR_VERSION = 1;

type QueueItem = Pick<PlanItem, 'kind' | 'id' | 'note'>;
interface StoryEntry {
  item: QueueItem;
  story: CatalogStory;
}
interface Queues {
  lessons: QueueItem[];
  stories: StoryEntry[];
  comingSoon: QueueItem[];
}
interface CalendarWeek {
  index: number;
  startDate: DateKey;
  sessions: DateKey[];
}
interface Reservation {
  entry: StoryEntry;
  festival: FestivalAnchor;
  date: DateKey;
}

export interface GenerateOptions {
  /** Sessions dated before this day are history: they keep the items of `history`. */
  freezeBefore?: DateKey;
  history?: PlanItem[];
  /** Week metadata of the weeks before the week that contains `freezeBefore`. */
  historyWeeks?: WeekMeta[];
}

interface BuildOptions extends GenerateOptions {
  /** `regenerateFrom` `shift`: the plan's own future items replace the catalogue queue. */
  queue?: Queues;
}

const stageIndex = (stage: StageKey): number => StageKeySchema.options.indexOf(stage);
const CANONICAL_THEMES = ThemeKeySchema.options as readonly ThemeKey[];
/** Plain code-unit order of date keys (never a locale comparison). */
const compareKeys = (x: string, y: string): number => (x < y ? -1 : x > y ? 1 : 0);
/** Undated items sort first, as "today". */
const byDate = (a: Pick<PlanItem, 'targetDate'>, b: Pick<PlanItem, 'targetDate'>): number =>
  compareKeys(a.targetDate ?? '', b.targetDate ?? '');
const asQueueItem = (item: PlanItem): QueueItem =>
  item.note === undefined ? { kind: item.kind, id: item.id } : { kind: item.kind, id: item.id, note: item.note };

/** Catalogue lookups and the category of a plan item. */
class Lookup {
  readonly quests: Map<string, CatalogQuest>;
  readonly cells: Map<string, CatalogCell>;
  readonly storiesByQuest: Map<string, CatalogStory>;

  constructor(catalog: Catalog) {
    this.quests = new Map(catalog.quests.map((quest) => [quest.id, quest]));
    this.cells = new Map(catalog.cells.map((cell) => [cell.episodeId, cell]));
    this.storiesByQuest = new Map(catalog.stories.map((story) => [story.questId, story]));
  }

  category(item: QueueItem): 'lesson' | 'story' | 'coming-soon' {
    if (item.kind === 'quest') return this.storiesByQuest.has(item.id) ? 'story' : 'lesson';
    const cell = this.cells.get(item.id);
    return cell !== undefined && cellIsReady(cell) ? 'lesson' : 'coming-soon';
  }

  /** The cell a lesson item belongs to (a lesson quest's cell, or a ready episode itself). */
  lessonCell(item: QueueItem): CatalogCell | undefined {
    if (this.category(item) !== 'lesson') return undefined;
    if (item.kind === 'episode') return this.cells.get(item.id);
    const quest = this.quests.get(item.id);
    return quest === undefined ? undefined : this.cells.get(quest.episodeId);
  }

  minutes(item: QueueItem): number {
    const source = item.kind === 'episode' ? this.cells.get(item.id) : this.quests.get(item.id);
    return source?.minutes ?? 0;
  }

  teachesSymbols(item: QueueItem): boolean {
    return (this.quests.get(item.id)?.teaches.length ?? 0) > 0;
  }
}

/** Step 1: the normalised cadences of a plan. */
const cadenceOf = (p: CurriculumParams) => {
  const sessionsPerWeek = sessionsPerWeekOf(p);
  return {
    sessionsPerWeek,
    reviewEvery: p.reviewEvery ?? (p.weeks >= DEFAULT_REVIEW_MIN_WEEKS ? DEFAULT_REVIEW_EVERY : 0),
    endStage: p.endStage ?? 'stage7',
    cultureEvery: CULTURE_EVERY[p.goals.focus],
    vocabEvery: VOCAB_EVERY[p.goals.focus],
    storiesPerCultureWeek: Math.min(STORIES_PER_CULTURE_WEEK_MAX, Math.max(1, Math.floor(sessionsPerWeek / 2))),
  };
};

/** Step 2: week `i` spans `startDate + 7(i-1)` to `+6`; days off remove sessions, they never move them. */
const calendarOf = (p: CurriculumParams): CalendarWeek[] => {
  const perWeek = sessionsPerWeekOf(p);
  const isOff = (date: DateKey): boolean => p.daysOff.some((range) => range.from <= date && date <= range.to);
  return Array.from({ length: p.weeks }, (_, i) => {
    const startDate = addDays(p.startDate, 7 * i);
    const days = p.sessionDays;
    const dates =
      days === undefined
        ? spreadDates(startDate, perWeek, perWeek)
        : Array.from({ length: 7 }, (__, d) => addDays(startDate, d)).filter((date) => days.includes(weekdayOf(date)));
    return { index: i + 1, startDate, sessions: dates.filter((date) => !isOff(date)) };
  });
};

/** Step 4 theme order: `goals.themes` first, else the motivation's theme first; then canonical. */
const themeOrderOf = (p: CurriculumParams): ThemeKey[] => {
  const themes = p.goals.themes ?? [];
  if (themes.length === 0) return themeOrderFor(p.goals.motivation);
  const first = themes.filter((theme, index) => themes.indexOf(theme) === index);
  return [...first, ...CANONICAL_THEMES.filter((theme) => !first.includes(theme))];
};

interface CatalogQueues extends Queues {
  locked: string[];
  alreadyDone: number;
}

/** Steps 3 to 5: the done set, the lesson queue, the coming-soon queue and the story pool. */
const catalogQueuesOf = (
  p: CurriculumParams,
  catalog: Catalog,
  themeOrder: readonly ThemeKey[],
  endStage: StageKey,
  exclude: ReadonlySet<string>,
): CatalogQueues => {
  const completed = new Set(p.completedQuestIds);
  // The exact placed-out set of a placement result wins over the level (section 3.1): after a
  // grown-up override it may be smaller than the level's, and the put-back quests return (FP-B4).
  const placed = p.placedOutQuestIds ?? questsPlacedOutAtLevel(p.level, routeCatalogOf(catalog));
  const done = new Set([...placed, ...completed, ...exclude]);
  const unlocked = new Set(p.unlockedStages);
  const cellAt = new Map(catalog.cells.map((cell) => [`${cell.stage}-${cell.theme}`, cell]));
  const out: CatalogQueues = { lessons: [], stories: [], comingSoon: [], locked: [], alreadyDone: 0 };
  let soonSeen = 0;
  /** Removed by the done set: only real completions count as "already done" (placement is not a completion). */
  const skip = (questId: string): boolean => {
    if (!done.has(questId)) return false;
    if (completed.has(questId) && !exclude.has(questId)) out.alreadyDone += 1;
    return true;
  };

  // With an exact set, the visit starts at the lowest stage that still has a ready lesson outside it.
  const open = p.placedOutQuestIds === undefined
    ? []
    : catalog.cells.filter((cell) => cellIsReady(cell) && cell.questIds.some((id) => !done.has(id))).map((cell) => stageIndex(cell.stage));
  const first = Math.min(stageIndex(p.level.stage), ...open);
  const stages = StageKeySchema.options.slice(first, stageIndex(endStage) + 1);
  for (const stage of stages) {
    for (const theme of stage === 'stage1' ? CANONICAL_THEMES : themeOrder) {
      const cell = cellAt.get(`${stage}-${theme}`);
      if (cell === undefined) continue;
      if (!cellIsReady(cell)) {
        // A placeholder already in the plan's history counts towards the cap but is not queued again.
        if (p.includeComingSoon && soonSeen < COMING_SOON_MAX) {
          soonSeen += 1;
          if (!done.has(cell.episodeId)) out.comingSoon.push({ kind: 'episode', id: cell.episodeId });
        }
        continue;
      }
      for (const questId of cell.questIds) {
        if (skip(questId)) continue;
        if (unlocked.has(stage)) out.lessons.push({ kind: 'quest', id: questId });
        else out.locked.push(questId);
      }
    }
  }

  const themeRank = (theme: ThemeKey): number => themeOrder.indexOf(theme);
  out.stories = catalog.stories
    .filter((story) => storyIsReady(story) && !skip(story.questId))
    .sort((a, b) => a.recommendedStage - b.recommendedStage || themeRank(a.theme) - themeRank(b.theme) || a.order - b.order)
    .map((story) => ({ item: { kind: 'quest', id: story.questId }, story }));
  return out;
};

/** `regenerateFrom` `shift`: the plan's own items from today, in their order, split by kind. */
const planQueuesOf = (items: readonly PlanItem[], lookup: Lookup): Queues => {
  const out: Queues = { lessons: [], stories: [], comingSoon: [] };
  for (const item of items) {
    const queued = asQueueItem(item);
    const story = lookup.storiesByQuest.get(item.id);
    if (item.kind === 'quest' && story !== undefined) out.stories.push({ item: queued, story });
    else if (lookup.category(queued) === 'coming-soon') out.comingSoon.push(queued);
    else out.lessons.push(queued);
  }
  return out;
};

/** The solar day of a festival in a year; Hangeul Day is 9 October every year. */
const festivalDay = (anchor: FestivalAnchor, year: number): DateKey | undefined =>
  anchor === 'hangeul-day' ? `${year}-10-09` : FESTIVAL_DATES[anchor][String(year)];

/**
 * Step 5 anchors: a story whose festival falls inside the window is reserved for
 * the week that contains the festival day, or the nearest earlier week with a
 * session to fill; it leaves the general pool. Otherwise it stays in the pool.
 */
const reserveAnchors = (
  pool: StoryEntry[],
  calendar: readonly CalendarWeek[],
  from: DateKey,
  end: DateKey,
  startDate: DateKey,
): Map<number, Reservation[]> => {
  const reserved = new Map<number, Reservation[]>();
  const fillable = (week: CalendarWeek | undefined): boolean => week !== undefined && week.sessions.some((date) => date >= from);
  for (const entry of [...pool]) {
    const anchor = entry.story.anchor;
    if (anchor === null) continue;
    let date: DateKey | undefined;
    for (let year = Number(from.slice(0, 4)); year <= Number(end.slice(0, 4)) && date === undefined; year += 1) {
      const day = festivalDay(anchor, year);
      if (day !== undefined && from <= day && day <= end) date = day;
    }
    if (date === undefined) continue;
    let index = Math.floor(daysBetween(startDate, date) / 7) + 1;
    while (index >= 1 && !fillable(calendar[index - 1])) index -= 1;
    if (index < 1) continue;
    const list = reserved.get(index) ?? [];
    list.push({ entry, festival: anchor, date });
    list.sort((a, b) => compareKeys(a.date, b.date));
    reserved.set(index, list);
    pool.splice(pool.indexOf(entry), 1);
  }
  return reserved;
};

const copyWeek = (meta: WeekMeta): WeekMeta => ({
  index: meta.index,
  startDate: meta.startDate,
  kind: meta.kind,
  focus: { episodeId: meta.focus.episodeId, storyIds: [...meta.focus.storyIds], festival: meta.focus.festival },
  extras: meta.extras.map((extra) => ({ ...extra })),
});

/** A real UTC day key; `today` and `freezeBefore` are compared as strings, so a malformed key must throw. */
const RealDateKeySchema = DateKeySchema.refine(isDateKey, { message: 'Not a real UTC day key (YYYY-MM-DD)' });

const build = (input: CurriculumParamsInput, catalog: Catalog, opts: BuildOptions): CurriculumDraft => {
  const p = CurriculumParamsSchema.parse(input);
  if (opts.freezeBefore !== undefined) RealDateKeySchema.parse(opts.freezeBefore);
  const cadence = cadenceOf(p);
  const lookup = new Lookup(catalog);
  const calendar = calendarOf(p);
  const end = addDays(p.startDate, 7 * p.weeks - 1);
  const from = opts.freezeBefore !== undefined && opts.freezeBefore > p.startDate ? opts.freezeBefore : p.startDate;
  const currentWeek = Math.min(p.weeks + 1, Math.floor(daysBetween(p.startDate, from) / 7) + 1);
  const weekOf = (date: DateKey): number => Math.min(p.weeks, Math.max(1, Math.floor(daysBetween(p.startDate, date) / 7) + 1));
  const themeOrder = themeOrderOf(p);

  const history = (opts.history ?? [])
    .filter((item): item is PlanItem & { targetDate: DateKey } => item.targetDate !== undefined && item.targetDate < from)
    .sort(byDate)
    .map((item): CurriculumItem => ({ ...item, week: weekOf(item.targetDate) }));
  const fromCatalog = catalogQueuesOf(p, catalog, themeOrder, cadence.endStage, new Set(history.map((item) => item.id)));
  const queues: Queues = opts.queue ?? fromCatalog;
  const { lessons, stories, comingSoon } = queues;
  const reserved = p.culturalAnchors ? reserveAnchors(stories, calendar, from, end, p.startDate) : new Map<number, Reservation[]>();
  const topics = [...catalog.topics].sort((a, b) => Number(b.free) - Number(a.free) || a.order - b.order);

  let sinceCulture = 0;
  let sinceVocab = 0;
  let newSinceReview = 0;
  let reached = placementStageNumber(p.level.stage);

  const isReady = (item: QueueItem): boolean => lookup.category(item) !== 'coming-soon';
  const count = (item: QueueItem): void => {
    if (isReady(item)) newSinceReview += 1;
    const cell = lookup.lessonCell(item);
    if (cell !== undefined) reached = Math.max(reached, placementStageNumber(cell.stage));
  };
  const fits = (entry: StoryEntry): boolean => entry.story.recommendedStage <= reached + 1;
  const takeStory = (fittingOnly: boolean): StoryEntry | undefined => {
    let index = stories.findIndex(fits);
    if (index < 0 && !fittingOnly) index = 0;
    return index < 0 ? undefined : stories.splice(index, 1)[0];
  };
  /** Every id the walk has put on a session so far (history first, then each placed item). */
  const scheduled = new Set(history.map((item) => item.id));
  /**
   * True while a lesson matching `test` is still unscheduled: in the queue being laid, or (in
   * `shift`, whose queue is the plan's own items) a catalogue lesson the plan never scheduled.
   */
  const unscheduled = (test: (item: QueueItem) => boolean): boolean =>
    lessons.some(test) || fromCatalog.lessons.some((item) => test(item) && !scheduled.has(item.id));
  const vocabAllowed = (): boolean => !unscheduled((item) => lookup.teachesSymbols(item));
  /** Replay: a frozen learn week allowed topics when no symbol lesson was scheduled after it. */
  const lastSymbolWeek = history.reduce((top, item) => (lookup.teachesSymbols(item) ? Math.max(top, item.week) : top), 0);
  const giveTopic = (extras: WeekExtra[]): void => {
    const topic = topics.shift();
    if (topic === undefined) return;
    extras.push({ kind: 'vocab', topicId: topic.id });
    sinceVocab = 0;
  };
  const focusOf = (items: readonly CurriculumItem[], festival: FestivalAnchor | null): WeekMeta['focus'] => ({
    episodeId: items.map((item) => lookup.lessonCell(item)).find((cell) => cell !== undefined)?.episodeId ?? null,
    storyIds: items.flatMap((item) => {
      const story = lookup.storiesByQuest.get(item.id);
      return item.kind === 'quest' && story !== undefined ? [story.id] : [];
    }).slice(0, 3),
    festival,
  });

  const weeks: WeekMeta[] = [];
  const items: CurriculumItem[] = [];
  for (const week of calendar) {
    const past = history.filter((item) => item.week === week.index);
    items.push(...past);

    if (week.index < currentWeek) {
      // Frozen: the week keeps its metadata; the cadence counters are rebuilt from it.
      const stored = opts.historyWeeks?.find((meta) => meta.index === week.index);
      const meta: WeekMeta = stored === undefined
        ? { index: week.index, startDate: week.startDate, kind: week.sessions.length === 0 ? 'break' : 'learn', focus: focusOf(past, null), extras: [] }
        : copyWeek(stored);
      if (meta.kind === 'review') newSinceReview = 0;
      if (meta.kind === 'culture') sinceCulture = 0;
      if (meta.kind === 'learn') {
        sinceCulture += 1;
        if (vocabAllowed() && week.index >= lastSymbolWeek) sinceVocab += 1;
      }
      for (const extra of meta.extras) {
        if (extra.kind !== 'vocab') continue;
        sinceVocab = 0;
        const index = topics.findIndex((topic) => topic.id === extra.topicId);
        if (index >= 0) topics.splice(index, 1);
      }
      past.forEach(count);
      weeks.push(meta);
      continue;
    }

    // Step 6: the week kind. A week already under way keeps the kind it was started with.
    const pastDates = new Set(past.map((item) => item.targetDate));
    const fillable = week.sessions.filter((date) => date >= from && !pastDates.has(date));
    const reservations = reserved.get(week.index) ?? [];
    const started = week.startDate < from ? opts.historyWeeks?.find((meta) => meta.index === week.index) : undefined;
    const keep = started !== undefined && (started.kind === 'learn' || started.kind === 'culture') ? started : undefined;
    let kind: WeekKind;
    if (week.sessions.length === 0) kind = 'break';
    else if (keep !== undefined && reservations.length === 0) kind = keep.kind;
    else if (reservations.length > 0) kind = 'culture';
    else if (
      cadence.reviewEvery > 0 &&
      week.index % cadence.reviewEvery === 0 &&
      week.index !== p.weeks &&
      newSinceReview > 0 &&
      past.length === 0
    ) kind = 'review';
    else if (cadence.cultureEvery > 0 && sinceCulture >= cadence.cultureEvery && stories.some(fits)) kind = 'culture';
    else kind = 'learn';

    // Step 7: fill the sessions, earliest first, one item each.
    past.forEach(count);
    const placed: CurriculumItem[] = [];
    if (kind === 'learn' || kind === 'culture') {
      const pastStories = past.filter((item) => lookup.category(item) === 'story').length;
      const storySlots =
        kind === 'culture'
          ? Math.min(fillable.length, Math.max(cadence.storiesPerCultureWeek - pastStories, reservations.length))
          : 0;
      const pending = reservations.map((reservation) => reservation.entry);
      fillable.forEach((date, slot) => {
        let next: QueueItem | undefined;
        if (slot < storySlots) next = (pending.shift() ?? takeStory(true))?.item;
        next ??= lessons.shift() ?? takeStory(false)?.item ?? comingSoon.shift();
        if (next === undefined) return;
        placed.push({ ...next, targetDate: date, week: week.index });
        scheduled.add(next.id);
        count(next);
      });
      stories.unshift(...pending);
    }
    items.push(...placed);

    // Step 8: extras and the cadence counters.
    const weekItems = [...past, ...placed];
    const extras: WeekExtra[] = [];
    if (kind === 'learn') {
      sinceCulture += 1;
      const allowed = vocabAllowed();
      if (allowed) sinceVocab += 1;
      const cadenceReached = cadence.vocabEvery > 0 && allowed && sinceVocab >= cadence.vocabEvery;
      const freePractice = weekItems.length === 0 && p.goals.focus !== 'reading';
      if (cadenceReached || freePractice) giveTopic(extras);
    } else if (kind === 'culture') sinceCulture = 0;
    else if (kind === 'review') newSinceReview = 0;

    weeks.push({
      index: week.index,
      startDate: week.startDate,
      kind,
      focus: focusOf(weekItems, reservations[0]?.festival ?? keep?.focus.festival ?? null),
      extras,
    });
  }

  // Step 8: the Hangul Check closes Stage 1 in the week of its last lesson, once every Stage 1
  // lesson of the catalogue is scheduled. A check in a frozen week stands; it is given again only
  // when a re-pace lays a Stage 1 lesson in a later week (requeue returned an unfinished one), so
  // the check never sits before the last Stage 1 lesson.
  const isStage1Lesson = (item: QueueItem): boolean => lookup.lessonCell(item)?.stage === 'stage1';
  const lastStage1 = [...items].reverse().find(isStage1Lesson);
  const checkWeek = lastStage1 === undefined ? undefined : weeks[lastStage1.week - 1];
  if (
    p.level.stage === 'stage1' &&
    !unscheduled(isStage1Lesson) &&
    checkWeek !== undefined &&
    checkWeek.index >= currentWeek
  ) {
    checkWeek.extras.push({ kind: 'hangul-check' });
  }

  items.sort(byDate);
  const leftovers = opts.queue === undefined ? lessons.length : lessons.filter(isReady).length + stories.length;
  return {
    params: p,
    generatorVersion: GENERATOR_VERSION,
    catalogVersion: catalog.version,
    weeks,
    items,
    locked: fromCatalog.locked,
    ...summarise(p, calendar, weeks, items, lookup, {
      from,
      locked: fromCatalog.locked.length,
      leftovers,
      alreadyDone: opts.queue === undefined ? fromCatalog.alreadyDone : 0,
    }),
  };
};

/** Step 9: stats and warnings. */
const summarise = (
  p: CurriculumParams,
  calendar: readonly CalendarWeek[],
  weeks: readonly WeekMeta[],
  items: readonly CurriculumItem[],
  lookup: Lookup,
  facts: { from: DateKey; locked: number; leftovers: number; alreadyDone: number },
): { stats: CurriculumStats; warnings: CurriculumWarning[] } => {
  const lessons = items.filter((item) => lookup.category(item) === 'lesson');
  const stories = items.filter((item) => lookup.category(item) === 'story');
  const comingSoon = items.filter((item) => lookup.category(item) === 'coming-soon');
  const ready = [...lessons, ...stories];
  const used = new Set(items.map((item) => item.targetDate));
  const kindOf = (index: number): WeekKind | undefined => weeks[index - 1]?.kind;

  let openSessions = 0;
  let runsOut: number | undefined;
  for (const week of calendar) {
    const kind = kindOf(week.index);
    if (kind !== 'learn' && kind !== 'culture') continue;
    for (const date of week.sessions) {
      if (used.has(date)) continue;
      openSessions += 1;
      if (runsOut === undefined && date >= facts.from) runsOut = week.index;
    }
  }

  const highest = lessons
    .map((item) => lookup.lessonCell(item)?.stage)
    .filter((stage): stage is StageKey => stage !== undefined)
    .reduce((top, stage) => (stageIndex(stage) > stageIndex(top) ? stage : top), p.level.stage);
  const sessions = calendar.reduce((sum, week) => sum + week.sessions.length, 0);
  const tooLong = ready.filter((item) => lookup.minutes(item) > SESSION_TOO_SHORT_FACTOR * p.minutesPerSession).length;

  const stats: CurriculumStats = {
    sessions,
    readyItems: ready.length,
    lessons: lessons.length,
    stories: stories.length,
    comingSoonItems: comingSoon.length,
    openSessions,
    minutesPlanned: ready.reduce((sum, item) => sum + lookup.minutes(item), 0),
    minutesAvailable: sessions * p.minutesPerSession,
    reviewWeeks: weeks.filter((week) => week.kind === 'review').length,
    breakWeeks: weeks.filter((week) => week.kind === 'break').length,
    cultureWeeks: weeks.filter((week) => week.kind === 'culture').length,
    vocabWeeks: weeks.filter((week) => week.extras.some((extra) => extra.kind === 'vocab')).length,
    endsAtStage: highest,
  };

  const warnings: CurriculumWarning[] = [];
  if (runsOut !== undefined) warnings.push({ code: 'content-runs-out', week: runsOut });
  const firstSoon = comingSoon[0];
  if (firstSoon !== undefined) warnings.push({ code: 'coming-soon-included', week: firstSoon.week, count: comingSoon.length });
  if (facts.locked > 0) warnings.push({ code: 'premium-needed', count: facts.locked });
  if (facts.leftovers > 0) warnings.push({ code: 'fewer-sessions-than-units', count: facts.leftovers });
  if (tooLong > 0) warnings.push({ code: 'session-too-short', count: tooLong });
  if (facts.alreadyDone > 0) warnings.push({ code: 'already-done-skipped', count: facts.alreadyDone });
  // Week-bound warnings first, in week order; then the rest in code order.
  const rank = (warning: CurriculumWarning): number => (warning.week ?? 53) * 10 + WARNING_CODES.indexOf(warning.code);
  warnings.sort((a, b) => rank(a) - rank(b));
  return { stats, warnings };
};

/** One curriculum draft for `(params, catalog)`; `opts` freezes the history of a re-paced plan. */
export function generateCurriculum(params: CurriculumParamsInput, catalog: Catalog, opts: GenerateOptions = {}): CurriculumDraft {
  return build(params, catalog, opts);
}

/** The draft as plan items, by date; a coming-soon item carries the `Coming soon` note. At most 260. */
export function toPlanItems(draft: CurriculumDraft): CurriculumItem[] {
  return [...draft.items]
    .sort(byDate)
    .slice(0, CURRICULUM_MAX_ITEMS)
    .map((item) => (item.kind === 'episode' ? { ...item, note: item.note ?? COMING_SOON_NOTE } : { ...item }));
}

/** What a plan stores next to its items; never the learner's completions. */
export function toMeta(draft: CurriculumDraft): CurriculumMeta {
  const { completedQuestIds: _completed, ...stored } = draft.params satisfies { completedQuestIds: string[] };
  return {
    kind: 'curriculum',
    generatorVersion: draft.generatorVersion,
    catalogVersion: draft.catalogVersion,
    params: stored satisfies StoredCurriculumParams,
    weeks: draft.weeks.map(copyWeek),
    horizonDays: HORIZON_DAYS,
    repacedAt: null,
  };
}

export type RegenerateMode = 'shift' | 'requeue' | 'reseed';

/** What a `reseed` may replace (FP-B4): the start (level and placed-out set) and the goals. */
export type ReseedPatch = Partial<Pick<CurriculumParams, 'level' | 'placedOutQuestIds' | 'goals'>>;

export interface RegenerateOptions {
  mode: RegenerateMode;
  completedQuestIds?: string[];
  /** `reseed` only; ignored by the other modes. */
  paramsPatch?: ReseedPatch;
}

const levelRank = (level: PlacementLevel): number => placementStageNumber(level.stage) * 10 + level.band;

/**
 * Re-pacing (section 3.7) from `today`: sessions before today keep their items,
 * weeks before the current week keep their metadata, and the end date stays.
 * `shift` lays the plan's own items dated today or later onto the remaining
 * sessions in their order (the console's mode: it cannot know completion).
 * `requeue` rebuilds the queue from the catalogue minus the done set, so an
 * unfinished past item leaves its old date and returns to the front (the
 * device's mode).
 *
 * `reseed` (after a retake or a grown-up override, FP-B4) replaces the stored
 * `level` (never lower: a lower level keeps the stored one) and, when the patch
 * carries them, `placedOutQuestIds` and `goals`; every item dated before today
 * stays where it is, done or not, and the future queue is rebuilt from the
 * catalogue minus the done set, the patched placed-out set and those past items.
 * The caller keeps the placed-out set a superset of the stored one except after
 * an override (`effectiveRoute` does), so put-back quests return to the queue.
 * A `reseed` with an empty patch is a `shift`.
 *
 * In `requeue`, past coming-soon placeholders stay on their dates (nothing can
 * complete them, so moving them would never settle), and when no session is
 * left on or after `today` there is nowhere to move anything: every past item
 * stays and the plan is unchanged. Offer **Add N weeks** (`weeks + N`) first.
 */
export function regenerateFrom(
  plan: { meta: CurriculumMeta; items: PlanItem[] },
  today: DateKey,
  catalog: Catalog,
  opts: RegenerateOptions,
): CurriculumDraft {
  RealDateKeySchema.parse(today);
  const completed = opts.completedQuestIds ?? [];
  const params: CurriculumParamsInput = { ...plan.meta.params, completedQuestIds: completed };
  const isPast = (item: PlanItem): boolean => item.targetDate !== undefined && item.targetDate < today;
  const past = plan.items.filter(isPast);
  const base = { freezeBefore: today, historyWeeks: plan.meta.weeks };
  if (opts.mode === 'reseed') {
    const { level, placedOutQuestIds, goals } = opts.paramsPatch ?? {};
    if (level === undefined && placedOutQuestIds === undefined && goals === undefined) {
      return regenerateFrom(plan, today, catalog, { mode: 'shift', completedQuestIds: completed });
    }
    const stored = plan.meta.params.level;
    const reseeded: CurriculumParamsInput = {
      ...params,
      level: level !== undefined && levelRank(level) > levelRank(stored) ? level : stored,
      ...(placedOutQuestIds === undefined ? {} : { placedOutQuestIds: [...placedOutQuestIds] }),
      ...(goals === undefined ? {} : { goals }),
    };
    return build(reseeded, catalog, { ...base, history: past });
  }
  if (opts.mode === 'requeue') {
    const lookup = new Lookup(catalog);
    const done = new Set(completed);
    const sessionsLeft = calendarOf(CurriculumParamsSchema.parse(params)).some((week) => week.sessions.some((date) => date >= today));
    const stays = (item: PlanItem): boolean =>
      !sessionsLeft || done.has(item.id) || lookup.category(asQueueItem(item)) === 'coming-soon';
    return build(params, catalog, { ...base, history: past.filter(stays) });
  }
  const future = plan.items.filter((item) => !isPast(item));
  return build(params, catalog, { ...base, history: past, queue: planQueuesOf(future, new Lookup(catalog)) });
}

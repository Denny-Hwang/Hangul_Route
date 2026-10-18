import {
  CATALOG,
  LECTURE_PRESETS,
  LECTURE_REVISIT_CHAR_RE,
  PRESET_DEFAULT_MINUTES,
  PRESET_LENGTHS,
  StageKeySchema,
  cellIsReady,
  classPosition,
  consoleRecentWords,
  deckVersion,
  presetOrder,
  questIdsOfBlocks,
  resolvePreset,
  type Catalog,
  type LectureBlock,
  type LecturePreset,
  type PresetContext,
  type PresetFallback,
  type PresetMinutes,
  type ResolvedPreset,
  type StageKey,
} from '@hangul-route/content-schema';
import type { Messages } from '@hangul-route/i18n';
import type { PlanView, Roster } from './api';
import { thisWeekOf, weekGroups } from './curriculum';
import { planBlocks, planOutline, titleProblem, v2LinksAllowed, type LectureSource } from './lecture';
import { classRollup } from './rollup';
import { parseVocabSummary } from './vocab-summary';

/**
 * The console's side of the ready-made lessons (AMENDMENTS-LECTURE-V2 sections 4.1 to 4.3 and 4.6, row LV-4): the
 * preset context built from what the setup page already loads (the roster and this week's plan), the presets the page
 * offers today, and the words and deck fields of a resolved preset. The resolver is content-schema's `resolvePreset`,
 * the same one the presenter and the learner app call, so the same inputs give the same blocks everywhere.
 *
 * What the console gives the resolver:
 * - **plan** (N1, W1): this week's outline of the plan on the page (`planOutline`), and whether its title may be the
 *   deck title (`titleProblem` against the roster: no learner name, no banned word);
 * - **position** (N2, S, T): `classPosition` over the roster rows' `summary.journey` (two numbers: the most common
 *   stage and the smallest done count in it; nobody is named, compared or counted on screen);
 * - **recent words** (W1): the quests of this week's and last week's plan items, and the class's words to revisit
 *   only when at least two learners carry `summary.vocab` (`consoleRecentWords`);
 * - **letters to revisit** (U): the roll-up's letters (at most 3), topped up from the plan's taught letters to 6.
 *
 * Nothing here returns a person: the context holds content ids, compatibility jamo and the two position numbers, and
 * a preset deck's title is a localized preset name or a plan title the roster check accepted.
 */

type RosterPick = Pick<Roster, 'space' | 'learners'>;
type PresetWords = Messages['console']['lecture']['presets'];

/** The presets whose deck needs format v2 (only Word review, LV-D6); held back until `LECTURE_V2_LINKS_FROM`. */
export const V2_PRESETS: readonly LecturePreset[] = ['word-review'];

/** The presets this console offers at `now`: all six, but Word review only from `LECTURE_V2_LINKS_FROM` (section 4.5). */
export function consolePresets(now: Date): LecturePreset[] {
  const v2 = v2LinksAllowed(now);
  return LECTURE_PRESETS.filter((preset) => v2 || !V2_PRESETS.includes(preset));
}

/** Next lesson has something to follow: a plan this week or a place on the Learning Route (it resolves without a fallback). */
export function somethingToFollow(ctx: PresetContext): boolean {
  return resolvePreset('next-lesson', PRESET_DEFAULT_MINUTES['next-lesson'], ctx).fallback === null;
}

/** The cards in the section 4.1 order (Next lesson first only with something to follow, else last), the offered ones only. */
export function consolePresetOrder(ctx: PresetContext, now: Date): LecturePreset[] {
  const offered = new Set(consolePresets(now));
  return presetOrder(somethingToFollow(ctx)).filter((preset) => offered.has(preset));
}

/** The stages Stage by stage offers: those with a ready cell, in order. */
export function presetStages(catalog: Catalog = CATALOG): StageKey[] {
  return StageKeySchema.options.filter((stage) => catalog.cells.some((cell) => cell.stage === stage && cellIsReady(cell)));
}

/** The quest ids of the plan's items this week and last week (W1): a classic plan is all this week's; a route reads its weeks. */
export function planWeekQuests(plan: Pick<PlanView, 'items' | 'meta'> | null, today: string): { thisWeek: string[]; lastWeek: string[] } {
  if (!plan) return { thisWeek: [], lastWeek: [] };
  const thisWeek = questIdsOfBlocks(planOutline(plan, today).blocks, CATALOG);
  const weeks = plan.meta?.weeks ?? [];
  if (weeks.length === 0) return { thisWeek, lastWeek: [] };
  const where = thisWeekOf(weeks, today);
  // The week before the one presented: none before the route starts, the second-to-last after it ends.
  const at = where.status === 'in' ? weeks.indexOf(where.week) : where.status === 'before' ? 0 : weeks.length - 1;
  const previous = weeks[at - 1];
  if (!previous) return { thisWeek, lastWeek: [] };
  const row = weekGroups([previous], plan.items).rows[0];
  const items = (row?.items ?? []).flatMap((entry) => {
    const item = plan.items[entry.index];
    return item ? [item] : [];
  });
  return { thisWeek, lastWeek: questIdsOfBlocks(planBlocks({ items }), CATALOG) };
}

/** U's letters on the console: the roll-up's letters to revisit (at most 3), topped up from the plan's taught letters to 6, plain jamo only. */
export function consoleRevisitChars(rollupRevisit: readonly string[], planOutlineBlocks: readonly LectureBlock[], catalog: Catalog = CATALOG): string[] {
  const teaches = new Map(catalog.quests.map((q) => [q.id, q.teaches]));
  const taught = questIdsOfBlocks(planOutlineBlocks, catalog).flatMap((id) => teaches.get(id) ?? []);
  const plain = [...rollupRevisit.slice(0, 3), ...taught].filter((c) => LECTURE_REVISIT_CHAR_RE.test(c));
  return [...new Set(plain)].slice(0, 6);
}

export interface ConsolePresetInput {
  /** The space's roster (null while it has not loaded or did not load: every preset still resolves, section 9). */
  roster: RosterPick | null;
  /** The plan the page presents (`pickPlan`), or null. */
  plan: PlanView | null;
  /** Today, as `dateKey`. */
  today: string;
  now: Date;
}

/** The console's preset context (sections 4.2 and 4.3): the roster and the plan read as the resolver needs them, nothing more. */
export function consolePresetContext(input: ConsolePresetInput): PresetContext {
  const learners = input.roster?.learners ?? [];
  const outline = input.plan ? planOutline(input.plan, input.today).blocks : [];
  const rollup = classRollup(learners, input.now);
  const weeks = planWeekQuests(input.plan, input.today);
  const roster = input.roster;
  return {
    catalog: CATALOG,
    plan: input.plan && outline.length > 0 ? { title: input.plan.title, blocks: outline } : null,
    ...(roster ? { planTitleOk: (title: string) => titleProblem(title, roster) === null } : {}),
    position: classPosition(
      learners.map((l) => ({ journey: l.summary?.journey ?? null })),
      CATALOG,
    ),
    recentWords: consoleRecentWords({
      thisWeek: weeks.thisWeek,
      lastWeek: weeks.lastWeek,
      vocabRevisit: rollup.vocabRevisit,
      vocabSummaries: learners.filter((l) => parseVocabSummary(l.summary?.vocab) !== null).length,
    }),
    revisitChars: consoleRevisitChars(rollup.revisit, outline),
  };
}

/** The stage chip Stage by stage opens on: the class's stage when it has a ready cell, else the first ready stage. */
export function defaultPresetStage(ctx: PresetContext, stages: readonly StageKey[] = presetStages(ctx.catalog)): StageKey {
  const own = ctx.position?.stage;
  return own !== undefined && stages.includes(own) ? own : (stages[0] ?? 'stage1');
}

/** The length a card builds: the chosen chip when the preset offers it, else its default. */
export function presetMinutes(preset: LecturePreset, chosen: Partial<Record<LecturePreset, PresetMinutes>>): PresetMinutes {
  const pick = chosen[preset];
  return pick !== undefined && PRESET_LENGTHS[preset].includes(pick) ? pick : PRESET_DEFAULT_MINUTES[preset];
}

/** A card's resolved deck blocks, with the stage chip for Stage by stage. */
export function resolveConsolePreset(preset: LecturePreset, minutes: PresetMinutes, stage: StageKey, ctx: PresetContext): ResolvedPreset {
  return resolvePreset(preset, minutes, { ...ctx, stage });
}

/** The localized deck title of a resolved preset: a preset name, or the plan's own title when the roster check accepted it (N1). */
export function presetTitle(resolved: Pick<ResolvedPreset, 'titleKey' | 'stageNumber' | 'planTitle'>, words: PresetWords): string {
  switch (resolved.titleKey) {
    case 'next.title':
      return words.next.title;
    case 'zero.short':
      return words.zero.short;
    case 'stage.chip':
      return words.stage.chip(resolved.stageNumber ?? 1);
    case 'words.title':
      return words.words.title;
    case 'warmup.short':
      return words.warmup.short;
    case 'story.title':
      return words.story.title;
    case 'plan':
      return resolved.planTitle ?? words.next.title;
  }
}

/**
 * The deck's `source` (LV-D6): `plan` for Next lesson from this week's plan (N1), `revisit` for a warm-up of the
 * space's letters to revisit, `catalogue` for every other console preset.
 */
export function presetSource(resolved: Pick<ResolvedPreset, 'preset'>, ctx: PresetContext): LectureSource {
  if (resolved.preset === 'next-lesson' && (ctx.plan?.blocks.length ?? 0) > 0) return 'plan';
  if (resolved.preset === 'warm-up' && (ctx.revisitChars?.length ?? 0) > 0) return 'revisit';
  return 'catalogue';
}

/** A card's title and line; Next lesson names this week's plan, else the class or the family (section 12.2). */
export function presetCardWords(preset: LecturePreset, words: PresetWords, input: { planTitle: string | null; family: boolean }): { title: string; line: string } {
  switch (preset) {
    case 'next-lesson': {
      const line = input.planTitle !== null ? words.next.plan(input.planTitle) : input.family ? words.next.family : words.next.class;
      return { title: words.next.title, line };
    }
    case 'hangul-week-1':
      return { title: words.zero.title, line: words.zero.body };
    case 'by-stage':
      return { title: words.stage.title, line: words.stage.body };
    case 'story-time':
      return { title: words.story.title, line: words.story.body };
    case 'word-review':
      return { title: words.words.title, line: words.words.body };
    case 'warm-up':
      return { title: words.warmup.title, line: words.warmup.body };
  }
}

/** The line under a card that could not build what it names (information, never a warning). */
export function presetFallbackLine(fallback: PresetFallback | null, words: PresetWords): string | null {
  if (fallback === 'zero') return words.fallback.zero;
  if (fallback === 'warm-up') return words.fallback.warmUp;
  if (fallback === 'restart') return words.fallback.restart;
  return null;
}

/** `?from=plan|revisit` (Present this plan, Revisit together) opens Next lesson or the warm-up (section 4.6). */
export function presetFrom(from: 'plan' | 'revisit' | null): LecturePreset | null {
  if (from === 'plan') return 'next-lesson';
  if (from === 'revisit') return 'warm-up';
  return null;
}

/** Whether an outline would make a v2 link, which the page holds back before `LECTURE_V2_LINKS_FROM`. */
export function needsV2(blocks: readonly LectureBlock[]): boolean {
  return deckVersion({ blocks }) === 2;
}

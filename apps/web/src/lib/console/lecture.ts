import {
  CATALOG,
  JOIN_CODE_RE,
  LECTURE_MAX_BLOCKS,
  LECTURE_REVISIT_CHAR_RE,
  LECTURE_TITLE_RE,
  LectureBlockSchema,
  LectureDeckSchema,
  encodeDeck,
  presetBlockMinutes,
  rosterAlias,
  type LectureBlock,
  type LectureDeck,
  type LectureOptions,
  type PlanItem,
  type WeekMeta,
} from '@hangul-route/content-schema';
import { itemTitle } from '@/data/catalog';
import { LECTURE_STORIES, LECTURE_VOCAB_TOPICS, type LectureCatalogueStory } from '@/data/lecture-catalogue.generated';
import type { PlanView, Roster, SpaceListItem } from './api';
import { findBannedWord } from './banned-text';
import { thisWeekOf, weekGroups } from './curriculum';
import { type PlanLike, latestPublished } from './plans';

/**
 * Lecture setup, the pure half (F-TCH-004 §3.10, §3.11). The console composes a
 * deck (ids, a seed and options) that travels in the presenter link. The helper
 * picker is gone (LV-H): a deck names none, and no learner name, summary, age,
 * level, avatar or id ever leaves this page; the roster is read only to keep
 * names out of the deck title (`titleProblem`).
 */

export type LectureSource = 'plan' | 'catalogue' | 'revisit';
export type TitleProblem = 'empty' | 'chars' | 'banned' | 'name';
export type OutlineProblem = 'empty' | 'too-many';

const REVISIT_MAX = 6;
const TITLE_MAX = 60;
const ID_CHARS = 'abcdefghijklmnopqrstuvwxyz0123456789';
const DECK_ID_LENGTH = 10;

type RosterPick = Pick<Roster, 'space' | 'learners'>;

/** `?from=plan|revisit` from an entry point (Present this plan, Revisit together). */
export function lectureSourceFrom(params: { get(name: string): string | null } | null): 'plan' | 'revisit' | null {
  const from = params?.get('from');
  return from === 'plan' || from === 'revisit' ? from : null;
}

/** `?plan=<id>` from "Present this plan": the plan on screen (an id, never a name). */
export function lecturePlanFrom(params: { get(name: string): string | null } | null): string | null {
  const id = params?.get('plan');
  return id ? id : null;
}

/** The plan to present: the one on the plan page when it is still published and live, else the newest published plan. */
export function pickPlan<T extends PlanLike & { id: string }>(plans: readonly T[], planId: string | null): T | null {
  const chosen = plans.find((p) => p.id === planId && p.publishedAt !== null && p.archivedAt === null);
  return chosen ?? latestPublished(plans);
}

/** One block per plan item, in order; an id the deck grammar refuses is left out. */
export function planBlocks(plan: { items: readonly PlanItem[] }): LectureBlock[] {
  return plan.items.flatMap((item) => {
    const parsed = LectureBlockSchema.safeParse({ kind: item.kind, id: item.id });
    return parsed.success ? [parsed.data] : [];
  });
}

/** The week of a route to present: today's week; before the route its first week, after it its last. */
function presentedWeek(weeks: readonly WeekMeta[], today: string): WeekMeta | null {
  const where = thisWeekOf(weeks, today);
  if (where.status === 'in') return where.week;
  return (where.status === 'before' ? weeks[0] : weeks[weeks.length - 1]) ?? null;
}

/**
 * "Present this plan" (§3.11): a classic plan gives one block per item; a route plan
 * (`meta`, up to 260 items over a term) gives this week's items only. Either way the
 * outline holds at most `LECTURE_MAX_BLOCKS`; `omitted` counts what the cap left out.
 */
export function planOutline(plan: { items: readonly PlanItem[]; meta?: { weeks: readonly WeekMeta[] } | null }, today: string): { blocks: LectureBlock[]; omitted: number } {
  let items: readonly PlanItem[] = plan.items;
  if (plan.meta) {
    const week = presentedWeek(plan.meta.weeks, today);
    const row = week ? weekGroups([week], plan.items).rows[0] : undefined;
    items = (row?.items ?? []).flatMap((entry) => {
      const item = plan.items[entry.index];
      return item ? [item] : [];
    });
  }
  const all = planBlocks({ items });
  return { blocks: all.slice(0, LECTURE_MAX_BLOCKS), omitted: Math.max(0, all.length - LECTURE_MAX_BLOCKS) };
}

/** The outline takes another block only below the deck's cap. */
export function canAdd(blocks: readonly LectureBlock[]): boolean {
  return blocks.length < LECTURE_MAX_BLOCKS;
}

export function outlineProblem(blocks: readonly LectureBlock[]): OutlineProblem | null {
  if (blocks.length === 0) return 'empty';
  return blocks.length > LECTURE_MAX_BLOCKS ? 'too-many' : null;
}

/** The roll-up's "jamo to revisit" as one revisit block (compatibility jamo, at most 6). */
export function revisitBlock(chars: readonly string[]): LectureBlock | null {
  const kept = [...new Set(chars.filter((c) => LECTURE_REVISIT_CHAR_RE.test(c)))].slice(0, REVISIT_MAX);
  return kept.length > 0 ? { kind: 'revisit', chars: kept } : null;
}

export function classCodeBlock(joinCode: string | null): LectureBlock | null {
  return joinCode !== null && JOIN_CODE_RE.test(joinCode) ? { kind: 'class-code', code: joinCode } : null;
}

export function moveBlock(blocks: readonly LectureBlock[], from: number, to: number): LectureBlock[] {
  if (to < 0 || to >= blocks.length || from < 0 || from >= blocks.length) return [...blocks];
  const out = [...blocks];
  const [moved] = out.splice(from, 1);
  out.splice(to, 0, moved as LectureBlock);
  return out;
}

export function updateBlock(blocks: readonly LectureBlock[], index: number, block: LectureBlock): LectureBlock[] {
  return blocks.map((b, i) => (i === index ? block : b));
}

/** A content block's title from the shared catalogue and the lecture mirror (titles are content); an unknown id shows itself. Null for other blocks. */
export function catalogueTitle(block: LectureBlock, stories: readonly LectureCatalogueStory[] = LECTURE_STORIES): string | null {
  switch (block.kind) {
    case 'quest':
    case 'episode':
      return itemTitle(block.kind, block.id);
    case 'story':
      return stories.find((s) => s.id === block.storyId)?.titleEn ?? block.storyId;
    case 'vocab':
      return LECTURE_VOCAB_TOPICS.find((t) => t.id === block.topicId)?.titleEn ?? block.topicId;
    default:
      return null;
  }
}

const questMinutes = new Map(CATALOG.quests.map((q) => [q.id, q.minutes]));
const episodeMinutes = new Map(CATALOG.cells.map((c) => [c.episodeId, c.minutes]));
// The deck names a topic `vocab-topic:<key>`; the shared catalogue names it `topic:<key>`.
const topicMinutes = new Map(CATALOG.topics.map((t) => [`vocab-topic:${t.key}`, t.minutes]));

/** A vocabulary topic's about-minutes from the shared catalogue (null when it does not know the topic). */
export function vocabMinutes(topicId: string): number | null {
  return topicMinutes.get(topicId) ?? null;
}

/**
 * About-minutes for the outline from the shared catalogue (F-PLAN-002) and the lecture
 * mirror (the console has no content bundle; exact slide counts appear on the presenter
 * start screen). Null when the catalogue does not know the item.
 */
export function blockMinutes(block: LectureBlock, stories: readonly LectureCatalogueStory[] = LECTURE_STORIES): number | null {
  switch (block.kind) {
    case 'quest':
      return questMinutes.get(block.id) ?? null;
    case 'episode':
      return episodeMinutes.get(block.id) ?? null;
    case 'story':
      return stories.find((s) => s.id === block.storyId)?.minutes ?? null;
    case 'vocab':
      return vocabMinutes(block.topicId);
    case 'quiz':
      return block.rounds;
    case 'activity':
      return block.minutes;
    case 'class-code':
      return 0;
    case 'jamo-set':
    case 'cards':
    case 'revisit':
    case 'word-review':
      // Rule 12 as amended (AMENDMENTS-LECTURE-V2 4.4): ceil(slides / 2) for the non-quiz slides,
      // 1 per quiz slide, from the block size, the same count the presets use.
      return presetBlockMinutes(block, CATALOG);
  }
}

export function aboutMinutes(blocks: readonly LectureBlock[]): number {
  return blocks.reduce((sum, b) => sum + (blockMinutes(b) ?? 0), 0);
}

// ---- quiz scope (§3.3 rule 7) ------------------------------------------------------

const QUIZ_MIN_ITEMS = 4;

/** The items a block teaches when the console can count them (letters and cards); null when only the bundle knows (quests, episodes, stories, vocab). */
function countedItems(block: LectureBlock): readonly string[] | null {
  switch (block.kind) {
    case 'revisit':
      return block.chars;
    case 'jamo-set':
      return block.jamoIds;
    case 'cards':
      return block.cardIds;
    default:
      return null;
  }
}

const teaches = (block: LectureBlock): boolean => block.kind !== 'quiz' && block.kind !== 'activity' && block.kind !== 'class-code';

/**
 * The quiz blocks the presenter would skip as `scope-too-small` (fewer than 4 distinct
 * taught items), so the console can warn at compose time: a quiz with nothing taught in
 * its scope (`previous`: since the last quiz or the start; `all`: since the start), or a
 * scope of letters and cards alone with fewer than 4 distinct ones. A quest, episode,
 * story or vocab block is taken as enough (its scope is in the bundle, not here).
 */
export function quizWarnings(blocks: readonly LectureBlock[]): number[] {
  const out: number[] = [];
  let lastQuiz = -1;
  blocks.forEach((block, index) => {
    if (block.kind !== 'quiz') return;
    const scope = blocks.slice(block.from === 'previous' ? lastQuiz + 1 : 0, index).filter(teaches);
    lastQuiz = index;
    const counted = scope.map(countedItems);
    const tooSmall =
      scope.length === 0 || (counted.every((items) => items !== null) && new Set(counted.flatMap((items) => items ?? [])).size < QUIZ_MIN_ITEMS);
    if (tooSmall) out.push(index);
  });
  return out;
}

// ---- who composes ---------------------------------------------------------------------

/**
 * The entry points show only for the roles that can compose plans (§3.11; `plan.write` in
 * `packages/backend/src/lib/can.ts`): a class `teacher`, a family `caregiver`, or the owner
 * of either. A school admin reaching a child class through the school sees none; so does
 * anyone before the space list loads.
 */
export function canComposeIn(spaces: readonly SpaceListItem[] | null, spaceId: string): boolean {
  const entry = spaces?.find((s) => s.space.id === spaceId);
  if (!entry) return false;
  if (entry.space.kind === 'class') return entry.role === 'teacher' || entry.role === 'owner';
  if (entry.space.kind === 'family') return entry.role === 'caregiver' || entry.role === 'owner';
  return false;
}

// ---- title guard -----------------------------------------------------------------

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const HANGUL_END = /\p{Script=Hangul}$/u;
const HANGUL_ONLY = /^\p{Script=Hangul}+$/u;

/**
 * A whole-token match in any case. A needle that ends in Hangul needs no boundary after it,
 * because Korean attaches particles directly to a name (Minho + ui "of", Minho + rang "with").
 */
function containsToken(haystack: string, needle: string): boolean {
  const after = HANGUL_END.test(needle) ? '' : '(?=$|[^\\p{L}\\p{N}])';
  return new RegExp(`(^|[^\\p{L}\\p{N}])${escapeRegExp(needle)}${after}`, 'iu').test(haystack);
}

/** The parts of a display name a title must not hold: every token of two letters or more, and a Hangul given name without its surname. */
function nameTokens(displayName: string): string[] {
  const tokens = displayName.trim().split(/\s+/).filter((t) => t.length > 0);
  // A one-letter token is an initial, not a name ("A Lee" must not block "a.m."); the alias covers initials.
  const out = tokens.filter((t) => t.length >= 2);
  for (const t of tokens) if (HANGUL_ONLY.test(t) && t.length >= 3) out.push(t.slice(1));
  return out;
}

/**
 * The deck title travels in the link (TD8), so it must not hold a learner's name:
 * every roster name token (first name, surname, a Hangul given name) and alias is
 * refused as a whole token, in any case.
 */
export function titleProblem(title: string, roster: RosterPick): TitleProblem | null {
  const trimmed = title.trim();
  if (trimmed.length === 0) return 'empty';
  if (trimmed.length > TITLE_MAX || !LECTURE_TITLE_RE.test(trimmed)) return 'chars';
  if (findBannedWord(trimmed) !== null) return 'banned';
  const needles = roster.learners.flatMap((l) => {
    const alias = roster.space.settings.anonymizeRoster ? l.displayName.trim() : rosterAlias(l.displayName);
    return [...nameTokens(l.displayName), alias].filter((n) => n.length > 0);
  });
  return needles.some((n) => containsToken(trimmed, n)) ? 'name' : null;
}

// ---- deck and link -----------------------------------------------------------------

export interface DeckInput {
  title: string;
  blocks: readonly LectureBlock[];
  options: Partial<LectureOptions>;
  source: LectureSource;
  now: Date;
  /** Uniform in [0, 1): the deck id and the quiz seed. */
  rng: () => number;
}

export function buildDeck(input: DeckInput): LectureDeck {
  let id = 'lecture:';
  for (let i = 0; i < DECK_ID_LENGTH; i += 1) id += ID_CHARS[Math.floor(input.rng() * ID_CHARS.length)];
  return LectureDeckSchema.parse({
    v: 1,
    id,
    title: input.title.trim(),
    createdAt: input.now.toISOString(),
    seed: Math.floor(input.rng() * 2_147_483_647),
    blocks: input.blocks,
    options: input.options,
    picker: null,
    source: input.source,
  });
}

/** `${APP_URL}/present#d=<deck>`: ids and options only, no label (D12). */
export function presenterUrl(appUrl: string, deck: LectureDeck): string {
  return `${appUrl}/present#d=${encodeDeck(deck)}`;
}

export type PresenterLink = { ok: true; deck: LectureDeck; url: string } | { ok: false };

/** The deck and its link, or `ok: false` when the deck grammar or the codec refuses it: a click handler never throws. */
export function presenterLink(appUrl: string, input: DeckInput): PresenterLink {
  try {
    const deck = buildDeck(input);
    return { ok: true, deck, url: presenterUrl(appUrl, deck) };
  } catch {
    return { ok: false };
  }
}

import {
  CATALOG,
  LECTURE_REVISIT_CHAR_RE,
  LectureDeckSchema,
  WORD_REVIEW_MAX_QUESTS,
  presetDeck,
  presetOrder,
  questIdsOfBlocks,
  resolvePreset,
  storyIdsOfBlocks,
  type Catalog,
  type ActivityPreset,
  type LectureBlock,
  type LectureDeck,
  type LecturePreset,
  type PresetContext,
  type ResolvedPreset,
  type StageKey,
} from '@hangul-route/content-schema';
import type { Messages } from '@hangul-route/i18n';
import { blockIndexOfSlide } from './shell';
import type { Slide } from './deck-builder';
import { deckIdFrom } from './quick-lesson';
import type { RecentItem, RecentList } from './recent';

/**
 * The presenter's side of the ready-made lessons (AMENDMENTS-LECTURE-V2 sections 4.2 and 4.3,
 * row LV-3): the preset context built from this device's Recent lessons, and the deck a resolved
 * preset becomes. The resolver itself is content-schema's `resolvePreset`, the same one the
 * console and the learner app call, so the same inputs give the same blocks everywhere.
 *
 * What Recent gives (by each item's `savedAt`, the day it was last started):
 * - **shown** (the last 60 days): the quests (`questIdsOfBlocks`) and stories (`storyIdsOfBlocks`)
 *   of those lessons, for Next lesson (N4), Stage by stage (S) and Story time (T);
 * - **recent words** (the last 7 days): the quests of those lessons, newest lesson first, at most
 *   12 (W2); the presenter has no word ids of its own;
 * - **letters to revisit** (the last 7 days): the plain letters (one compatibility jamo) the
 *   catalogue says those quests teach, at most 6 (U).
 *
 * A Recent deck holds ids, a seed and options (no name field, `recent.ts`), and the context has
 * no field that could carry a name, so nothing about a person can reach a preset deck. Items with
 * an unreadable `savedAt` are left out; items a newer build saved (`RecentList.unread`) are not
 * read at all.
 */

export const SHOWN_WINDOW_DAYS = 60;
export const RECENT_WORDS_WINDOW_DAYS = 7;
/** U on the presenter: at most six letters to revisit. */
export const REVISIT_MAX_LETTERS = 6;

const DAY_MS = 86_400_000;

/** Recent items started within `days` of `now`, newest first (by `savedAt`; a time ahead of the clock counts as now). */
function within(items: readonly RecentItem[], now: Date, days: number): RecentItem[] {
  const at = now.getTime();
  const dated = items.flatMap((item) => {
    const saved = Date.parse(item.savedAt);
    return Number.isNaN(saved) || at - saved > days * DAY_MS ? [] : [{ item, saved }];
  });
  // A stable sort keeps the list's own order for equal times.
  return dated.sort((a, b) => b.saved - a.saved).map((d) => d.item);
}

const unique = (values: readonly string[]): string[] => [...new Set(values)];

/** The presenter's preset context (section 4.3): Recent read through the two windows, and the catalogue. */
export function presenterPresetContext(recent: RecentList | null, now: Date, catalog: Catalog = CATALOG): PresetContext {
  const items = recent?.items ?? [];
  const shownItems = within(items, now, SHOWN_WINDOW_DAYS);
  const weekItems = within(items, now, RECENT_WORDS_WINDOW_DAYS);
  const weekQuests = unique(weekItems.flatMap((item) => questIdsOfBlocks(item.deck.blocks, catalog)));
  const teaches = new Map(catalog.quests.map((q) => [q.id, q.teaches]));
  const letters = unique(weekQuests.flatMap((id) => teaches.get(id) ?? []).filter((t) => LECTURE_REVISIT_CHAR_RE.test(t))).slice(0, REVISIT_MAX_LETTERS);
  return {
    catalog,
    shown: {
      questIds: unique(shownItems.flatMap((item) => questIdsOfBlocks(item.deck.blocks, catalog))),
      storyIds: unique(shownItems.flatMap((item) => storyIdsOfBlocks(item.deck.blocks))),
    },
    recentWords: { questIds: weekQuests.slice(0, WORD_REVIEW_MAX_QUESTS), vocabIds: [] },
    revisitChars: letters,
  };
}

/** Next lesson has something to follow (a Recent lesson whose place on the Learning Route it can continue from). */
export function somethingToFollow(ctx: PresetContext): boolean {
  return resolvePreset('next-lesson', 20, ctx).fallback === null;
}

/** The presets in the order the home draws them (section 4.1): Next lesson first only when it has something to follow. */
export function presenterPresetOrder(ctx: PresetContext): LecturePreset[] {
  return presetOrder(somethingToFollow(ctx));
}

/**
 * The stage of a deck's first lesson (a quest, an episode, or a story read as a Stage 5 lesson),
 * for the chooser's stage chip when Customize opens from a preset (section 18.3); null when the
 * deck holds no lesson of the catalogue (a warm-up, a word review, a story).
 */
export function firstStageOf(blocks: readonly LectureBlock[], catalog: Catalog = CATALOG): StageKey | null {
  for (const block of blocks) {
    if (block.kind === 'quest') {
      const stage = catalog.quests.find((q) => q.id === block.id)?.stage;
      if (stage) return stage;
    }
    if (block.kind === 'episode') {
      const stage = catalog.cells.find((c) => c.episodeId === block.id)?.stage;
      if (stage) return stage;
    }
  }
  return null;
}

type PresetWords = Messages['learner']['presenter']['presets'];

/** The localized deck title of a resolved preset (never a story's own title, never a name). */
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
      // The presenter has no plan (N1 is the console's); a plan title still never reaches it unchecked.
      return words.next.title;
  }
}

export interface PresetDeckInput {
  /** The localized title (`presetTitle`). */
  title: string;
  now: Date;
  /** Uniform in [0, 1): the deck id. */
  rng: () => number;
}

/**
 * The deck a preset resolved on the presenter becomes (LV-D6): `source: 'quick'`, a time seed,
 * the default options with no `uiLocale` (the slides follow the presenting device's language), no
 * picker, and v1 unless it holds a Word review (then v2 with its `preset` id). Null when it does
 * not pass the deck schema (it always does with the shipped catalogue).
 */
export function presetLectureDeck(resolved: Pick<ResolvedPreset, 'blocks' | 'preset'>, input: PresetDeckInput): LectureDeck | null {
  const parsed = LectureDeckSchema.safeParse(
    presetDeck(resolved, {
      id: deckIdFrom(input.rng),
      title: input.title,
      createdAt: input.now.toISOString(),
      seed: input.now.getTime() % 2 ** 31,
      source: 'quick',
    }),
  );
  return parsed.success ? parsed.data : null;
}

/** What the preview of a ready-made lesson calls each part that is not content (section 12.2, `presets.preview.*`). */
export interface PreviewLabels {
  quiz: (rounds: number) => string;
  words: (n: number) => string;
  letters: (n: number) => string;
  activity: (preset: ActivityPreset) => string;
}

/**
 * What's in this lesson (design `presets.md` V4): one row per part of the deck, in order, with the
 * content title (`titleOf`, in the presenter language) or the part's own label (a quiz by its
 * questions, a Word review by the word cards it shows, letters by their count, an activity by its
 * name), and its minutes (`minutesOf`). A part with no title (an id this build does not know) is
 * left out; the start screen's skipped line already counts it.
 */
export function presetPreview(
  deck: Pick<LectureDeck, 'blocks'>,
  slides: readonly Pick<Slide, 'key' | 'kind'>[],
  labels: PreviewLabels,
  titleOf: (block: LectureBlock) => string | null,
  minutesOf: (block: LectureBlock) => number,
): { title: string; minutes: number }[] {
  return deck.blocks.flatMap((block, i) => {
    let title: string | null;
    switch (block.kind) {
      case 'quiz':
        title = labels.quiz(block.rounds);
        break;
      case 'word-review':
        title = labels.words(slides.filter((s) => s.kind === 'vocab' && blockIndexOfSlide(deck, s.key) === i).length);
        break;
      case 'revisit':
        title = labels.letters(block.chars.length);
        break;
      case 'jamo-set':
        title = labels.letters(block.jamoIds.length);
        break;
      case 'activity':
        title = labels.activity(block.preset);
        break;
      case 'quest':
      case 'episode':
      case 'story':
      case 'vocab':
        title = titleOf(block);
        break;
      default:
        title = null;
    }
    return title === null || title === '' ? [] : [{ title, minutes: minutesOf(block) }];
  });
}

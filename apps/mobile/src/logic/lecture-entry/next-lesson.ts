import {
  CATALOG,
  WORD_REVIEW_MAX_QUESTS,
  encodeDeck,
  learnerPosition,
  resolvePreset,
  type Catalog,
  type LectureDeck,
  type PresetContext,
} from '@hangul-route/content-schema';
import type { Messages } from '@hangul-route/i18n';
import { PRESENTER_PATH } from '../../platform/presenter';
import { presetLectureDeck, presetTitle } from '../lecture/preset-source';
import type { RouteNext } from '../route-next';

/**
 * The learner app's side of the grown-up card's **Next lesson for {name}** (AMENDMENTS-LECTURE-V2 section 3 E5,
 * row LV-6; design `design/screens/lecture-entry/learner-card.md`). Pure: the screen reads the learner's progress
 * and `routeNext` from the app root, which owns the profile, and passes them in.
 *
 * - **Context** (section 4.3, the app caller): the learner's place, N3 (`learnerPosition` of the `routeNext` quest;
 *   `free-end` and `rest` give none, so Next lesson falls back to Hangul week 1), and the quests that learner finished
 *   in the last 7 days, W3. Ids only: nothing here can carry a name, and Recent (the presenter's `shown`) is not the
 *   app's to read.
 * - **Deck** (sections 4.2 and LV-D6): Next lesson at its default length, resolved by content-schema's
 *   `resolvePreset` (the one resolver of the console and the presenter), made into the presenter's own preset deck
 *   (`presetLectureDeck`): v1, `source: 'quick'`, no picker, no preset id, no slides language. Its title is the
 *   localized preset name, never the learner's name (section 8); its start counts as `quick` (section 11).
 * - **Link**: the same-origin `/present#d=…`; the deck rides in the fragment only, never in a request.
 *
 * Nothing here writes progress, starts a quest or sends telemetry (section 7 item 4).
 */

/** W3: the window of finished quests a word review of this learner would read (section 4.2). */
export const RECENT_FINISHED_DAYS = 7;

const DAY_MS = 86_400_000;

/** One quest of a learner's progress, as `ProgressSnapshot.quests` holds it. */
export interface FinishedQuest {
  questId: string;
  completedAt?: string;
}

const finished = (quests: readonly FinishedQuest[]): string[] => quests.flatMap((q) => (q.completedAt === undefined ? [] : [q.questId]));

/**
 * W3 (section 4.2): the catalogue quests this learner finished in the last 7 days, newest first, each once, at most
 * 12. A finish time up to a day ahead of this device's clock counts (a clock a little behind the one that wrote it);
 * an unreadable time is left out.
 */
export function recentFinishedQuestIds(quests: readonly FinishedQuest[], now: Date, catalog: Catalog = CATALOG): string[] {
  const known = new Set(catalog.quests.map((q) => q.id));
  const at = now.getTime();
  const dated = quests.flatMap((q) => {
    const time = q.completedAt === undefined ? Number.NaN : Date.parse(q.completedAt);
    if (Number.isNaN(time) || !known.has(q.questId)) return [];
    const age = at - time;
    return age > RECENT_FINISHED_DAYS * DAY_MS || age < -DAY_MS ? [] : [{ id: q.questId, time }];
  });
  // A stable sort keeps the stored order for equal times.
  const ordered = dated.sort((a, b) => b.time - a.time).map((d) => d.id);
  return [...new Set(ordered)].slice(0, WORD_REVIEW_MAX_QUESTS);
}

/**
 * The learner app's preset context (section 4.3): N3's place and W3's quests, for the learner whose `routeNext`
 * result and progress are given. `next` is null when it could not be worked out (then, as for `free-end` and `rest`,
 * there is no place).
 */
export function appPresetContext(input: { next: RouteNext | null; quests: readonly FinishedQuest[]; now: Date; catalog?: Catalog }): PresetContext {
  const catalog = input.catalog ?? CATALOG;
  const position = input.next?.kind === 'quest' ? learnerPosition(input.next.questId, finished(input.quests), catalog) : null;
  return { catalog, position, recentWords: { questIds: recentFinishedQuestIds(input.quests, input.now, catalog), vocabIds: [] } };
}

type PresetWords = Messages['learner']['presenter']['presets'];

export interface NextLessonEnv {
  now: Date;
  /** Uniform in [0, 1): the deck id. */
  rng: () => number;
}

/** Next lesson at its default length for this context, as the deck the presenter opens; null if it does not pass the deck schema. */
export function nextLessonDeck(ctx: PresetContext, words: PresetWords, env: NextLessonEnv): LectureDeck | null {
  const resolved = resolvePreset('next-lesson', 20, ctx);
  return presetLectureDeck(resolved, { title: presetTitle(resolved, words), now: env.now, rng: env.rng });
}

/** The presenter link of `nextLessonDeck`: `/present#d=…`, or null when there is no deck. */
export function nextLessonHref(ctx: PresetContext, words: PresetWords, env: NextLessonEnv): string | null {
  const deck = nextLessonDeck(ctx, words, env);
  return deck === null ? null : `${PRESENTER_PATH}#d=${encodeDeck(deck)}`;
}

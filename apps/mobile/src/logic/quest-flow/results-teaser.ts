import type { Episode, Overlays, ProgressSnapshot, Quest, UiLocale } from '@hangul-route/content-schema';
import type { Messages } from '@hangul-route/i18n';
import { findJamo } from '../../content/jamo';
import type { TelemetryEvent } from '../../platform/telemetry';
import { localizeQuest } from '../content-locale';
import { nextQuestAfter } from '../next-quest';
import { isOffPlan, nextStartedEvent, routeNext, type NextSource, type PlanView, type RouteNextInput } from '../route-next';
import { questTeaches } from '../stage1/curriculum';

/**
 * The Results "Next up" teaser (F-QUEST-002 §3.5, wireframe results/next-quest-teaser).
 * Pure view-model: the screen only paints what it returns, so the cursor, the
 * one-line fallbacks and the button demotion are unit-tested without a renderer.
 * Copy is plain Pre-A1 English and never says "must" or shows a count or percent;
 * its words ("Play next quest", "New letters:") live in `learner.results.nextUp` and
 * the screen renders them, so this model carries data only (F-I18N-001 §3.4 rule 3).
 */

/** Hangul inside the teaser is taught content: the screen renders it with `KoreanText`. */
export interface TeaserLetter {
  ko: string;
  romanization: string;
}

export type TeaserLine =
  | { kind: 'text'; text: string }
  | { kind: 'letters'; letters: TeaserLetter[] };

/**
 * The words above the title (F-ENT-003 section 3.8): today's "Next up" for
 * the default route, "Next in your plan" for a plan's quest, and "Back to
 * your plan" after a quest outside the plan.
 */
export type TeaserCaption = 'nextUp' | 'nextInPlan' | 'backToPlan';

export interface ResultsTeaser {
  questId: string;
  episodeId: string;
  titleEn: string;
  line?: TeaserLine;
  /** `true` when every game was skipped and the same quest is offered again. */
  again: boolean;
  caption: TeaserCaption;
  /** Where `routeNext` found the quest; absent without `route` and on "Try this one again". */
  source?: NextSource;
}

export interface ResultsTeaserInput {
  snapshot: ProgressSnapshot | undefined;
  quests: readonly Quest[];
  episodes: readonly Episode[];
  /** The quest the learner just played. */
  questId: string;
  /** Rounds scored in that run; 0 means every game was skipped and nothing completed. */
  total: number;
  /** The stages the cursor may land on: the predicate from `cursorContext` (F-ROUTE-001 R-4a, OD-4). Omitted means every playable stage. */
  isEntitled?: (stageKey: string) => boolean;
  /** The UI locale: the title and the line come from the target quest's overlay (F-I18N-001 §3.6). Default `en`. */
  locale?: UiLocale;
  /** Defaults to the generated overlays (tests pass their own). */
  overlays?: Overlays;
  /** Placed-out quests of the level check (`placedOutSkipSet`, F-PLC-001 section 3.7); omitted without a result. */
  skipQuestIds?: ReadonlySet<string>;
  /** May the learner start this quest: from `cursorContext`, as on Home (F-ENT-003 section 3.5). Omitted means every quest is open. */
  isQuestOpen?: (questId: string) => boolean;
  /**
   * The one next (F-ENT-003 section 3.8, `routeNextInputOf`): the teaser
   * target becomes `routeNext` with the quest just played as `justCompleted`;
   * `free-end` and `rest` give no teaser card. The cursor fields above are
   * then unused. Omitted means the bare cursor, as before E3-4.
   */
  route?: RouteNextInput;
  /**
   * `planView` taken before the quest was completed: a quest outside it,
   * while a leading source exists, makes the caption "Back to your plan".
   */
  planBefore?: PlanView;
}

/** The one line under the title: `teaserEn`, else the new letters from Discover, else `blurbEn`. */
function teaserLine(quest: Quest): TeaserLine | undefined {
  if (quest.teaserEn) return { kind: 'text', text: quest.teaserEn };
  const letters: TeaserLetter[] = [];
  for (const id of questTeaches(quest)) {
    const jamo = findJamo(id);
    if (jamo) letters.push({ ko: jamo.char, romanization: jamo.romanization });
  }
  if (letters.length > 0) return { kind: 'letters', letters };
  if (quest.blurbEn) return { kind: 'text', text: quest.blurbEn };
  return undefined;
}

function episodeIdOf(questId: string, episodes: readonly Episode[]): string | undefined {
  return episodes.find((e) => e.questIds.includes(questId))?.id;
}

/**
 * The quest to tease, or `undefined` when there is none (the screen then keeps
 * its two original buttons). The target is the Journey cursor with the quest
 * just played counted as done, so replaying an old quest still points at the
 * learner's real next step; when nothing was scored the quest did not
 * complete and the same quest is offered again.
 */
export function resultsTeaser(input: ResultsTeaserInput): ResultsTeaser | undefined {
  const { quests, episodes, questId, total } = input;
  const again = total === 0;
  if (input.route && !again) {
    const next = routeNext({ ...input.route, justCompleted: questId });
    if (next.kind !== 'quest') return undefined;
    const quest = quests.find((q) => q.id === next.questId);
    if (!quest) return undefined;
    const caption: TeaserCaption =
      next.source === 'cursor' ? 'nextUp' : input.planBefore && isOffPlan(input.planBefore, questId) ? 'backToPlan' : 'nextInPlan';
    return teaserOf(quest, next.episodeId, input, { again, caption, source: next.source });
  }
  const cursor = {
    snapshot: input.snapshot ?? EMPTY_SNAPSHOT,
    quests,
    episodes,
    justCompleted: questId,
    isEntitled: input.isEntitled,
    isQuestOpen: input.isQuestOpen,
  };
  // A placed-out quest never played still comes before "nothing next".
  const target = again
    ? quests.find((q) => q.id === questId)
    : (nextQuestAfter({ ...cursor, skipQuestIds: input.skipQuestIds }) ??
      (input.skipQuestIds === undefined ? undefined : nextQuestAfter(cursor)));
  if (!target) return undefined;
  const episodeId = episodeIdOf(target.id, episodes);
  if (!episodeId) return undefined;
  return teaserOf(target, episodeId, input, { again, caption: 'nextUp' });
}

function teaserOf(
  target: Quest,
  episodeId: string,
  input: ResultsTeaserInput,
  how: { again: boolean; caption: TeaserCaption; source?: NextSource },
): ResultsTeaser {
  const local = localizeQuest(target, input.locale ?? 'en', input.overlays);
  return {
    questId: target.id,
    episodeId,
    titleEn: local.titleEn,
    line: teaserLine(local),
    again: how.again,
    caption: how.caption,
    ...(how.source === undefined ? {} : { source: how.source }),
  };
}

/** The caption's words: `learner.results.nextUp.title`, or `learner.routeNext.results.*` for a plan. */
export function teaserCaption(
  teaser: Pick<ResultsTeaser, 'caption'>,
  m: { results: Pick<Messages['learner']['results'], 'nextUp'>; routeNext: Pick<Messages['learner']['routeNext'], 'results'> },
): string {
  if (teaser.caption === 'nextInPlan') return m.routeNext.results.caption;
  if (teaser.caption === 'backToPlan') return m.routeNext.results.backToPlan;
  return m.results.nextUp.title;
}

/** `route.next_started { source, surface: 'results' }` when the teaser is the one next; null for "Try this one again". */
export function teaserNextStartedEvent(profileId: string, teaser: Pick<ResultsTeaser, 'source'>): TelemetryEvent | null {
  return teaser.source === undefined ? null : nextStartedEvent(profileId, teaser.source, 'results');
}

/** The teaser button's words: "Try this one again" when every game was skipped, else "Play next quest". */
export function teaserCtaLabel(teaser: Pick<ResultsTeaser, 'again'>, m: Messages['learner']['results']['nextUp']): string {
  return teaser.again ? m.again.cta : m.next.cta;
}

const EMPTY_SNAPSHOT: ProgressSnapshot = {
  profileId: '',
  updatedAt: '',
  episodes: [],
  quests: [],
  cards: [],
  sessions: [],
  homework: [],
  reviews: [],
  streakDays: 0,
};

interface ButtonLook {
  tone: 'primary' | 'ghost';
  size: 'hero' | 'md';
}

/** With a teaser the teaser CTA is the one primary; Back home and Episode page are both ghost. */
export function resultsActions(teaser: ResultsTeaser | undefined): {
  backHome: ButtonLook;
  episodePage: ButtonLook;
} {
  return {
    backHome: teaser ? { tone: 'ghost', size: 'md' } : { tone: 'primary', size: 'hero' },
    episodePage: { tone: 'ghost', size: 'md' },
  };
}

/** `quest.teaser_tapped { fromQuestId, toQuestId }` (spec §4). */
export function teaserTappedEvent(profileId: string, fromQuestId: string, teaser: ResultsTeaser): TelemetryEvent {
  return {
    name: 'quest.teaser_tapped',
    profileId,
    payload: { fromQuestId, toQuestId: teaser.questId },
  };
}

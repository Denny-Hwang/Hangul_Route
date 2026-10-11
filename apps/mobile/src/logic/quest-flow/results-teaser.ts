import type { Episode, Overlays, ProgressSnapshot, Quest, UiLocale } from '@hangul-route/content-schema';
import type { Messages } from '@hangul-route/i18n';
import { findJamo } from '../../content/jamo';
import type { TelemetryEvent } from '../../platform/telemetry';
import { localizeQuest } from '../content-locale';
import { nextQuestAfter } from '../next-quest';
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

export interface ResultsTeaser {
  questId: string;
  episodeId: string;
  titleEn: string;
  line?: TeaserLine;
  /** `true` when every game was skipped and the same quest is offered again. */
  again: boolean;
}

export interface ResultsTeaserInput {
  snapshot: ProgressSnapshot | undefined;
  quests: readonly Quest[];
  episodes: readonly Episode[];
  /** The quest the learner just played. */
  questId: string;
  /** Rounds scored in that run; 0 means every game was skipped and nothing completed. */
  total: number;
  /** `isStageEntitled(stageKey, tier)` for the current learner. */
  isEntitled?: (stageKey: string) => boolean;
  /** The UI locale: the title and the line come from the target quest's overlay (F-I18N-001 §3.6). Default `en`. */
  locale?: UiLocale;
  /** Defaults to the generated overlays (tests pass their own). */
  overlays?: Overlays;
  /** Placed-out quests of the level check (`placedOutSkipSet`, F-PLC-001 section 3.7); omitted without a result. */
  skipQuestIds?: ReadonlySet<string>;
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
  const cursor = {
    snapshot: input.snapshot ?? EMPTY_SNAPSHOT,
    quests,
    episodes,
    justCompleted: questId,
    isEntitled: input.isEntitled,
  };
  // A placed-out quest never played still comes before "nothing next".
  const target = again
    ? quests.find((q) => q.id === questId)
    : (nextQuestAfter({ ...cursor, skipQuestIds: input.skipQuestIds }) ??
      (input.skipQuestIds === undefined ? undefined : nextQuestAfter(cursor)));
  if (!target) return undefined;
  const episodeId = episodeIdOf(target.id, episodes);
  if (!episodeId) return undefined;
  const local = localizeQuest(target, input.locale ?? 'en', input.overlays);
  return {
    questId: target.id,
    episodeId,
    titleEn: local.titleEn,
    line: teaserLine(local),
    again,
  };
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

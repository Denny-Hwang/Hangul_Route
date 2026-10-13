import type { Quest, StageKey, ThemeKey } from '@hangul-route/content-schema';
import { findJamo } from '../content/jamo';
import type { TelemetryEvent } from '../platform/telemetry';
import { nextStartedEvent, type PlanView, type RouteNext } from './route-next';
import { questTeaches } from './stage1/curriculum';

/**
 * The episode page's plan tags and preview state (F-ENT-003 section 3.7, PR E3-6; wireframe
 * episode/detail-access-preview; mock design/components/RouteMarkers D6, D7). Open rows are
 * unchanged except for the tags: the row of the one next carries Next, a row in the plan view
 * carries In your plan. A row whose quest is closed (free, effective switch on) shows the caption
 * Not open yet in place of Start, and the page is a preview: it shows everything the lesson
 * holds, then one card with the ask and Back to open lessons. Pure.
 */

/** What a quest row offers: Start, Play again (played before), or the Not open yet caption. */
export type EpisodeRowAction = 'start' | 'replay' | 'closed';

export interface EpisodeRowView {
  questId: string;
  action: EpisodeRowAction;
  /** The row's quest is `routeNext`. */
  next: boolean;
  /** The row's quest is in `planView().inPlanQuestIds`. */
  inPlan: boolean;
}

export interface EpisodeAccessView {
  rows: EpisodeRowView[];
  /** At least one row is closed: the preview card shows and the page has no primary button. */
  preview: boolean;
}

export interface EpisodeAccessInput {
  /** The episode's quests, in page order. */
  questIds: readonly string[];
  /** Best stars of a quest (0 when never played): a played quest offers Play again. */
  starsOf: (questId: string) => number;
  /** `useQuestAccess()`: may the learner start this quest (kept quests stay open). */
  isQuestOpen: (questId: string) => boolean;
  /** `routeNext`, or null when it cannot be read (fail open: no tag). */
  next: RouteNext | null;
  /** `planView`, or null when it cannot be read (no tag). */
  plan: PlanView | null;
}

export function episodeAccessView(i: EpisodeAccessInput): EpisodeAccessView {
  const nextId = i.next?.kind === 'quest' ? i.next.questId : null;
  const rows = i.questIds.map((questId): EpisodeRowView => {
    // A closed quest is never Next or In your plan (section 3.7 precedence): `routeNext` and
    // `planView` only name open quests, and this keeps the page right even if they disagree.
    if (!i.isQuestOpen(questId)) return { questId, action: 'closed', next: false, inPlan: false };
    return {
      questId,
      action: i.starsOf(questId) > 0 ? 'replay' : 'start',
      next: questId === nextId,
      inPlan: i.plan?.inPlanQuestIds.has(questId) ?? false,
    };
  });
  return { rows, preview: rows.some((r) => r.action === 'closed') };
}

/** Where Back to open lessons goes. */
export type BackTarget =
  | { kind: 'episode'; episodeId: string }
  | { kind: 'topic'; topicKey: string }
  | { kind: 'library' }
  | { kind: 'journey' };

/**
 * The `routeNext` lesson page; at `free-end` the first free word topic playable in this build
 * (or the Library when none is); at `rest` or with no next, the Journey.
 */
export function backToOpenLessons(next: RouteNext | null, freeTopicKey: string | null): BackTarget {
  if (next?.kind === 'quest') return { kind: 'episode', episodeId: next.episodeId };
  if (next?.kind === 'free-end') return freeTopicKey === null ? { kind: 'library' } : { kind: 'topic', topicKey: freeTopicKey };
  return { kind: 'journey' };
}

/** Where a lesson page was opened from (`access.preview_opened.from`, section 3.12). */
export const PREVIEW_FROM = ['journey', 'home', 'route', 'results', 'library', 'player'] as const;
export type PreviewFrom = (typeof PREVIEW_FROM)[number];

/** The route's `from`, or the Journey (the grid, its two-pane view and the cell pages open lessons without one). */
export function previewFromOf(from: PreviewFrom | undefined): PreviewFrom {
  return from ?? 'journey';
}

/** `access.preview_opened { stage, theme, from }`: stable codes only (the internal route day is never sent). */
export function previewOpenedEvent(profileId: string | undefined, stage: StageKey, theme: ThemeKey, from: PreviewFrom): TelemetryEvent {
  return { name: 'access.preview_opened', ...(profileId === undefined ? {} : { profileId }), payload: { stage, theme, from } };
}

/** `route.next_started { surface: 'episode' }` when the quest started is the one next, else null. */
export function startedFromEpisode(profileId: string | undefined, next: RouteNext | null, questId: string): TelemetryEvent | null {
  if (profileId === undefined || next?.kind !== 'quest' || next.questId !== questId) return null;
  return nextStartedEvent(profileId, next.source, 'episode');
}

/**
 * The quest player's guard (section 3.6): a closed quest never starts. The player replaces itself
 * with the quest's lesson page, which shows the preview. It covers every entry the screens do not
 * (an assignment made before the switch, Play again after a lapse, a card earn hint, a deep link).
 */
export function playerGuard(
  isQuestOpen: (questId: string) => boolean,
  questId: string,
  episodeId: string,
): { episodeId: string; from: 'player' } | null {
  return isQuestOpen(questId) ? null : { episodeId, from: 'player' };
}

/**
 * The letters a quest introduces, as taught Korean with its romanization (drawn with `KoreanText`).
 * The preview lists them under a closed quest (section 3.7); no closed quest teaches letters today,
 * because all of Stage 1 is free (OD-1), so the row shows them only once a later stage does.
 */
export function taughtLetters(quest: Quest): { ko: string; romanization: string }[] {
  const seen = new Set<string>();
  const letters: { ko: string; romanization: string }[] = [];
  for (const id of questTeaches(quest)) {
    const jamo = findJamo(id);
    if (!jamo || seen.has(jamo.char)) continue;
    seen.add(jamo.char);
    letters.push({ ko: jamo.char, romanization: jamo.romanization });
  }
  return letters;
}

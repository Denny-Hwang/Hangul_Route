import type { StoryLevel } from '@hangul-route/content-schema';
import { episodesFor, gridEpisodes } from '../../content/episodes';
import { itemAccess, type FreeQuestOpen } from './access';
import { isOpenableEpisode, type BrowseBundle } from './bundle';

/**
 * A preview in All lessons (F-BROWSE-001 sections 4.7, 4.8 and 9; BD9; mocks
 * `design/screens/browse/preview-player.md`, `preview-end.md`): what it sends,
 * where the end screen's Next lesson and Next story go, the card it names and
 * how a story opens. Pure: the screens pass the bundle, the pass scope and the
 * effective switch, and act on the answer. Nothing here knows a learner.
 */

export type PreviewKind = 'quest' | 'story' | 'vocab-topic';

export interface PreviewStartedEvent {
  name: 'browse.preview_started';
  payload: { kind: PreviewKind; itemId: string };
}

export interface PreviewEndedEvent {
  name: 'browse.preview_ended';
  payload: { kind: PreviewKind; itemId: string; reachedEnd: boolean; minutes: number };
}

/** `browse.preview_ended` minutes stop here (section 9; the Worker's allow-list keeps 0 to 60). */
export const PREVIEW_MINUTES_CAP = 60;

const MINUTE_MS = 60_000;

/** `browse.preview_started` on [[ Preview this lesson ]] (section 9): a content id, never a person. */
export function previewStartedEvent(kind: PreviewKind, itemId: string): PreviewStartedEvent {
  return { name: 'browse.preview_started', payload: { kind, itemId } };
}

/** Whole minutes since the preview started, rounded down, capped at 60, never negative. */
export function previewMinutes(startedAt: number, now: number): number {
  return Math.min(PREVIEW_MINUTES_CAP, Math.max(0, Math.floor((now - startedAt) / MINUTE_MS)));
}

/** `browse.preview_ended` on the end screen (`reachedEnd`) or on leaving early (section 9). */
export function previewEndedEvent(i: { kind: PreviewKind; itemId: string; reachedEnd: boolean; startedAt: number; now: number }): PreviewEndedEvent {
  return {
    name: 'browse.preview_ended',
    payload: { kind: i.kind, itemId: i.itemId, reachedEnd: i.reachedEnd, minutes: previewMinutes(i.startedAt, i.now) },
  };
}

export interface CatalogueLesson {
  questId: string;
  episodeId: string;
}

/**
 * Every shipped grid lesson in catalogue order: stage by stage, theme by
 * theme, each cell's openable episodes by volume, each episode's lessons in
 * its own order. A shelf story's quest is not a grid lesson.
 */
export function catalogueLessons(bundle: Pick<BrowseBundle, 'stages' | 'themes' | 'episodes'>): CatalogueLesson[] {
  const grid = gridEpisodes(bundle.episodes);
  return bundle.stages.flatMap((stage) =>
    bundle.themes.flatMap((theme) =>
      episodesFor(stage.key, theme.key, grid)
        .filter(isOpenableEpisode)
        .flatMap((episode) => episode.questIds.map((questId) => ({ questId, episodeId: episode.id }))),
    ),
  );
}

export interface NextInput {
  bundle: BrowseBundle;
  scope: 'full' | 'sampler';
  gatingEnabled: boolean;
  /** Test seam for the sampler lesson rule (default: F-ENT-003's `browseQuestOpen`, `access.ts`). */
  freeQuestOpen?: FreeQuestOpen;
}

export interface NextLesson extends CatalogueLesson {
  /** A closed next lesson opens its page in closed form and never plays (section 4.8). */
  open: boolean;
}

function opens(kind: 'quest' | 'story', id: string, i: NextInput): boolean {
  return itemAccess({ kind, id }, i.scope, i.gatingEnabled, { bundle: i.bundle, ...(i.freeQuestOpen ? { freeQuestOpen: i.freeQuestOpen } : {}) }) === 'open';
}

/**
 * [[ Next lesson ]] (section 4.8): the next lesson of the same episode, else
 * the first lesson of the next shipped cell, in catalogue order; `null` after
 * the last one (the end screen hides the button) and for a lesson that is not
 * a grid lesson.
 */
export function nextLesson(questId: string, i: NextInput): NextLesson | null {
  const order = catalogueLessons(i.bundle);
  const at = order.findIndex((l) => l.questId === questId);
  const next = at < 0 ? undefined : order[at + 1];
  return next ? { ...next, open: opens('quest', next.questId, i) } : null;
}

/** [[ Next story ]] on a story's end screen: the next reviewed story in the index order, once each. */
export function nextStory(storyId: string, i: NextInput): { storyId: string; open: boolean } | null {
  const ids = [...new Set(i.bundle.storyIndex.map((s) => s.storyId))];
  const at = ids.indexOf(storyId);
  const next = at < 0 ? undefined : ids[at + 1];
  return next ? { storyId: next, open: opens('story', next, i) } : null;
}

/** The card a learner collects at the end of the lesson, when the bundle holds it (section 4.8). */
export function endCardId(bundle: Pick<BrowseBundle, 'quests' | 'cards'>, questId: string): string | null {
  const cardId = bundle.quests.find((q) => q.id === questId)?.rewardCardId;
  return cardId !== undefined && bundle.cards.some((c) => c.id === cardId) ? cardId : null;
}

/** The learner replay reader at scene 0 of the level the grown-up picked (section 4.7): it writes nothing. */
export function storyPreviewParams(storyId: string, level: StoryLevel): { storyId: string; level: StoryLevel; mode: 'replay'; sceneIndex: number } {
  return { storyId, level, mode: 'replay', sceneIndex: 0 };
}

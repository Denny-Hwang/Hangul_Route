import type { SceneArt, Story, ThemeKey } from '@hangul-route/content-schema';
import { defaultOpenMode, type OpenStoryMode } from './open-story';
import type { StoryShelfCopy } from './shelf-copy';
import type { ShelfCategory, StoryIndexEntry } from './story-index';
import type { StoryStatus } from './story-status';

/**
 * What a story tile and the "Picked for you" hero draw (F-STORY-004 §3.4).
 * Pure: the screen passes the dictionary subtree (`shelfCopy`) and the
 * localised story, and paints the result. The state line is always words
 * (colour is never the only cue); a 0-star finish draws no stars (D3); a
 * locked tile says "Locked" and nothing else about progress (only possible
 * with `contentGatingEnabled`, D5).
 */

export type StoryTileState = StoryStatus['state'] | 'locked';

export interface StoryTileView {
  storyId: string;
  /** Tap target: `EpisodeDetail { episodeId }` (the story variant, §3.6). */
  episodeId: string;
  titleEn: string;
  /** The Korean title and its romanization, always drawn together (`KoreanText`). */
  ko: string;
  romanization: string;
  theme: ThemeKey;
  state: StoryTileState;
  stateLine: string;
  /** Stars for the tile's `StarRow`; 0 draws no `StarRow`. */
  stars: 0 | 1 | 2 | 3;
  minutesLine: string;
  /** The one label of the whole tile: "title. state. About N minutes." (+ stars when there are some). */
  accessibilityLabel: string;
  /** The cover scene's art; null draws the theme tint with the Korean title. */
  cover: SceneArt | null;
  locked: boolean;
}

/** The art of the story's `coverSceneId` scene, in whichever tier holds it; null when none has art. */
function coverArtOf(story: Pick<Story, 'coverSceneId' | 'tiers'>): SceneArt | null {
  for (const tier of story.tiers) {
    const scene = tier.scenes.find((s) => s.id === story.coverSceneId);
    if (scene) return scene.art ?? null;
  }
  return null;
}

function stateLineOf(state: StoryTileState, copy: StoryShelfCopy): string {
  switch (state) {
    case 'locked':
      return copy.state.locked;
    case 'finished':
      return copy.state.finished;
    case 'in-progress':
      return copy.state.inProgress;
    case 'new':
      return copy.state.new;
  }
}

export function storyTileView(input: {
  entry: StoryIndexEntry;
  status: StoryStatus;
  locked: boolean;
  copy: StoryShelfCopy;
}): StoryTileView {
  const { entry, status, locked, copy } = input;
  const state: StoryTileState = locked ? 'locked' : status.state;
  const stars = state === 'finished' ? status.stars : 0;
  const stateLine = stateLineOf(state, copy);
  const title = entry.story.title;
  return {
    storyId: entry.storyId,
    episodeId: entry.episodeId,
    titleEn: title.en,
    ko: title.ko,
    romanization: title.romanization,
    theme: entry.theme,
    state,
    stateLine,
    stars,
    minutesLine: copy.minutes.pill(entry.minutes),
    accessibilityLabel: copy.tileLabel(title.en, stateLine, entry.minutes, stars),
    cover: coverArtOf(entry.story),
    locked,
  };
}

/** The hero tile's one primary button: Start, Keep reading or Read it again, and how it opens (`planOpenStory`). */
export function heroAction(status: StoryStatus, copy: StoryShelfCopy): { mode: OpenStoryMode; label: string } {
  const mode = defaultOpenMode(status);
  const label = mode === 'read-again' ? copy.readAgain.cta : mode === 'continue' ? copy.keepReading.cta : copy.start.cta;
  return { mode, label };
}

/**
 * Tile columns by window width (§3.4): 1 below 360 dp (the 320 phone), 2 up to
 * 767, 3 from 768 and 4 from 1024. An unknown width is one column.
 */
export function storyTileColumns(windowWidth: number): 1 | 2 | 3 | 4 {
  if (!Number.isFinite(windowWidth) || windowWidth < 360) return 1;
  if (windowWidth < 768) return 2;
  return windowWidth < 1024 ? 3 : 4;
}

export interface ShelfViewedPayload {
  section: ShelfCategory;
  stories: number;
  /** Stories with a bookmark (in progress), not finished. */
  started: number;
  finished: number;
}

/** `story.shelf.viewed` (§3.11): counts only, from the statuses of the section's tiles. */
export function shelfViewedPayload(section: ShelfCategory, statuses: readonly Pick<StoryStatus, 'state'>[]): ShelfViewedPayload {
  return {
    section,
    stories: statuses.length,
    started: statuses.filter((s) => s.state === 'in-progress').length,
    finished: statuses.filter((s) => s.state === 'finished').length,
  };
}

/** Below this cover width the scene is drawn as a thumbnail (detail shapes and hairlines dropped). */
export const STORY_COVER_THUMB_BELOW = 240;

/** The cover width for a tile `width` wide less its `chrome` (padding and border, both sides); never negative. */
export function storyTileCoverWidth(width: number, chrome: number): number {
  return Number.isFinite(width) ? Math.max(0, Math.floor(width - chrome)) : 0;
}

export function storyCoverVariant(coverWidth: number): 'thumb' | 'full' {
  return coverWidth < STORY_COVER_THUMB_BELOW ? 'thumb' : 'full';
}

/**
 * Where a locked tile goes (§3.4, gating on only): the grown-up gate Journey
 * uses for a locked stage, or the paywall directly on a self-only device with
 * no PIN (`opensDirectly`). Either way the paywall is attributed to the Library.
 */
export type LockedStoryGate =
  | { route: 'Paywall'; params: { from: 'library' } }
  | { route: 'PinEntry'; params: { next: 'Paywall'; from: 'library' } };

export function lockedStoryGate(opensDirectly: boolean): LockedStoryGate {
  return opensDirectly
    ? { route: 'Paywall', params: { from: 'library' } }
    : { route: 'PinEntry', params: { next: 'Paywall', from: 'library' } };
}

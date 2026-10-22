import type { KoText, Quest, Story, StoryLevel } from '@hangul-route/content-schema';
import type { Messages } from '@hangul-route/i18n';
import type { TelemetryEvent } from '../../platform/telemetry';
import { storyTierLevels } from './story-chunk-store';
import { levelOfQuest, storyIdOfQuest } from './story-ref';

/**
 * What the story variant of the Results screen adds (F-STORY-003 §3.7): the
 * story title, an optional culture-note link, one primary action and at most
 * two ghost actions. Pure view-model; the screen draws it and fires
 * `story.results.action` with the `action` of the button pressed.
 * F-STORY-004 supplies `nextQuestId` (via `nextStoryAfter`), the culture note
 * and the episode page; none of them is required. The words are the
 * `learner.story.results` subtree (F-I18N-001 PR 7b), passed in.
 */
export type StoryResultsCopy = Messages['learner']['story']['results'];

export interface StoryResultsInput {
  stars: 0 | 1 | 2 | 3;
  storyId: string;
  level: StoryLevel;
  title: KoText;
  /** Quest to open next, or null when there is no next story. */
  nextQuestId: string | null;
  hasEpisodePage: boolean;
  cultureNote: { id: string; titleEn: string } | null;
  /** F-STORY-006's "Episode complete" line, when it exposes one. */
  episodeCompleteLine: string | null;
}

export type StoryResultsPrimary =
  | { action: 'next-story'; label: string; questId: string }
  | { action: 'home'; label: string };

export type StoryResultsSecondary =
  | {
      action: 'read-again';
      label: string;
      /** `StoryReader` params: an unscored replay that writes nothing. */
      target: { storyId: string; level: StoryLevel; mode: 'replay' };
    }
  | { action: 'episode'; label: string };

export interface StoryResultsExtras {
  title: KoText;
  cultureNote: { id: string; label: string } | null;
  /** Reserved slot above the actions for F-STORY-006. */
  episodeLine: string | null;
  /** Shown at 0 and 1 star; never a number. */
  encouragement: string | null;
  primary: StoryResultsPrimary;
  secondary: StoryResultsSecondary[];
}

export function storyResultsExtras(input: StoryResultsInput, copy: StoryResultsCopy): StoryResultsExtras {
  const primary: StoryResultsPrimary = input.nextQuestId
    ? { action: 'next-story', label: copy.nextStory.cta, questId: input.nextQuestId }
    : { action: 'home', label: copy.backHome.cta };
  const secondary: StoryResultsSecondary[] = [
    {
      action: 'read-again',
      label: copy.readAgain.cta,
      target: { storyId: input.storyId, level: input.level, mode: 'replay' },
    },
  ];
  if (input.hasEpisodePage) secondary.push({ action: 'episode', label: copy.episodePage.cta });
  return {
    title: input.title,
    cultureNote: input.cultureNote
      ? { id: input.cultureNote.id, label: copy.cultureNote(input.cultureNote.titleEn) }
      : null,
    episodeLine: input.episodeCompleteLine,
    encouragement: input.stars <= 1 ? copy.encourage : null,
    primary,
    secondary,
  };
}

/** The story a Results visit is about (title in Korean, romanization and the UI language). */
export interface ResultsStory {
  storyId: string;
  level: StoryLevel;
  title: KoText;
}

/**
 * The story of the quest just finished, read from its `story-read` step
 * (`storyIdOfQuest`, `levelOfQuest`), or null: not a story quest, an unknown
 * quest, or a story (or level) the bundle does not hold. Null keeps Results
 * exactly `results/celebrate` (wireframe `results/celebrate-story` error
 * state). `findStory` returns the story as shown (UI-language overlay);
 * `levelsOf` the levels of its tiers, which the default reads from the shelf
 * for a bundled story (F-CURR-002 §10, row CM-8: known before its chunk loads,
 * so the story extras are drawn at the first frame, never shifted in later).
 */
export function resultsStoryOf(
  quest: Pick<Quest, 'steps'> | undefined,
  findStory: (storyId: string) => Story | undefined,
  levelsOf: (storyId: string, shown: Story) => readonly StoryLevel[] = (_id, shown) => storyTierLevels(shown),
): ResultsStory | null {
  if (!quest) return null;
  const storyId = storyIdOfQuest(quest);
  const level = levelOfQuest(quest);
  const story = storyId === null ? undefined : findStory(storyId);
  if (!story || storyId === null || level === null || !levelsOf(storyId, story).includes(level)) return null;
  const { ko, romanization, en } = story.title;
  return { storyId: story.id, level, title: { ko, romanization, en } };
}

export type StoryResultsAction = 'next-story' | 'read-again' | 'episode' | 'home' | 'culture-note';

/** `story.results.action` when a Results action is chosen: ids and the action only (spec §3.9). */
export function storyResultsActionEvent(
  profileId: string | undefined,
  questId: string,
  storyId: string,
  action: StoryResultsAction,
): TelemetryEvent {
  return { name: 'story.results.action', profileId, payload: { questId, storyId, action } };
}

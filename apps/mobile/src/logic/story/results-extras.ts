import type { KoText, StoryLevel } from '@hangul-route/content-schema';
import type { Messages } from '@hangul-route/i18n';

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

import type { Messages } from '@hangul-route/i18n';
import type { LibrarySectionId } from './library-sections';

/**
 * Every UI string of the story shelf (F-STORY-004 §3.12) lives in the
 * dictionary, `learner.storyShelf` (`packages/i18n`), so it follows the
 * selected UI locale; screens read it with `useMessages()` and hand it to
 * these helpers. Nothing here is a literal.
 */

export type StoryShelfCopy = Messages['learner']['storyShelf'];

/** The shelf subtree of a locale's messages. */
export function shelfCopy(messages: Messages): StoryShelfCopy {
  return messages.learner.storyShelf;
}

/** A Library section's tab title. */
export function sectionTitle(id: LibrarySectionId, copy: StoryShelfCopy): string {
  return copy.sections[id];
}

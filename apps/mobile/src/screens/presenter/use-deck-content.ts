import type { LectureBlock, UiLocale } from '@hangul-route/content-schema';
import { useEffect, useState } from 'react';
import { episodeById } from '../../content/episodes';
import { LATER_STORY_IDS } from '../../content/later-content';
import { lessonContent } from '../../content/lessons';
import { localePacks } from '../../content/locale-packs';
import { questById } from '../../content/quests';
import { storyContent } from '../../content/stories';
import { loadDeckContent, type DeckContentLoaders, type DeckContentLookups } from '../../logic/lecture/deck-content';
import { isNewBuildError } from '../../logic/lessons/lesson-store';
import { scopeFor } from '../../logic/minigame-config';
import { isLaterCellId } from '../../logic/offline/offline-packs';
import { isStoryNewBuildError } from '../../logic/story/story-chunk-store';
import { isNewBuildAnswer, reloadForNewBuild } from '../../platform/new-build-reload';

/**
 * The presenter's side of a deck's own content ([FN] AMENDMENTS-FINISH-2026-11 row FN-4, finding F6): the home lists
 * from the manifests, and a chosen deck (or one a link opens) loads the cells and stories its blocks hold
 * (`logic/lecture/deck-content.ts`) while the start screen shows its existing loading state. `failed` is a core chunk
 * that did not load and is not of a newer build (a newer build reloads the page instead): the crash screen's Try again
 * calls `retry`. `version` counts the loads that finished, so a memo over the content (the deck builder's bundle) is
 * built again with what arrived.
 */
export type DeckContentState = 'loading' | 'ready' | 'failed';

export interface DeckContent {
  state: DeckContentState;
  version: number;
  retry: () => void;
}

export interface DeckContentDeps {
  lookups: DeckContentLookups;
  loaders: Omit<DeckContentLoaders, 'onLaterNewBuild'>;
  /** True when a failed load means a newer build on the host. */
  isNewer: (error: unknown) => Promise<boolean>;
  /** Reloads the page for a newer build; false when it did not (offline, or reloaded a moment ago). */
  reload: () => boolean;
}

export function deckContentBindings(deps: DeckContentDeps): { useDeckContent: (blocks: readonly LectureBlock[] | null, locale: UiLocale) => DeckContent } {
  const loaders: DeckContentLoaders = {
    ...deps.loaders,
    onLaterNewBuild: (error) => (isNewBuildError(error) || isStoryNewBuildError(error)) && deps.reload(),
  };

  /** Loads `blocks`' content in `locale` (null: nothing to load, `ready`); a new key (other blocks or locale) loads again. */
  function useDeckContent(blocks: readonly LectureBlock[] | null, locale: UiLocale): DeckContent {
    const key = blocks === null ? null : `${locale}|${JSON.stringify(blocks)}`;
    const [done, setDone] = useState<{ key: string; state: Exclude<DeckContentState, 'loading'> } | null>(null);
    const [version, setVersion] = useState(0);
    const [attempt, setAttempt] = useState(0);
    useEffect(() => {
      if (key === null || blocks === null) return undefined;
      let live = true;
      loadDeckContent(blocks, locale, deps.lookups, loaders).then(
        () => {
          if (!live) return;
          setDone({ key, state: 'ready' });
          setVersion((v) => v + 1);
        },
        async (error: unknown) => {
          if (!live) return;
          const newer = isStoryNewBuildError(error) || isNewBuildError(error) || (await deps.isNewer(error).catch(() => false));
          if (live && !(newer && deps.reload())) setDone({ key, state: 'failed' });
        },
      );
      return () => {
        live = false;
      };
      // `key` stands for the blocks and the locale.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [key, attempt]);
    const state: DeckContentState = key === null ? 'ready' : done !== null && done.key === key ? done.state : 'loading';
    return {
      state,
      version,
      retry: () => {
        setDone(null);
        setAttempt((n) => n + 1);
      },
    };
  }

  return { useDeckContent };
}

/** The stories a quest's steps play: each step's scope's story (a story read, its checks and order). */
function storiesOfQuest(questId: string): string[] {
  const quest = questById(questId);
  if (quest === undefined) return [];
  return quest.steps.flatMap((step) => {
    const story = step.minigameRef === undefined ? undefined : scopeFor(step.minigameRef)?.story;
    return story === undefined ? [] : [story.storyId];
  });
}

export const { useDeckContent } = deckContentBindings({
  lookups: {
    cellOfQuest: (questId) => lessonContent.cellOfQuest(questId),
    episodeOf: (episodeId) => episodeById(episodeId),
    storiesOfQuest,
  },
  loaders: {
    ensureCells: (cellIds) => lessonContent.ensureCells(cellIds),
    ensureStories: (storyIds) => storyContent.ensureStories(storyIds),
    ensureTitles: (locale) => lessonContent.ensureTitles(locale),
    ensureLocale: (locale) => localePacks.ensure(locale),
    isLaterCell: isLaterCellId,
    isLaterStory: (storyId) => LATER_STORY_IDS.has(storyId),
  },
  isNewer: (error) => isNewBuildAnswer(error),
  reload: () => reloadForNewBuild(),
});

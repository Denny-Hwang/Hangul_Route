import type { Episode, Overlays, Quest, SceneArt, SpeechLang, Story, ThemeKey, UiLocale } from '@hangul-route/content-schema';
import { episodesAll } from '../../../content/episodes';
import { questsAll } from '../../../content/quests';
import { storiesAll } from '../../../content/stories';
import { localizeStory } from '../../content-locale';
import { uiSpeechLang } from '../../story/reader-locale';
import { narrationSpeechLang } from '../../story/scene-audio';
import { buildStoryIndex } from '../../story/story-index';
import { storyTierLevels } from '../../story/story-chunk-store';
import type { LectureStory } from '../deck-builder';

/**
 * The presenter's story adapter (F-TCH-004 §3.3 rule 5, §8): the only file of
 * the presenter that knows the bundled stories and their shape.
 *
 * Only the stories the learner Library lists are expandable: the entries of
 * F-STORY-004's story index with its review gate (`ready`, language- and
 * culture-reviewed). The dev-only `showUnreviewedStories` widening is never
 * honoured here. A bundled story the index keeps out is `'not-ready'`; an id
 * the bundle does not know is `undefined`. Entitlement is never consulted (D5).
 *
 * Story text follows the presenter's language through the overlays
 * (F-I18N-001 §3.6); taught Korean and its romanization never change.
 */

/** What a story scene slide draws beside the narration (`StoryScene`). */
export interface LectureSceneView {
  /** Null when the scene has no art yet (or only placeholder art): the panel shows its theme tint. */
  art: SceneArt | null;
  theme: ThemeKey;
  /** The art's accessible name: the scene caption, else the art's own `altEn` (README D8; never drawn). */
  label: string;
  /** Read-to-me's voice: the presenter language when the overlay's narration is shown, else English. */
  narrationLang: SpeechLang;
}

export interface LectureStorySource {
  story(id: string): LectureStory | 'not-ready' | undefined;
  /** Only for a listed story; undefined for an unknown story or scene. */
  scene(storyId: string, sceneId: string): LectureSceneView | undefined;
}

export interface LectureStoryInput {
  stories: readonly Story[];
  episodes: readonly Episode[];
  quests: readonly Pick<Quest, 'id' | 'steps'>[];
}

export function lectureStoriesFrom(input: LectureStoryInput, locale: UiLocale, overlays?: Overlays): LectureStorySource {
  // The shelf's levels (F-CURR-002 §10, row CM-8): the list never depends on whether a story's chunk is in yet.
  const listed = new Set(buildStoryIndex({ ...input, showUnreviewed: false, levelsOf: storyTierLevels }).map((entry) => entry.storyId));
  const bundled = new Map(input.stories.map((story) => [story.id, story]));
  const localized = new Map<string, Story>();
  const listedStory = (id: string): Story | undefined => {
    const story = bundled.get(id);
    if (!story || !listed.has(id)) return undefined;
    let out = localized.get(id);
    if (!out) {
      out = localizeStory(story, locale, overlays);
      localized.set(id, out);
    }
    return out;
  };
  return {
    story: (id) => listedStory(id) ?? (bundled.has(id) ? 'not-ready' : undefined),
    scene: (storyId, sceneId) => {
      const story = listedStory(storyId);
      const scene = story?.tiers.flatMap((tier) => tier.scenes).find((s) => s.id === sceneId);
      if (!story || !scene) return undefined;
      const source = bundled.get(storyId)!.tiers.flatMap((tier) => tier.scenes).find((s) => s.id === sceneId);
      // Placeholder art marked pending is no art, as in the reader (`buildSceneView`).
      const art = scene.artPending === true ? null : (scene.art ?? null);
      const narrationLang = narrationSpeechLang(uiSpeechLang(locale), source?.narrationEn !== scene.narrationEn);
      return { art, theme: story.theme, label: scene.captionEn ?? scene.art?.altEn ?? '', narrationLang };
    },
  };
}

/** The bundled stories, in the presenter's language. */
export function lectureStories(locale: UiLocale, overlays?: Overlays): LectureStorySource {
  return lectureStoriesFrom({ stories: storiesAll, episodes: episodesAll, quests: questsAll }, locale, overlays);
}

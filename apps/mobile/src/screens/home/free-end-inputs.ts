import { isFreeContent } from '../../logic/content-access';
import type { SamplerStory } from '../../logic/free-end';
import type { StoryIndexEntry } from '../../logic/story/story-index';
import { pickerTopics, topicWords, wordsOffered } from '../vocab/topic-data';

/**
 * What the end of the free lessons can offer in this build (F-ENT-003 sections 3.7, 3.8): the free
 * word topics the picker shows (Words on), and the first sampler story bundled (F-STORY-004 D5).
 */
export function freeTopicsInBuild(): { key: string; title: string; cover: { pictureRef: string | undefined } }[] {
  if (!wordsOffered()) return [];
  return pickerTopics()
    .filter((t) => isFreeContent('vocab-topic', t.key))
    .map((t) => {
      const items = topicWords(t.key);
      const coverItem = items.find((item) => item.id === t.coverItemId) ?? items[0];
      return { key: t.key, title: t.titleEn, cover: { pictureRef: coverItem?.visual } };
    });
}

/** The first sampler story of the story index (reviewed stories only), or null. */
export function samplerStoryOf(entries: readonly StoryIndexEntry[]): SamplerStory | null {
  const entry = entries.find((e) => isFreeContent('story', e.storyId));
  return entry ? { storyId: entry.storyId, questId: entry.questId, episodeId: entry.episodeId, title: entry.story.title.en } : null;
}

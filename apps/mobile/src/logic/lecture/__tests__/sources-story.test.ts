import type { Overlays, Story } from '@hangul-route/content-schema';
import { describe, expect, it } from 'vitest';
import { episodesAll } from '../../../content/episodes';
import { questsAll } from '../../../content/quests';
import { storiesAll } from '../../../content/stories';
import { buildStoryIndex } from '../../story/story-index';
import { lectureStories, lectureStoriesFrom } from '../sources/story';

/**
 * The story adapter (F-TCH-004 §3.3 rule 5, §8): the presenter's only view of
 * the bundled stories. Only the stories the learner Library lists (the story
 * index with its review gate, never the dev-only widening) are expandable.
 */

const reviewedIndex = buildStoryIndex({ stories: storiesAll, episodes: episodesAll, quests: questsAll, showUnreviewed: false });
const listed = [...new Set(reviewedIndex.map((e) => e.storyId))];
const sample = storiesAll.find((s) => s.id === listed[0])!;

/** The sample story with its review undone (a draft the bundle could carry with `--include-drafts`). */
const unreviewed = (story: Story): Story => ({ ...story, review: { ...story.review, language: 'draft' } });

describe('lectureStories (F-TCH-004 PR 11)', () => {
  it('lists at least one reviewed story from the bundle', () => {
    expect(listed.length).toBeGreaterThan(0);
  });

  it('gives every story the Library lists, unchanged in English', () => {
    const source = lectureStories('en');
    for (const id of listed) expect(source.story(id)).toBe(storiesAll.find((s) => s.id === id));
  });

  it('an id the bundle does not know is undefined (counted unknown-id)', () => {
    expect(lectureStories('en').story('story:nope')).toBeUndefined();
    expect(lectureStories('en').scene('story:nope', 's1')).toBeUndefined();
  });

  it('a bundled story the review gate keeps out is not ready', () => {
    const stories = storiesAll.map((s) => (s.id === sample.id ? unreviewed(s) : s));
    const source = lectureStoriesFrom({ stories, episodes: episodesAll, quests: questsAll }, 'en');
    expect(source.story(sample.id)).toBe('not-ready');
    expect(source.scene(sample.id, sample.coverSceneId)).toBeUndefined();
  });

  it('a ready story no shelf or book lists is not ready either', () => {
    const source = lectureStoriesFrom({ stories: [sample], episodes: [], quests: [] }, 'en');
    expect(source.story(sample.id)).toBe('not-ready');
  });

  it('localizes the story text through the overlays and keeps the taught Korean', () => {
    const sceneId = sample.tiers[0]!.scenes[0]!.id;
    const overlays: Overlays = { es: { [sample.id]: { [`scenes.${sceneId}.narration`]: 'Narracion' } }, ko: {} };
    const es = lectureStories('es', overlays).story(sample.id) as Story;
    expect(es.tiers[0]!.scenes[0]!.narrationEn).toBe('Narracion');
    expect(es.title.ko).toBe(sample.title.ko);
    expect(es.title.romanization).toBe(sample.title.romanization);
    expect(es.keywords).toEqual(sample.keywords);
    expect(lectureStories('en', overlays).story(sample.id)).toBe(sample);
  });

  it('gives a scene its art, the story theme and the caption as its accessible name (D8)', () => {
    const source = lectureStories('en');
    const tier = sample.tiers[0]!;
    const scene = tier.scenes.find((s) => s.captionEn !== undefined)!;
    const view = source.scene(sample.id, scene.id)!;
    expect(view.theme).toBe(sample.theme);
    expect(view.art).toBe(scene.artPending === true ? null : (scene.art ?? null));
    expect(view.label).toBe(scene.captionEn);
    expect(source.scene(sample.id, 's99')).toBeUndefined();
  });

  it('pending art is no art, and a scene with no caption is named by its art', () => {
    const tier = sample.tiers[0]!;
    const [first, second, ...rest] = tier.scenes;
    const art = first!.art ?? second!.art;
    const altEn = 'A test picture';
    const scenes = [
      { ...first!, artPending: true },
      { ...second!, captionEn: undefined, art: art ? { ...art, altEn } : undefined },
      ...rest,
    ];
    const story: Story = { ...sample, tiers: [{ ...tier, scenes }, ...sample.tiers.slice(1)] };
    const stories = storiesAll.map((s) => (s.id === sample.id ? story : s));
    const source = lectureStoriesFrom({ stories, episodes: episodesAll, quests: questsAll }, 'en');
    expect(source.scene(sample.id, first!.id)!.art).toBeNull();
    const view = source.scene(sample.id, second!.id)!;
    expect(view.label).toBe(art ? altEn : '');
  });

  it('finds a scene in any tier of the story', () => {
    const source = lectureStories('en');
    for (const id of listed) {
      const story = storiesAll.find((s) => s.id === id)!;
      for (const tier of story.tiers) for (const scene of tier.scenes) expect(source.scene(id, scene.id)).toBeDefined();
    }
  });
});

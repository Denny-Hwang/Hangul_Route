import { describe, expect, it } from 'vitest';
import type { Story } from '@hangul-route/content-schema';
import type { MinigameScope } from '../../minigame-config';
import { buildSequenceCards } from '../sequence-cards';
import { readyStory } from './story-fixture';

const storyScope = (story: Story, level: 'listen' | 'read-along' | 'read', extra = {}): MinigameScope => ({
  kind: 'story-sequence',
  story: { storyId: story.id, level, ...extra },
});

describe('buildSequenceCards: story scopes', () => {
  it('follows tier.sequenceSceneIds, which is the correct order', () => {
    const story = readyStory();
    const tier = story.tiers.find((t) => t.level === 'listen')!;
    const cards = buildSequenceCards(storyScope(story, 'listen'), story);
    expect(cards.map((c) => c.id)).toEqual(tier.sequenceSceneIds);
  });

  it('Listen: caption is captionEn and the Korean is the scene keyword', () => {
    const story = readyStory();
    const tier = story.tiers.find((t) => t.level === 'listen')!;
    const cards = buildSequenceCards(storyScope(story, 'listen'), story);
    cards.forEach((card, i) => {
      const scene = tier.scenes.find((s) => s.id === tier.sequenceSceneIds[i])!;
      expect(card.caption).toBe(scene.captionEn);
      expect(card.ko).toEqual(scene.keyword);
      expect(card.art).toEqual(scene.art);
    });
  });

  it('read-along and read: the Korean is the scene line, else its keyword', () => {
    const story = readyStory();
    const tier = story.tiers.find((t) => t.level === 'read-along')!;
    const cards = buildSequenceCards(storyScope(story, 'read-along'), story);
    cards.forEach((card, i) => {
      const scene = tier.scenes.find((s) => s.id === tier.sequenceSceneIds[i])!;
      expect(card.ko).toEqual(scene.line ?? scene.keyword);
    });
    expect(cards.some((c) => c.ko !== undefined)).toBe(true);
  });

  it('falls back to the narration when a draft scene has no caption', () => {
    const story = readyStory();
    const tier = story.tiers.find((t) => t.level === 'listen')!;
    const scene = tier.scenes.find((s) => s.id === tier.sequenceSceneIds[0])!;
    delete scene.captionEn;
    const [first] = buildSequenceCards(storyScope(story, 'listen'), story);
    expect(first?.caption).toBe(scene.narrationEn);
  });

  it('honours a scene id override, in the given order, skipping unknown ids', () => {
    const story = readyStory();
    const cards = buildSequenceCards(storyScope(story, 'listen', { sceneIds: ['s2', 'nope', 's1'] }), story);
    expect(cards.map((c) => c.id)).toEqual(['s2', 's1']);
  });

  it('returns nothing when the story, tier or scope story is missing', () => {
    const story = readyStory();
    expect(buildSequenceCards(storyScope(story, 'listen'), undefined)).toEqual([]);
    expect(buildSequenceCards(storyScope(story, 'read'), story)).toEqual([]);
    expect(buildSequenceCards({ kind: 'story-sequence' }, story)).toEqual([]);
  });

  it('leaves art undefined for a scene without art', () => {
    const story = readyStory();
    const tier = story.tiers.find((t) => t.level === 'listen')!;
    const scene = tier.scenes.find((s) => s.id === tier.sequenceSceneIds[0])!;
    delete scene.art;
    scene.artPending = true;
    const [first] = buildSequenceCards(storyScope(story, 'listen'), story);
    expect(first?.art).toBeUndefined();
  });
});

describe('buildSequenceCards: legacy storySteps scopes', () => {
  it('builds text-only cards in order, with Korean only when romanization is there', () => {
    const scope: MinigameScope = {
      kind: 'story-sequence',
      storySteps: [
        { id: 'a', labelEn: 'Wash hands', labelKo: '손 씻기', romanization: 'son ssitgi' },
        { id: 'b', labelEn: 'Set the table', labelKo: '상 차리기' },
        { id: 'c', labelEn: 'Eat' },
      ],
    };
    const cards = buildSequenceCards(scope, undefined);
    expect(cards.map((c) => c.id)).toEqual(['a', 'b', 'c']);
    expect(cards.map((c) => c.caption)).toEqual(['Wash hands', 'Set the table', 'Eat']);
    expect(cards[0]?.ko).toEqual({ ko: '손 씻기', romanization: 'son ssitgi', en: 'Wash hands' });
    expect(cards[1]?.ko).toBeUndefined();
    expect(cards[2]?.ko).toBeUndefined();
    expect(cards.every((c) => c.art === undefined)).toBe(true);
  });

  it('is empty for a scope with neither steps nor a story', () => {
    expect(buildSequenceCards({ kind: 'story-sequence' }, undefined)).toEqual([]);
  });
});

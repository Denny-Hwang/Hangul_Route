import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { EpisodeSchema, MinigameKindSchema, QuestSchema, parseStory } from '@hangul-route/content-schema';
import { buildBundle } from '../../../../../scripts/build-stories.mjs';
import { episodesAll } from '../episodes';
import { questsAll } from '../quests';
import { storiesAll, storyById, storyEpisodes, storyQuests, storySlug } from '../stories';

const FIXTURE_DIR = join(
  __dirname,
  '../../../../../packages/content-schema/src/__fixtures__/story',
);
const readyFixture: unknown = JSON.parse(readFileSync(join(FIXTURE_DIR, 'valid.ready.json'), 'utf8'));

describe('stories bundle wiring (F-STORY-001 PR 1.4)', () => {
  it('storySlug strips the story: prefix', () => {
    expect(storySlug('story:seollal-new-year')).toBe('seollal-new-year');
  });

  it('storyById finds a bundled story and returns undefined otherwise', () => {
    for (const story of storiesAll) expect(storyById(story.id)).toBe(story);
    expect(storyById('story:no-such-story')).toBeUndefined();
  });

  it('every shelf episode is appended to episodesAll, every story quest to questsAll', () => {
    for (const e of storyEpisodes) expect(episodesAll).toContain(e);
    for (const q of storyQuests) expect(questsAll).toContain(q);
  });

  it('episode and quest ids stay unique across hand-written and generated content', () => {
    const episodeIds = episodesAll.map((e) => e.id);
    expect(new Set(episodeIds).size).toBe(episodeIds.length);
    const questIds = questsAll.map((q) => q.id);
    expect(new Set(questIds).size).toBe(questIds.length);
  });

  it('every bundled shelf episode parses and points at a bundled quest', () => {
    for (const e of storyEpisodes) {
      expect(() => EpisodeSchema.parse(e), e.id).not.toThrow();
      for (const id of e.questIds) expect(storyQuests.some((q) => q.id === id), id).toBe(true);
    }
    for (const q of storyQuests) expect(() => QuestSchema.parse(q), q.id).not.toThrow();
  });
});

describe('generator output against the real schemas (fixture story)', () => {
  const story = parseStory(readyFixture);
  const { episodes, quests } = buildBundle([story]);
  const [episode] = episodes;
  const [questDraft] = quests;
  if (!episode || !questDraft) throw new Error('the fixture story must derive an episode and a quest');

  it('the derived shelf episode passes EpisodeSchema', () => {
    expect(episodes).toHaveLength(1);
    const parsed = EpisodeSchema.parse(episode);
    expect(parsed.format).toBe('story');
    expect(parsed.placement).toBe('shelf');
    expect(parsed.questIds).toEqual([questDraft.id]);
  });

  it('the derived quest passes QuestSchema and keeps the story-ref grammar', () => {
    // `story-read` joined MinigameKindSchema in F-STORY-002 PR 2.1; `story-check` joins in F-STORY-003 PR 3.1.
    // Until then only the kind enum may differ, so the kind is dropped from steps whose kind is unknown.
    const known = new Set<string>(MinigameKindSchema.options);
    const quest = {
      ...questDraft,
      steps: questDraft.steps.map((step) => {
        const { minigameKind, ...rest } = step;
        return minigameKind && known.has(minigameKind) ? step : rest;
      }),
    };
    const parsed = QuestSchema.parse(quest);
    expect(parsed.steps.map((s) => s.kind)).toEqual(['intro', 'present', 'practice', 'apply', 'reward']);
    for (const step of questDraft.steps.slice(1, 4)) {
      expect(step.minigameRef).toMatch(/^minigame:story-(read|check|seq)-(listen|along|read)-[a-z0-9-]+$/);
    }
    expect(questDraft.steps.slice(1, 4).map((s) => s.minigameKind)).toEqual([
      'story-read',
      'story-check',
      'story-sequence',
    ]);
  });
});

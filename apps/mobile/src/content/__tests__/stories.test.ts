import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { EpisodeSchema, MinigameKindSchema, QuestSchema, parseStory } from '@hangul-route/content-schema';
import { buildBundle } from '../../../../../scripts/build-stories.mjs';
import { episodesAll } from '../episodes';
import { questsAll } from '../quests';
import { parseStoryMinigameRef, storyIdOfQuest } from '../../logic/story/story-ref';
import { storiesAll, storyById, storyEpisodes, storyFixtureIds, storyQuests, storySlug } from '../stories';

const FIXTURE_DIR = join(
  __dirname,
  '../../../../../packages/content-schema/src/__fixtures__/story',
);
const readyFixture: unknown = JSON.parse(readFileSync(join(FIXTURE_DIR, 'valid.ready.json'), 'utf8'));

describe('stories bundle wiring (F-STORY-001 PR 1.4)', () => {
  it('the committed bundle holds no test fixture (F-STORY-002 §5: --include-fixtures is e2e-only)', () => {
    expect(storyFixtureIds).toEqual([]);
    const fixtureIds = new Set(['story:hangul-day', 'story:hangul-day-draft', 'story:hangul-day-revised', 'story:sun-and-moon-fixture', 'story:cell-stories-fixture']);
    for (const story of storiesAll) expect(fixtureIds.has(story.id) && /test fixture/i.test(story.authorNotes ?? '')).toBe(false);
  });

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
    // `story-read` and `story-check` joined MinigameKindSchema in F-STORY-002 PR 2.1 / F-STORY-003 PR 3.1.
    // The filter stays as a guard: a step whose kind the enum does not know has the kind dropped.
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

/**
 * A story can be `ready` as content before PR 1.9 gives it a `shelf` block (F-PLAN-002
 * section 3.2). Such a story ships in `storiesAll` but must surface on no learner path:
 * no shelf episode, no quest and no quest step plays it.
 */
describe('a ready story without a shelf block reaches no learner path', () => {
  it('the generator derives no episode and no quest for it (fixture story)', () => {
    const story = parseStory(readyFixture);
    const bundle = buildBundle([{ ...story, shelf: undefined }]);
    expect(bundle.stories.map((s) => s.id)).toEqual([story.id]);
    expect(bundle.episodes).toEqual([]);
    expect(bundle.quests).toEqual([]);
  });

  it('every generated shelf episode and quest belongs to a bundled story with a shelf block', () => {
    const shelfSlugs = new Set(storiesAll.filter((s) => s.shelf).map((s) => storySlug(s.id)));
    for (const e of storyEpisodes) expect(shelfSlugs.has(e.id.replace(/^episode:shelf-/, '')), e.id).toBe(true);
    for (const q of storyQuests) {
      const storyId = storyIdOfQuest(q);
      expect(storyId !== null && shelfSlugs.has(storySlug(storyId)), q.id).toBe(true);
    }
  });

  it('no episode lists, and no quest plays, a bundled story that has no shelf block', () => {
    for (const story of storiesAll.filter((s) => !s.shelf)) {
      const slug = storySlug(story.id);
      expect(episodesAll.some((e) => e.id === `episode:shelf-${slug}`), `${story.id} has a shelf episode`).toBe(false);
      expect(questsAll.some((q) => storyIdOfQuest(q) === story.id), `${story.id} is played by a quest`).toBe(false);
      const namesIt = questsAll.some((q) =>
        q.steps.some((step) => step.minigameRef !== undefined && parseStoryMinigameRef(step.minigameRef)?.storyId === story.id),
      );
      expect(namesIt, `${story.id} is named by a quest step`).toBe(false);
    }
  });
});

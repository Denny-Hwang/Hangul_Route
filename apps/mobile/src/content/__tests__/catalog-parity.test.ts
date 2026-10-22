import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import {
  CATALOG,
  VOCAB_TOPIC_KEYS,
  catalogStatusOfStory,
  cellIsReady,
  type CatalogCell,
  type CatalogQuest,
  type CatalogStory,
  type CatalogTopic,
  type Episode,
  type Jamo,
  type Quest,
} from '@hangul-route/content-schema';
import { FREE_VOCAB_TOPIC_IDS } from '../../logic/content-access';
import { bookEpisodes } from '../books';
import { questTeaches } from '../../logic/stage1/curriculum';
import { discoverQuest } from '../../logic/stage1/__tests__/fixtures';
import { episodesAll } from '../episodes';
import { jamoAll, jamoWordBuilder } from '../jamo';
import { questsAll } from '../quests';
import { storiesAll, storyQuests } from '../stories';
import { VOCAB_TOPICS } from '../__generated__/vocab';

/**
 * Catalogue parity (F-PLAN-002 section 3.2): this is the guard that keeps `CATALOG` equal to the
 * shipped bundle (episodes, quests, shelf stories, vocabulary topics). Since F-CURR-002 row CM-6
 * the rows content/ defines are generated (`catalog.generated.ts`, scripts/build-lessons.mjs), so a
 * failure there means a generator and the bundle disagree; the Stage 1 and Stage 5 rows are still
 * hand-kept in `packages/content-schema/src/catalog/data.ts`, and for them the message prints the
 * corrected row to paste. It replaces the hand mirror
 * `apps/web/src/data/stage1-catalog.ts` and the two web-side parity tests (retired
 * with the web adapter in P2-6, not here).
 */

const row = (value: unknown): string => `\ncorrect row (data.ts for Stage 1 and Stage 5; generated from content/ otherwise): ${JSON.stringify(value)}\n`;

/** Symbol keys as the catalogue spells them: the letter, or `<letter>/final` for a batchim. */
const symbolKeyOf = (jamo: Jamo): string => (jamo.kind === 'batchim' ? `${jamo.char}/final` : jamo.char);
const symbolKeys = new Map([...jamoAll, ...jamoWordBuilder].map((jamo) => [jamo.id, symbolKeyOf(jamo)]));
const teachesOf = (quest: Quest): string[] =>
  questTeaches(quest).map((id) => symbolKeys.get(id) ?? `unknown:${id}`);

const isShelf = (episode: Episode): boolean => episode.placement === 'shelf';
const gridEpisodes = episodesAll.filter((episode) => !isShelf(episode));
const storyQuestIds = new Set(storyQuests.map((quest) => quest.id));
const lessonQuests = questsAll.filter((quest) => !storyQuestIds.has(quest.id));
const episodeOfQuest = (questId: string): Episode | undefined => episodesAll.find((e) => e.questIds.includes(questId));

const cellOf = (episode: Episode): Pick<CatalogCell, 'stage' | 'theme' | 'episodeId' | 'title' | 'minutes' | 'questIds'> => ({
  stage: episode.stage,
  theme: episode.theme,
  episodeId: episode.id,
  title: episode.titleEn,
  minutes: episode.estimatedMinutes,
  questIds: episode.questIds,
});

describe('cells and the bundle episodes', () => {
  it('has a cell with equal id, stage, theme, title, minutes and quest ids for every grid episode', () => {
    for (const episode of gridEpisodes) {
      const cell = CATALOG.cells.find((c) => c.episodeId === episode.id);
      const expected = { ...cellOf(episode), status: episode.status };
      expect(cell, `no catalogue cell for ${episode.id}${row(expected)}`).toBeDefined();
      const { status, ...rest } = cell as CatalogCell;
      expect(rest, `cell ${episode.id} differs${row(expected)}`).toEqual(cellOf(episode));
      expect(cellIsReady({ status }), `cell ${episode.id} status class (ready or coming soon)${row(expected)}`).toBe(
        cellIsReady({ status: episode.status }),
      );
    }
  });

  it('lists nothing the bundle lacks, except coming-soon cells', () => {
    for (const cell of CATALOG.cells) {
      const inBundle = gridEpisodes.some((episode) => episode.id === cell.episodeId);
      if (!inBundle) expect(cellIsReady(cell), `cell ${cell.episodeId} is not in the bundle but is ready`).toBe(false);
    }
  });

  it('lists every Stage 5 book as a shipped cell whose read quests are catalogue lesson quests (F-STORY-005 PR 5.6)', () => {
    expect(bookEpisodes.map((book) => book.theme)).toEqual(['letters', 'life', 'rites', 'nature', 'crafts']);
    for (const book of bookEpisodes) {
      const cell = CATALOG.cells.find((c) => c.episodeId === book.id);
      expect(cell?.status, book.id).toBe('shipped');
      for (const questId of book.questIds) {
        expect(CATALOG.quests.find((q) => q.id === questId)?.kind, questId).toBe('lesson');
      }
    }
  });

  it('covers the whole grid: the bundle has 35 grid episodes and so has the catalogue', () => {
    expect(gridEpisodes).toHaveLength(35);
    expect(CATALOG.cells).toHaveLength(35);
  });
});

describe('quests and the bundle quests', () => {
  it('has a lesson quest with equal id, title, minutes, episode, stage, theme and teaches for every bundle quest', () => {
    for (const quest of lessonQuests) {
      const episode = episodeOfQuest(quest.id);
      expect(episode, `quest ${quest.id} belongs to no bundle episode`).toBeDefined();
      const expected: Omit<CatalogQuest, 'kind'> = {
        id: quest.id,
        episodeId: (episode as Episode).id,
        stage: (episode as Episode).stage,
        theme: (episode as Episode).theme,
        title: quest.titleEn,
        minutes: quest.estimatedMinutes,
        teaches: teachesOf(quest),
      };
      const found = CATALOG.quests.find((q) => q.id === quest.id);
      expect(found, `no catalogue quest for ${quest.id}${row({ ...expected, kind: 'lesson' })}`).toBeDefined();
      const { kind, ...rest } = found as CatalogQuest;
      expect(kind).toBe('lesson');
      expect(rest, `quest ${quest.id} differs${row({ ...expected, kind: 'lesson' })}`).toEqual(expected);
    }
  });

  it('has a story quest with equal id, title, minutes and shelf episode for every bundled story quest', () => {
    for (const quest of storyQuests) {
      const episode = episodeOfQuest(quest.id);
      const found = CATALOG.quests.find((q) => q.id === quest.id);
      const expected = { id: quest.id, episodeId: episode?.id, title: quest.titleEn, minutes: quest.estimatedMinutes, kind: 'story' };
      expect(found, `no catalogue quest for ${quest.id}${row(expected)}`).toBeDefined();
      expect({ id: found?.id, episodeId: found?.episodeId, title: found?.title, minutes: found?.minutes, kind: found?.kind }, `quest ${quest.id} differs${row(expected)}`).toEqual(expected);
    }
  });

  it('lists nothing the bundle lacks, except quests of draft stories', () => {
    const draftStoryQuests = new Set(CATALOG.stories.filter((s) => s.status === 'draft').map((s) => s.questId));
    for (const quest of CATALOG.quests) {
      const inBundle = questsAll.some((q) => q.id === quest.id);
      if (!inBundle) expect(draftStoryQuests.has(quest.id), `quest ${quest.id} is not in the bundle (remove it, or mark its story draft)`).toBe(true);
    }
  });

  it('every bundle quest is a lesson quest of the catalogue or a bundled story quest (no quest is unaccounted)', () => {
    expect(lessonQuests.length + storyQuests.length).toBe(questsAll.length);
  });
});

describe('teaches', () => {
  it('maps jamo ids to the symbol keys of F-QUEST-002: the letter, and <letter>/final for a batchim', () => {
    const keys = jamoAll.map(symbolKeyOf);
    expect(new Set(keys).size).toBe(30);
    expect(keys.filter((k) => k.endsWith('/final'))).toEqual(['ㄱ/final', 'ㄴ/final', 'ㄹ/final', 'ㅁ/final', 'ㅂ/final', 'ㅇ/final']);
    const giyeok = 'jamo:giyeok';
    const nieunFinal = 'jamo:nieun-batchim';
    expect(teachesOf(discoverQuest('quest:t', [giyeok, nieunFinal, 'jamo:a']))).toEqual(['ㄱ', 'ㄴ/final', 'ㅏ']);
  });

  it('flags a discover jamo the bundle does not know', () => {
    expect(teachesOf(discoverQuest('quest:t', ['jamo:nope']))).toEqual(['unknown:jamo:nope']);
  });

  it('equals what the Discover steps teach for every shipped quest (letters q1-q3 since Q-6a; empty for a quest without one)', () => {
    for (const quest of lessonQuests) {
      const found = CATALOG.quests.find((q) => q.id === quest.id);
      expect(found?.teaches, `quest ${quest.id} teaches${row(teachesOf(quest))}`).toEqual(teachesOf(quest));
    }
  });
});

const RawStorySchema = z.object({
  id: z.string(),
  state: z.enum(['draft', 'ready']),
  recommendedStage: z.number(),
  theme: z.string(),
  minutes: z.number(),
  title: z.object({ en: z.string() }),
  shelf: z.object({}).passthrough().optional(),
  review: z.object({ language: z.enum(['draft', 'native-reviewed']), culture: z.enum(['draft', 'culture-reviewed']) }),
});
const STORY_DIR = join(__dirname, '../../../../../content/stories');
const rawStories = readdirSync(STORY_DIR)
  .filter((name) => name.endsWith('.json'))
  .sort()
  .map((name) => RawStorySchema.parse(JSON.parse(readFileSync(join(STORY_DIR, name), 'utf8'))));

/**
 * Story status follows one rule, `catalogStatusOfStory` (section 3.2): a catalogue story is
 * `ready` only when its file is `ready`, has a `shelf` block and carries both review
 * sign-offs. So a story can be `ready` as content (F-STORY-001 PR 1.8) before PR 1.9 adds
 * its shelf block and sign-offs, and the catalogue flips at that review step, never before
 * the bundle holds the story's listen quest.
 */
describe('stories and content/stories', () => {
  it('has a story with equal id, title, minutes, recommended stage, theme and offer status for every story file', () => {
    expect(rawStories.length).toBeGreaterThan(0);
    for (const raw of rawStories) {
      const expected: Pick<CatalogStory, 'id' | 'title' | 'minutes' | 'recommendedStage' | 'theme' | 'status'> = {
        id: raw.id,
        title: raw.title.en,
        minutes: raw.minutes,
        recommendedStage: raw.recommendedStage,
        theme: raw.theme as CatalogStory['theme'],
        status: catalogStatusOfStory(raw),
      };
      const found = CATALOG.stories.find((s) => s.id === raw.id);
      expect(found, `no catalogue story for ${raw.id}${row(expected)}`).toBeDefined();
      const { id, title, minutes, recommendedStage, theme, status } = found as CatalogStory;
      expect({ id, title, minutes, recommendedStage, theme, status }, `story ${raw.id} differs${row(expected)}`).toEqual(expected);
    }
  });

  it('lists no story without a file in content/stories', () => {
    const ids = new Set(rawStories.map((raw) => raw.id));
    for (const story of CATALOG.stories) expect(ids.has(story.id), `story ${story.id} has no file in content/stories`).toBe(true);
  });

  it('gives every bundled story the status of the rule, and the same sampler flag once it has a shelf block', () => {
    for (const story of storiesAll) {
      const found = CATALOG.stories.find((s) => s.id === story.id);
      const status = catalogStatusOfStory(story);
      const why = `shelf block: ${story.shelf ? 'yes' : 'no'}, review: ${story.review.language} / ${story.review.culture}`;
      expect(found?.status, `bundled story ${story.id} must be ${status} in the catalogue (${why})`).toBe(status);
      // The catalogue sampler is the intended free set (D5); a story file states it only in its shelf block (PR 1.9).
      if (story.shelf) expect(found?.sampler, `story ${story.id} sampler flag`).toBe(story.shelf.sampler === true);
    }
  });

  it('lists a story as ready only when the bundle holds it as a shelf story with its listen quest', () => {
    const bundledShelf = new Set(storiesAll.filter((story) => story.shelf).map((story) => story.id));
    const bundledQuests = new Set(storyQuests.map((quest) => quest.id));
    for (const story of CATALOG.stories.filter((s) => s.status === 'ready')) {
      expect(bundledShelf.has(story.id), `story ${story.id} is ready in the catalogue but not a bundled shelf story`).toBe(true);
      expect(bundledQuests.has(story.questId), `story ${story.id} is ready in the catalogue but the bundle lacks ${story.questId}`).toBe(true);
    }
  });
});

describe('vocabulary topics', () => {
  it('has a topic with equal key, title and order for every bundled topic', () => {
    expect(VOCAB_TOPICS.length).toBeGreaterThan(0);
    for (const topic of VOCAB_TOPICS) {
      const expected: Pick<CatalogTopic, 'id' | 'key' | 'title' | 'order'> = { id: `topic:${topic.key}`, key: topic.key, title: topic.titleEn, order: topic.order };
      const found = CATALOG.topics.find((t) => t.key === topic.key);
      expect(found, `no catalogue topic for ${topic.key}${row(expected)}`).toBeDefined();
      const { id, key, title, order } = found as CatalogTopic;
      expect({ id, key, title, order }, `topic ${topic.key} differs${row(expected)}`).toEqual(expected);
    }
  });

  it('lists exactly the twelve launch topic keys (topics the bundle has not landed yet are allowed)', () => {
    expect([...CATALOG.topics.map((t) => t.key)].sort()).toEqual([...VOCAB_TOPIC_KEYS].sort());
  });

  it('marks as free exactly the topics of the content-access registry (D5)', () => {
    expect(CATALOG.topics.filter((t) => t.free).map((t) => t.key).sort()).toEqual([...FREE_VOCAB_TOPIC_IDS].sort());
  });
});

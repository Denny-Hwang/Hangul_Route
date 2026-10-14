import { describe, expect, it } from 'vitest';
import {
  BOOK_MAX_QUESTS,
  BOOK_MIN_QUESTS,
  BOOK_STAGE,
  EpisodeSchema,
  QuestSchema,
  type Story,
} from '@hangul-route/content-schema';
import { BOOK_DEFINITIONS, bookEpisodes, bookQuests, buildBook } from '../books';
import { episodesAll, episodeById } from '../episodes';
import { questsAll } from '../quests';
import { storiesAll, storyById, storyQuests } from '../stories';
import { STORY_QUEST_COPY, STORY_STEP_SECONDS, storyQuestSkeleton } from '../story-skeleton';

/** F-STORY-005 §3.2 "Books", §3.3 book plan, PR 5.6. */
describe('Stage 5 books (books.ts)', () => {
  it('ships the rites book first, with the placeholder id and the planned three stories', () => {
    expect(bookEpisodes.map((e) => e.id)).toEqual(['episode:stage5-rites']);
    const [rites] = bookEpisodes;
    expect(rites?.titleEn).toBe('Festival Tales');
    expect(rites?.storyIds).toEqual(['story:seollal-new-year', 'story:dano-ssireum', 'story:chuseok-ganggangsullae']);
  });

  it.each(bookEpisodes.map((e) => [e.id, e] as const))('%s is a valid grid story book of its Stage 5 cell', (_id, book) => {
    expect(EpisodeSchema.safeParse(book).success).toBe(true);
    expect(book.id).toBe(`episode:${book.stage}-${book.theme}`);
    expect(book.stage).toBe(BOOK_STAGE);
    expect(book.format).toBe('story');
    expect(book.placement).toBe('grid');
    expect(book.status).toBe('shipped');
    expect(book.questIds.length).toBeGreaterThanOrEqual(BOOK_MIN_QUESTS);
    expect(book.questIds.length).toBeLessThanOrEqual(BOOK_MAX_QUESTS);
    // One quest per story, in the same order: quest:story-<slug>-read.
    expect(book.questIds).toEqual((book.storyIds ?? []).map((id) => `quest:story-${id.replace(/^story:/, '')}-read`));
    // Book reward cards are the Stage 5 scene cards of F-CARD-S5-001 (a draft, out of scope).
    expect(book.rewardCardIds).toEqual([]);
  });

  it('every story of a book has a reviewed read tier and a shelf twin', () => {
    for (const book of bookEpisodes) {
      for (const id of book.storyIds ?? []) {
        const story = storyById(id);
        expect(story, id).toBeDefined();
        const s = story as Story;
        expect(s.state).toBe('ready');
        expect(s.review.language).toBe('native-reviewed');
        expect(s.review.culture).toBe('culture-reviewed');
        expect(s.review.reviewedBy).toBe('MAR');
        expect(s.tiers.some((t) => t.level === 'read')).toBe(true);
        expect(s.shelf).toBeDefined();
        expect(episodesAll.some((e) => e.placement === 'shelf' && e.id === `episode:shelf-${id.replace(/^story:/, '')}`)).toBe(true);
        // Both review passes of the read tier are on record.
        expect(s.verification.notes).toMatch(/MAR \d{4}-\d{2}-\d{2} language review of the read tier/);
        expect(s.verification.notes).toMatch(/MAR \d{4}-\d{2}-\d{2} culture review of the read tier/);
      }
    }
  });

  it('a book replaces its placeholder and its quests are in the quest list', () => {
    for (const book of bookEpisodes) {
      expect(episodeById(book.id)).toBe(book);
      expect(episodesAll.filter((e) => e.id === book.id)).toHaveLength(1);
      for (const questId of book.questIds) expect(questsAll.some((q) => q.id === questId)).toBe(true);
    }
    expect(bookQuests.map((q) => q.id)).toEqual(bookEpisodes.flatMap((e) => e.questIds));
    for (const quest of bookQuests) expect(QuestSchema.safeParse(quest).success).toBe(true);
  });
});

describe('buildBook: content trouble never breaks the app (F-STORY-001 §3.7 holds)', () => {
  const rites = BOOK_DEFINITIONS[0]!;
  const lookup = (id: string): Story | undefined => storyById(id);

  it('builds the shipped book from the bundle', () => {
    expect(buildBook(rites, lookup)?.episode).toEqual(bookEpisodes[0]);
  });

  it('leaves out a story that is held (not bundled), unreviewed or has no read tier', () => {
    const held = buildBook(rites, (id) => (id === 'story:dano-ssireum' ? undefined : lookup(id)));
    expect(held?.episode.storyIds).toEqual(['story:seollal-new-year', 'story:chuseok-ganggangsullae']);
    expect(held?.episode.questIds).toEqual(['quest:story-seollal-new-year-read', 'quest:story-chuseok-ganggangsullae-read']);
    expect(held?.episode.estimatedMinutes).toBe(held?.quests.reduce((n, q) => n + q.estimatedMinutes, 0));
    const unreviewed = (id: string): Story | undefined => {
      const s = lookup(id);
      return s && id === 'story:seollal-new-year' ? { ...s, review: { ...s.review, culture: 'draft' } } : s;
    };
    expect(buildBook(rites, unreviewed)?.episode.storyIds).not.toContain('story:seollal-new-year');
    const listenOnly = (id: string): Story | undefined => {
      const s = lookup(id);
      return s && id === 'story:chuseok-ganggangsullae' ? { ...s, tiers: s.tiers.filter((t) => t.level !== 'read') } : s;
    };
    expect(buildBook(rites, listenOnly)?.episode.storyIds).not.toContain('story:chuseok-ganggangsullae');
    const draft = (id: string): Story | undefined => {
      const s = lookup(id);
      return s && id === 'story:dano-ssireum' ? { ...s, state: 'draft' } : s;
    };
    expect(buildBook(rites, draft)?.episode.storyIds).not.toContain('story:dano-ssireum');
  });

  it('builds nothing below two stories, so the cell stays a placeholder', () => {
    expect(buildBook(rites, (id) => (id === 'story:seollal-new-year' ? lookup(id) : undefined))).toBeNull();
    expect(buildBook(rites, () => undefined)).toBeNull();
  });
});

describe('storyQuestSkeleton (story-skeleton.ts)', () => {
  it('equals the generated shelf quest for the same story at the listen level (parity with build-stories.mjs)', () => {
    expect(storyQuests.length).toBeGreaterThan(0);
    for (const generated of storyQuests) {
      const story = storiesAll.find((s) => generated.id === `quest:story-${s.id.replace(/^story:/, '')}-listen`);
      expect(story, generated.id).toBeDefined();
      expect(storyQuestSkeleton(story as Story, 'listen')).toEqual(generated);
    }
  });

  it('builds the five-step read quest with read refs and no listen reward card', () => {
    const story = storyById('story:seollal-new-year') as Story;
    const quest = storyQuestSkeleton(story, 'read');
    expect(quest.id).toBe('quest:story-seollal-new-year-read');
    expect(quest.titleEn).toBe(story.title.en);
    expect(quest.estimatedMinutes).toBe(Math.max(3, story.minutes));
    expect(quest.steps.map((s) => s.kind)).toEqual(['intro', 'present', 'practice', 'apply', 'reward']);
    expect(quest.steps.map((s) => s.minigameRef ?? null)).toEqual([
      null,
      'minigame:story-read-read-seollal-new-year',
      'minigame:story-check-read-seollal-new-year',
      'minigame:story-seq-read-seollal-new-year',
      null,
    ]);
    expect(quest.steps[0]?.hoyaLineEn).toBe(story.hoyaIntroEn);
    expect(quest.steps[4]?.hoyaLineEn).toBe(story.hoyaOutroEn);
    expect(quest.steps.map((s) => s.titleEn)).toEqual([
      STORY_QUEST_COPY.intro,
      STORY_QUEST_COPY.read,
      STORY_QUEST_COPY.check,
      STORY_QUEST_COPY.seq,
      STORY_QUEST_COPY.reward,
    ]);
    expect(quest.steps.map((s) => s.durationSeconds)).toEqual([
      STORY_STEP_SECONDS.intro,
      STORY_STEP_SECONDS.read,
      STORY_STEP_SECONDS.check,
      STORY_STEP_SECONDS.seq,
      STORY_STEP_SECONDS.reward,
    ]);
    expect(quest.rewardCardId).toBeUndefined();
  });

  it('takes the reward card of its own level, uses the along code for read-along and floors minutes at 3', () => {
    const base = storyById('story:seollal-new-year') as Story;
    const story: Story = { ...base, minutes: 2, rewardCardIds: { listen: 'card:a', read: 'card:b' } };
    expect(storyQuestSkeleton(story, 'read').rewardCardId).toBe('card:b');
    expect(storyQuestSkeleton(story, 'listen').rewardCardId).toBe('card:a');
    expect(storyQuestSkeleton(story, 'read-along').rewardCardId).toBeUndefined();
    expect(storyQuestSkeleton(story, 'read-along').id).toBe('quest:story-seollal-new-year-along');
    expect(storyQuestSkeleton(story, 'read').estimatedMinutes).toBe(3);
  });

  it('throws on a story without the Hoya lines a quest needs', () => {
    const base = storyById('story:seollal-new-year') as Story;
    expect(() => storyQuestSkeleton({ ...base, hoyaIntroEn: undefined }, 'read')).toThrow(/hoyaIntroEn/);
    expect(() => storyQuestSkeleton({ ...base, hoyaOutroEn: undefined }, 'read')).toThrow(/hoyaOutroEn/);
  });
});

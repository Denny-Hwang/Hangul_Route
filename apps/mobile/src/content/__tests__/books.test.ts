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
import { completeStages, stagesToLatch, withStageLatches } from '../../logic/my-route/latch';
import { snapshotWith } from '../../logic/my-route/__tests__/fixtures/bundle-2026-10';
import { STORY_QUEST_COPY, STORY_STEP_SECONDS, storyQuestSkeleton } from '../story-skeleton';

/** F-STORY-005 §3.2 "Books", §3.3 book plan, PR 5.6. */
describe('Stage 5 books (books.ts)', () => {
  it('ships all five Stage 5 books in grid order, each with its placeholder id, its planned title and stories (§3.3 book plan)', () => {
    expect(bookEpisodes.map((e) => [e.id, e.order, e.titleEn, e.storyIds])).toEqual([
      ['episode:stage5-letters', 1, 'Stories of Letters', ['story:sejong-new-letters', 'story:shapes-of-hangeul', 'story:hangeul-day']],
      ['episode:stage5-life', 2, 'Family Stories', ['story:gimjang-arirang', 'story:kim-hongdo-genre-paintings', 'story:donguibogam']],
      ['episode:stage5-rites', 3, 'Festival Tales', ['story:seollal-new-year', 'story:dano-ssireum', 'story:chuseok-ganggangsullae']],
      ['episode:stage5-nature', 4, 'Tiger Folktales', ['story:sun-and-moon', 'story:angbuilgu-sundial']],
      ['episode:stage5-crafts', 5, 'Craft Stories', ['story:cheugugi-rain-gauge', 'story:jagyeongnu-water-clock', 'story:pansori-tales']],
    ]);
  });

  it('every book carries its pillar tags and a minute total equal to its quests', () => {
    expect(Object.fromEntries(bookEpisodes.map((e) => [e.id, e.pillarTags]))).toEqual({
      'episode:stage5-letters': ['A1'],
      'episode:stage5-life': ['B1', 'B5', 'E4'],
      'episode:stage5-rites': ['B5'],
      'episode:stage5-nature': ['D5', 'E5'],
      'episode:stage5-crafts': ['E3', 'C3'],
    });
    for (const book of bookEpisodes) {
      const minutes = book.questIds.reduce((n, id) => n + (bookQuests.find((q) => q.id === id)?.estimatedMinutes ?? 0), 0);
      expect(book.estimatedMinutes, book.id).toBe(minutes);
    }
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
  const rites = BOOK_DEFINITIONS.find((d) => d.id === 'episode:stage5-rites')!;
  const lookup = (id: string): Story | undefined => storyById(id);

  it('builds every shipped book from the bundle', () => {
    for (const definition of BOOK_DEFINITIONS) {
      expect(buildBook(definition, lookup)?.episode, definition.id).toEqual(bookEpisodes.find((e) => e.id === definition.id));
    }
  });

  it('the two-story nature book stays a placeholder when one of its stories is held', () => {
    const nature = BOOK_DEFINITIONS.find((d) => d.id === 'episode:stage5-nature')!;
    expect(buildBook(nature, lookup)?.episode.questIds).toEqual(['quest:story-sun-and-moon-read', 'quest:story-angbuilgu-sundial-read']);
    expect(buildBook(nature, (id) => (id === 'story:angbuilgu-sundial' ? undefined : lookup(id)))).toBeNull();
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

  it('leaves out a reviewed read story without the Hoya lines a quest needs, without throwing', () => {
    const noOutro = (id: string): Story | undefined => {
      const s = lookup(id);
      return s && id === 'story:dano-ssireum' ? { ...s, hoyaOutroEn: undefined } : s;
    };
    expect(() => buildBook(rites, noOutro)).not.toThrow();
    expect(buildBook(rites, noOutro)?.episode.storyIds).toEqual(['story:seollal-new-year', 'story:chuseok-ganggangsullae']);
    const noIntro = (id: string): Story | undefined => {
      const s = lookup(id);
      return s && id !== 'story:seollal-new-year' ? { ...s, hoyaIntroEn: '' } : s;
    };
    expect(() => buildBook(rites, noIntro)).not.toThrow();
    expect(buildBook(rites, noIntro)).toBeNull();
  });

  it('Hoya names no story count, so a book that lost a story never promises more than it lists', () => {
    for (const definition of BOOK_DEFINITIONS) {
      expect(definition.hoyaIntroEn, definition.id).not.toMatch(/\b(two|three|four|five|six|\d+)\b/i);
      const held = buildBook(definition, (id) => (id === definition.storyIds[1] ? undefined : lookup(id)));
      if (held) expect(held.episode.hoyaIntroEn).toBe(definition.hoyaIntroEn);
    }
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

/** F-STORY-005 PR 5.6: with all five books shipped, Stage 5 is `open` and can complete (F-ROUTE-001 OD-6 latch). */
describe('Stage 5 completion on the shipped bundle', () => {
  const stage5Quests = bookEpisodes.flatMap((e) => e.questIds);
  const NOW = new Date('2026-10-13T09:00:00.000Z');
  const episodeOf = new Map(bookEpisodes.flatMap((e) => e.questIds.map((q) => [q, e.id] as const)));
  /** The fixture helper guesses episode ids from quest ids; a book quest names its book. */
  const doneWith = (questIds: readonly string[]) => {
    const s = snapshotWith(questIds);
    return { ...s, quests: s.quests.map((q) => ({ ...q, episodeId: episodeOf.get(q.questId) ?? q.episodeId })) };
  };

  it('latches stage5 once when every Stage 5 read quest is done, and no other stage', () => {
    expect(stage5Quests).toHaveLength(14);
    expect(stagesToLatch(doneWith(stage5Quests.slice(0, -1)), episodesAll)).toEqual([]);
    const done = doneWith(stage5Quests);
    expect(stagesToLatch(done, episodesAll)).toEqual(['stage5']);
    const latched = withStageLatches(done, ['stage5'], NOW);
    expect(latched.stageDoneAt).toEqual({ stage5: NOW.toISOString() });
    expect(stagesToLatch(latched, episodesAll)).toEqual([]);
    expect([...completeStages(latched, episodesAll)]).toEqual(['stage5']);
  });
});

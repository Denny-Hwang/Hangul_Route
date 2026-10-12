import {
  HeritageCardListSchema,
  ROMANIZATION_EXCEPTIONS,
  STORY_CARD_FACT_MAX_CHARS,
  STORY_CARD_MIN_SOURCES,
  checkRomanization,
  lintStory,
  lintStoryCorpus,
  storyCardId,
  type HeritageCard,
  type ProgressSnapshot,
  type StageKey,
  type Story,
} from '@hangul-route/content-schema';
import { describe, expect, it } from 'vitest';
import { derivedAwards, missingAwards, stageCanComplete } from '../../logic/awards/derive';
import { obtainableCards } from '../../logic/awards/obtainable';
import { parseUnlockedBy } from '../../logic/awards/rules';
import { buildStoryCards } from '../../logic/awards/story-cards';
import type { AwardWorld } from '../../logic/awards/types';
import { playableEpisodes } from '../../logic/next-quest';
import { awardWorld } from '../award-world';
import { episodesAll } from '../episodes';
import { heritageCardsAll, stage1Cards, stage2Cards, stage4Cards } from '../heritage-cards';
import { questsAll } from '../quests';
import { storiesAll } from '../stories';
import { storyCards, storySets } from '../story-cards';
import { storySetDefs } from '../story-sets';

/**
 * Card award integrity (F-STORY-006 §5, T-AWARD-1..5): CI fails when a card
 * can never be earned, when an episode's reward list and the cards' rules
 * disagree, or when two cards share a Korean word.
 */
const world: AwardWorld = awardWorld;
const PROFILE = { createdAt: '2026-09-01T00:00:00.000Z' };
const AT = '2026-09-10T00:00:00.000Z';

const episodeById = new Map(episodesAll.map((e) => [e.id, e]));
const questIds = new Set(questsAll.map((q) => q.id));
const episodeOfQuest = new Map(episodesAll.flatMap((e) => e.questIds.map((q) => [q, e] as const)));

function finished(ids: readonly string[], stars: 1 | 2 | 3): ProgressSnapshot {
  return {
    profileId: 'profile:a',
    updatedAt: AT,
    episodes: [],
    quests: ids.map((questId) => ({ questId, episodeId: episodeOfQuest.get(questId)?.id ?? '', startedAt: AT, completedAt: AT, stars, attempts: 1, accuracy: 1 })),
    cards: [],
    sessions: [],
    homework: [],
    reviews: [],
    streakDays: 0,
  };
}

describe('card award integrity (F-STORY-006 T-AWARD-1..5)', () => {
  it('every shipped card parses, including the tightened unlockedBy grammar', () => {
    expect(() => HeritageCardListSchema.parse(heritageCardsAll)).not.toThrow();
  });

  it('T-AWARD-1: every card in heritageCardsAll has a rule that can still fire', () => {
    const hidden = heritageCardsAll.map((c) => c.id).filter((id) => !obtainableCards(world, new Set()).some((c) => c.id === id));
    expect(hidden).toEqual([]);
  });

  it('T-AWARD-1: finishing every playable quest, even at 1 star, earns every card', () => {
    const all = playableEpisodes(episodesAll).flatMap((e) => e.questIds);
    const earned = new Set(derivedAwards(world, finished(all, 1), PROFILE).map((a) => a.cardId));
    expect(heritageCardsAll.map((c) => c.id).filter((id) => !earned.has(id))).toEqual([]);
  });

  it('T-AWARD-2: every episode reward exists and names that episode as its rule', () => {
    for (const e of episodesAll) {
      for (const cardId of e.rewardCardIds) {
        const card = heritageCardsAll.find((c) => c.id === cardId);
        expect(card, `${e.id} -> ${cardId}`).toBeDefined();
        expect(card?.unlockedBy, `${e.id} -> ${cardId}`).toBe(e.id);
      }
    }
  });

  it('T-AWARD-2: every episode card is in its episode reward list', () => {
    for (const card of heritageCardsAll) {
      const rule = parseUnlockedBy(card.unlockedBy);
      if (rule.kind !== 'episode') continue;
      expect(episodeById.get(rule.episodeId)?.rewardCardIds ?? [], `${card.id} -> ${rule.episodeId}`).toContain(card.id);
    }
  });

  it("T-AWARD-2: every quest card is in its episode's reward list", () => {
    for (const q of questsAll) {
      if (!q.rewardCardId) continue;
      const episode = episodeOfQuest.get(q.id);
      expect(episode, `${q.id} has no episode`).toBeDefined();
      expect(episode?.rewardCardIds ?? [], `${q.id} -> ${q.rewardCardId}`).toContain(q.rewardCardId);
    }
  });

  it('T-AWARD-3: no card is unlocked by an episode that cannot complete', () => {
    for (const card of heritageCardsAll) {
      const rule = parseUnlockedBy(card.unlockedBy);
      if (rule.kind !== 'episode') continue;
      const e = episodeById.get(rule.episodeId);
      expect(e, card.id).toBeDefined();
      expect(e?.status === 'shipped' || e?.status === 'ready', `${card.id}: ${rule.episodeId} is ${e?.status}`).toBe(true);
      expect(e?.questIds.length ?? 0, `${card.id}: ${rule.episodeId} has no quests`).toBeGreaterThan(0);
      for (const q of e?.questIds ?? []) expect(questIds.has(q), `${rule.episodeId} -> ${q}`).toBe(true);
    }
  });

  it('T-AWARD-4: stage cards exist only for a stage that can complete', () => {
    const stages = new Set<StageKey>();
    for (const card of heritageCardsAll) {
      const rule = parseUnlockedBy(card.unlockedBy);
      if (rule.kind === 'stage') stages.add(rule.stage);
    }
    expect(stages.size).toBeGreaterThan(0);
    for (const stage of stages) expect(stageCanComplete(stage, world), stage).toBe(true);
  });

  it('T-AWARD-5: no two cards share a Korean word', () => {
    const seen = new Map<string, string>();
    for (const card of heritageCardsAll) {
      if (card.subtitleKo === undefined) continue;
      expect(seen.get(card.subtitleKo), `${card.id} repeats ${card.subtitleKo}`).toBeUndefined();
      seen.set(card.subtitleKo, card.id);
    }
  });

  it('catch-up (§3.11 row 1): all 15 Stage 1 quests at 2+ stars with their 15 quest cards adds the 15 other cards', () => {
    const stage1 = episodesAll.filter((e) => e.stage === 'stage1' && e.status === 'shipped' && (e.placement ?? 'grid') === 'grid').flatMap((e) => e.questIds);
    // F-QUEST-002 grows Stage 1 to 15 quests (Q-6b adds life q3, Q-7b rites q2-q3, Q-8 nature and crafts q2-q3); each new quest card moves one card from "episode" to "quest".
    expect(stage1).toHaveLength(15);
    const base = finished(stage1, 2);
    const questCards = questsAll.filter((q) => stage1.includes(q.id)).map((q) => q.rewardCardId as string);
    expect(questCards).toHaveLength(15);
    const snapshot = { ...base, cards: questCards.map((cardId) => ({ cardId, unlockedAt: AT, newSinceLastView: false })) };
    const missing = missingAwards(world, snapshot, PROFILE);
    const bySource = (s: string) => missing.filter((a) => a.source === s).length;
    // F-QUEST-002 section 3.6: 15 quest cards + 11 episode extras + 3 stage1-complete + 1 first-launch = all 30 Stage 1 cards.
    expect(missing).toHaveLength(15);
    expect({ episode: bySource('episode'), stage: bySource('stage'), welcome: bySource('welcome'), quest: bySource('quest') }).toEqual({ episode: 11, stage: 3, welcome: 1, quest: 0 });
  });
});

// ---- the heritage story cards (F-STORY-006 §3.8, PR 6.7) -------------------------------------

const handWritten: readonly HeritageCard[] = [...stage1Cards, ...stage2Cards, ...stage4Cards];
const slugOf = (storyId: string): string => storyId.replace(/^story:/, '');

/**
 * T-AWARD-6 for a list of story cards and the stories they were built from:
 * the back face is the story's own sourced fact, verbatim, with its first
 * source; the Korean word is one of the story's keywords; the story's listen
 * reward is the card, so its shelf episode awards it.
 */
function expectSourcedStoryCards(cards: readonly HeritageCard[], stories: readonly Story[]): void {
  for (const card of cards) {
    const story = stories.find((s) => s.id === card.storyId);
    expect(story, `${card.id}: no story ${card.storyId}`).toBeDefined();
    if (!story?.card) throw new Error(`${card.id}: ${card.storyId} has no card block`);
    expect(card.id).toBe(storyCardId(story.id));
    expect(card.unlockedBy, card.id).toBe(`episode:shelf-${slugOf(story.id)}`);
    expect(story.rewardCardIds?.listen, card.id).toBe(card.id);
    expect(card.titleEn, card.id).toBe(story.card.titleEn);
    expect(card.titleEn.length, card.id).toBeLessThanOrEqual(28);
    expect(card.blurbEn, card.id).toBe(story.summaryEn);
    const keyword = story.keywords.find((k) => k.id === story.card?.keywordId);
    expect(keyword, `${card.id}: headword ${story.card.keywordId}`).toBeDefined();
    expect([card.subtitleKo, card.romanization], card.id).toEqual([keyword?.ko, keyword?.romanization]);
    const fact = story.facts.find((f) => f.id === story.card?.factId);
    if (!fact) throw new Error(`${card.id}: fact ${story.card.factId} is not in ${story.id}`);
    expect(card.factId, card.id).toBe(fact.id);
    expect(card.factEn, card.id).toBe(fact.claimEn);
    expect(fact.claimEn.length, card.id).toBeLessThanOrEqual(STORY_CARD_FACT_MAX_CHARS);
    expect(fact.sources.length, card.id).toBeGreaterThanOrEqual(STORY_CARD_MIN_SOURCES);
    const [first] = fact.sources;
    expect(card.citation, card.id).toEqual({ title: first?.title, publisher: first?.publisher, more: fact.sources.length - 1 });
  }
}

/**
 * The 24 card blocks the spec proposes (F-STORY-006 §3.8 table), applied to
 * the bundled stories as 6.8 will apply them once each story is reviewed:
 * proves today that the content, the builder and the counts agree. The
 * headword id is the keyword whose romanization the table names; the fact is
 * the first one with a short enough claim and two sources.
 */
const PROPOSED: ReadonlyArray<readonly [slug: string, titleEn: string, keywordId: string, factId: string]> = [
  ['sillok-royal-historians', 'Royal Historian', 'sagwan', 'f1'],
  ['sillok-mountain-archives', 'History Archive', 'sago', 'f1'],
  ['seungjeongwon-ilgi-every-day', 'Royal Secretariat', 'seungjeongwon', 'f1'],
  ['ilseongnok-daily-reflection', 'Daily Reflections', 'ilseongnok', 'f1'],
  ['uigwe-royal-birthday', 'Royal Picture Record', 'uigwe', 'f1'],
  ['joseon-records-today', 'Hwaseong Fortress', 'hwaseong', 'f2'],
  ['sejong-new-letters', 'King Sejong', 'sejong-daewang', 'f1'],
  ['shapes-of-hangeul', 'Consonants', 'jaeum', 'f1'],
  ['hangeul-day', 'National Treasure', 'gukbo', 'f1'],
  ['jikji-metal-type', 'Metal Type', 'geumsokhwalja', 'f1'],
  ['tripitaka-koreana', 'Tripitaka Koreana', 'daejanggyeong', 'f1'],
  ['janggyeong-panjeon', 'Wind', 'baram', 'f2'],
  ['cheugugi-rain-gauge', 'Rain Gauge', 'cheugugi', 'f2'],
  ['angbuilgu-sundial', 'Sundial', 'angbuilgu', 'f1'],
  ['jagyeongnu-water-clock', 'Water Clock', 'jagyeongnu', 'f1'],
  ['donguibogam', 'Medicine Book', 'donguibogam', 'f3'],
  ['nanjung-ilgi', 'War Diary', 'nanjung-ilgi', 'f2'],
  ['kim-hongdo-genre-paintings', 'Genre Painting', 'pungsokhwa', 'f1'],
  ['seollal-new-year', 'Words of Blessing', 'deokdam', 'f2'],
  ['dano-ssireum', 'Dano', 'dano', 'f2'],
  ['chuseok-ganggangsullae', 'Circle Dance', 'ganggangsullae', 'f1'],
  ['gimjang-arirang', 'Making Winter Kimchi', 'gimjang', 'f8'],
  ['sun-and-moon', 'Strong Rope', 'dongajul', 'f5'],
  ['pansori-tales', 'Pansori', 'pansori', 'f1'],
];

function withProposedCards(): Story[] {
  return PROPOSED.map(([slug, titleEn, keywordId, factId]) => {
    const source = storiesAll.find((s) => s.id === `story:${slug}`);
    if (!source) throw new Error(`story:${slug} is not bundled`);
    const story = structuredClone(source);
    story.card = { titleEn, keywordId, factId };
    story.rewardCardIds = { ...story.rewardCardIds, listen: storyCardId(story.id) };
    story.shelf ??= { category: 'culture', order: 1, sampler: false, minutes: story.minutes };
    return story;
  });
}

const CARD_RULE = /^card-/;

describe('heritage story cards (F-STORY-006 T-AWARD-6, T-AWARD-7)', () => {
  it('the bundle holds one card per reviewed shelf story with a card block (none until 6.8), and every set is complete', () => {
    const carded = storiesAll.filter((s) => s.state === 'ready' && s.shelf !== undefined && s.card !== undefined);
    const built = storyCards.filter((c) => c.storyId !== undefined);
    expect(built.map((c) => c.storyId)).toEqual(carded.map((s) => s.id));
    for (const set of storySets) {
      const def = storySetDefs.find((d) => d.id === set.id);
      expect(set.memberCardIds, set.id).toEqual(def?.memberStoryIds.map(storyCardId));
      expect(storyCards.some((c) => c.id === set.cardId), set.cardId).toBe(true);
    }
    expect(heritageCardsAll).toEqual([...handWritten, ...storyCards]);
    expect(awardWorld.sets).toBe(storySets);
  });

  it('T-AWARD-6: every bundled story card carries its story fact verbatim, the first source and a story keyword', () => {
    expectSourcedStoryCards(
      heritageCardsAll.filter((c) => c.storyId !== undefined),
      storiesAll,
    );
  });

  it('every bundled story with a card block passes the card lint rules, and no card repeats a Korean word', () => {
    for (const story of storiesAll) {
      expect(lintStory(story).filter((f) => CARD_RULE.test(f.rule) && f.level === 'error'), story.id).toEqual([]);
    }
    expect(lintStoryCorpus(storiesAll, { cards: handWritten }).filter((f) => CARD_RULE.test(f.rule))).toEqual([]);
  });

  describe('with the 24 proposed card blocks applied to the bundled stories', () => {
    const stories = withProposedCards();
    const { cards, sets } = buildStoryCards(stories, storySetDefs);
    const all = [...handWritten, ...cards];

    it('T-AWARD-6: each of the 24 cards is sourced, verbatim and short enough', () => {
      expect(cards.filter((c) => c.storyId !== undefined)).toHaveLength(24);
      expectSourcedStoryCards(
        cards.filter((c) => c.storyId !== undefined),
        stories,
      );
      for (const story of stories) {
        expect(lintStory(story).filter((f) => CARD_RULE.test(f.rule)), story.id).toEqual([]);
      }
    });

    it('T-AWARD-7: 70 cards (25 common, 21 uncommon, 16 rare, 8 legendary) and 4 sets', () => {
      expect(handWritten).toHaveLength(42);
      expect(all).toHaveLength(70);
      const byRarity = (r: HeritageCard['rarity']): number => all.filter((c) => c.rarity === r).length;
      expect({ common: byRarity('common'), uncommon: byRarity('uncommon'), rare: byRarity('rare'), legendary: byRarity('legendary') }).toEqual({
        common: 25,
        uncommon: 21,
        rare: 16,
        legendary: 8,
      });
      expect(sets.map((s) => s.id)).toEqual(['set:records-joseon', 'set:hangul-printing', 'set:science-art-life', 'set:seasons-tales']);
      for (const set of sets) expect(set.memberCardIds, set.id).toHaveLength(6);
      expect(() => HeritageCardListSchema.parse(all)).not.toThrow();
    });

    it('T-AWARD-5: no two of the 70 cards share a Korean word, and the corpus lint agrees', () => {
      const words = all.flatMap((c) => (c.subtitleKo === undefined ? [] : [c.subtitleKo]));
      expect(new Set(words).size).toBe(words.length);
      expect(lintStoryCorpus(stories, { cards: handWritten }).filter((f) => f.rule === 'card-korean-duplicate')).toEqual([]);
    });

    it('a set card arrives once its six member cards are owned, from the members alone', () => {
      const proposed: AwardWorld = { ...awardWorld, cards: all, sets };
      for (const set of sets) {
        const snapshot: ProgressSnapshot = {
          ...finished([], 1),
          cards: set.memberCardIds.map((cardId, i) => ({ cardId, unlockedAt: `2026-09-1${i}T00:00:00.000Z`, newSinceLastView: false })),
        };
        expect(derivedAwards(proposed, snapshot, PROFILE).filter((a) => a.source === 'set'), set.id).toEqual([
          { cardId: set.cardId, source: 'set', via: set.id, unlockedAt: '2026-09-15T00:00:00.000Z' },
        ]);
      }
    });
  });

  it('story-sets: four collections of six bundled stories, each story in one set, valid ids and romanization', () => {
    expect(storySetDefs).toHaveLength(4);
    const members = storySetDefs.flatMap((d) => d.memberStoryIds);
    expect(new Set(members).size).toBe(24);
    expect([...members].sort()).toEqual(PROPOSED.map(([slug]) => `story:${slug}`).sort());
    for (const def of storySetDefs) {
      expect(def.memberStoryIds, def.id).toHaveLength(6);
      expect(def.id).toMatch(/^set:[a-z0-9-]+$/);
      expect(def.cardId).toBe(`card:set-${def.id.slice('set:'.length)}`);
      expect(def.rarity).toBe('legendary');
      expect(checkRomanization(def.headword.ko, def.headword.romanization, { exceptions: ROMANIZATION_EXCEPTIONS }), def.id).toEqual([]);
      for (const id of def.memberStoryIds) expect(storiesAll.some((s) => s.id === id), id).toBe(true);
    }
  });
});

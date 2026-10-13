import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  HeritageCardListSchema,
  ROMANIZATION_EXCEPTIONS,
  STORY_CARD_FACT_MAX_CHARS,
  STORY_CARD_MIN_SOURCES,
  WEB_ADDRESS,
  checkRomanization,
  lintStory,
  lintStoryCorpus,
  parseStory,
  storyCardId,
  type Episode,
  type HeldStoryCard,
  type HeritageCard,
  type ProgressSnapshot,
  type StageKey,
  type Story,
  type ThemeKey,
} from '@hangul-route/content-schema';
import { supportedCardIds } from '@hangul-route/design-system/heritage-card-ids';
import { getMessages } from '@hangul-route/i18n';
import { describe, expect, it } from 'vitest';
import { heldStoryCards as heldStoryCardsOf } from '../../../../../scripts/build-stories.mjs';
import { derivedAwards, missingAwards, stageCanComplete } from '../../logic/awards/derive';
import { obtainableCards } from '../../logic/awards/obtainable';
import { parseUnlockedBy } from '../../logic/awards/rules';
import { buildStoryCards } from '../../logic/awards/story-cards';
import { cardArtSource } from '../../logic/card-art';
import { cardCitationView } from '../../logic/library/card-citation';
import { storyCoverArt } from '../../logic/story/scene-view';
import type { AwardWorld } from '../../logic/awards/types';
import { playableEpisodes } from '../../logic/next-quest';
import { awardWorld } from '../award-world';
import { episodesAll } from '../episodes';
import { heritageCardsAll, stage1Cards, stage2Cards, stage4Cards } from '../heritage-cards';
import { questsAll } from '../quests';
import { heldStoryCards, storiesAll, storyById } from '../stories';
import { heldSetCardIds, heldStoryCardIds, storyCards, storySets } from '../story-cards';
import { storySetDefs } from '../story-sets';

/**
 * Card award integrity (F-STORY-006 §5, T-AWARD-1..5): CI fails when a card
 * can never be earned, when an episode's reward list and the cards' rules
 * disagree, or when two cards share a Korean word.
 */
const world: AwardWorld = awardWorld;
const PROFILE = { createdAt: '2026-09-01T00:00:00.000Z' };
const AT = '2026-09-10T00:00:00.000Z';

/**
 * The cards T-AWARD-1..3 hold to "can still fire": all of them except the
 * cards of held stories and the set cards with a held member, which by
 * design can no longer be earned and stay only for the learners who own them
 * (rule 1, §3.8 "Reviewed only").
 */
const notHeld = (held: readonly string[]) => (c: HeritageCard): boolean => !held.includes(c.id);
const earnable: readonly HeritageCard[] = heritageCardsAll.filter(notHeld([...heldStoryCardIds, ...heldSetCardIds]));

const episodeById = new Map(episodesAll.map((e) => [e.id, e]));
const questIds = new Set(questsAll.map((q) => q.id));
const episodeOfQuest = new Map(episodesAll.flatMap((e) => e.questIds.map((q) => [q, e] as const)));

function finished(ids: readonly string[], stars: 1 | 2 | 3, episodes: readonly Episode[] = episodesAll): ProgressSnapshot {
  const episodeOf = episodes === episodesAll ? episodeOfQuest : new Map(episodes.flatMap((e) => e.questIds.map((q) => [q, e] as const)));
  return {
    profileId: 'profile:a',
    updatedAt: AT,
    episodes: [],
    quests: ids.map((questId) => ({ questId, episodeId: episodeOf.get(questId)?.id ?? '', startedAt: AT, completedAt: AT, stars, attempts: 1, accuracy: 1 })),
    cards: [],
    sessions: [],
    homework: [],
    reviews: [],
    streakDays: 0,
  };
}

/**
 * Every episode a learner can play: the playable grid episodes and the shelf
 * story episodes (F-STORY-004 §3.1), whose quests award the story cards.
 */
function offeredEpisodes(episodes: readonly Episode[]): Episode[] {
  const shelf = episodes.filter((e) => e.placement === 'shelf' && (e.status === 'shipped' || e.status === 'ready'));
  return [...playableEpisodes(episodes), ...shelf];
}

/** T-AWARD-1 over a world: each card in `cards` is listed to a learner who owns nothing, and finishing every playable quest at 1 star earns it. */
function expectEarnable(w: AwardWorld, cards: readonly HeritageCard[]): void {
  const listed = new Set(obtainableCards(w, new Set()).map((c) => c.id));
  expect(cards.map((c) => c.id).filter((id) => !listed.has(id))).toEqual([]);
  const all = offeredEpisodes(w.episodes).flatMap((e) => e.questIds);
  const earned = new Set(derivedAwards(w, finished(all, 1, w.episodes), PROFILE).map((a) => a.cardId));
  expect(cards.map((c) => c.id).filter((id) => !earned.has(id))).toEqual([]);
}

describe('card award integrity (F-STORY-006 T-AWARD-1..5)', () => {
  it('every shipped card parses, including the tightened unlockedBy grammar', () => {
    expect(() => HeritageCardListSchema.parse(heritageCardsAll)).not.toThrow();
  });

  it('T-AWARD-1: every card in heritageCardsAll has a rule that can still fire', () => {
    const hidden = earnable.map((c) => c.id).filter((id) => !obtainableCards(world, new Set()).some((c) => c.id === id));
    expect(hidden).toEqual([]);
  });

  it('T-AWARD-1: finishing every playable quest, even at 1 star, earns every card', () => {
    const all = offeredEpisodes(episodesAll).flatMap((e) => e.questIds);
    const earned = new Set(derivedAwards(world, finished(all, 1), PROFILE).map((a) => a.cardId));
    expect(earnable.map((c) => c.id).filter((id) => !earned.has(id))).toEqual([]);
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
    for (const card of earnable) {
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
    for (const card of earnable) {
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
    // The printed source line never shows a web address, and keeps a name (§3.8, card-source-address-only).
    const line = cardCitationView(card, citationMessages)?.line ?? '';
    expect(line, card.id).not.toMatch(WEB_ADDRESS);
    expect(line, card.id).not.toMatch(/Source: ,|, $/);
  }
}

const citationMessages = getMessages('en').learner.cardDetail.citation;

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

/** The set cards' Korean words: a story card must not take one, even before its set is complete. */
const setHeadwords = storySetDefs.map((d) => ({ id: d.cardId, subtitleKo: d.headword.ko }));

/** What the bundle keeps of `story` once it is held: the generator's own entry (`build-stories.mjs` heldStoryCards). */
function heldOf(story: Story): HeldStoryCard {
  const [held] = heldStoryCardsOf([{ ...structuredClone(story), state: 'draft' }]);
  if (!held) throw new Error(`${story.id} keeps no held card`);
  return held;
}

const REPO = join(__dirname, '../../../../..');
const FIXTURE_DIR = join(REPO, 'packages/content-schema/src/__fixtures__/story');

describe('heritage story cards (F-STORY-006 T-AWARD-6, T-AWARD-7)', () => {
  it('the bundle holds one card per reviewed shelf story with a card block (none until 6.8), and every set is complete', () => {
    const carded = storiesAll.filter((s) => s.state === 'ready' && s.shelf !== undefined && s.card !== undefined);
    const built = storyCards.filter((c) => c.storyId !== undefined && !heldStoryCardIds.includes(c.id));
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
      heritageCardsAll.filter((c) => c.storyId !== undefined && !heldStoryCardIds.includes(c.id)),
      storiesAll,
    );
  });

  it('a held story keeps its card with no fact and no citation, and the card can no longer be earned (rule 1, Behaviour #10)', () => {
    expect(heldStoryCardIds).toEqual(heldStoryCards.map((h) => storyCardId(h.storyId)));
    for (const id of heldStoryCardIds) {
      const card = heritageCardsAll.find((c) => c.id === id);
      expect(card, id).toBeDefined();
      expect([card?.factEn, card?.factId, card?.citation], id).toEqual([undefined, undefined, undefined]);
      expect(storiesAll.some((s) => s.id === card?.storyId), id).toBe(false);
      expect(obtainableCards(world, new Set()).some((c) => c.id === id), id).toBe(false);
      expect(obtainableCards(world, new Set([id])).some((c) => c.id === id), id).toBe(true);
    }
  });

  it('every bundled story with a card block passes the card lint rules, and no card repeats a Korean word', () => {
    for (const story of storiesAll) {
      expect(lintStory(story).filter((f) => CARD_RULE.test(f.rule) && f.level === 'error'), story.id).toEqual([]);
    }
    const others = [...handWritten, ...setHeadwords, ...heritageCardsAll.filter((c) => heldStoryCardIds.includes(c.id))];
    expect(lintStoryCorpus(storiesAll, { cards: others }).filter((f) => CARD_RULE.test(f.rule))).toEqual([]);
  });

  it('a story card that takes a set card word fails the corpus lint before its set is complete', () => {
    const [gimjang] = withProposedCards().filter((s) => s.id === 'story:gimjang-arirang');
    if (!gimjang?.card) throw new Error('story:gimjang-arirang is not bundled');
    gimjang.card = { ...gimjang.card, keywordId: 'arirang' };
    const found = lintStoryCorpus([gimjang], { cards: [...handWritten, ...setHeadwords] }).filter((f) => f.rule === 'card-korean-duplicate');
    expect(found.map((f) => f.message)).toEqual([expect.stringMatching(/card:story-gimjang-arirang.*아리랑.*card:set-seasons-tales/)]);
  });

  it('the e2e fixture bundle (build:web:fixtures) passes the card lint: its story cards repeat no Korean word', () => {
    const fixtures = ['valid.ready.json', 'valid.revised.json'].map((f) => parseStory(JSON.parse(readFileSync(join(FIXTURE_DIR, f), 'utf8')) as unknown));
    expect(fixtures.every((s) => s.state === 'ready' && s.card !== undefined)).toBe(true);
    const found = lintStoryCorpus([...storiesAll, ...fixtures], { cards: [...handWritten, ...setHeadwords] }).filter((f) => CARD_RULE.test(f.rule));
    expect(found).toEqual([]);
  });

  describe('with the 24 proposed card blocks applied to the bundled stories', () => {
    const stories = withProposedCards();
    const { cards, sets } = buildStoryCards(stories, storySetDefs);
    const all = [...handWritten, ...cards];

    it('T-AWARD-6: each of the 24 cards is sourced, verbatim and short enough', () => {
      expect(cards.filter((c) => c.storyId !== undefined)).toHaveLength(24);
      // Some first sources name their web address (heritage.go.kr, unesco.org): the card line drops it.
      expect(cards.filter((c) => c.citation !== undefined && WEB_ADDRESS.test(`${c.citation.publisher} ${c.citation.title}`)).length).toBeGreaterThan(0);
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
      expect(lintStoryCorpus(stories, { cards: [...handWritten, ...setHeadwords] }).filter((f) => f.rule === 'card-korean-duplicate')).toEqual([]);
    });

    /** The award world once these stories are on the shelf: one shipped shelf episode each, as the bundle builds them. */
    const shelfWorld = (shelved: readonly Story[], cardsOf: { cards: HeritageCard[]; sets: AwardWorld['sets'] }): AwardWorld => ({
      cards: [...handWritten, ...cardsOf.cards],
      episodes: [
        // The grid as shipped; the shelf is exactly the stories given here.
        ...episodesAll.filter((e) => e.placement !== 'shelf'),
        ...shelved.map((s) => ({
          ...episodesAll[0]!,
          id: `episode:shelf-${slugOf(s.id)}`,
          status: 'shipped' as const,
          questIds: [`quest:story-${slugOf(s.id)}-listen`],
          rewardCardIds: [storyCardId(s.id)],
        })),
      ],
      quests: questsAll,
      sets: cardsOf.sets,
    });

    it('T-AWARD-1 with the 70 cards: every one, set cards included, is listed and earned by finishing every quest', () => {
      const w = shelfWorld(stories, { cards, sets });
      expectEarnable(w, w.cards);
    });

    it('holding one story keeps its card, its set and the counts, and the Library shows it only to its owners (Behaviour #10)', () => {
      const heldId = 'story:sun-and-moon';
      const heldStory = stories.find((s) => s.id === heldId);
      if (!heldStory) throw new Error(`${heldId} is not bundled`);
      const kept = buildStoryCards(
        stories.filter((s) => s.id !== heldId),
        storySetDefs,
        [heldOf(heldStory)],
      );
      expect(kept.heldCardIds).toEqual(['card:story-sun-and-moon']);
      expect(kept.sets).toEqual(sets);
      const keptAll = [...handWritten, ...kept.cards];
      expect(keptAll.map((c) => c.id).sort()).toEqual(all.map((c) => c.id).sort());
      const words = keptAll.flatMap((c) => (c.subtitleKo === undefined ? [] : [c.subtitleKo]));
      expect(new Set(words).size).toBe(words.length);
      expect(() => HeritageCardListSchema.parse(keptAll)).not.toThrow();

      // The held story is a draft now: its shelf episode is gone with it.
      const heldWorld = shelfWorld(
        stories.filter((s) => s.id !== heldId),
        kept,
      );
      const listed = (owned: readonly string[]): string[] => obtainableCards(heldWorld, new Set(owned)).map((c) => c.id);
      expect(listed([])).not.toContain('card:story-sun-and-moon');
      expect(listed([])).not.toContain('card:set-seasons-tales');
      expect(listed([])).toContain('card:set-records-joseon');
      expect(listed(['card:story-sun-and-moon'])).toContain('card:story-sun-and-moon');
      expect(listed(['card:story-sun-and-moon'])).toContain('card:set-seasons-tales');
      expect(listed(['card:set-seasons-tales'])).toContain('card:set-seasons-tales');

      // T-AWARD-1 still holds during the hold: the held card and its set card are the only ones that cannot fire.
      expect(kept.heldSetCardIds).toEqual(['card:set-seasons-tales']);
      expectEarnable(heldWorld, keptAll.filter(notHeld([...kept.heldCardIds, ...kept.heldSetCardIds])));
      expect(() => expectEarnable(heldWorld, keptAll.filter(notHeld(kept.heldCardIds)))).toThrow(/card:set-seasons-tales/);
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
      // A member is a story file (bundled, or held as a draft: its set stays defined).
      for (const id of def.memberStoryIds) expect(existsSync(join(REPO, 'content/stories', `${slugOf(id)}.json`)), id).toBe(true);
    }
  });

  it("story-sets: each set's theme is its members' most common theme, a tie going to the first tied member in shelf order", () => {
    for (const def of storySetDefs) {
      const themes = def.memberStoryIds.map((id) => (JSON.parse(readFileSync(join(REPO, 'content/stories', `${slugOf(id)}.json`), 'utf8')) as { theme: ThemeKey }).theme);
      const count = (t: ThemeKey): number => themes.filter((x) => x === t).length;
      const top = Math.max(...themes.map(count));
      expect(def.theme, def.id).toBe(themes.find((t) => count(t) === top));
    }
  });
});

/**
 * The fact on a story card's back face says what the card names (F-STORY-001
 * PR 1.9 culture review; F-STORY-006 §3.8 as built), and reads as learner text
 * with no Hangul. "Names the subject" is checked as: the claim contains the
 * headword's romanization, or a word of four letters or more from the card
 * title (a trailing plural "s" dropped), case-insensitively.
 */
describe('story card facts name their subject (F-STORY-006 §3.8 as built)', () => {
  const HANGUL = /[ᄀ-ᇿ㄰-㆏가-힯]/;
  const namesSubject = (claim: string, titleEn: string, romanization: string): boolean => {
    const text = claim.toLowerCase();
    if (text.includes(romanization.toLowerCase())) return true;
    return titleEn
      .toLowerCase()
      .split(/[^a-z]+/)
      .filter((w) => w.length >= 4)
      .map((w) => w.replace(/s$/, ''))
      .some((w) => text.includes(w));
  };

  it('the check itself: a matching title word or romanization passes, an unrelated fact fails', () => {
    expect(namesSubject('Gimjang is the custom of making kimchi.', 'Making Winter Kimchi', 'gimjang')).toBe(true);
    expect(namesSubject('The five basic consonant letters were made...', 'Consonants', 'jaeum')).toBe(true);
    expect(namesSubject('Arirang exists in many regional versions.', 'Making Winter Kimchi', 'gimjang')).toBe(false);
    expect(namesSubject('Soil differs in dryness and dampness.', 'Rain Gauge', 'cheugugi')).toBe(false);
  });

  it('every bundled story card fact names the card subject and carries no Hangul', () => {
    const withCard = storiesAll.filter((s) => s.card);
    expect(withCard.length).toBeGreaterThan(0);
    for (const story of withCard) {
      const card = story.card;
      if (!card) continue;
      const keyword = story.keywords.find((k) => k.id === card.keywordId);
      const fact = story.facts.find((f) => f.id === card.factId);
      if (!keyword || !fact) throw new Error(`${story.id}: card keyword or fact does not resolve`);
      expect(namesSubject(fact.claimEn, card.titleEn, keyword.romanization), `${story.id} ${card.titleEn}: ${fact.id}`).toBe(true);
      expect(fact.claimEn, `${story.id}: ${fact.id}`).not.toMatch(HANGUL);
    }
  });
});

/**
 * F-STORY-006 PR 6.8: the story cards and set cards as reviewed. The 24 card
 * blocks and `rewardCardIds.listen` came with F-STORY-001 PR 1.9 (#506) and
 * its multi-agent language and culture review; 6.8 closes the row's two other
 * clauses: every story card's face is its cover scene cropped by `StoryScene`
 * (not the word fallback), and the four set names are pinned as reviewed.
 */
describe('reviewed story and set cards (F-STORY-006 6.8)', () => {
  // The same deps `CardArt.tsx` renders with: the design system's drawn ids and `storyById`.
  const deps = {
    drawnCardIds: supportedCardIds,
    storyCover: (storyId: string) => {
      const story = storyById(storyId);
      return story ? storyCoverArt(story) : null;
    },
    world: awardWorld,
  };

  it("every bundled story card's face is its story's cover scene, and every set card's face is its full plate", () => {
    const story = heritageCardsAll.filter((c) => c.storyId !== undefined);
    expect(story).toHaveLength(24);
    for (const card of story) {
      expect(supportedCardIds, card.id).not.toContain(card.id);
      const src = cardArtSource(card, deps);
      expect(src.kind, card.id).toBe('cover');
      // A cover with nothing to draw would pass on kind alone: it names a backdrop and its alt text.
      if (src.kind === 'cover') expect([src.art.setting, src.art.altEn.length > 0], card.id).toEqual([expect.stringMatching(/^scene:/), true]);
    }
    const sets = heritageCardsAll.filter((c) => c.unlockedBy.startsWith('set:'));
    expect(sets).toHaveLength(4);
    for (const card of sets) {
      const src = cardArtSource(card, deps);
      expect(src.kind, card.id).toBe('plate');
      const def = storySetDefs.find((d) => d.cardId === card.id);
      const expected = (def?.memberStoryIds ?? []).map((id) => storyCardId(id));
      expect(expected, card.id).toHaveLength(6);
      if (src.kind === 'plate') expect(src.members.map((m) => m.id), card.id).toEqual(expected);
    }
  });

  /**
   * The set names after the 6.8 review (language and culture lenses, recorded
   * in the spec's 6.8 as-built note). The Hangul and Printing set holds two
   * woodblock stories (Tripitaka Koreana, Janggyeong Panjeon), so its card
   * names printing (inswae), not movable type (hwalja), which only the Jikji story is about.
   */
  const REVIEWED_SETS: ReadonlyArray<readonly [cardId: string, titleEn: string, romanization: string, gloss: string]> = [
    ['card:set-records-joseon', 'Record', 'girok', 'record'],
    ['card:set-hangul-printing', 'Printing', 'inswae', 'printing'],
    ['card:set-science-art-life', 'Treasure', 'bomul', 'treasure'],
    ['card:set-seasons-tales', 'Arirang', 'arirang', 'Arirang (a folk song)'],
  ];

  it('the four set cards carry their reviewed names', () => {
    expect(storySetDefs.map((d) => [d.cardId, d.titleEn, d.headword.romanization, d.headword.en])).toEqual(REVIEWED_SETS);
    for (const [cardId, titleEn, romanization] of REVIEWED_SETS) {
      const card = heritageCardsAll.find((c) => c.id === cardId);
      expect([card?.titleEn, card?.romanization], cardId).toEqual([titleEn, romanization]);
    }
  });
});

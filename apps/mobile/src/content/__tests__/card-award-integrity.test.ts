import { HeritageCardListSchema, type ProgressSnapshot, type StageKey } from '@hangul-route/content-schema';
import { describe, expect, it } from 'vitest';
import { derivedAwards, missingAwards, stageCanComplete } from '../../logic/awards/derive';
import { obtainableCards } from '../../logic/awards/obtainable';
import { parseUnlockedBy } from '../../logic/awards/rules';
import type { AwardWorld } from '../../logic/awards/types';
import { playableEpisodes } from '../../logic/next-quest';
import { episodesAll } from '../episodes';
import { heritageCardsAll } from '../heritage-cards';
import { questsAll } from '../quests';

/**
 * Card award integrity (F-STORY-006 §5, T-AWARD-1..5): CI fails when a card
 * can never be earned, when an episode's reward list and the cards' rules
 * disagree, or when two cards share a Korean word.
 */
const world: AwardWorld = { cards: heritageCardsAll, episodes: episodesAll, quests: questsAll, sets: [] };
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

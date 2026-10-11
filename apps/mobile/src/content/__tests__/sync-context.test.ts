import { JourneySummarySchema, type ProgressSnapshot } from '@hangul-route/content-schema';
import { describe, expect, it } from 'vitest';
import { isStagePlayable } from '../../logic/entitlement';
import { scopeFor } from '../../logic/minigame-config';
import { journeySummaryOf } from '../../logic/my-route/summary';
import { STAGE1_QUESTS, questTeaches } from '../../logic/stage1/curriculum';
import { episodesAll } from '../episodes';
import { jamoAll } from '../jamo';
import { questsAll } from '../quests';
import { journeyContent, questJamo, stage1QuestIds } from '../sync-context';

const charOf = new Map(jamoAll.map((j) => [j.id, j.char]));

/**
 * The grown-up summary (`jamoRecognized`, `needsPractice`) credits a finished quest with
 * what it teaches: the Discover symbols of a rebuilt quest (F-QUEST-002 Q-6a), never the
 * review symbols its practice, apply or Check scopes also ask.
 */
describe('questJamo: the symbols each Stage 1 quest teaches', () => {
  it('lists every Stage 1 quest', () => {
    expect(Object.keys(questJamo).sort()).toEqual([...stage1QuestIds].sort());
  });

  it('credits letters q1-q3 with their Discover symbols only', () => {
    expect(questJamo['quest:stage1-letters-q1']).toEqual(['ㅏ', 'ㅓ', 'ㄱ', 'ㄴ']);
    expect(questJamo['quest:stage1-letters-q2']).toEqual(['ㅗ', 'ㅜ', 'ㅁ', 'ㅇ']);
    expect(questJamo['quest:stage1-letters-q3']).toEqual(['ㅡ', 'ㅣ', 'ㄷ', 'ㄹ']);
  });

  it('falls back to the scope symbols for a quest without a Discover step yet', () => {
    const notRebuilt = STAGE1_QUESTS.filter((q) => questTeaches(q).length === 0);
    expect(notRebuilt.length).toBeGreaterThan(0);
    for (const quest of notRebuilt) {
      const fromScopes = new Set(
        quest.steps.flatMap((step) => (step.minigameRef ? scopeFor(step.minigameRef)?.jamoIds ?? [] : [])).map((id) => charOf.get(id)),
      );
      expect(new Set(questJamo[quest.id])).toEqual(fromScopes);
    }
  });
});

/**
 * `summary.journey` over the shipped bundle (F-ROUTE-001 R-8). `journeySummaryOf` swallows
 * errors so a sync never blocks; this guard makes a bundle change that breaks My route fail CI
 * instead of silently dropping the console strip for every learner.
 */
describe('journeyContent: summary.journey over the live bundle', () => {
  const now = new Date('2026-10-11T00:00:00.000Z');
  const snapshot = (questIds: readonly string[]): ProgressSnapshot => ({
    profileId: 'profile:smoke',
    updatedAt: now.toISOString(),
    episodes: [],
    quests: questIds.map((questId) => ({
      questId,
      episodeId: episodesAll.find((e) => e.questIds.includes(questId))?.id ?? 'episode:unknown',
      startedAt: now.toISOString(),
      completedAt: now.toISOString(),
      stars: 1,
      attempts: 1,
      accuracy: 1,
    })),
    cards: [],
    sessions: [],
    homework: [],
    reviews: [],
    streakDays: 0,
  });

  it('binds the one route predicate, never its own rule', () => {
    expect(journeyContent.isEntitled).toBe(isStagePlayable);
  });

  it('gives a journey for an empty learner and for one who finished every quest', () => {
    for (const snap of [snapshot([]), snapshot(questsAll.map((q) => q.id))]) {
      const journey = journeySummaryOf(snap, journeyContent, now);
      expect(journey).toBeDefined();
      expect(JourneySummarySchema.parse(journey)).toEqual(journey);
      expect(journey?.stages).toHaveLength(7);
    }
    expect(journeySummaryOf(snapshot([]), journeyContent, now)?.here).toBe('stage1');
  });
});

import { JourneySummarySchema, type ProgressSnapshot } from '@hangul-route/content-schema';
import { describe, expect, it } from 'vitest';
import { isStagePlayable } from '../../logic/entitlement';
import { journeySummaryOf } from '../../logic/my-route/summary';
import { STAGE1_QUESTS, questTeaches } from '../../logic/stage1/curriculum';
import { episodesAll } from '../episodes';
import { jamoAll } from '../jamo';
import { questsAll } from '../quests';
import { journeyContent, questJamo, stage1QuestIds } from '../sync-context';

const charOf = new Map(jamoAll.map((j) => [j.id, j.char]));

/**
 * The grown-up summary (`jamoRecognized`, `needsPractice`) credits a finished quest with
 * what it teaches: its Discover symbols (F-QUEST-002 Q-6a), never the review symbols its
 * practice, apply or Check scopes also ask. Since Q-8 every Stage 1 quest has a Discover
 * step, so the five reading quests (R5) credit no letter. A final is credited as its
 * letter (one compatibility jamo, the shape `needsPractice` consumers read).
 */
describe('questJamo: the symbols each Stage 1 quest teaches', () => {
  it('lists every Stage 1 quest: all 15, so the summary counts 15', () => {
    expect(Object.keys(questJamo).sort()).toEqual([...stage1QuestIds].sort());
    expect(stage1QuestIds).toHaveLength(15);
  });

  it('credits letters q1-q3 with their Discover symbols only', () => {
    expect(questJamo['quest:stage1-letters-q1']).toEqual(['ㅏ', 'ㅓ', 'ㄱ', 'ㄴ']);
    expect(questJamo['quest:stage1-letters-q2']).toEqual(['ㅗ', 'ㅜ', 'ㅁ', 'ㅇ']);
    expect(questJamo['quest:stage1-letters-q3']).toEqual(['ㅡ', 'ㅣ', 'ㄷ', 'ㄹ']);
  });

  it('credits every Stage 1 quest with exactly its Discover symbols, a final as its letter', () => {
    for (const quest of STAGE1_QUESTS) {
      expect(quest.steps.some((s) => s.kind === 'discover'), quest.id).toBe(true);
      expect(questJamo[quest.id], quest.id).toEqual([...new Set(questTeaches(quest).map((id) => charOf.get(id)))]);
    }
    expect(questJamo['quest:stage1-rites-q1']).toEqual(['ㄴ', 'ㄹ']);
    expect(questJamo['quest:stage1-nature-q1']).toEqual(['ㅁ', 'ㅂ']);
  });

  it('credits no letter for the reading quests 11-15, whatever their games ask (the quest 12 trace asks four finals)', () => {
    for (const id of ['nature-q2', 'nature-q3', 'crafts-q1', 'crafts-q2', 'crafts-q3']) {
      expect(questJamo[`quest:stage1-${id}`], id).toEqual([]);
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

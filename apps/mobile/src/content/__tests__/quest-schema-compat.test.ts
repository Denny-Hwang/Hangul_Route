import { JamoSchema, QuestSchema } from '@hangul-route/content-schema';
import { describe, expect, it } from 'vitest';
import { jamoAll } from '../jamo';
import { questsAll, stage1Quests, stage2Quests, stage4Quests } from '../quests';

/**
 * F-QUEST-002 Q-1: the quest schema grew (discover / check, teaserEn) and must
 * stay additive. Every shipped quest, and every jamo, still parses unchanged.
 * (Until now no test parsed app content with the schema, audit story-mode #1.)
 */
describe('shipped content still parses after the F-QUEST-002 schema changes', () => {
  it('has Stage 1, Stage 2 and Stage 4 quests to check', () => {
    expect(stage1Quests.length).toBeGreaterThan(0);
    expect(stage2Quests.length).toBeGreaterThan(0);
    expect(stage4Quests.length).toBeGreaterThan(0);
    expect(questsAll).toHaveLength(stage1Quests.length + stage2Quests.length + stage4Quests.length);
  });

  it.each(questsAll.map((q) => [q.id, q] as const))('%s passes QuestSchema', (_id, quest) => {
    const result = QuestSchema.safeParse(quest);
    expect(result.success, result.success ? '' : JSON.stringify(result.error.issues)).toBe(true);
  });

  it('adds no discover or check step to a shipped quest (content lands in later PRs)', () => {
    for (const quest of questsAll) {
      for (const step of quest.steps) {
        expect(['discover', 'check']).not.toContain(step.kind);
      }
    }
  });

  it.each(jamoAll.map((j) => [j.id, j] as const))('%s passes JamoSchema', (_id, jamo) => {
    expect(JamoSchema.safeParse(jamo).success).toBe(true);
  });
});

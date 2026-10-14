import { JamoSchema, QuestSchema } from '@hangul-route/content-schema';
import { describe, expect, it } from 'vitest';
import { bookQuests } from '../books';
import { lessonQuests } from '../lessons';
import { jamoAll } from '../jamo';
import { questsAll, stage1Quests, stage2Quests, stage4Quests } from '../quests';
import { storyQuests } from '../stories';

/**
 * F-QUEST-002 Q-1: the quest schema grew (discover / check, teaserEn) and must
 * stay additive. Every shipped quest, and every jamo, still parses unchanged.
 * (Until now no test parsed app content with the schema, audit story-mode #1.)
 */
describe('shipped content still parses after the F-QUEST-002 schema changes', () => {
  it('has Stage 1, Stage 2 and Stage 4 quests to check, plus the generated story, book and lesson quests', () => {
    expect(stage1Quests.length).toBeGreaterThan(0);
    expect(stage2Quests.length).toBeGreaterThan(0);
    expect(stage4Quests.length).toBeGreaterThan(0);
    expect(questsAll).toHaveLength(
      stage1Quests.length + stage2Quests.length + stage4Quests.length + storyQuests.length + bookQuests.length + lessonQuests.length,
    );
  });

  it.each(questsAll.map((q) => [q.id, q] as const))('%s passes QuestSchema', (_id, quest) => {
    const result = QuestSchema.safeParse(quest);
    expect(result.success, result.success ? '' : JSON.stringify(result.error.issues)).toBe(true);
  });

  it('adds discover and check steps only to Stage 1 and the upper-stage lesson quests; the Stage 2 and Stage 4 tastes keep five steps and present', () => {
    // F-CURR-001 lesson cells (generated) have the six-step shape of F-QUEST-002 R4 too.
    const sixSteps = new Set([...stage1Quests, ...lessonQuests].map((q) => q.id));
    for (const quest of questsAll) {
      if (sixSteps.has(quest.id)) continue;
      for (const step of quest.steps) expect(['discover', 'check'], `${quest.id}/${step.id}`).not.toContain(step.kind);
    }
    for (const quest of [...stage2Quests, ...stage4Quests]) {
      expect(quest.steps.map((s) => s.kind), quest.id).toEqual(['intro', 'present', 'practice', 'apply', 'reward']);
    }
  });

  it('rebuilds letters q1-q3 with a Discover and a Check step (F-QUEST-002 Q-6a)', () => {
    for (const id of ['quest:stage1-letters-q1', 'quest:stage1-letters-q2', 'quest:stage1-letters-q3']) {
      const kinds = stage1Quests.find((q) => q.id === id)?.steps.map((s) => s.kind);
      expect(kinds, id).toContain('discover');
      expect(kinds, id).toContain('check');
    }
  });

  it.each(jamoAll.map((j) => [j.id, j] as const))('%s passes JamoSchema', (_id, jamo) => {
    expect(JamoSchema.safeParse(jamo).success).toBe(true);
  });
});

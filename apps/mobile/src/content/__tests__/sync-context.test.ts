import { describe, expect, it } from 'vitest';
import { scopeFor } from '../../logic/minigame-config';
import { STAGE1_QUESTS, questTeaches } from '../../logic/stage1/curriculum';
import { jamoAll } from '../jamo';
import { questJamo, stage1QuestIds } from '../sync-context';

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

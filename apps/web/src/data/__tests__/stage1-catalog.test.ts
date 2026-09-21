import { describe, expect, it } from 'vitest';
import { catalogLabel, questsOf, stage1Episodes, stage1Quests } from '../stage1-catalog';

describe('stage1 catalog mirror (F-PLAN-001 §3.5)', () => {
  it('has well-formed ids and every episode quest exists', () => {
    const questIds = new Set(stage1Quests.map((q) => q.id));
    expect(stage1Quests.every((q) => /^quest:stage1-[a-z0-9-]+$/.test(q.id))).toBe(true);
    for (const e of stage1Episodes) {
      expect(e.id).toMatch(/^episode:stage1-[a-z]+$/);
      for (const id of e.questIds) expect(questIds.has(id)).toBe(true);
    }
    expect(stage1Episodes.map((e) => e.order)).toEqual([1, 2, 3, 4, 5]);
  });

  it('labels items and lists an episode\'s quests', () => {
    expect(catalogLabel('quest', 'quest:stage1-letters-q1')).toBe('Meet g, n, d, l');
    expect(catalogLabel('episode', 'episode:stage1-letters')).toBe('Meet the Letters (3 quests)');
    expect(catalogLabel('episode', 'episode:stage1-rites')).toBe('New Year & Festivals (1 quest)');
    expect(catalogLabel('quest', 'quest:nope')).toBe('quest:nope');
    expect(catalogLabel('episode', 'episode:nope')).toBe('episode:nope');
    expect(questsOf('episode:stage1-life').map((q) => q.id)).toEqual(['quest:stage1-life-q1', 'quest:stage1-life-q2']);
    expect(questsOf('episode:nope')).toEqual([]);
  });
});

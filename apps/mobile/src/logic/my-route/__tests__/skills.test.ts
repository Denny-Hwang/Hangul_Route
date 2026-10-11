import { describe, expect, it } from 'vitest';
import { MinigameKindSchema } from '@hangul-route/content-schema';
import { questsAll } from '../../../content/quests';
import { SKILLS, SKILL_OF_KIND, SKILL_THRESHOLDS, TILE_KINDS, marksFor, questSkills, skillRows, tilesCount } from '../skills';
import { BUNDLE_8, quest } from './fixtures/bundle-2026-10';

const ALL_8 = new Set(BUNDLE_8.quests.map((q) => q.id));

describe('SKILL_OF_KIND (F-ROUTE-001 section 3.7, OD-5 default)', () => {
  it('maps every minigame kind, so a new kind fails until it is mapped', () => {
    expect(Object.keys(SKILL_OF_KIND).sort()).toEqual([...MinigameKindSchema.options].sort());
  });

  it('pins the default mapping', () => {
    expect(SKILL_OF_KIND['match-sound']).toEqual(['read', 'listen']);
    expect(SKILL_OF_KIND['tap-respond']).toEqual(['read', 'listen']);
    expect(SKILL_OF_KIND['listen-pick']).toEqual(['listen']);
    for (const kind of ['match-shape', 'odd-one-out', 'pic-word-match', 'story-read'] as const) expect(SKILL_OF_KIND[kind]).toEqual(['read']);
    expect(SKILL_OF_KIND['trace-stroke']).toEqual(['write']);
    for (const kind of ['build-letter', 'syllable-build', 'card-match', 'culture-quiz', 'story-sequence', 'story-check', 'tap-rhythm', 'order-it'] as const)
      expect(SKILL_OF_KIND[kind]).toEqual([]);
  });

  it('tracks no speaking: voice-echo maps to none and no skill is called speak', () => {
    expect(SKILL_OF_KIND['voice-echo']).toEqual([]);
    expect(SKILLS).toEqual(['read', 'listen', 'write']);
  });

  it('counts tiles separately (grown-up "Spelling with tiles")', () => {
    expect([...TILE_KINDS].sort()).toEqual(['build-letter', 'syllable-build']);
  });
});

describe('marksFor', () => {
  it('counts the thresholds [1, 2, 4, 6, 8] reached', () => {
    expect(SKILL_THRESHOLDS).toEqual([1, 2, 4, 6, 8]);
    expect([0, 1, 2, 3, 4, 5, 6, 7, 8, 30].map(marksFor)).toEqual([0, 1, 2, 2, 3, 3, 4, 4, 5, 5]);
  });
});

describe('skillRows on the frozen 8-quest bundle', () => {
  it('Appendix C: letters q1-q3 and life q1 done', () => {
    const finished = new Set(['quest:stage1-letters-q1', 'quest:stage1-letters-q2', 'quest:stage1-letters-q3', 'quest:stage1-life-q1']);
    expect(skillRows({ finished, open: ALL_8, quests: BUNDLE_8.quests })).toEqual([
      { skill: 'read', marks: 3, nextReachable: true, quests: 4 },
      { skill: 'listen', marks: 3, nextReachable: true, quests: 4 },
      { skill: 'write', marks: 1, nextReachable: false, quests: 1 },
    ]);
    expect(tilesCount(finished, BUNDLE_8.quests)).toBe(2);
  });

  it('everything done: read and listen in 8 quests, write in 1, tiles in 4', () => {
    const rows = skillRows({ finished: ALL_8, open: ALL_8, quests: BUNDLE_8.quests });
    expect(rows.map((r) => [r.skill, r.quests, r.marks, r.nextReachable])).toEqual([
      ['read', 8, 5, false],
      ['listen', 8, 5, false],
      ['write', 1, 1, false],
    ]);
    expect(tilesCount(ALL_8, BUNDLE_8.quests)).toBe(4);
  });

  it('a new learner: zero quests, no slots, next reachable where content exists', () => {
    const rows = skillRows({ finished: new Set(), open: ALL_8, quests: BUNDLE_8.quests });
    expect(rows.map((r) => [r.quests, r.marks, r.nextReachable])).toEqual([
      [0, 0, true],
      [0, 0, true],
      [0, 0, true],
    ]);
    expect(skillRows({ finished: new Set(), open: new Set(), quests: BUNDLE_8.quests }).every((r) => !r.nextReachable)).toBe(true);
  });

  it('counts a finished quest that is no longer open, and ignores ids the bundle does not hold', () => {
    const finished = new Set(['quest:stage1-letters-q2', 'quest:gone']);
    const rows = skillRows({ finished, open: new Set(), quests: BUNDLE_8.quests });
    expect(rows.find((r) => r.skill === 'write')).toEqual({ skill: 'write', marks: 1, nextReachable: false, quests: 1 });
  });

  it('counts a quest once whatever number of matching steps it has', () => {
    expect([...questSkills(quest('quest:x', 'X', ['match-sound', 'match-sound', 'listen-pick']))].sort()).toEqual(['listen', 'read']);
    expect([...questSkills({ steps: [{ id: 'a', kind: 'intro', titleEn: 'A' }] })]).toEqual([]);
  });
});

describe('invariant on the live bundle (no counts pinned)', () => {
  it('never shows a next slot that the open content cannot fill', () => {
    const open = new Set(questsAll.map((q) => q.id));
    for (let n = 0; n <= questsAll.length; n += 1) {
      const finished = new Set(questsAll.slice(0, n).map((q) => q.id));
      for (const row of skillRows({ finished, open, quests: questsAll })) {
        const counting = questsAll.filter((q) => questSkills(q).has(row.skill)).length;
        if (row.nextReachable) expect(counting).toBeGreaterThanOrEqual(SKILL_THRESHOLDS[row.marks] as number);
      }
    }
  });
});

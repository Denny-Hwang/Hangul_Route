import { describe, expect, it } from 'vitest';
import {
  DEFAULT_LEARNER_LEVEL,
  LEARNER_LEVELS,
  LEARNER_LEVEL_IDS,
  LearnerLevelIdSchema,
  LearnerTypeSchema,
  isLearnerLevelId,
  levelDescription,
  levelLabel,
  levelOrder,
} from '../index';

describe('LEARNER_LEVELS (F-LEARN-001 §3.1)', () => {
  it('has exactly the three opaque ids, in order', () => {
    expect([...LEARNER_LEVEL_IDS]).toEqual(['5-7', '8-9', '10-11']);
    expect(LEARNER_LEVELS.map((l) => l.id)).toEqual(['5-7', '8-9', '10-11']);
    expect(LEARNER_LEVELS.map((l) => l.order)).toEqual([0, 1, 2]);
  });

  it('labels read as reading levels, never ages', () => {
    expect(LEARNER_LEVELS.map((l) => l.label)).toEqual(['Pictures first', 'Some reading', 'Reads easily']);
    for (const l of LEARNER_LEVELS) {
      expect(l.label).not.toMatch(/\bage/i);
      expect(l.description.length).toBeGreaterThan(0);
    }
  });

  it('defaults to the middle level', () => {
    expect(DEFAULT_LEARNER_LEVEL).toBe('8-9');
  });
});

describe('level helpers', () => {
  it('isLearnerLevelId narrows known ids only', () => {
    for (const id of LEARNER_LEVEL_IDS) expect(isLearnerLevelId(id)).toBe(true);
    expect(isLearnerLevelId('12-14')).toBe(false);
    expect(isLearnerLevelId('')).toBe(false);
    expect(isLearnerLevelId(7)).toBe(false);
    expect(isLearnerLevelId(undefined)).toBe(false);
  });

  it('levelLabel / levelDescription / levelOrder resolve each id', () => {
    expect(levelLabel('5-7')).toBe('Pictures first');
    expect(levelLabel('8-9')).toBe('Some reading');
    expect(levelLabel('10-11')).toBe('Reads easily');
    expect(levelDescription('5-7')).toBe('Big tiles and pictures, very little to read.');
    expect(levelDescription('8-9')).toBe('Short words and short sentences.');
    expect(levelDescription('10-11')).toBe('Longer text, stories and conversations.');
    expect(levelOrder('5-7')).toBe(0);
    expect(levelOrder('8-9')).toBe(1);
    expect(levelOrder('10-11')).toBe(2);
  });

  it('returns null for an id this build does not know', () => {
    for (const bad of ['12-14', '']) {
      expect(levelLabel(bad)).toBeNull();
      expect(levelDescription(bad)).toBeNull();
      expect(levelOrder(bad)).toBeNull();
    }
  });

  it('does not resolve Object.prototype keys', () => {
    expect(levelLabel('constructor')).toBeNull();
    expect(levelOrder('__proto__')).toBeNull();
  });
});

describe('schemas', () => {
  it('LearnerLevelIdSchema accepts the three ids only', () => {
    for (const id of LEARNER_LEVEL_IDS) expect(LearnerLevelIdSchema.parse(id)).toBe(id);
    expect(LearnerLevelIdSchema.safeParse('12-14').success).toBe(false);
  });

  it('LearnerTypeSchema is child | self and rejects others', () => {
    expect(LearnerTypeSchema.parse('child')).toBe('child');
    expect(LearnerTypeSchema.parse('self')).toBe('self');
    expect(LearnerTypeSchema.safeParse('adult').success).toBe(false);
    expect(LearnerTypeSchema.safeParse(undefined).success).toBe(false);
  });
});

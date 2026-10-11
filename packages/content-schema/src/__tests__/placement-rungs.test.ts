import { describe, expect, it } from 'vitest';
import {
  IDLE_PAUSE_MS,
  QUESTIONS_PER_RUNG,
  RUNG_SYMBOLS,
  RUNG_TABLE,
  STRAND_GATES,
  backstopMs,
  questionCap,
  strandOfGate,
  PLACEMENT_GATES,
  PlacementStrandSchema,
} from '..';

describe('RUNG_SYMBOLS', () => {
  it('holds the 30 symbol keys of the F-QUEST-002 accounting (12 + 12 + 6), once each', () => {
    expect(RUNG_SYMBOLS.basic).toHaveLength(12);
    expect(RUNG_SYMBOLS.rest).toHaveLength(12);
    expect(RUNG_SYMBOLS.finals).toHaveLength(6);
    const all = [...RUNG_SYMBOLS.basic, ...RUNG_SYMBOLS.rest, ...RUNG_SYMBOLS.finals];
    expect(new Set(all).size).toBe(30);
  });

  it('writes finals as "<consonant>/final" and nothing else', () => {
    expect(RUNG_SYMBOLS.finals.every((k) => k.endsWith('/final'))).toBe(true);
    expect([...RUNG_SYMBOLS.basic, ...RUNG_SYMBOLS.rest].some((k) => k.includes('/'))).toBe(false);
  });
});

describe('RUNG_TABLE', () => {
  it('lists the seven rungs in asking order, one row per gate', () => {
    expect(RUNG_TABLE.map((r) => r.gate)).toEqual([...PLACEMENT_GATES]);
    expect(RUNG_TABLE).toHaveLength(7);
  });

  it('maps every gate to its strand and forms (spec 3.4)', () => {
    const row = (gate: string) => RUNG_TABLE.find((r) => r.gate === gate);
    expect(row('recog')).toMatchObject({ strand: 'hangul-recognition', forms: ['decode'] });
    expect(row('sound-basic')).toMatchObject({ strand: 'sound-letter', forms: ['decode'] });
    expect(row('sound-rest')).toMatchObject({ strand: 'sound-letter', forms: ['decode'] });
    expect(row('syl-cv')).toMatchObject({ strand: 'syllable-reading', forms: ['decode'] });
    expect(row('syl-cvc')).toMatchObject({ strand: 'syllable-reading', forms: ['decode'] });
    expect(row('vocab')).toMatchObject({ strand: 'vocabulary', forms: ['read', 'oral'] });
    expect(row('sentence')).toMatchObject({ strand: 'sentences', forms: ['read', 'oral'] });
  });

  it('strandOfGate and STRAND_GATES agree with the table and cover all five strands', () => {
    for (const r of RUNG_TABLE) expect(strandOfGate(r.gate)).toBe(r.strand);
    expect(Object.keys(STRAND_GATES).sort()).toEqual([...PlacementStrandSchema.options].sort());
    expect(STRAND_GATES['sound-letter']).toEqual(['sound-basic', 'sound-rest']);
    expect(STRAND_GATES['syllable-reading']).toEqual(['syl-cv', 'syl-cvc']);
  });
});

describe('limits', () => {
  it('asks three questions per rung and pauses after 45 seconds of no touch', () => {
    expect(QUESTIONS_PER_RUNG).toBe(3);
    expect(IDLE_PAUSE_MS).toBe(45_000);
  });

  it('quick is at most 15 questions and 4 minutes, full 21 and 6 minutes; take-my-time has no clock', () => {
    expect(questionCap('quick')).toBe(15);
    expect(questionCap('full')).toBe(21);
    expect(backstopMs('quick', false)).toBe(240_000);
    expect(backstopMs('full', false)).toBe(360_000);
    expect(backstopMs('quick', true)).toBeNull();
    expect(backstopMs('full', true)).toBeNull();
  });
});

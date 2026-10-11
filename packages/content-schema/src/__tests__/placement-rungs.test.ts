import { describe, expect, it } from 'vitest';
import {
  IDLE_PAUSE_MS,
  QUESTIONS_PER_RUNG,
  RUNG_SYMBOLS,
  RUNG_TABLE,
  STRAND_GATES,
  DEEP_REST_AT,
  LISTEN_FIRST_FORMATS,
  PLACEMENT_MODES,
  PlacementModeSchema,
  backstopMs,
  drawsFor,
  legacyLengthOf,
  modeCeiling,
  modeOf,
  passAtFor,
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

  it('Short has no cap label and no clock; Standard 24 and 10 minutes; Deep 42 and 20 minutes; take-my-time has no clock', () => {
    expect(questionCap('short')).toBeNull();
    expect(questionCap('standard')).toBe(24);
    expect(questionCap('deep')).toBe(42);
    expect(backstopMs('short', false)).toBeNull();
    expect(backstopMs('standard', false)).toBe(600_000);
    expect(backstopMs('deep', false)).toBe(1_200_000);
    for (const mode of PLACEMENT_MODES) expect(backstopMs(mode, true)).toBeNull();
    expect(DEEP_REST_AT).toBe(18);
  });
});

describe('modes', () => {
  it('are short, standard and deep; the schema reuses the one tuple', () => {
    expect(PLACEMENT_MODES).toEqual(['short', 'standard', 'deep']);
    expect(PlacementModeSchema.options).toEqual([...PLACEMENT_MODES]);
  });

  it('store the legacy length: short as quick, standard and deep as full', () => {
    expect(legacyLengthOf('short')).toBe('quick');
    expect(legacyLengthOf('standard')).toBe('full');
    expect(legacyLengthOf('deep')).toBe('full');
  });

  it('read a stored mode, or fall back on the legacy length when it is missing', () => {
    expect(modeOf({ length: 'full', mode: 'deep' })).toBe('deep');
    expect(modeOf({ length: 'quick' })).toBe('short');
    expect(modeOf({ length: 'full' })).toBe('standard');
  });

  it('cap Short at stage1 band 1; Standard and Deep at stage3', () => {
    expect(modeCeiling('short')).toEqual({ stage: 'stage1', band: 1 });
    expect(modeCeiling('standard')).toEqual({ stage: 'stage3', band: 0 });
    expect(modeCeiling('deep')).toEqual({ stage: 'stage3', band: 0 });
  });

  it('draw twice in Deep for every route-moving rung, in Standard only for vocab read', () => {
    for (const gate of ['sound-basic', 'syl-cv', 'sound-rest', 'syl-cvc'] as const) {
      expect(drawsFor('deep', gate, 'decode')).toBe(2);
      expect(drawsFor('standard', gate, 'decode')).toBe(1);
      expect(drawsFor('short', gate, 'decode')).toBe(1);
    }
    expect(drawsFor('deep', 'recog', 'decode')).toBe(1);
    expect(drawsFor('deep', 'vocab', 'read')).toBe(2);
    expect(drawsFor('deep', 'sentence', 'read')).toBe(2);
    expect(drawsFor('deep', 'vocab', 'oral')).toBe(1);
    expect(drawsFor('standard', 'vocab', 'read')).toBe(2);
    expect(drawsFor('standard', 'sentence', 'read')).toBe(1);
    expect(drawsFor('short', 'vocab', 'oral')).toBe(1);
  });

  it('ask all three CV syllables right only in Short', () => {
    expect(passAtFor('short', 'syl-cv')).toBe(3);
    expect(passAtFor('short', 'sound-basic')).toBe(2);
    expect(passAtFor('standard', 'syl-cv')).toBe(2);
    expect(passAtFor('deep', 'syl-cv')).toBe(2);
  });

  it('listen-first formats leave out Latin sound chips and tile building', () => {
    expect(LISTEN_FIRST_FORMATS).not.toContain('see-pick-sound');
    expect(LISTEN_FIRST_FORMATS).not.toContain('build-syllable');
    expect(LISTEN_FIRST_FORMATS).toContain('hear-pick-written');
    expect(LISTEN_FIRST_FORMATS).toContain('hear-pick-picture');
  });
});

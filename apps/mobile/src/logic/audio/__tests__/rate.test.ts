import { describe, expect, it } from 'vitest';
import { RATE_BASE, speechParams, type PromptKind } from '../rate';

describe('speechParams (F-AUDIO-004 §3.3)', () => {
  it('exposes the base rates in one object', () => {
    expect(RATE_BASE).toEqual({ sound: 0.75, word: 0.85, sentence: 0.9, narration: 1.0 });
  });

  const kinds: readonly PromptKind[] = ['sound', 'word', 'sentence', 'narration'];
  const factor = { 0: 0.9, 1: 1.0, 2: 1.05 } as const;

  for (const kind of kinds) {
    for (const level of [0, 1, 2] as const) {
      it(`${kind} at level order ${level}`, () => {
        const want = Math.min(1.1, Math.max(0.5, RATE_BASE[kind] * factor[level]));
        expect(speechParams(kind, level).rate).toBeCloseTo(want, 10);
      });
    }
  }

  it('treats an unknown level (null) as factor 1.0', () => {
    expect(speechParams('word', null).rate).toBeCloseTo(0.85, 10);
  });

  it('slow multiplies by 0.7', () => {
    expect(speechParams('sound', 1, { slow: true }).rate).toBeCloseTo(0.75 * 0.7, 10);
    expect(speechParams('sound', 1, { slow: false }).rate).toBeCloseTo(0.75, 10);
  });

  it('clamps to 0.5 at the bottom and 1.1 at the top', () => {
    expect(speechParams('sound', 0, { slow: true }).rate).toBe(0.5);
    expect(speechParams('narration', 2).rate).toBeCloseTo(1.05, 10);
    expect(speechParams('narration', 2).rate).toBeLessThanOrEqual(1.1);
  });

  it('pitch is always exactly 1', () => {
    for (const kind of kinds) {
      expect(speechParams(kind, 2).pitch).toBe(1);
      expect(speechParams(kind, null, { slow: true }).pitch).toBe(1);
    }
  });
});

import { getMessages } from '@hangul-route/i18n';
import { describe, expect, it } from 'vitest';
import { bannedNumberIn, leafStrings } from '../banned-text';

describe('bannedNumberIn (F-RVW-001 §3.1)', () => {
  it('finds a percent or a fraction', () => {
    expect(bannedNumberIn('You got 80 %')).toBe('80 %');
    expect(bannedNumberIn('27/35 right')).toBe('27/35');
    expect(bannedNumberIn('3 / 5')).toBe('3 / 5');
  });

  it('lets plain words, a stage name and a sound value pass', () => {
    expect(bannedNumberIn('Every letter!')).toBeNull();
    expect(bannedNumberIn('Stage 1: Hangul')).toBeNull();
    expect(bannedNumberIn('g/k')).toBeNull();
  });
});

describe('leafStrings', () => {
  it('collects every string of a message tree and samples its functions', () => {
    const tree = { a: 'one', b: { c: 'two', d: (x: string) => `three ${x}` }, e: 4 };
    expect(leafStrings(tree)).toEqual(['one', 'two', 'three x']);
  });
});

describe('the Hangul Check and ceremony copy', () => {
  const m = getMessages('en').learner;
  it('carries no percent and no fraction anywhere', () => {
    for (const s of [...leafStrings(m.stageReview), ...leafStrings(m.stageComplete)]) expect(bannedNumberIn(s), s).toBeNull();
  });
});

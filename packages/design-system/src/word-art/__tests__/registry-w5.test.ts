import { describe, expect, it } from 'vitest';
import { WORD_ART, WORD_ART_KEYS, getWordArt } from '../registry';

/**
 * Batch W-5 (§3.12): the twelve family glyphs, composed from `figure()`; the
 * ten other school glyphs (the chair is from W-1b) and the seven other nature
 * glyphs (the cloud is from W-1b, the flower from W-3). Reviewed against the
 * §3.12 checklist by the review that replaces the owner's batch review (owner,
 * 2026-10-11).
 */
const W5_FAMILY = ['mom', 'dad', 'grandma', 'grandpa', 'eonni', 'nuna', 'oppa', 'hyeong', 'dongsaeng', 'baby', 'family', 'me'].map((k) => `family-${k}`);
const W5_SCHOOL = ['school', 'teacher', 'friend', 'pencil', 'bag', 'notebook', 'eraser', 'desk', 'scissors', 'board'].map((k) => `school-${k}`);
const W5_NATURE = ['sky', 'sun', 'star', 'tree', 'rain', 'snow', 'river'].map((k) => `nature-${k}`);

describe('batch W-5 (§3.12)', () => {
  it.each([...W5_FAMILY, ...W5_SCHOOL, ...W5_NATURE])('%s is registered, approved after review', (key) => {
    expect(WORD_ART[key]?.meta).toEqual({ family: key.split('-')[0], status: 'approved' });
  });

  it('completes the family, school and nature families with the earlier samples', () => {
    // the reserved lesson pictures (registry-lessons.test.ts) are not part of the batch
    const of = (f: string) => WORD_ART_KEYS.filter((k) => k.startsWith(`${f}-`) && WORD_ART[k]!.meta.reserved !== true).sort();
    expect(of('family')).toEqual([...W5_FAMILY].sort());
    expect(of('school')).toEqual(['school-chair', ...W5_SCHOOL].sort());
    expect(of('nature')).toEqual(['nature-cloud', 'nature-flower', ...W5_NATURE].sort());
  });

  it('draws the four sibling words with the siblings() composition, each a different pair', () => {
    const sib = ['family-eonni', 'family-nuna', 'family-oppa', 'family-hyeong'].map((k) => JSON.stringify(getWordArt(k)));
    expect(new Set(sib).size).toBe(4);
  });
});

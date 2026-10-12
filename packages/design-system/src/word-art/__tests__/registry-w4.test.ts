import { describe, expect, it } from 'vitest';
import { BODY_PARTS, bodyPart } from '../generated/body';
import { WORD_ART, WORD_ART_KEYS, getWordArt } from '../registry';

/**
 * Batch W-4 (§3.12): the eight other animal glyphs, drawn by hand (the cat
 * was drawn at W-1b, the bear and the elephant at W-3), and the twelve body
 * parts, generated. Reviewed against the §3.12 checklist by the multi-agent
 * visual review that replaces the owner's batch review (owner, 2026-10-11).
 */
const W4_ANIMALS = ['animal-puppy', 'animal-rabbit', 'animal-bird', 'animal-fish', 'animal-duck', 'animal-fox', 'animal-monkey', 'animal-butterfly'];
const W4_BODY = BODY_PARTS.map((part) => `body-${part}`);

describe('batch W-4 (§3.12)', () => {
  it('holds the eight other animal glyphs, approved after review', () => {
    for (const key of W4_ANIMALS) expect(WORD_ART[key]?.meta, key).toEqual({ family: 'animal', status: 'approved' });
  });

  it('completes the animal family: the W-1b cat, the W-3 bear and elephant and the eight of W-4', () => {
    const animals = WORD_ART_KEYS.filter((k) => k.startsWith('animal-')).sort();
    expect(animals).toEqual(['animal-cat', 'animal-bear', 'animal-elephant', ...W4_ANIMALS].sort());
  });

  it('registers the twelve body parts as the generator draws them, approved after review', () => {
    expect(W4_BODY).toHaveLength(12);
    for (const part of BODY_PARTS) {
      expect(getWordArt(`body-${part}`), part).toEqual(bodyPart(part));
      expect(WORD_ART[`body-${part}`]!.meta, part).toEqual({ family: 'body', status: 'approved' });
    }
  });
});

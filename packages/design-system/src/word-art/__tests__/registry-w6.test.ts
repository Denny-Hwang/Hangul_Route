import { describe, expect, it } from 'vitest';
import { fillTones } from './glyph-checks';
import { WORD_ART, WORD_ART_KEYS, getWordArt } from '../registry';

/**
 * Batch W-6 (§3.12): the eleven other travel glyphs (the bus is from W-1b),
 * the eleven other sport glyphs (the football is from W-1b), the seven
 * K-Culture glyphs and the twelve science glyphs. Reviewed against the §3.12
 * checklist, K-Culture under the heritage accuracy bar, by the review that
 * replaces the owner's batch review (owner, 2026-10-11).
 */
const W6_TRAVEL = ['airplane', 'train', 'taxi', 'subway', 'car', 'boat', 'map', 'passport', 'ticket', 'airport', 'hotel'].map((k) => `travel-${k}`);
const W6_SPORT = ['baseball', 'basketball', 'volleyball', 'tabletennis', 'swimming', 'taekwondo', 'running', 'jumprope', 'bicycle', 'skiing', 'ball'].map((k) => `sport-${k}`);
const W6_CULTURE = ['hangul', 'hanok', 'bibimbap', 'tteokbokki', 'song', 'dance', 'drama'].map((k) => `culture-${k}`);
const W6_SCIENCE = ['fire', 'ice', 'stone', 'magnet', 'earth', 'space', 'robot', 'seed', 'rainbow', 'shadow', 'wind', 'light'].map((k) => `science-${k}`);

describe('batch W-6 (§3.12)', () => {
  it.each([...W6_TRAVEL, ...W6_SPORT, ...W6_CULTURE, ...W6_SCIENCE])('%s is registered and approved after review', (key) => {
    const { meta } = WORD_ART[key] ?? {};
    expect(meta?.family).toBe(key.split('-')[0]);
    expect(meta?.status).toBe('approved');
  });

  it('completes the travel, sport, culture and science families with the earlier samples', () => {
    // the reserved lesson pictures (registry-lessons.test.ts) are not part of the batch
    const of = (f: string) => WORD_ART_KEYS.filter((k) => k.startsWith(`${f}-`) && WORD_ART[k]!.meta.reserved !== true).sort();
    expect(of('travel')).toEqual(['travel-bus', ...W6_TRAVEL].sort());
    expect(of('sport')).toEqual(['sport-soccer', ...W6_SPORT].sort());
    expect(of('culture')).toEqual([...W6_CULTURE].sort());
    expect(of('science')).toEqual([...W6_SCIENCE].sort());
  });

  it('allows the rainbow its six arc colours and the cloud white (7), with a reason, and no other key a tone waiver', () => {
    expect(WORD_ART['science-rainbow']!.meta).toEqual({ family: 'science', status: 'approved', maxTones: 7, reason: expect.stringMatching(/six arc colours/) as unknown as string });
    expect(fillTones(getWordArt('science-rainbow')!)).toHaveLength(7);
    const waived = WORD_ART_KEYS.filter((k) => WORD_ART[k]!.meta.maxTones !== undefined);
    expect(waived).toEqual(['science-rainbow']);
  });
});

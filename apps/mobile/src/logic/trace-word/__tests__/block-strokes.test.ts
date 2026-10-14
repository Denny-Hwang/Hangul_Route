import { describe, expect, it } from 'vitest';
import { strokesForJamo, type JamoStrokePoint } from '../../../content/jamo-strokes';
import {
  BLOCK_VIEWBOX,
  BLOCK_ZONES,
  MAX_STRETCH,
  PAIR_WIDEN,
  PART_GAP,
  columns,
  fitStrokes,
  placeBlockStrokes,
  placeWordStrokes,
  shapeOf,
  type BlockRect,
  type PlacedBlock,
} from '../block-strokes';

const place = (syllable: string): PlacedBlock => {
  const placed = placeBlockStrokes(syllable, strokesForJamo);
  expect(placed, syllable).not.toBeNull();
  return placed!;
};

const within = (p: JamoStrokePoint, z: BlockRect): boolean =>
  p.x >= z.x - 0.11 && p.x <= z.x + z.width + 0.11 && p.y >= z.y - 0.11 && p.y <= z.y + z.height + 0.11;

describe('placeBlockStrokes: each letter in its zone of the block (F-CURR-001 §9 assumption 3)', () => {
  it('puts a vowel under the initial: 호 is ㅎ above ㅗ', () => {
    const b = place('호');
    expect(b.shape).toBe('under');
    expect(b.hasFinal).toBe(false);
    expect(b.letters.map((l) => [l.role, l.char, l.jamoIds])).toEqual([
      ['initial', 'ㅎ', ['jamo:hieut']],
      ['vowel', 'ㅗ', ['jamo:o']],
    ]);
    expect(b.letters[0]!.zones).toEqual([BLOCK_ZONES['under-open'].initial]);
    expect(b.letters[1]!.zones).toEqual([BLOCK_ZONES['under-open'].under]);
    // The block's target is every letter's strokes in writing order: ㅎ's 3, then ㅗ's 2.
    expect(b.strokes).toHaveLength(5);
    expect(b.strokes).toEqual([...b.letters[0]!.strokes, ...b.letters[1]!.strokes]);
  });

  it('puts a vertical vowel beside the initial: 야', () => {
    const b = place('야');
    expect(b.shape).toBe('beside');
    expect(b.letters[0]!.zones).toEqual([BLOCK_ZONES['beside-open'].initial]);
    expect(b.letters[1]!.zones).toEqual([BLOCK_ZONES['beside-open'].beside]);
  });

  it('gives a final its own lower band, drawn from the batchim skeleton when there is one: 한, 름', () => {
    const han = place('한');
    expect(han.shape).toBe('beside');
    expect(han.hasFinal).toBe(true);
    expect(han.letters.map((l) => l.role)).toEqual(['initial', 'vowel', 'final']);
    expect(han.letters[2]!.jamoIds).toEqual(['jamo:nieun-batchim']);
    expect(han.letters[2]!.zones).toEqual([BLOCK_ZONES['beside-final'].final]);
    const reum = place('름');
    expect(reum.shape).toBe('under');
    expect(reum.letters[2]!.zones).toEqual([BLOCK_ZONES['under-final'].final]);
    // ㅊ has no batchim skeleton of its own: the final draws the consonant's.
    expect(place('꽃').letters[2]!.jamoIds).toEqual(['jamo:chieut']);
  });

  it('draws a compound vowel from the vowels the stroke data holds, under then beside', () => {
    const hoe = place('회');
    expect(hoe.shape).toBe('mixed');
    expect(hoe.letters[1]!.jamoIds).toEqual(['jamo:o', 'jamo:i']);
    expect(hoe.letters[1]!.zones).toEqual([BLOCK_ZONES['mixed-open'].under, BLOCK_ZONES['mixed-open'].beside]);
    expect(place('원').letters[1]!.jamoIds).toEqual(['jamo:u', 'jamo:eo']);
    expect(place('의').letters[1]!.jamoIds).toEqual(['jamo:eu', 'jamo:i']);
    expect(place('왜').letters[1]!.jamoIds).toEqual(['jamo:o', 'jamo:a', 'jamo:i']);
    expect(place('궤').letters[1]!.jamoIds).toEqual(['jamo:u', 'jamo:eo', 'jamo:i']);
    expect(place('개').letters[1]!.jamoIds).toEqual(['jamo:a', 'jamo:i']);
    expect(place('예').letters[1]!.jamoIds).toEqual(['jamo:yeo', 'jamo:i']);
  });

  it('gives a two-part vertical vowel more room, and its ㅣ the narrow column', () => {
    const gae = place('개');
    const zones = BLOCK_ZONES['beside-open'];
    expect(gae.letters[0]!.zones[0]!.width).toBe(zones.initial.width - PAIR_WIDEN);
    const [tick, stem] = gae.letters[1]!.zones;
    expect(tick!.x).toBe(zones.beside!.x - PAIR_WIDEN);
    expect(tick!.width).toBeGreaterThan(stem!.width);
    expect(tick!.width + stem!.width + PART_GAP).toBeCloseTo(zones.beside!.width + PAIR_WIDEN, 5);
    // ㅙ narrows the horizontal part too.
    expect(place('왜').letters[1]!.zones[0]!.width).toBe(BLOCK_ZONES['mixed-open'].under!.width - PAIR_WIDEN);
  });

  it('writes a tense initial and a double final as two consonants side by side: 끼, 닭', () => {
    const kki = place('끼');
    expect(kki.letters[0]!.char).toBe('ㄲ');
    expect(kki.letters[0]!.jamoIds).toEqual(['jamo:giyeok', 'jamo:giyeok']);
    expect(kki.letters[0]!.zones).toHaveLength(2);
    expect(kki.letters[0]!.zones[1]!.x).toBeGreaterThan(kki.letters[0]!.zones[0]!.x);
    const dak = place('닭');
    expect(dak.letters[2]!.jamoIds).toEqual(['jamo:rieul-batchim', 'jamo:giyeok-batchim']);
    expect(place('값').letters[2]!.jamoIds).toEqual(['jamo:bieup-batchim', 'jamo:siot']);
  });

  it('keeps every placed point inside its zone and on the canvas', () => {
    for (const syllable of ['호', '야', '한', '름', '회', '왜', '꽃', '닭', '뷁', '쀍', '의', '개', '뭐']) {
      const b = place(syllable);
      for (const letter of b.letters) {
        let i = 0;
        for (const [k, jamoId] of letter.jamoIds.entries()) {
          const own = strokesForJamo(jamoId)!;
          for (const stroke of letter.strokes.slice(i, i + own.length)) {
            for (const p of stroke) {
              expect(within(p, letter.zones[k]!), `${syllable} ${letter.char} ${jamoId}`).toBe(true);
              expect(p.x).toBeGreaterThanOrEqual(0);
              expect(p.y).toBeLessThanOrEqual(BLOCK_VIEWBOX);
            }
          }
          i += own.length;
        }
      }
    }
  });

  it('is null for anything but one Hangul block', () => {
    for (const text of ['ㅎ', 'a', '호야', '', '1']) expect(placeBlockStrokes(text, strokesForJamo), text).toBeNull();
  });

  it('is null when the stroke data cannot draw a letter (the round builder drops the word)', () => {
    const without = (missing: string) => (id: string) => (id === missing ? undefined : strokesForJamo(id));
    expect(placeBlockStrokes('호', without('jamo:hieut'))).toBeNull();
    expect(placeBlockStrokes('호', without('jamo:o'))).toBeNull();
    expect(placeBlockStrokes('밭', without('jamo:tieut'))).toBeNull();
    expect(placeBlockStrokes('꽃', without('jamo:giyeok'))).toBeNull();
    // A final falls back from its batchim skeleton to the consonant's.
    expect(placeBlockStrokes('한', without('jamo:nieun-batchim'))!.letters[2]!.jamoIds).toEqual(['jamo:nieun']);
  });
});

describe('fitStrokes', () => {
  const zone: BlockRect = { x: 10, y: 20, width: 40, height: 100 };

  it('centres a letter with no width (ㅣ) and scales it to the zone height', () => {
    const [stem] = fitStrokes(strokesForJamo('jamo:i')!, zone);
    expect(stem!.every((p) => p.x === 30)).toBe(true);
    expect(stem![0]!.y).toBe(20);
    expect(stem![stem!.length - 1]!.y).toBe(120);
  });

  it('centres a letter with no height (ㅡ) and scales it to the zone width', () => {
    const [bar] = fitStrokes(strokesForJamo('jamo:eu')!, zone);
    expect(bar!.every((p) => p.y === 70)).toBe(true);
    expect(bar![0]!.x).toBe(10);
    expect(bar![bar!.length - 1]!.x).toBe(50);
  });

  it('never stretches one axis more than MAX_STRETCH times the other, either way', () => {
    const square = [[{ x: 0, y: 0 }, { x: 100, y: 100 }]];
    const tall = fitStrokes(square, { x: 0, y: 0, width: 10, height: 100 })[0]!;
    expect(tall[1]!.y - tall[0]!.y).toBeCloseTo(10 * MAX_STRETCH, 5);
    const wide = fitStrokes(square, { x: 0, y: 0, width: 100, height: 10 })[0]!;
    expect(wide[1]!.x - wide[0]!.x).toBeCloseTo(10 * MAX_STRETCH, 5);
  });
});

describe('columns and shapeOf', () => {
  it('splits a zone by weight, PART_GAP apart', () => {
    const zone: BlockRect = { x: 0, y: 5, width: 106, height: 50 };
    expect(columns(zone, [1])).toEqual([zone]);
    expect(columns(zone, [1, 1])).toEqual([
      { x: 0, y: 5, width: 50, height: 50 },
      { x: 56, y: 5, width: 50, height: 50 },
    ]);
    const [a, b] = columns(zone, [3, 1]);
    expect(a!.width).toBe(75);
    expect(b!.x).toBe(81);
  });

  it('names the block shape of every vowel', () => {
    expect([...'ㅏㅐㅑㅒㅓㅔㅕㅖㅣ'].map(shapeOf).every((s) => s === 'beside')).toBe(true);
    expect([...'ㅗㅛㅜㅠㅡ'].map(shapeOf).every((s) => s === 'under')).toBe(true);
    expect([...'ㅘㅙㅚㅝㅞㅟㅢ'].map(shapeOf).every((s) => s === 'mixed')).toBe(true);
  });
});

describe('placeWordStrokes', () => {
  it('places every block of a word, or nothing', () => {
    expect(placeWordStrokes('호야', strokesForJamo)?.map((b) => b.syllable)).toEqual(['호', '야']);
    expect(placeWordStrokes('호a', strokesForJamo)).toBeNull();
    expect(placeWordStrokes('', strokesForJamo)).toBeNull();
  });
});

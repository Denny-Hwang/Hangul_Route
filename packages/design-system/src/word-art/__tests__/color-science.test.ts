import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { contrastRatio } from '../../contrast';
import { colors } from '../../tokens';
import { COLOR_CONFUSION_PAIRS } from '../color-confusion';
import {
  CONFUSION_THRESHOLD,
  VISIONS,
  ciede2000,
  confusionPairs,
  deltaE,
  hexToLab,
  simulate,
} from '../color-science';

/**
 * F-VOC-002 §3.4: the colour-vision helpers on reference values, and the
 * shipped COLOR_CONFUSION_PAIRS recomputed from the tokens.
 */

const REPO = join(__dirname, '..', '..', '..', '..', '..');

describe('hexToLab (sRGB, D65)', () => {
  it('white is L 100, a 0, b 0', () => {
    const [l, a, b] = hexToLab('#FFFFFF');
    expect(l).toBeCloseTo(100, 2);
    expect(a).toBeCloseTo(0, 2);
    expect(b).toBeCloseTo(0, 2);
  });

  it('pure red is about (53.24, 80.09, 67.20)', () => {
    const [l, a, b] = hexToLab('#FF0000');
    expect(l).toBeCloseTo(53.24, 1);
    expect(a).toBeCloseTo(80.09, 1);
    expect(b).toBeCloseTo(67.2, 1);
  });

  it('rejects anything but an opaque #RRGGBB', () => {
    expect(() => hexToLab('#fff')).toThrow(/RRGGBB/);
    expect(() => hexToLab('rgba(0,0,0,0.4)')).toThrow(/RRGGBB/);
  });
});

describe('ciede2000 (Sharma, Wu and Dalal 2005 test data)', () => {
  it.each([
    [[50, 2.6772, -79.7751], [50, 0, -82.7485], 2.0425],
    [[50, 0, 0], [50, -1, 2], 2.3669],
    [[50, 2.5, 0], [73, 25, -18], 27.1492],
    [[50, 2.5, 0], [50, 0, -2.5], 4.3065],
    [[60.2574, -34.0099, 36.2677], [60.4626, -34.1751, 39.4387], 1.2644],
    [[2.0776, 0.0795, -1.135], [0.9033, -0.0636, -0.5514], 0.9082],
  ] as const)('%j vs %j = %s', (a, b, expected) => {
    expect(ciede2000(a, b)).toBeCloseTo(expected, 4);
    expect(ciede2000(b, a)).toBeCloseTo(expected, 4);
  });

  it('is zero for one colour', () => {
    expect(ciede2000([40, 10, -10], [40, 10, -10])).toBe(0);
  });
});

describe('simulate (Machado, Oliveira and Fernandes 2009, severity 1.0)', () => {
  it('leaves greys alone in every simulation (rows sum to one)', () => {
    for (const vision of VISIONS) {
      expect(simulate('#FFFFFF', vision)).toBe('#FFFFFF');
      expect(simulate('#000000', vision)).toBe('#000000');
      expect(simulate('#808080', vision)).toBe('#808080');
    }
  });

  it('normal vision is the identity', () => {
    expect(simulate('#D83A34', 'normal')).toBe('#D83A34');
  });

  it('protanopia darkens and yellows a pure red', () => {
    expect(simulate('#FF0000', 'protanopia')).toBe('#6D5F00');
  });

  it('deuteranopia and tritanopia move pure red and blue', () => {
    expect(simulate('#FF0000', 'deuteranopia')).toBe('#A39000');
    expect(simulate('#0000FF', 'tritanopia')).toBe('#006B96');
  });
});

describe('the twelve vocab colours (§3.4 numbers)', () => {
  const vocab = colors.vocab as Record<string, string>;

  it('normal vision: the closest pair is skyBlue/gray at 21.1', () => {
    const keys = Object.keys(vocab);
    let best = { d: Infinity, pair: '' };
    for (let i = 0; i < keys.length; i++)
      for (let j = i + 1; j < keys.length; j++) {
        const d = deltaE(vocab[keys[i]!]!, vocab[keys[j]!]!);
        if (d < best.d) best = { d, pair: `${keys[i]}/${keys[j]}` };
      }
    expect(best.pair).toBe('skyBlue/gray');
    expect(best.d).toBeCloseTo(21.1, 1);
  });

  it.each([
    ['protanopia', 'red', 'brown', 2.4],
    ['protanopia', 'orange', 'green', 5.8],
    ['deuteranopia', 'blue', 'purple', 5.0],
    ['deuteranopia', 'pink', 'gray', 6.8],
    ['deuteranopia', 'red', 'green', 6.3],
    ['tritanopia', 'orange', 'pink', 7.6],
  ] as const)('%s: %s/%s collapse to %s', (vision, a, b, expected) => {
    expect(deltaE(vocab[a]!, vocab[b]!, vision)).toBeCloseTo(expected, 1);
  });

  it('confusionPairs finds exactly those six pairs below the threshold', () => {
    expect(CONFUSION_THRESHOLD).toBe(8);
    const pairs = confusionPairs(vocab).map(({ a, b }) => [a, b].sort().join('/'));
    expect(pairs.sort()).toEqual(['blue/purple', 'brown/red', 'gray/pink', 'green/orange', 'green/red', 'orange/pink']);
  });

  it('confusionPairs reports the vision and the distance of each pair', () => {
    const redBrown = confusionPairs(vocab).find(({ a, b }) => [a, b].sort().join('/') === 'brown/red')!;
    expect(redBrown.vision).toBe('protanopia');
    expect(redBrown.distance).toBeCloseTo(2.4, 1);
  });

  it('vocab.red sits a just-noticeable 3.4 from feedback.danger, which is why the import guard exists', () => {
    expect(deltaE(colors.vocab.red, colors.feedback.danger)).toBeCloseTo(3.4, 1);
  });

  it('the text.primary outline is at least 3:1 on canvas (15.2), so the outline carries every edge', () => {
    expect(contrastRatio(colors.text.primary, colors.surface.canvas)).toBeGreaterThanOrEqual(3);
    expect(contrastRatio(colors.text.primary, colors.surface.canvas)).toBeCloseTo(15.2, 1);
  });
});

describe('COLOR_CONFUSION_PAIRS (behaviour 9)', () => {
  /** colour key (`color-skyblue`) -> vocab token key (`skyBlue`) */
  const tokenOf = (key: string): string => Object.keys(colors.vocab).find((k) => `color-${k.toLowerCase()}` === key)!;

  const items = (JSON.parse(readFileSync(join(REPO, 'content', 'vocab', 'colors.json'), 'utf8')) as { items: { id: string; visual: string }[] }).items;
  const itemOfToken = new Map(items.map((item) => [tokenOf(item.visual.slice('word:'.length)), item.id]));

  it('every colour item maps to one vocab token', () => {
    expect(items).toHaveLength(12);
    expect(new Set(itemOfToken.keys()).size).toBe(12);
    for (const key of itemOfToken.keys()) expect(Object.keys(colors.vocab)).toContain(key);
  });

  it('matches the list recomputed from the tokens (fails when a token edit makes it stale)', () => {
    const recomputed = confusionPairs(colors.vocab as Record<string, string>).map(({ a, b }) => [itemOfToken.get(a)!, itemOfToken.get(b)!].sort().join('|'));
    const shipped = COLOR_CONFUSION_PAIRS.map((pair) => [...pair].sort().join('|'));
    expect(shipped.sort()).toEqual(recomputed.sort());
  });

  it('is the spec constant, in the spec order', () => {
    expect(COLOR_CONFUSION_PAIRS).toEqual([
      ['vocab:ppalgansaek', 'vocab:galsaek'],
      ['vocab:juhwangsaek', 'vocab:choroksaek'],
      ['vocab:paransaek', 'vocab:borasaek'],
      ['vocab:bunhongsaek', 'vocab:hoesaek'],
      ['vocab:ppalgansaek', 'vocab:choroksaek'],
      ['vocab:juhwangsaek', 'vocab:bunhongsaek'],
    ]);
    expect(Object.isFrozen(COLOR_CONFUSION_PAIRS)).toBe(true);
  });
});

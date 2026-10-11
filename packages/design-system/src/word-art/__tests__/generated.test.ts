import { describe, expect, it } from 'vitest';
import { BODY_ANCHORS, BODY_PARTS, bodyGlyphs, bodyPart, ring } from '../generated/body';
import { COLOR_SWATCHES, STICKER_SCALE, SWATCH_RECT, colorGlyphs, swatch } from '../generated/color';
import { COUNT_VALUES, count, countGlyphs } from '../generated/count';
import { FIGURE_HAND, figure, figureTop, marker, siblings } from '../generated/figure';
import type { FigureOptions } from '../generated/figure';
import { HALO_TONE, HALO_WIDTH, haloOf, haloPath, outlineD } from '../generated/halo';
import { parsePath } from '../path';
import { getWordArt } from '../registry';
import { isWordArtTone } from '../tones';
import type { WordArtGlyph, WordArtShape } from '../types';
import { fillTones, glyphViolations, pathPoints, shapeBox, subjectBox } from './glyph-checks';

/**
 * F-VOC-002 §3.6 (generated families) and §5 `generated.test.ts`. The
 * generators land in PR W-1c; their keys are registered by the batches
 * (colours and counts in W-3, body in W-4), so every generator's output is
 * also run through the §3.5 glyph rules here, before it is registered.
 */

const GENERATED = { generated: true, haloWidth: HALO_WIDTH } as const;

const isDot = (s: WordArtShape): boolean => s.t === 'circle' && (s.f === 'brand.primary' || s.f === 'brand.secondary');
const isHalo = (s: WordArtShape): boolean => s.s === HALO_TONE && s.sw === HALO_WIDTH && s.f === undefined;

/**
 * A smile: an ink path of width 2 that starts with one small arc drawn from
 * right to left with sweep 1 (clockwise on screen), so it bends through the
 * bottom. A frown is the same arc drawn left to right, or with sweep 0.
 */
function isSmile(s: WordArtShape): boolean {
  if (s.t !== 'path' || s.s !== 'text.primary' || s.sw !== 2) return false;
  const cmds = parsePath(s.d);
  const [move, arc] = cmds ?? [];
  if (move?.c !== 'M' || arc?.c !== 'A') return false;
  const [, , , large, sweep, endX] = arc.a;
  return large === 0 && sweep === 1 && move.a[0]! > endX!;
}

describe('the smile check of these tests', () => {
  const ink = { s: 'text.primary', sw: 2 } as const;
  it('takes a right-to-left clockwise arc (through the bottom) and refuses a frown', () => {
    expect(isSmile({ t: 'path', d: 'M 60 50 A 10 10 0 0 1 40 50', ...ink })).toBe(true);
    expect(isSmile({ t: 'path', d: 'M 40 50 A 10 10 0 0 1 60 50', ...ink })).toBe(false);
    expect(isSmile({ t: 'path', d: 'M 60 50 A 10 10 0 0 0 40 50', ...ink })).toBe(false);
    expect(isSmile({ t: 'path', d: 'M 60 50 A 10 10 0 0 1 40 50', s: 'text.primary', sw: 3 })).toBe(false);
  });
});

describe('haloOf', () => {
  it('copies the geometry with a wide paper stroke and no fill or opacity', () => {
    const shape: WordArtShape = { t: 'circle', x: 10, y: 20, r: 5, f: 'vocab.red', s: 'text.primary', sw: 3, o: 0.9 };
    expect(haloOf(shape)).toEqual({ t: 'circle', x: 10, y: 20, r: 5, s: HALO_TONE, sw: HALO_WIDTH });
    expect(haloOf({ t: 'path', d: 'M 0 0 L 10 10', s: 'text.primary', sw: 2 })).toEqual({ t: 'path', d: 'M 0 0 L 10 10', s: HALO_TONE, sw: HALO_WIDTH });
  });

  it('is paper, wider than any outline', () => {
    expect(HALO_TONE).toBe('surface.paper');
    expect(HALO_WIDTH).toBeGreaterThan(3);
  });
});

describe('outlineD and haloPath', () => {
  const shapes: WordArtShape[] = [
    { t: 'circle', x: 30, y: 40, r: 6, f: 'vocab.red' },
    { t: 'ellipse', x: 60, y: 30, rx: 8, ry: 4, f: 'vocab.green' },
    { t: 'rect', x: 10, y: 60, w: 20, h: 12, r: 3, f: 'vocab.blue' },
    { t: 'rect', x: 50, y: 60, w: 10, h: 10, f: 'vocab.blue' },
    { t: 'path', d: 'M 70 70 L 80 85', s: 'text.primary', sw: 2 },
  ];

  it.each(shapes.map((s) => [s.t, s] as const))('outlines a %s in the path grammar, over the same extent', (_t, shape) => {
    const d = outlineD(shape);
    expect(parsePath(d)).not.toBeNull();
    const box = shapeBox({ t: 'path', d });
    const want = shapeBox(shape);
    for (const k of ['minX', 'minY', 'maxX', 'maxY'] as const) expect(box[k], k).toBeCloseTo(want[k], 5);
  });

  it('keeps a corner radius within half the side', () => {
    expect(parsePath(outlineD({ t: 'rect', x: 0, y: 0, w: 10, h: 4, r: 9, f: 'vocab.blue' }))).not.toBeNull();
    expect(outlineD({ t: 'rect', x: 0, y: 0, w: 10, h: 4, r: 9, f: 'vocab.blue' })).toContain('A 2 2 ');
  });

  it('halos many shapes as one paper path with one sub-path per shape', () => {
    const halo = haloPath(shapes)!;
    expect(halo).toMatchObject({ t: 'path', s: HALO_TONE, sw: HALO_WIDTH });
    expect(halo.f).toBeUndefined();
    const d = (halo as Extract<WordArtShape, { t: 'path' }>).d;
    expect(parsePath(d)!.filter((c) => c.c === 'M')).toHaveLength(shapes.length);
    expect(haloPath([])).toBeUndefined();
  });
});

describe('colour swatches (§3.6.1)', () => {
  const apple = getWordArt('food-apple')!;

  it('maps the twelve colour words to the spec objects', () => {
    expect(COLOR_SWATCHES).toEqual({
      'color-red': { tone: 'vocab.red', object: 'food-apple' },
      'color-orange': { tone: 'vocab.orange', object: 'prop-tangerine' },
      'color-yellow': { tone: 'vocab.yellow', object: 'food-banana' },
      'color-green': { tone: 'vocab.green', object: 'prop-leaf' },
      'color-blue': { tone: 'vocab.blue', object: 'food-water' },
      'color-purple': { tone: 'vocab.purple', object: 'prop-grapes' },
      'color-skyblue': { tone: 'vocab.skyBlue', object: 'nature-cloud' },
      'color-brown': { tone: 'vocab.brown', object: 'animal-bear' },
      'color-gray': { tone: 'vocab.gray', object: 'animal-elephant' },
      'color-white': { tone: 'vocab.white', object: 'food-milk' },
      'color-black': { tone: 'vocab.black', object: 'prop-crow' },
      'color-pink': { tone: 'vocab.pink', object: 'nature-flower' },
    });
  });

  it('draws a rounded square in the colour with the 3-unit ink outline, margin 6', () => {
    const glyph = swatch('vocab.red', apple);
    expect(glyph[0]).toEqual({ t: 'rect', x: 6, y: 6, w: 88, h: 88, r: 14, f: 'vocab.red', s: 'text.primary', sw: 3 });
    expect(SWATCH_RECT).toEqual({ x: 6, y: 6, size: 88, radius: 14 });
  });

  it('places the object as a sticker in the lower right at 55 %, haloes first, and keeps 9+ shapes', () => {
    const glyph = swatch('vocab.red', getWordArt('animal-cat')!);
    expect(STICKER_SCALE).toBe(0.55);
    expect(glyph.length).toBeGreaterThanOrEqual(9);
    const sticker = glyph.slice(1).filter((s) => !isHalo(s));
    const box = subjectBox(sticker);
    expect((box.minX + box.maxX) / 2).toBeGreaterThan(60);
    expect((box.minY + box.maxY) / 2).toBeGreaterThan(60);
    expect(box.maxX).toBeLessThanOrEqual(SWATCH_RECT.x + SWATCH_RECT.size - 3);
    expect(box.maxY).toBeLessThanOrEqual(SWATCH_RECT.y + SWATCH_RECT.size - 3);
    const firstShape = glyph.findIndex((s, i) => i > 0 && !isHalo(s));
    expect(glyph.slice(1, firstShape).every(isHalo)).toBe(true);
    expect(glyph.slice(firstShape).some(isHalo)).toBe(false);
  });

  it('keeps the object in its own colours, drops its ground shadow, and haloes only opaque shapes, in one path', () => {
    const glyph = swatch('vocab.purple', apple);
    expect(glyph.some((s) => s.f === 'vocab.red')).toBe(true);
    expect(glyph.some((s) => s.f === 'hoya.furDark')).toBe(false);
    const opaque = apple.filter((s) => (s.o ?? 1) >= 1);
    const haloes = glyph.filter(isHalo) as Extract<WordArtShape, { t: 'path' }>[];
    expect(haloes).toHaveLength(1);
    const subPaths = parsePath(haloes[0]!.d)!.filter((c) => c.c === 'M').length;
    const ownSubPaths = opaque.reduce((n, s) => n + (s.t === 'path' ? parsePath(s.d)!.filter((c) => c.c === 'M').length : 1), 0);
    expect(subPaths).toBe(ownSubPaths);
    expect(glyph.length).toBe(2 + apple.filter((s) => s.f !== 'hoya.furDark').length);
  });

  it('the halo covers the sticker: it reaches past every opaque shape of the object', () => {
    const glyph = swatch('vocab.red', getWordArt('animal-cat')!);
    const halo = glyph.find(isHalo) as Extract<WordArtShape, { t: 'path' }>;
    const sticker = glyph.slice(2).filter((s) => (s.o ?? 1) >= 1);
    const haloBox = shapeBox(halo);
    const stickerBox = subjectBox(sticker);
    for (const k of ['minX', 'minY'] as const) expect(haloBox[k]).toBeLessThanOrEqual(stickerBox[k] + 1e-6);
    for (const k of ['maxX', 'maxY'] as const) expect(haloBox[k]).toBeGreaterThanOrEqual(stickerBox[k] - 1e-6);
    expect(pathPoints(halo.d).length).toBeGreaterThan(0);
  });

  it('fits the 48-shape limit for any object a hand glyph may be (32 shapes, C7)', () => {
    const big: WordArtGlyph = Array.from({ length: 32 }, (_, i) => ({ t: 'circle' as const, x: 20 + (i % 8) * 8, y: 20 + Math.floor(i / 8) * 12, r: 3, f: 'vocab.red' as const, s: 'text.primary' as const, sw: 2 }));
    const glyph = swatch('vocab.purple', big);
    expect(glyph).toHaveLength(34);
    expect(glyphViolations(glyph, { ...GENERATED, bboxWaived: true, maxTones: 5 }, isWordArtTone)).toEqual([]);
  });

  it('keeps the outline and detail widths of the object (they do not shrink with it)', () => {
    const widths = new Set(swatch('vocab.red', apple).filter((s) => !isHalo(s)).map((s) => s.sw));
    expect(widths.has(3)).toBe(true);
    expect(widths.has(2)).toBe(true);
  });

  it('builds every colour glyph from a lookup, and names each missing object', () => {
    const lookup = (key: string): WordArtGlyph | undefined => (key === 'food-banana' || key === 'animal-bear' ? undefined : apple);
    expect(() => colorGlyphs(lookup)).toThrow(/color-yellow needs food-banana.*color-brown needs animal-bear/s);
    const all = colorGlyphs(() => apple);
    expect(Object.keys(all)).toEqual(Object.keys(COLOR_SWATCHES));
    expect(all['color-skyblue']![0]).toMatchObject({ f: 'vocab.skyBlue' });
  });

  it('every swatch the drawn objects allow today passes the glyph rules (C2 waived: the swatch fills the frame)', () => {
    const waiting: string[] = [];
    for (const [key, { tone, object }] of Object.entries(COLOR_SWATCHES)) {
      const glyph = getWordArt(object);
      if (!glyph) {
        waiting.push(object);
        continue;
      }
      expect(glyphViolations(swatch(tone, glyph), { ...GENERATED, bboxWaived: true, maxTones: 5 }, isWordArtTone), key).toEqual([]);
      expect(fillTones(swatch(tone, glyph)).length, key).toBeLessThanOrEqual(5);
    }
    // the objects W-3 draws (§3.12); this list shrinks as they land, and the loop above can never check nothing
    const W3_OBJECTS = ['food-banana', 'food-water', 'animal-bear', 'animal-elephant', 'food-milk', 'nature-flower'];
    expect(waiting.every((key) => W3_OBJECTS.includes(key)), waiting.join(', ')).toBe(true);
    expect(Object.keys(COLOR_SWATCHES).length - waiting.length).toBeGreaterThanOrEqual(6);
  });

  it('the swatch square is the reason for the C2 waiver: 88 of 100 units', () => {
    const box = subjectBox(swatch('vocab.red', apple));
    expect(box.maxX - box.minX).toBe(88);
  });
});

describe('counts (§3.6.2)', () => {
  it('covers 0 to 10 and 20', () => {
    expect(COUNT_VALUES).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 20]);
  });

  it.each(COUNT_VALUES)('count(%i) has exactly that many dots and no numeral', (n) => {
    const glyph = count(n);
    expect(glyph.filter(isDot)).toHaveLength(n);
    expect(glyph.every((s) => ['circle', 'rect'].includes(s.t))).toBe(true);
  });

  it('fills left to right, top row first: the first five brand.primary, the next five brand.secondary', () => {
    const dots = count(7).filter(isDot) as Extract<WordArtShape, { t: 'circle' }>[];
    expect(dots.map((d) => d.f)).toEqual([...Array(5).fill('brand.primary'), 'brand.secondary', 'brand.secondary']);
    for (let i = 1; i < 5; i++) expect(dots[i]!.x).toBeGreaterThan(dots[i - 1]!.x);
    expect(dots.slice(0, 5).every((d) => d.y === dots[0]!.y)).toBe(true);
    expect(dots[5]!.y).toBeGreaterThan(dots[0]!.y);
    expect(dots[5]!.x).toBe(dots[0]!.x);
    expect(dots[6]!.x).toBe(dots[1]!.x);
  });

  it('draws a ten-frame: a paper frame with the ink outline and ten cells outlined in border.strong', () => {
    const glyph = count(0);
    expect(glyph[0]).toMatchObject({ t: 'rect', f: 'surface.paper', s: 'text.primary', sw: 3 });
    const cells = glyph.filter((s) => s.t === 'rect' && s.s === 'border.strong');
    expect(cells).toHaveLength(10);
    expect(glyph).toHaveLength(11);
  });

  it('20 draws two full frames (42 shapes, under the 48 limit)', () => {
    const glyph = count(20);
    expect(glyph).toHaveLength(42);
    expect(glyph.filter((s) => s.t === 'rect' && s.f === 'surface.paper')).toHaveLength(2);
    expect(glyph.filter((s) => s.f === 'brand.primary')).toHaveLength(10);
  });

  it('dots are drawn on top of their cells, inside them', () => {
    const glyph = count(10);
    const cells = glyph.filter((s) => s.t === 'rect' && s.s === 'border.strong').map(shapeBox);
    const lastCell = glyph.map((s) => s.t === 'rect' && s.s === 'border.strong').lastIndexOf(true);
    const firstDot = glyph.findIndex(isDot);
    expect(firstDot).toBeGreaterThan(lastCell);
    for (const dot of glyph.filter(isDot).map(shapeBox)) {
      expect(cells.some((c) => dot.minX > c.minX && dot.maxX < c.maxX && dot.minY > c.minY && dot.maxY < c.maxY)).toBe(true);
    }
  });

  it.each([-1, 11, 19, 21, 2.5, Number.NaN])('refuses %s', (n) => {
    expect(() => count(n)).toThrow(/count/);
  });

  it.each(COUNT_VALUES)('count(%i) passes the glyph rules', (n) => {
    expect(glyphViolations(count(n), GENERATED, isWordArtTone)).toEqual([]);
  });

  it('countGlyphs keys every value as count-<n>, all distinct', () => {
    const all = countGlyphs();
    expect(Object.keys(all)).toEqual(COUNT_VALUES.map((n) => `count-${n}`));
    expect(new Set(Object.values(all).map((g) => JSON.stringify(g))).size).toBe(12);
  });
});

describe('body parts (§3.6.3)', () => {
  it('lists the twelve parts of the spec', () => {
    expect(BODY_PARTS).toEqual(['eye', 'nose', 'mouth', 'ear', 'head', 'face', 'hand', 'arm', 'leg', 'foot', 'belly', 'tooth']);
  });

  it('zooms on the head for eye, nose, mouth, ear, tooth and face, and shows the whole figure otherwise', () => {
    const head = BODY_PARTS.filter((p) => BODY_ANCHORS[p].view === 'head');
    expect(head.sort()).toEqual(['ear', 'eye', 'face', 'mouth', 'nose', 'tooth']);
  });

  it.each(BODY_PARTS)('the %s anchor, its ring and its halo sit inside the viewBox', (part) => {
    const { x, y } = BODY_ANCHORS[part];
    const outer = (ring(x, y, BODY_ANCHORS[part].r)[0] as Extract<WordArtShape, { t: 'circle' }>).r + HALO_WIDTH / 2;
    expect(x - outer).toBeGreaterThanOrEqual(0);
    expect(y - outer).toBeGreaterThanOrEqual(0);
    expect(x + outer).toBeLessThanOrEqual(100);
    expect(y + outer).toBeLessThanOrEqual(100);
  });

  it('the anchors are taken from the drawing: the eye, the ear and the hand rings sit on those parts', () => {
    type Circle = Extract<WordArtShape, { t: 'circle' }>;
    const circles = (g: WordArtGlyph): Circle[] => g.filter((s): s is Circle => s.t === 'circle');
    const eye = BODY_ANCHORS.eye;
    const eyes = circles(bodyPart('eye')).filter((s) => s.f === 'text.primary');
    expect(eyes).toHaveLength(2);
    const left = eyes.reduce((a, b) => (b.x < a.x ? b : a));
    expect([eye.x, eye.y]).toEqual([left.x, left.y]);
    expect(eye.r).toBeGreaterThan(left.r);
    const ear = BODY_ANCHORS.ear;
    const ears = circles(bodyPart('ear')).filter((s) => s.f === 'surface.paper' && s.x < 50 && s.r < 10);
    expect(ears).toHaveLength(1);
    expect(Math.hypot(ears[0]!.x - ear.x, ears[0]!.y - ear.y)).toBeLessThanOrEqual(1);
    const hand = BODY_ANCHORS.hand;
    const hands = bodyPart('hand').filter((s) => s.t === 'path' && s.f === 'surface.paper' && parsePath(s.d)!.filter((c) => c.c === 'M').length === 2 && shapeBox(s).maxY - shapeBox(s).minY < 10);
    expect(hands).toHaveLength(1);
    const box = shapeBox({ t: 'path', d: (hands[0] as Extract<WordArtShape, { t: 'path' }>).d.split(' M ')[0]! });
    expect((box.minX + box.maxX) / 2).toBeCloseTo(hand.x, 0);
    expect((box.minY + box.maxY) / 2).toBeCloseTo(hand.y, 0);
    expect(FIGURE_HAND.dx).toBeGreaterThan(0);
  });

  it('ring() is a brand.secondary circle on a paper halo that only shows outside it', () => {
    const [halo, blue] = ring(40, 50, 9) as Extract<WordArtShape, { t: 'circle' }>[];
    expect(blue).toEqual({ t: 'circle', x: 40, y: 50, r: 9, s: 'brand.secondary', sw: 3 });
    expect(halo).toMatchObject({ t: 'circle', x: 40, y: 50, s: HALO_TONE, sw: HALO_WIDTH });
    // the inner edges meet, so the part inside the ring is not covered
    expect(halo!.r - HALO_WIDTH / 2).toBeCloseTo(blue!.r - 1.5, 5);
  });

  it.each(BODY_PARTS)('%s ends with its ring at its anchor, and the figure smiles', (part) => {
    const glyph = bodyPart(part);
    const { x, y, r } = BODY_ANCHORS[part];
    expect(glyph.slice(-2)).toEqual(ring(x, y, r));
    expect(glyph.some(isSmile)).toBe(true);
  });

  it('draws a neutral figure: paper face and limbs, hoya.fur clothes, no skin-tone fill', () => {
    for (const part of BODY_PARTS) {
      const tones = fillTones(bodyPart(part));
      expect(tones, part).toContain('surface.paper');
      for (const t of tones) expect(['surface.paper', 'hoya.fur', 'text.secondary', 'hoya.cheek'], `${part} ${t}`).toContain(t);
    }
    expect(fillTones(bodyPart('belly'))).toContain('hoya.fur');
  });

  it.each(BODY_PARTS)('%s passes the glyph rules', (part) => {
    expect(glyphViolations(bodyPart(part), GENERATED, isWordArtTone)).toEqual([]);
  });

  it('bodyGlyphs keys every part as body-<part>, all distinct', () => {
    const all = bodyGlyphs();
    expect(Object.keys(all)).toEqual(BODY_PARTS.map((p) => `body-${p}`));
    expect(new Set(Object.values(all).map((g) => JSON.stringify(g))).size).toBe(12);
  });
});

describe('figure (§3.6.4)', () => {
  const base: FigureOptions = { height: 70, hair: 'short', clothes: 'brand.secondary' };
  const json = (o: FigureOptions): string => JSON.stringify(figure(o));

  it('stands on the ground line with the requested height, centred on x', () => {
    const box = subjectBox(figure(base));
    expect(box.maxY).toBeCloseTo(88, 0);
    expect(box.maxY - box.minY).toBeGreaterThan(64);
    expect(box.maxY - box.minY).toBeLessThan(76);
    expect((box.minX + box.maxX) / 2).toBeCloseTo(50, 0);
    const moved = subjectBox(figure({ ...base, x: 30, ground: 80, height: 40 }));
    expect(moved.maxY).toBeCloseTo(80, 0);
    expect((moved.minX + moved.maxX) / 2).toBeCloseTo(30, 0);
    expect(moved.maxY - moved.minY).toBeLessThan(46);
  });

  it('figureTop is the top of the head (hair included)', () => {
    for (const o of [...(['short', 'long', 'bun', 'none', 'grey'] as const).map((hair) => ({ ...base, hair })), { ...base, hair: 'none' as const, accessory: 'blanket' as const }]) {
      const hair = `${o.hair} ${o.accessory ?? ''}`;
      const top = subjectBox(figure(o)).minY;
      expect(figureTop(o), hair).toBeLessThanOrEqual(top + 0.1);
      expect(figureTop(o), hair).toBeGreaterThan(top - 1.5);
    }
  });

  it('every figure smiles', () => {
    for (const hair of ['short', 'long', 'bun', 'none', 'grey'] as const) expect(figure({ ...base, hair }).some(isSmile), hair).toBe(true);
    expect(figure({ ...base, accessory: 'blanket', height: 34 }).some(isSmile)).toBe(true);
  });

  it('hair, clothes and accessories each change the drawing', () => {
    const variants = [
      base,
      { ...base, hair: 'long' as const },
      { ...base, hair: 'bun' as const },
      { ...base, hair: 'none' as const },
      { ...base, hair: 'grey' as const },
      { ...base, clothes: 'vocab.pink' as const },
      { ...base, accessory: 'glasses' as const },
      { ...base, accessory: 'cane' as const },
      { ...base, accessory: 'blanket' as const },
      { ...base, hairTone: 'vocab.gray' as const, hair: 'bun' as const },
    ];
    expect(new Set(variants.map(json)).size).toBe(variants.length);
  });

  it('grey hair is vocab.gray; other hair defaults to text.secondary and takes hairTone', () => {
    expect(figure({ ...base, hair: 'grey' }).some((s) => s.f === 'vocab.gray')).toBe(true);
    expect(figure({ ...base, hair: 'long' }).some((s) => s.f === 'text.secondary')).toBe(true);
    expect(figure({ ...base, hair: 'bun', hairTone: 'vocab.gray' }).some((s) => s.f === 'text.secondary')).toBe(false);
    expect(figure({ ...base, hair: 'none' }).some((s) => s.f === 'text.secondary')).toBe(false);
  });

  it('is neutral: the face is paper with an ink outline, never a skin tone (C12)', () => {
    const tones = fillTones(figure(base));
    expect(tones).toContain('surface.paper');
    for (const t of tones) expect(['surface.paper', 'brand.secondary', 'text.secondary'], t).toContain(t);
  });

  it('compact drops the hands so four figures fit the 32-shape limit', () => {
    expect(figure({ ...base, compact: true }).length).toBeLessThan(figure(base).length);
    const hair = ['long', 'short', 'long', 'short'] as const;
    const four = [20, 40, 60, 80].flatMap((x, i) => figure({ height: 60, hair: hair[i]!, clothes: 'brand.primary', x, compact: true }));
    expect(four.length).toBeLessThanOrEqual(31);
  });

  it('marker is a small brand.secondary dot', () => {
    expect(marker(50, 10)).toEqual({ t: 'circle', x: 50, y: 10, r: 4, f: 'brand.secondary', s: 'text.primary', sw: 2 });
  });

  it('refuses a height outside 20..80', () => {
    expect(() => figure({ ...base, height: 10 })).toThrow(/height/);
    expect(() => figure({ ...base, height: 90 })).toThrow(/height/);
  });

  it.each(['short', 'long', 'bun', 'none', 'grey'] as const)('a lone %s-haired figure passes the hand-glyph rules', (hair) => {
    expect(glyphViolations(figure({ ...base, height: 64, hair }), {}, isWordArtTone)).toEqual([]);
  });

  it.each(['glasses', 'cane', 'blanket'] as const)('a figure with %s passes the hand-glyph rules', (accessory) => {
    expect(glyphViolations(figure({ ...base, height: 64, accessory, ...(accessory === 'blanket' ? { height: 50 } : {}) }), { bboxWaived: accessory === 'blanket' }, isWordArtTone)).toEqual([]);
  });
});

describe('siblings (§3.6.4: the four sibling words)', () => {
  const pairs = [
    ['long', 'long'],
    ['long', 'short'],
    ['short', 'long'],
    ['short', 'short'],
  ] as const;

  it('the four pairs (eonni, nuna, oppa, hyeong) all differ (C8)', () => {
    expect(new Set(pairs.map(([o, s]) => JSON.stringify(siblings(o, s)))).size).toBe(4);
  });

  it('the speaker is smaller, to the right, and carries the marker above the head', () => {
    const glyph = siblings('long', 'short');
    const markers = glyph.filter((s) => s.t === 'circle' && s.f === 'brand.secondary' && s.r === 4);
    expect(markers).toHaveLength(1);
    const m = markers[0] as Extract<WordArtShape, { t: 'circle' }>;
    expect(m.x).toBeGreaterThan(50);
    const speakerTop = Math.min(...glyph.filter((s) => s !== m).filter((s) => shapeBox(s).minX > 52).map((s) => shapeBox(s).minY));
    expect(m.y).toBeLessThan(speakerTop);
    const olderTop = Math.min(...glyph.filter((s) => shapeBox(s).maxX < 50).map((s) => shapeBox(s).minY));
    expect(olderTop).toBeLessThan(speakerTop);
  });

  it.each(pairs)('%s + %s passes the hand-glyph rules', (o, s) => {
    expect(glyphViolations(siblings(o, s), {}, isWordArtTone)).toEqual([]);
  });
});

import { describe, expect, it } from 'vitest';
import { HOYA_BOX, HOYA_POSES, hoyaItem, hoyaNodes } from '../hoya';
import { boundsOf, nodeCount, paletteOf } from '../resolve';
import { checkItem } from '../rules';
import type { LeafShape, Shape } from '../types';

function leaves(shapes: readonly Shape[]): LeafShape[] {
  return shapes.flatMap((s) => (s.t === 'group' ? leaves(s.kids) : [s]));
}

const ellipses = (pose: Parameters<typeof hoyaNodes>[0]) => leaves(hoyaNodes(pose)).filter((s): s is Extract<LeafShape, { t: 'ellipse' }> => s.t === 'ellipse');
const eyesOf = (pose: Parameters<typeof hoyaNodes>[0]) => ellipses(pose).filter((e) => e.fill === 'hoya.stripes');
const cheeksOf = (pose: Parameters<typeof hoyaNodes>[0]) => leaves(hoyaNodes(pose)).filter((s) => s.t === 'circle' && s.fill === 'hoya.cheek' && s.o === 0.6);

describe('hoya data port: poses', () => {
  it('has the five poses of the shipped component', () => {
    expect([...HOYA_POSES]).toEqual(['idle', 'cheering', 'thinking', 'reading', 'waving']);
  });

  it.each(HOYA_POSES)('%s: draws the head, belly, nose and a mouth on the 128 box', (pose) => {
    const all = leaves(hoyaNodes(pose));
    expect(all).toContainEqual({ t: 'circle', cx: 64, cy: 64, r: 44, fill: 'hoya.fur' });
    expect(all).toContainEqual({ t: 'ellipse', cx: 64, cy: 84, rx: 26, ry: 16, fill: 'hoya.belly' });
    expect(all).toContainEqual({ t: 'path', d: 'M58 84 H70 L64 90 Z', fill: 'hoya.nose' });
    expect(HOYA_BOX).toEqual({ w: 128, h: 128 });
  });

  it('returns a fresh tree on every call', () => {
    const a = hoyaNodes('idle');
    const b = hoyaNodes('idle');
    expect(a).not.toBe(b);
    expect(a).toEqual(b);
  });

  it('reads an unknown pose as idle, like the component', () => {
    expect(hoyaNodes('wobbling' as never)).toEqual(hoyaNodes('idle'));
  });
});

describe('hoya data port: the character contract (Hoya.tsx header)', () => {
  it('cheeks show only in idle, cheering and waving', () => {
    expect(cheeksOf('idle')).toHaveLength(2);
    expect(cheeksOf('cheering')).toHaveLength(2);
    expect(cheeksOf('waving')).toHaveLength(2);
    expect(cheeksOf('thinking')).toHaveLength(0);
    expect(cheeksOf('reading')).toHaveLength(0);
  });

  it('thinking looks up and to the right, never down', () => {
    const [left, right] = eyesOf('thinking');
    const [idleLeft] = eyesOf('idle');
    expect(left).toMatchObject({ cx: 51, cy: 68, rx: 3, ry: 4.5 });
    expect(right).toMatchObject({ cx: 79, cy: 68 });
    expect(left!.cy).toBeLessThan(idleLeft!.cy);
    expect(left!.cx).toBeGreaterThan(idleLeft!.cx);
  });

  it('reading looks down at the book', () => {
    const [left] = eyesOf('reading');
    const [idleLeft] = eyesOf('idle');
    expect(left).toMatchObject({ cy: 76, rx: 3, ry: 3.5 });
    expect(left!.cy).toBeGreaterThan(idleLeft!.cy);
  });

  it('cheering squints into joyful slits and keeps its eyes glint-free', () => {
    const [left, right] = eyesOf('cheering');
    expect(left).toMatchObject({ cx: 50, cy: 70, rx: 4, ry: 1.5 });
    expect(right).toMatchObject({ cx: 78 });
    const glints = (pose: Parameters<typeof hoyaNodes>[0]) => leaves(hoyaNodes(pose)).filter((s) => s.t === 'circle' && s.fill === 'surface.paper' && s.r === 1);
    expect(glints('cheering')).toHaveLength(0);
    for (const pose of ['idle', 'thinking', 'reading', 'waving'] as const) expect(glints(pose)).toHaveLength(2);
  });

  it('idle and waving share the open eyes', () => {
    expect(eyesOf('idle')[0]).toMatchObject({ cx: 50, cy: 72, rx: 3.5, ry: 4 });
    expect(eyesOf('waving')[0]).toMatchObject({ cx: 50, cy: 72, rx: 3.5, ry: 4 });
  });

  it.each([
    ['idle', 'M50 92 Q60 100 70 92'],
    ['waving', 'M48 92 Q60 104 72 92'],
    ['thinking', 'M53 96 Q60 92 67 96'],
  ] as const)('%s: a soft stroked mouth', (pose, d) => {
    expect(leaves(hoyaNodes(pose))).toContainEqual({ t: 'path', d, stroke: 'hoya.stripes', sw: 'thick' });
  });

  it('reading has a tiny flat mouth and cheering a cheek-pink open smile', () => {
    expect(leaves(hoyaNodes('reading'))).toContainEqual({ t: 'line', x1: 56, y1: 95, x2: 64, y2: 95, stroke: 'hoya.stripes', sw: 'thick' });
    expect(leaves(hoyaNodes('cheering'))).toContainEqual({ t: 'path', d: 'M44 92 Q60 110 76 92 Q60 100 44 92 Z', fill: 'hoya.cheek', stroke: 'hoya.stripes', sw: 'thick' });
  });

  it('draws no teeth, no black and no danger red in any pose', () => {
    for (const pose of HOYA_POSES) {
      for (const s of leaves(hoyaNodes(pose))) {
        expect(s.t === 'poly' ? s.fill : undefined).toSatisfy((f: unknown) => f === undefined || f === 'feedback.nudge');
        for (const token of [s.fill, s.stroke]) {
          expect(token).not.toBe('feedback.danger');
          expect(token).not.toBe('brand.primary');
        }
      }
    }
  });

  it('adds the pose accents and only those', () => {
    const has = (pose: Parameters<typeof hoyaNodes>[0], pred: (s: LeafShape) => boolean) => leaves(hoyaNodes(pose)).some(pred);
    const cloud = (s: LeafShape) => s.t === 'rect' && s.x === 108 && s.y === 2 && s.fill === 'surface.paper' && s.stroke === 'brand.secondary';
    const sparkle = (s: LeafShape) => s.t === 'poly' && s.fill === 'feedback.nudge' && s.o === 0.85;
    const book = (s: LeafShape) => s.t === 'rect' && s.x === 36 && s.y === 94 && s.fill === 'surface.paper' && s.stroke === 'text.secondary';
    expect(has('thinking', cloud)).toBe(true);
    expect(has('cheering', sparkle)).toBe(true);
    expect(has('reading', book)).toBe(true);
    for (const pose of HOYA_POSES) {
      expect(has(pose, cloud)).toBe(pose === 'thinking');
      expect(has(pose, sparkle)).toBe(pose === 'cheering');
      expect(has(pose, book)).toBe(pose === 'reading');
    }
    expect(leaves(hoyaNodes('cheering')).filter(sparkle)).toHaveLength(4);
  });

  it('raises both arms when cheering, one arm when waving, paws on the book when reading', () => {
    const hands = (pose: Parameters<typeof hoyaNodes>[0]) => leaves(hoyaNodes(pose)).filter((s) => s.t === 'circle' && s.fill === 'hoya.fur' && s.r !== 44 && s.r !== 12);
    const mids = (pose: Parameters<typeof hoyaNodes>[0]): number[] => {
      const b = hands(pose);
      return b.map((s) => (s.t === 'circle' ? s.cx : -1)).sort((x, y) => x - y);
    };
    expect(mids('cheering')).toEqual([8, 8]); // the second is the flipped group (x -> 128 - x)
    expect(mids('waving')).toEqual([121.5]);
    expect(mids('reading')).toEqual([42, 86]);
    expect(mids('idle')).toEqual([]);
    expect(mids('thinking')).toEqual([]);
  });

  it('mirrors the cheering arm about the middle of the box', () => {
    const b = boundsOf(hoyaNodes('cheering'))!;
    expect(b.minX + b.maxX).toBe(128);
    const arms = hoyaNodes('cheering').filter((s) => s.t === 'group');
    expect(arms).toHaveLength(1);
    expect(arms[0]).toMatchObject({ t: 'group', tx: 128, flip: true });
  });
});

describe('hoya data port: as an item', () => {
  it.each(HOYA_POSES)('%s: is a mid-band figure with its tintable fur', (pose) => {
    const item = hoyaItem(pose);
    expect(item).toMatchObject({ id: `hoya:${pose}`, kind: 'figure', box: HOYA_BOX, z: 'mid', tintable: 'hoya.fur' });
    expect(item.nodes).toEqual(hoyaNodes(pose));
    expect(item.alt).toMatch(/^Hoya/);
  });

  it.each(HOYA_POSES)('%s: passes every item rule, his fixed palette exempt from the five-colour cap', (pose) => {
    // Hoya is a full character, not a prop: the shipped component uses 7 to 9
    // tokens per pose, which checkItem exempts. Everything else in R-I holds (shapes, box, size, detail).
    expect(checkItem(hoyaItem(pose))).toEqual([]);
    expect(paletteOf(hoyaItem(pose)).length).toBeLessThanOrEqual(9);
  });

  it.each(HOYA_POSES)('%s: stays light', (pose) => {
    expect(nodeCount(hoyaNodes(pose))).toBeLessThanOrEqual(40);
  });

  it('keeps every pose inside the 128 box', () => {
    for (const pose of HOYA_POSES) {
      const b = boundsOf(hoyaNodes(pose))!;
      expect(b.minX).toBeGreaterThanOrEqual(0);
      expect(b.minY).toBeGreaterThanOrEqual(0);
      expect(b.maxX).toBeLessThanOrEqual(128);
      expect(b.maxY).toBeLessThanOrEqual(128);
    }
  });
});

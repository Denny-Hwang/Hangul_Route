import { describe, expect, it } from 'vitest';
import { HOYA_BOX, HOYA_POSES, hoyaFigure, hoyaItem, hoyaNodes, hoyaPaintProps, hoyaPoseOf, hoyaSceneShapes, type HoyaPart } from '../hoya';
import { boundsOf, nodeCount, paletteOf } from '../resolve';
import { checkItem } from '../rules';
import { resolveColor } from '../tokens-map';
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

  it('draws an unknown pose as idle without the cheek blush, like the component', () => {
    const blush = (s: Shape) => s.t === 'circle' && s.fill === 'hoya.cheek' && s.o === 0.6;
    const junk = leaves(hoyaNodes('junk' as never));
    expect(junk.filter(blush)).toHaveLength(0);
    expect(junk).toEqual(leaves(hoyaNodes('idle')).filter((s) => !blush(s)));
    // The idle mouth is still drawn, and the pink ear insides are not the blush.
    expect(junk).toContainEqual({ t: 'path', d: 'M50 92 Q60 100 70 92', stroke: 'hoya.stripes', sw: 'thick' });
    expect(junk.filter((s) => s.t === 'circle' && s.fill === 'hoya.cheek' && s.o === 0.85)).toHaveLength(2);
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

describe('hoya data port: frozen', () => {
  it('keeps every pose shape for shape as it was before Hoya.tsx moved onto the data (PR 2.11)', async () => {
    const all = Object.fromEntries(HOYA_POSES.map((pose) => [pose, hoyaNodes(pose)]));
    await expect(`${JSON.stringify(all, null, 1)}\n`).toMatchFileSnapshot('./__snapshots__/hoya-nodes.json');
  });
});

describe('hoya figure: the scene form', () => {
  it('is hoyaNodes, part for part, in every pose', () => {
    for (const pose of HOYA_POSES) expect(hoyaSceneShapes(hoyaFigure(pose))).toEqual(hoyaNodes(pose));
  });

  it('snaps stroke widths to the nearest token, a tie to the wider one', () => {
    const sw = (strokeWidth: number | undefined) => (hoyaSceneShapes([{ t: 'line', x1: 0, y1: 0, x2: 4, y2: 0, stroke: 'text.primary', strokeWidth }])[0] as LeafShape).sw;
    expect([0.5, 1, 1.2, 1.5, 2, 2.6, 3, 10].map(sw)).toEqual(['thin', 'thin', 'thin', 'base', 'base', 'thick', 'thick', 'thick']);
    expect(sw(undefined)).toBe('base');
  });

  it('snaps opacities to the allowed steps and numbers to half units', () => {
    expect(hoyaSceneShapes([{ t: 'circle', cx: 51.2, cy: 70.7, r: 0.9, fill: 'surface.paper', opacity: 0.18 }])).toEqual([{ t: 'circle', cx: 51, cy: 70.5, r: 1, fill: 'surface.paper', o: 0.2 }]);
    expect(hoyaSceneShapes([{ t: 'rect', x: 1.2, y: 2, w: 3, h: 4.3, fill: 'hoya.belly' }])).toEqual([{ t: 'rect', x: 1, y: 2, w: 3, h: 4.5, fill: 'hoya.belly' }]);
  });

  it('hands a group paint and detail down to its parts, the part own paint winning', () => {
    const group: HoyaPart = {
      t: 'group',
      fill: 'surface.paper',
      det: true,
      kids: [
        { t: 'circle', cx: 1, cy: 1, r: 1 },
        { t: 'circle', cx: 4, cy: 1, r: 1, fill: 'hoya.cheek' },
      ],
    };
    expect(hoyaSceneShapes([group])).toEqual([
      { t: 'circle', cx: 1, cy: 1, r: 1, fill: 'surface.paper', det: true },
      { t: 'circle', cx: 4, cy: 1, r: 1, fill: 'hoya.cheek', det: true },
    ]);
  });

  it('draws a part scene stand-in instead of the part, and nothing for an empty one', () => {
    expect(hoyaSceneShapes([{ t: 'circle', cx: 1, cy: 1, r: 1, fill: 'hoya.fur', scene: [] }])).toEqual([]);
    const standIn = [{ t: 'circle', cx: 2, cy: 2, r: 1, fill: 'hoya.fur' }] as Shape[];
    expect(hoyaSceneShapes([{ t: 'circle', cx: 1, cy: 1, r: 1, fill: 'hoya.fur', scene: standIn }])).toEqual(standIn);
  });

  it('drops an explicit no-fill: a scene shape without a fill draws none', () => {
    expect(hoyaSceneShapes([{ t: 'path', d: 'M0 0 H4', fill: 'none', stroke: 'hoya.stripes', strokeWidth: 3 }])).toEqual([{ t: 'path', d: 'M0 0 H4', stroke: 'hoya.stripes', sw: 'thick' }]);
  });

  it('reads anything but the five poses as idle', () => {
    expect(HOYA_POSES.map(hoyaPoseOf)).toEqual([...HOYA_POSES]);
    for (const junk of ['wobbling', '', undefined, 3]) expect(hoyaPoseOf(junk)).toBe('idle');
  });

  it('draws an unknown pose as the idle figure without the cheek-blush group', () => {
    const idle = hoyaFigure('idle');
    const isBlush = (p: HoyaPart) => p.t === 'group' && p.kids.every((k) => k.t === 'circle' && k.fill === 'hoya.cheek' && k.opacity === 0.6);
    expect(idle.filter(isBlush)).toHaveLength(1);
    for (const junk of ['junk', 'wobbling', '']) {
      const parts = hoyaFigure(junk as never);
      expect(parts.filter(isBlush)).toHaveLength(0);
      expect(parts).toEqual(idle.filter((p) => !isBlush(p)));
    }
  });
});

describe('hoyaPaintProps: the one paint mapper of hoyaFigure', () => {
  const fur = { fur: 'FUR', furDark: 'FURDARK' };

  it('sets only the paint fields a part sets, with resolved colours', () => {
    expect(hoyaPaintProps({}, fur)).toEqual({});
    expect(hoyaPaintProps({ fill: 'hoya.fur', stroke: 'hoya.furDark', strokeWidth: 3, strokeLinecap: 'round', strokeLinejoin: 'round', opacity: 0.6 }, fur)).toEqual({
      fill: 'FUR',
      stroke: 'FURDARK',
      strokeWidth: 3,
      strokeLinecap: 'round',
      strokeLinejoin: 'round',
      opacity: 0.6,
    });
    expect(hoyaPaintProps({ fill: 'none', stroke: 'hoya.stripes' }, fur)).toEqual({ fill: 'none', stroke: resolveColor('hoya.stripes') });
  });

  it.each(HOYA_POSES)('%s: every token part maps to a resolved colour', (pose) => {
    const walk = (parts: readonly HoyaPart[]): void => {
      for (const part of parts) {
        const props = hoyaPaintProps(part, fur);
        for (const key of ['fill', 'stroke'] as const) {
          const token = part[key];
          if (token !== undefined && token !== 'none') expect(props[key]).not.toBe(token);
        }
        if (part.t === 'group') walk(part.kids);
      }
    };
    walk(hoyaFigure(pose));
  });
});

import { describe, expect, it } from 'vitest';
import {
  boundsOf,
  nodeCount,
  paletteOf,
  parsePath,
  resolveScene,
  thumbVariant,
  type Matrix,
} from '../resolve';
import type { Shape } from '../types';
import { makeArt, makeHoya, makeProp, makeRegistry, makeSetting } from './fixtures';

function apply(m: Matrix, x: number, y: number): [number, number] {
  return [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];
}

describe('nodeCount', () => {
  it('counts leaf shapes, descending into groups, not the groups', () => {
    const shapes: Shape[] = [
      { t: 'circle', cx: 1, cy: 1, r: 1 },
      { t: 'group', kids: [{ t: 'rect', x: 0, y: 0, w: 1, h: 1 }, { t: 'line', x1: 0, y1: 0, x2: 1, y2: 1 }] },
    ];
    expect(nodeCount(shapes)).toBe(3);
    expect(nodeCount([])).toBe(0);
  });
});

describe('paletteOf', () => {
  it('lists distinct fill and stroke tokens in sorted order, ignoring none', () => {
    const item = makeProp({
      nodes: [
        { t: 'rect', x: 0, y: 0, w: 4, h: 4, fill: 'theme.rites', stroke: 'border.strong' },
        { t: 'group', kids: [{ t: 'circle', cx: 2, cy: 2, r: 1, fill: 'theme.rites' }, { t: 'line', x1: 0, y1: 0, x2: 1, y2: 1, fill: 'none', stroke: 'text.primary' }] },
      ],
    });
    expect(paletteOf(item)).toEqual(['border.strong', 'text.primary', 'theme.rites']);
  });

  it('is empty for an item with no paint', () => {
    expect(paletteOf(makeProp({ nodes: [{ t: 'circle', cx: 1, cy: 1, r: 1 }] }))).toEqual([]);
  });
});

describe('boundsOf', () => {
  it('is null for no shapes', () => {
    expect(boundsOf([])).toBeNull();
  });

  it('covers each of the eight kinds', () => {
    expect(boundsOf([{ t: 'rect', x: 2, y: 3, w: 10, h: 4 }])).toEqual({ minX: 2, minY: 3, maxX: 12, maxY: 7 });
    expect(boundsOf([{ t: 'circle', cx: 10, cy: 10, r: 5 }])).toEqual({ minX: 5, minY: 5, maxX: 15, maxY: 15 });
    expect(boundsOf([{ t: 'ellipse', cx: 10, cy: 10, rx: 6, ry: 2 }])).toEqual({ minX: 4, minY: 8, maxX: 16, maxY: 12 });
    expect(boundsOf([{ t: 'line', x1: 9, y1: 1, x2: 3, y2: 8 }])).toEqual({ minX: 3, minY: 1, maxX: 9, maxY: 8 });
    expect(boundsOf([{ t: 'poly', pts: [[0, 0], [10, 2], [4, 9]] }])).toEqual({ minX: 0, minY: 0, maxX: 10, maxY: 9 });
    expect(boundsOf([{ t: 'path', d: 'M 1 2 L 9 2 L 9 8 Z' }])).toEqual({ minX: 1, minY: 2, maxX: 9, maxY: 8 });
  });

  it('applies group translate, scale, flip and rotation', () => {
    const kid: Shape = { t: 'rect', x: 0, y: 0, w: 10, h: 20 };
    expect(boundsOf([{ t: 'group', tx: 5, ty: 5, kids: [kid] }])).toEqual({ minX: 5, minY: 5, maxX: 15, maxY: 25 });
    expect(boundsOf([{ t: 'group', s: 2, kids: [kid] }])).toEqual({ minX: 0, minY: 0, maxX: 20, maxY: 40 });
    expect(boundsOf([{ t: 'group', flip: true, kids: [kid] }])).toEqual({ minX: -10, minY: 0, maxX: 0, maxY: 20 });
    expect(boundsOf([{ t: 'group', rot: 90, kids: [kid] }])).toEqual({ minX: -20, minY: 0, maxX: 0, maxY: 10 });
  });

  it('draws nothing for a shape kind it does not know', () => {
    expect(boundsOf([{ t: 'text', x: 0, y: 0 } as unknown as Shape])).toBeNull();
  });

  it('unions several shapes and ignores a path it cannot parse', () => {
    const b = boundsOf([
      { t: 'rect', x: 0, y: 0, w: 2, h: 2 },
      { t: 'rect', x: 8, y: 8, w: 2, h: 2 },
      { t: 'path', d: 'garbage' },
    ]);
    expect(b).toEqual({ minX: 0, minY: 0, maxX: 10, maxY: 10 });
    expect(boundsOf([{ t: 'path', d: 'garbage' }])).toBeNull();
  });

  it('includes bezier control points and the true extent of an arc', () => {
    expect(boundsOf([{ t: 'path', d: 'M 0 0 C 0 10 10 10 10 0' }])).toEqual({ minX: 0, minY: 0, maxX: 10, maxY: 10 });
    expect(boundsOf([{ t: 'path', d: 'M 0 0 Q 5 8 10 0' }])).toEqual({ minX: 0, minY: 0, maxX: 10, maxY: 8 });
    // semicircle from (0,10) to (20,10) bulging up (sweep 1) with r = 10
    const up = boundsOf([{ t: 'path', d: 'M 0 10 A 10 10 0 0 1 20 10' }])!;
    expect(up.minX).toBeCloseTo(0, 3);
    expect(up.maxX).toBeCloseTo(20, 3);
    expect(up.minY).toBeCloseTo(0, 3);
    expect(up.maxY).toBeCloseTo(10, 3);
    // both sweep directions with a chord shorter than the diameter
    for (const d of ['M 15 10 A 10 10 0 0 0 5 10', 'M 15 10 A 10 10 0 0 1 5 10', 'M 5 10 A 10 10 0 0 0 15 10', 'M 5 10 A 10 10 0 1 0 15 10']) {
      const b = boundsOf([{ t: 'path', d }])!;
      expect(b.maxX - b.minX).toBeGreaterThanOrEqual(10);
    }
    // the other sweep bulges down
    const down = boundsOf([{ t: 'path', d: 'M 0 10 A 10 10 0 0 0 20 10' }])!;
    expect(down.maxY).toBeCloseTo(20, 3);
    // large-arc flag and radii too small (scaled up), plus a rotated ellipse arc
    const big = boundsOf([{ t: 'path', d: 'M 0 10 A 4 4 0 1 1 20 10' }])!;
    expect(big.minY).toBeCloseTo(0, 3);
    const small = boundsOf([{ t: 'path', d: 'M 5 0 A 10 10 0 0 1 15 0' }])!;
    const large = boundsOf([{ t: 'path', d: 'M 5 0 A 10 10 0 1 1 15 0' }])!;
    expect(large.maxY - large.minY).toBeGreaterThan(small.maxY - small.minY);
    const rotated = boundsOf([{ t: 'path', d: 'M 0 0 A 10 5 45 0 1 10 10' }])!;
    expect(rotated.maxX).toBeGreaterThanOrEqual(10);
    // zero radius degrades to a straight line; coincident endpoints draw nothing extra
    expect(boundsOf([{ t: 'path', d: 'M 0 0 A 0 5 0 0 1 10 10' }])).toEqual({ minX: 0, minY: 0, maxX: 10, maxY: 10 });
    expect(boundsOf([{ t: 'path', d: 'M 4 4 A 5 5 0 0 1 4 4' }])).toEqual({ minX: 4, minY: 4, maxX: 4, maxY: 4 });
  });

  it('tracks the current point through H, V and Z', () => {
    expect(boundsOf([{ t: 'path', d: 'M 2 2 H 10 V 8 Z L 5 5' }])).toEqual({ minX: 2, minY: 2, maxX: 10, maxY: 8 });
  });
});

describe('parsePath', () => {
  it('accepts absolute commands with repeats and returns segments', () => {
    expect(parsePath('M 0 0 L 1 1 2 2 Z')).toEqual([
      { cmd: 'M', args: [0, 0] },
      { cmd: 'L', args: [1, 1] },
      { cmd: 'L', args: [2, 2] },
      { cmd: 'Z', args: [] },
    ]);
    expect(parsePath('M0 0H5V6')).toEqual([
      { cmd: 'M', args: [0, 0] },
      { cmd: 'H', args: [5] },
      { cmd: 'V', args: [6] },
    ]);
    expect(parsePath('M 0.5 -1.5 Q 1 1 2 2 C 1 1 2 2 3 3 A 1 1 0 0 1 2 2')).toHaveLength(4);
  });

  it('turns extra M pairs into lineto', () => {
    expect(parsePath('M 0 0 1 1')).toEqual([
      { cmd: 'M', args: [0, 0] },
      { cmd: 'L', args: [1, 1] },
    ]);
  });

  it('rejects anything else', () => {
    for (const bad of ['', 'L 1 1', 'M 0', 'M 0 0 l 1 1', 'M 0 0 L 1', 'M 0 0 Z 1', 'M 0 0 X 1 1', 'M 0 0 A 1 1 0 2 0 5 5', 'M 0 0 , 1', '1 2 M 0 0', 'M 0 0 L a b']) {
      expect(parsePath(bad), bad).toBeNull();
    }
  });
});

describe('thumbVariant', () => {
  it('drops detail shapes and thin strokes, keeps fills', () => {
    const shapes: Shape[] = [
      { t: 'rect', x: 0, y: 0, w: 4, h: 4, fill: 'theme.rites', stroke: 'border.strong', sw: 'thin' },
      { t: 'circle', cx: 1, cy: 1, r: 1, fill: 'hoya.fur', det: true },
      { t: 'line', x1: 0, y1: 0, x2: 5, y2: 5, stroke: 'text.primary', sw: 'thin' },
      { t: 'line', x1: 0, y1: 0, x2: 5, y2: 5, stroke: 'text.primary', sw: 'thick' },
      { t: 'ellipse', cx: 1, cy: 1, rx: 1, ry: 1, fill: 'none', stroke: 'text.primary', sw: 'thin' },
      { t: 'poly', pts: [[0, 0], [1, 0], [0, 1]], fill: 'theme.life', stroke: 'text.primary' },
    ];
    const out = thumbVariant(shapes);
    expect(out).toHaveLength(3);
    expect(out[0]).toEqual({ t: 'rect', x: 0, y: 0, w: 4, h: 4, fill: 'theme.rites' });
    expect(out[0]).not.toHaveProperty('stroke');
    expect(out[1]).toMatchObject({ t: 'line', sw: 'thick' });
    expect(out[2]).toMatchObject({ t: 'poly', stroke: 'text.primary' });
  });

  it('recurses into groups and drops the ones left empty', () => {
    const shapes: Shape[] = [
      { t: 'group', tx: 3, kids: [{ t: 'circle', cx: 1, cy: 1, r: 1, fill: 'hoya.fur' }, { t: 'circle', cx: 1, cy: 1, r: 1, det: true, fill: 'hoya.fur' }] },
      { t: 'group', kids: [{ t: 'circle', cx: 1, cy: 1, r: 1, det: true, fill: 'hoya.fur' }] },
    ];
    expect(thumbVariant(shapes)).toEqual([{ t: 'group', tx: 3, kids: [{ t: 'circle', cx: 1, cy: 1, r: 1, fill: 'hoya.fur' }] }]);
  });

  it('does not mutate its input', () => {
    const shapes: Shape[] = [{ t: 'rect', x: 0, y: 0, w: 1, h: 1, fill: 'theme.life', stroke: 'border.strong', sw: 'thin' }];
    const copy = JSON.parse(JSON.stringify(shapes));
    thumbVariant(shapes);
    expect(shapes).toEqual(copy);
  });
});

describe('resolveScene', () => {
  it('places the setting first and anchors a layer at bottom-centre', () => {
    const r = resolveScene(makeArt(), makeRegistry());
    expect(r.issues).toEqual([]);
    const setting = r.nodes.filter((n) => n.layerIndex === -1);
    expect(setting).toHaveLength(3);
    expect(r.nodes.slice(0, 3)).toEqual(setting);
    // setting anchor (200,300) onto canvas anchor (200,300): identity
    expect(setting[0]!.matrix).toEqual([1, 0, 0, 1, 0, 0]);
    const desk = r.nodes.filter((n) => n.layerIndex === 0);
    expect(desk).toHaveLength(4);
    // the desk's anchor (50,80) lands on (200,220) at scale 1.5
    const m = desk[0]!.matrix;
    expect(apply(m, 50, 80)).toEqual([200, 220]);
    expect(apply(m, 0, 0)).toEqual([125, 100]);
    expect(desk[0]!.ref).toBe('prop:desk');
  });

  it('defaults s to 1 and mirrors around the anchor on flip', () => {
    const art = makeArt({ layers: [{ ref: 'prop:desk', x: 100, y: 200 }, { ref: 'prop:desk', x: 100, y: 200, flip: true }] });
    const r = resolveScene(art, makeRegistry());
    const a = r.nodes.find((n) => n.layerIndex === 0)!.matrix;
    const b = r.nodes.find((n) => n.layerIndex === 1)!.matrix;
    expect(apply(a, 0, 0)).toEqual([50, 120]);
    expect(apply(b, 0, 0)).toEqual([150, 120]);
    expect(apply(b, 50, 80)).toEqual([100, 200]);
  });

  it('orders layers back, mid, front and then by array index', () => {
    const reg = makeRegistry([
      makeProp({ id: 'prop:sky', z: 'back' }),
      makeProp({ id: 'prop:fence', z: 'front' }),
    ]);
    const art = makeArt({
      layers: [
        { ref: 'prop:fence', x: 10, y: 250 },
        { ref: 'prop:desk', x: 20, y: 250 },
        { ref: 'prop:sky', x: 30, y: 250 },
        { ref: 'prop:desk', x: 40, y: 250 },
      ],
    });
    const r = resolveScene(art, reg);
    expect(r.layers.map((l) => l.layerIndex)).toEqual([2, 1, 3, 0]);
    expect(r.layers.map((l) => l.band)).toEqual(['back', 'mid', 'mid', 'front']);
    expect(r.layers.map((l) => l.rank)).toEqual([0, 1, 2, 3]);
    const ranks = r.nodes.map((n) => n.rank);
    expect(ranks).toEqual([...ranks].sort((x, y) => x - y));
    expect(r.nodes[0]!.rank).toBe(-1);
  });

  it('lets a layer override its default band with z', () => {
    const art = makeArt({ layers: [{ ref: 'prop:desk', x: 10, y: 250, z: 'front' }, { ref: 'prop:desk', x: 20, y: 250 }] });
    const r = resolveScene(art, makeRegistry());
    expect(r.layers.map((l) => [l.layerIndex, l.band])).toEqual([[1, 'mid'], [0, 'front']]);
  });

  it('swaps the tintable colour for the tint token', () => {
    const reg = makeRegistry([
      makeProp({
        id: 'prop:robe',
        tintable: 'brand.secondary',
        nodes: [
          { t: 'rect', x: 0, y: 0, w: 10, h: 10, fill: 'brand.secondary', stroke: 'text.primary' },
          { t: 'group', kids: [{ t: 'line', x1: 0, y1: 0, x2: 5, y2: 5, stroke: 'brand.secondary' }] },
          { t: 'circle', cx: 5, cy: 5, r: 2, fill: 'surface.paper' },
        ],
      }),
    ]);
    const r = resolveScene(makeArt({ layers: [{ ref: 'prop:robe', x: 100, y: 250, tint: 'theme.rites' }] }), reg);
    expect(r.issues).toEqual([]);
    const shapes = r.nodes.filter((n) => n.layerIndex === 0).map((n) => n.shape);
    expect(shapes[0]).toMatchObject({ fill: 'theme.rites', stroke: 'text.primary' });
    expect(shapes[1]).toMatchObject({ stroke: 'theme.rites' });
    expect(shapes[2]).toMatchObject({ fill: 'surface.paper' });
    // the registry item itself is untouched
    expect(reg['prop:robe']!.nodes[0]).toMatchObject({ fill: 'brand.secondary' });
  });

  it('reports a bad tint and a tint on an untintable item, and draws untinted', () => {
    const reg = makeRegistry([makeProp({ id: 'prop:robe', tintable: 'brand.secondary' })]);
    const art = makeArt({
      layers: [
        { ref: 'prop:robe', x: 10, y: 250, tint: 'feedback.danger' },
        { ref: 'prop:desk', x: 20, y: 250, tint: 'theme.rites' },
      ],
    });
    const r = resolveScene(art, reg);
    expect(r.issues).toEqual([
      { kind: 'invalid-tint', ref: 'prop:robe', layerIndex: 0 },
      { kind: 'tint-unsupported', ref: 'prop:desk', layerIndex: 1 },
    ]);
    expect(r.layers).toHaveLength(2);
    expect(r.nodes.find((n) => n.layerIndex === 1)!.shape).toMatchObject({ fill: 'brand.secondary' });
  });

  it('skips unresolved layers and keeps drawing the rest', () => {
    const art = makeArt({ layers: [{ ref: 'prop:ghost', x: 10, y: 250 }, { ref: 'prop:desk', x: 20, y: 250 }, { ref: 'scene:hall', x: 0, y: 0 }] });
    const r = resolveScene(art, makeRegistry());
    expect(r.issues).toEqual([
      { kind: 'unresolved-ref', ref: 'prop:ghost', layerIndex: 0 },
      { kind: 'unresolved-ref', ref: 'scene:hall', layerIndex: 2 },
    ]);
    expect(r.layers.map((l) => l.layerIndex)).toEqual([1]);
    expect(r.stats.layers).toBe(1);
  });

  it('does not find inherited object keys', () => {
    const r = resolveScene(makeArt({ layers: [{ ref: 'constructor', x: 1, y: 1 }] }), makeRegistry());
    expect(r.issues).toEqual([{ kind: 'unresolved-ref', ref: 'constructor', layerIndex: 0 }]);
  });

  it('reports an unresolved setting and still draws the layers', () => {
    const r = resolveScene(makeArt({ setting: 'scene:missing' }), makeRegistry());
    expect(r.issues).toEqual([{ kind: 'unresolved-setting', ref: 'scene:missing', layerIndex: -1 }]);
    expect(r.nodes.every((n) => n.layerIndex === 0)).toBe(true);
  });

  it('passes card layers through for the react-native renderer', () => {
    const art = makeArt({ layers: [{ ref: 'card:hangul-day', x: 300, y: 250, s: 0.5, flip: true }, { ref: 'prop:desk', x: 20, y: 250 }] });
    const r = resolveScene(art, makeRegistry());
    expect(r.issues).toEqual([]);
    expect(r.cards).toEqual([{ ref: 'card:hangul-day', x: 300, y: 250, s: 0.5, flip: true, layerIndex: 0, rank: 0 }]);
    expect(r.layers.map((l) => [l.layerIndex, l.ref, l.bounds === null])).toEqual([[0, 'card:hangul-day', true], [1, 'prop:desk', false]]);
    // a card draws in the mid band by default, in array order with the other mid layers
    const card = r.layers.find((l) => l.ref.startsWith('card:'))!;
    expect(card.band).toBe('mid');
    expect(r.stats.layers).toBe(2);
    const front = resolveScene(makeArt({ layers: [{ ref: 'card:x', x: 1, y: 1, z: 'front' }] }), makeRegistry());
    expect(front.cards[0]).toMatchObject({ s: 1, flip: false, rank: 0 });
  });

  it('composes group transforms into the node matrix', () => {
    const reg = makeRegistry([
      makeProp({
        id: 'prop:wheel',
        box: { w: 20, h: 20 },
        nodes: [{ t: 'group', tx: 10, ty: 10, rot: 90, s: 2, flip: true, kids: [{ t: 'rect', x: 0, y: 0, w: 1, h: 1 }] }],
      }),
    ]);
    const r = resolveScene(makeArt({ layers: [{ ref: 'prop:wheel', x: 10, y: 20 }] }), reg);
    const m = r.nodes.find((n) => n.layerIndex === 0)!.matrix;
    // local (1,0): flip -> (-2,0) scaled, rot 90 -> (0,-2), + (10,10) -> (10,8), layer offset (0,0)
    expect(apply(m, 1, 0)).toEqual([10, 8]);
    expect(m.every((v) => !Object.is(v, -0))).toBe(true);
  });

  it('reports stats: layers, shapes, sorted distinct colours and bounds', () => {
    const r = resolveScene(makeArt(), makeRegistry());
    expect(r.stats.layers).toBe(1);
    expect(r.stats.shapes).toBe(7);
    expect(r.stats.colors).toEqual(['border.strong', 'brand.secondary', 'surface.canvas', 'surface.paper', 'text.secondary', 'theme.nature']);
    expect(r.stats.bounds).toEqual({ minX: 0, minY: 0, maxX: 400, maxY: 300 });
    const empty = resolveScene(makeArt({ setting: 'scene:missing', layers: [] }), makeRegistry());
    expect(empty.stats).toEqual({ layers: 0, shapes: 0, colors: [], bounds: null });
  });

  it('computes per-layer bounds and shape counts', () => {
    const r = resolveScene(makeArt(), makeRegistry());
    expect(r.layers[0]).toMatchObject({ layerIndex: 0, ref: 'prop:desk', kind: 'furniture', shapes: 4 });
    expect(r.layers[0]!.bounds).toEqual({ minX: 125, minY: 130, maxX: 275, maxY: 220 });
  });

  it('resolves the thumb variant with fewer shapes', () => {
    const r = resolveScene(makeArt(), makeRegistry(), { variant: 'thumb' });
    // the setting loses its thin detail line; the desk loses its thin... none; its circle keeps base stroke
    expect(r.stats.shapes).toBe(6);
    expect(resolveScene(makeArt(), makeRegistry(), { variant: 'full' }).stats.shapes).toBe(7);
  });

  it('rounds matrix noise away', () => {
    const reg = makeRegistry([makeProp({ id: 'prop:spin', nodes: [{ t: 'group', rot: 30, kids: [{ t: 'rect', x: 0, y: 0, w: 1, h: 1 }] }] })]);
    const r = resolveScene(makeArt({ layers: [{ ref: 'prop:spin', x: 50, y: 80 }] }), reg);
    const m = r.nodes.find((n) => n.layerIndex === 0)!.matrix;
    expect(m[0]).toBe(0.866);
    expect(m[1]).toBe(0.5);
  });

  it('resolves a hoya layer like any other item', () => {
    const r = resolveScene(makeArt({ layers: [{ ref: 'hoya:idle', x: 100, y: 250, s: 0.8 }] }), makeRegistry());
    expect(r.layers[0]).toMatchObject({ ref: 'hoya:idle', kind: 'figure', band: 'mid' });
    expect(makeSetting().horizonY).toBe(180);
    expect(makeHoya().box.h).toBe(96);
  });
});

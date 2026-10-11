import { describe, expect, it } from 'vitest';
import { CARD_SIZE, drawScene, type DrawItem, type DrawNode } from '../draw';
import { hoyaItem } from '../hoya';
import { resolveColor } from '../tokens-map';
import type { ItemDef, Shape } from '../types';
import { makeArt, makeProp, makeRegistry } from './fixtures';

const registry = makeRegistry([hoyaItem('thinking')]);

const nodesOf = (items: readonly DrawItem[], layerIndex: number): DrawNode[] =>
  items.filter((i): i is DrawNode => i.tag !== 'card' && i.layerIndex === layerIndex);

function drawnProp(shapes: Shape[], extra: Partial<ItemDef> = {}): DrawNode[] {
  const prop = makeProp({ id: 'prop:x', box: { w: 100, h: 100 }, nodes: shapes, ...extra });
  const scene = drawScene({ setting: 'scene:hall', layers: [{ ref: 'prop:x', x: 50, y: 100 }], altEn: 'x' }, makeRegistry([prop]));
  return nodesOf(scene.items, 0);
}

describe('drawScene: order and placement', () => {
  it('draws the setting first, then the layers back to front', () => {
    const scene = drawScene(
      makeArt({ layers: [{ ref: 'prop:desk', x: 200, y: 220, z: 'front' }, { ref: 'hoya:thinking', x: 100, y: 250 }] }),
      registry,
    );
    expect(scene.viewBox).toBe('0 0 400 300');
    expect(scene.issues).toEqual([]);
    const order = scene.items.map((i) => (i.tag === 'card' ? 'card' : i.layerIndex));
    const firstOf = (n: number) => order.indexOf(n);
    expect(order[0]).toBe(-1);
    expect(firstOf(1)).toBeLessThan(firstOf(0)); // Hoya (mid) before the desk (front)
    expect(new Set(scene.items.map((i) => i.key)).size).toBe(scene.items.length);
    expect(nodesOf(scene.items, -1)[0]!.geometry).toEqual({ x: 0, y: 0, width: 400, height: 180 });
  });

  it('applies the layer placement as one matrix per shape', () => {
    expect(drawnProp([{ t: 'rect', x: 0, y: 0, w: 10, h: 10, fill: 'brand.secondary' }])[0]!.transform).toBe('matrix(1 0 0 1 0 0)');
    const moved = drawScene(makeArt({ layers: [{ ref: 'prop:desk', x: 200, y: 200, s: 2, flip: true }] }), registry);
    // desk box 100 x 80: x' = -2x + 200 + 100, y' = 2y + 200 - 160
    expect(nodesOf(moved.items, 0)[0]!.transform).toBe('matrix(-2 0 0 2 300 40)');
  });

  it('is deterministic', () => {
    const art = makeArt({ layers: [{ ref: 'hoya:thinking', x: 200, y: 250 }] });
    expect(drawScene(art, registry)).toEqual(drawScene(art, registry));
  });

  it('passes issues through and skips unresolved layers', () => {
    const scene = drawScene(makeArt({ layers: [{ ref: 'prop:nope', x: 10, y: 10 }, { ref: 'hoya:thinking', x: 200, y: 250 }] }), registry);
    expect(scene.issues).toEqual([{ kind: 'unresolved-ref', ref: 'prop:nope', layerIndex: 0 }]);
    expect(nodesOf(scene.items, 1).length).toBeGreaterThan(0);
    expect(drawScene(makeArt({ setting: 'scene:nowhere' }), registry).issues[0]).toMatchObject({ kind: 'unresolved-setting' });
  });

  it('drops detail shapes and hairlines in the thumb variant', () => {
    const art = makeArt({ layers: [{ ref: 'hoya:thinking', x: 200, y: 250 }] });
    const full = drawScene(art, registry);
    const thumb = drawScene(art, registry, { variant: 'thumb' });
    expect(thumb.items.length).toBeLessThan(full.items.length);
  });

  it('tints the fur of a Hoya layer', () => {
    const art = makeArt({ layers: [{ ref: 'hoya:thinking', x: 200, y: 250, tint: 'theme.crafts' }] });
    const scene = drawScene(art, registry);
    expect(scene.issues).toEqual([]);
    const fills = nodesOf(scene.items, 0).map((n) => n.paint.fill);
    expect(fills).toContain(resolveColor('theme.crafts'));
    expect(fills).not.toContain(resolveColor('hoya.fur'));
  });
});

describe('drawScene: paint', () => {
  it('resolves colours through the token table, never a literal in the data', () => {
    const [node] = drawnProp([{ t: 'rect', x: 0, y: 0, w: 10, h: 10, r: 2, fill: 'brand.secondary', stroke: 'text.primary', sw: 'thick', o: 0.6 }]);
    expect(node).toMatchObject({ tag: 'rect', geometry: { x: 0, y: 0, width: 10, height: 10, rx: 2 } });
    expect(node!.paint).toEqual({
      fill: resolveColor('brand.secondary'),
      stroke: resolveColor('text.primary'),
      strokeWidth: 3,
      opacity: 0.6,
      strokeLinecap: 'round',
      strokeLinejoin: 'round',
    });
  });

  it('maps every shape kind to an svg element', () => {
    const nodes = drawnProp([
      { t: 'rect', x: 1, y: 2, w: 3, h: 4, fill: 'brand.secondary' },
      { t: 'circle', cx: 5, cy: 6, r: 7, fill: 'brand.secondary' },
      { t: 'ellipse', cx: 5, cy: 6, rx: 7, ry: 8, fill: 'brand.secondary' },
      { t: 'line', x1: 1, y1: 2, x2: 3, y2: 4, stroke: 'text.primary' },
      { t: 'path', d: 'M 0 0 L 10 10 Z', fill: 'brand.secondary' },
      { t: 'poly', pts: [[0, 0], [10, 0], [5, 8.5]], fill: 'brand.secondary' },
    ]);
    expect(nodes.map((n) => n.tag)).toEqual(['rect', 'circle', 'ellipse', 'line', 'path', 'polygon']);
    expect(nodes.map((n) => n.geometry)).toEqual([
      { x: 1, y: 2, width: 3, height: 4 },
      { cx: 5, cy: 6, r: 7 },
      { cx: 5, cy: 6, rx: 7, ry: 8 },
      { x1: 1, y1: 2, x2: 3, y2: 4 },
      { d: 'M 0 0 L 10 10 Z' },
      { points: '0,0 10,0 5,8.5' },
    ]);
  });

  it('fills nothing unless asked: a stroke-only shape has fill none', () => {
    const [a, b] = drawnProp([
      { t: 'circle', cx: 5, cy: 5, r: 4, stroke: 'text.primary' },
      { t: 'circle', cx: 5, cy: 5, r: 4, fill: 'none', stroke: 'text.primary', sw: 'thin' },
    ]);
    expect(a!.paint).toMatchObject({ fill: 'none', strokeWidth: 2 });
    expect(b!.paint).toMatchObject({ fill: 'none', strokeWidth: 1 });
  });

  it('omits stroke and opacity attributes that were not asked for', () => {
    const [node] = drawnProp([{ t: 'circle', cx: 5, cy: 5, r: 4, fill: 'brand.secondary' }]);
    expect(node!.paint).toEqual({ fill: resolveColor('brand.secondary') });
  });

  it('draws nothing for a shape with neither fill nor stroke, or with an unknown or reserved token', () => {
    const nodes = drawnProp([
      { t: 'circle', cx: 5, cy: 5, r: 4 },
      { t: 'circle', cx: 5, cy: 5, r: 4, fill: 'none' },
      { t: 'circle', cx: 5, cy: 5, r: 4, fill: 'not.a-token' as never },
      { t: 'circle', cx: 5, cy: 5, r: 4, fill: 'brand.secondary', stroke: 'surface.overlay' as never },
      { t: 'circle', cx: 5, cy: 5, r: 4, fill: 'brand.secondary', stroke: 'text.primary', sw: 'wide' as never },
      { t: 'circle', cx: 5, cy: 5, r: 4, fill: 'brand.secondary' },
    ]);
    expect(nodes).toHaveLength(1);
  });

  it('draws nothing for a malformed path, a short polygon or an unknown kind', () => {
    const nodes = drawnProp([
      { t: 'path', d: 'M 0 0 l 4 4', fill: 'brand.secondary' },
      { t: 'poly', pts: [[0, 0], [1, 1]], fill: 'brand.secondary' },
      { t: 'star', fill: 'brand.secondary' } as unknown as Shape,
    ]);
    expect(nodes).toEqual([]);
  });
});

describe('drawScene: cards', () => {
  it('places a card layer bottom-centre for the react-native renderer', () => {
    const scene = drawScene(makeArt({ layers: [{ ref: 'card:book', x: 200, y: 250, s: 1.5, flip: true }] }), registry);
    expect(scene.issues).toEqual([]);
    const card = scene.items.find((i) => i.tag === 'card');
    expect(card).toEqual({ tag: 'card', key: 'c0', ref: 'card:book', size: CARD_SIZE, transform: `matrix(-1.5 0 0 1.5 ${200 + 1.5 * (CARD_SIZE / 2)} ${250 - 1.5 * CARD_SIZE})` });
  });

  it('keeps a card in its band', () => {
    const scene = drawScene(makeArt({ layers: [{ ref: 'card:book', x: 100, y: 250, z: 'front' }, { ref: 'prop:desk', x: 200, y: 250 }, { ref: 'card:moon', x: 300, y: 250, z: 'back' }] }), registry);
    const refs = scene.items.map((i) => (i.tag === 'card' ? i.ref : i.layerIndex === -1 ? 'setting' : 'prop'));
    expect(refs.filter((r, i) => refs.indexOf(r) === i)).toEqual(['setting', 'card:moon', 'prop', 'card:book']);
  });

  it('places an unflipped card at its anchor', () => {
    const scene = drawScene(makeArt({ layers: [{ ref: 'card:book', x: 200, y: 250 }] }), registry);
    const card = scene.items.find((i) => i.tag === 'card');
    expect(card).toMatchObject({ transform: `matrix(1 0 0 1 ${200 - CARD_SIZE / 2} ${250 - CARD_SIZE})` });
  });
});

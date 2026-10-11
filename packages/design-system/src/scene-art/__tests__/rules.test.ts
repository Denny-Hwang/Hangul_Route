import { describe, expect, it } from 'vitest';
import { HOYA_POSES, hoyaItem } from '../hoya';
import { paletteOf, resolveScene } from '../resolve';
import { LIMITS, cappedPalette, checkItem, checkScene, serializedBytes, type Finding } from '../rules';
import type { ColorToken, ItemDef, Shape } from '../types';
import { makeArt, makeHoya, makeProp, makeRegistry, makeSetting } from './fixtures';

const ids = (f: Finding[]): string[] => f.map((x) => x.rule);

function rects(n: number, fill: ColorToken = 'surface.paper', extra: Partial<Shape> = {}): Shape[] {
  return Array.from({ length: n }, (_, i) => ({ t: 'rect', x: i % 10, y: 0, w: 1, h: 1, fill, ...extra }) as Shape);
}

describe('serializedBytes', () => {
  it('measures UTF-8 bytes of the JSON form', () => {
    expect(serializedBytes({ a: 1 })).toBe(7);
    expect(serializedBytes('한')).toBe(5);
  });
});

describe('checkItem', () => {
  it('passes the baseline prop, setting and Hoya', () => {
    expect(checkItem(makeProp())).toEqual([]);
    expect(checkItem(makeSetting())).toEqual([]);
    expect(checkItem(makeHoya())).toEqual([]);
  });

  it('caps shapes at 40 for a prop and 60 for a setting', () => {
    expect(ids(checkItem(makeProp({ nodes: rects(40) })))).not.toContain('I-shapes');
    const over = checkItem(makeProp({ nodes: rects(41) }));
    expect(over).toContainEqual(expect.objectContaining({ rule: 'I-shapes', severity: 'error' }));
    expect(ids(checkItem(makeSetting({ nodes: rects(60) })))).not.toContain('I-shapes');
    expect(ids(checkItem(makeSetting({ nodes: rects(61) })))).toContain('I-shapes');
    expect(LIMITS.propShapes).toBe(40);
    expect(LIMITS.settingShapes).toBe(60);
  });

  it('counts shapes inside groups', () => {
    const item = makeProp({ nodes: [{ t: 'group', kids: rects(41) }] });
    expect(ids(checkItem(item))).toContain('I-shapes');
  });

  it('caps distinct colour tokens at 5 for a prop and 6 for a setting', () => {
    const five: Shape[] = (['theme.life', 'theme.rites', 'theme.crafts', 'stage.stage1', 'stage.stage2'] as const).map((fill, i) => ({ t: 'rect', x: i, y: 0, w: 1, h: 1, fill }));
    const six: Shape[] = [...five, { t: 'rect', x: 6, y: 0, w: 1, h: 1, fill: 'stage.stage3' }];
    const seven: Shape[] = [...six, { t: 'rect', x: 7, y: 0, w: 1, h: 1, fill: 'stage.stage4' }];
    expect(ids(checkItem(makeProp({ nodes: five })))).not.toContain('I-palette');
    expect(ids(checkItem(makeProp({ nodes: six })))).toContain('I-palette');
    expect(ids(checkItem(makeSetting({ nodes: six })))).not.toContain('I-palette');
    expect(ids(checkItem(makeSetting({ nodes: seven })))).toContain('I-palette');
  });

  it("exempts Hoya's fixed character palette from the colour cap, and nothing else", () => {
    for (const pose of HOYA_POSES) expect(checkItem(hoyaItem(pose)), pose).toEqual([]);
    // a hoya:* item drawing a token outside his palette is held to the cap
    const extra = hoyaItem('idle');
    const recoloured = { ...extra, nodes: [...extra.nodes, { t: 'rect', x: 0, y: 0, w: 1, h: 1, fill: 'theme.life' } as Shape] };
    expect(ids(checkItem(recoloured))).toContain('I-palette');
    // so is any other item drawing Hoya's shapes, and an unknown pose
    expect(ids(checkItem({ ...hoyaItem('idle'), id: 'prop:tiger' }))).toContain('I-palette');
    expect(ids(checkItem({ ...hoyaItem('idle'), id: 'hoya:dancing' }))).toContain('I-palette');
  });

  it('requires every shape inside the box', () => {
    expect(ids(checkItem(makeProp({ nodes: [{ t: 'rect', x: 95, y: 0, w: 10, h: 5, fill: 'surface.paper' }] })))).toContain('I-box');
    expect(ids(checkItem(makeProp({ nodes: [{ t: 'rect', x: -1, y: 0, w: 5, h: 5, fill: 'surface.paper' }] })))).toContain('I-box');
    expect(ids(checkItem(makeProp({ nodes: [{ t: 'group', tx: 99, kids: [{ t: 'rect', x: 0, y: 0, w: 5, h: 5, fill: 'surface.paper' }] }] })))).toContain('I-box');
    expect(ids(checkItem(makeProp({ nodes: [{ t: 'rect', x: 0, y: 0, w: 100, h: 80, fill: 'surface.paper' }] })))).not.toContain('I-box');
  });

  it('limits detail shapes to half of the item', () => {
    const half = [...rects(2), ...rects(2, 'surface.paper', { det: true })];
    expect(ids(checkItem(makeProp({ nodes: half })))).not.toContain('I-detail');
    const more = [...rects(1), ...rects(2, 'surface.paper', { det: true })];
    expect(ids(checkItem(makeProp({ nodes: more })))).toContain('I-detail');
  });

  it('limits brand.primary to 15 percent of the shapes', () => {
    const red = (n: number): Shape[] => rects(n, 'brand.primary');
    const ok = [...red(3), ...rects(17)];
    const bad = [...red(4), ...rects(16)];
    expect(ids(checkItem(makeProp({ nodes: ok })))).not.toContain('I-red');
    expect(ids(checkItem(makeProp({ nodes: bad })))).toContain('I-red');
    // a stroke counts too
    const stroked = [...rects(4, 'surface.paper', { stroke: 'brand.primary' }), ...rects(16)];
    expect(ids(checkItem(makeProp({ nodes: stroked })))).toContain('I-red');
  });

  it('rejects unknown, reserved and literal colours', () => {
    for (const bad of ['feedback.danger', 'surface.overlay', 'surface.inkScrim', '#ff0000', 'theme.nope']) {
      const f = checkItem(makeProp({ nodes: [{ t: 'rect', x: 0, y: 0, w: 1, h: 1, fill: bad as ColorToken }] }));
      expect(ids(f), bad).toContain('I-color');
    }
    const stroke = checkItem(makeProp({ nodes: [{ t: 'rect', x: 0, y: 0, w: 1, h: 1, stroke: 'rgb(1,2,3)' as ColorToken }] }));
    expect(ids(stroke)).toContain('I-color');
    // 'none' is a legal fill
    expect(ids(checkItem(makeProp({ nodes: [{ t: 'rect', x: 0, y: 0, w: 1, h: 1, fill: 'none', stroke: 'text.primary' }] })))).not.toContain('I-color');
    // a bad tintable is caught too
    expect(ids(checkItem(makeProp({ tintable: 'feedback.danger' as ColorToken })))).toContain('I-color');
    expect(ids(checkItem(makeProp({ tintable: 'brand.secondary' })))).not.toContain('I-color');
  });

  it('allows only the eight shape kinds', () => {
    const f = checkItem(makeProp({ nodes: [{ t: 'text', x: 0, y: 0 } as unknown as Shape, { t: 'image' } as unknown as Shape] }));
    expect(f.filter((x) => x.rule === 'I-kind')).toHaveLength(2);
  });

  it('enforces the shape grammar', () => {
    const bad = (shape: unknown): string[] => ids(checkItem(makeProp({ nodes: [shape as Shape] })));
    expect(bad({ t: 'path', d: 'M 0 0 l 1 1' })).toContain('I-grammar');
    expect(bad({ t: 'path', d: `M 0 0 ${'L 1 1 '.repeat(50)}` })).toContain('I-grammar');
    expect(bad({ t: 'path', d: 'M 0 0 L 1 1 Z' })).not.toContain('I-grammar');
    expect(bad({ t: 'poly', pts: [[0, 0], [1, 1]] })).toContain('I-grammar');
    expect(bad({ t: 'poly', pts: Array.from({ length: 17 }, (_, i) => [i, 0]) })).toContain('I-grammar');
    expect(bad({ t: 'poly', pts: Array.from({ length: 16 }, (_, i) => [i, i % 2]) })).not.toContain('I-grammar');
    expect(bad({ t: 'poly', pts: [[0, 0], [1, 1], [2, 0]] })).not.toContain('I-grammar');
    expect(bad({ t: 'rect', x: 1.3, y: 0, w: 1, h: 1 })).toContain('I-grammar');
    expect(bad({ t: 'rect', x: 1.5, y: 0, w: 1, h: 1 })).not.toContain('I-grammar');
    expect(bad({ t: 'circle', cx: 1, cy: 1, r: 'x' })).toContain('I-grammar');
    expect(bad({ t: 'circle', cx: 1, cy: 1, r: Number.NaN })).toContain('I-grammar');
    expect(bad({ t: 'poly', pts: [[0, 0], [1, 0.3], [2, 0]] })).toContain('I-grammar');
    expect(bad({ t: 'path', d: 'M 0 0.3 L 1 1' })).toContain('I-grammar');
    expect(bad({ t: 'line', x1: 0, y1: 0, x2: 1, y2: 1, sw: 'huge' })).toContain('I-grammar');
    expect(bad({ t: 'line', x1: 0, y1: 0, x2: 1, y2: 1, stroke: 'text.primary', sw: 'thin' })).not.toContain('I-grammar');
    expect(bad({ t: 'rect', x: 0, y: 0, w: 1, h: 1, o: 0.5 })).toContain('I-grammar');
    expect(bad({ t: 'rect', x: 0, y: 0, w: 1, h: 1, o: 0.35 })).not.toContain('I-grammar');
    expect(bad({ t: 'group', tx: 0.3, kids: [] })).toContain('I-grammar');
    expect(bad({ t: 'group', ty: 0.7, kids: [] })).toContain('I-grammar');
    expect(bad({ t: 'group', tx: 2, ty: 3, kids: [] })).not.toContain('I-grammar');
    expect(bad({ t: 'group', kids: [{ t: 'group', kids: [] }] })).toContain('I-grammar');
  });

  it('requires a source for heritage artefacts', () => {
    const heritage = makeProp({ kind: 'object', tags: { heritage: true } });
    expect(checkItem(heritage)).toContainEqual(expect.objectContaining({ rule: 'I-heritage', severity: 'error' }));
    const sourced = makeProp({
      kind: 'object',
      tags: { heritage: true },
      sourceRef: { title: 'Jikji', publisher: 'Cultural Heritage Administration', url: 'https://example.org/jikji', accessed: '2026-10-10' },
      accuracyNote: 'Cover and stitching simplified.',
    });
    expect(ids(checkItem(sourced))).not.toContain('I-heritage');
    expect(ids(checkItem(makeProp({ kind: 'object' })))).not.toContain('I-heritage');
    expect(ids(checkItem(makeProp({ kind: 'furniture', tags: { heritage: true } })))).not.toContain('I-heritage');
  });

  it('holds heritage buildings to the same rule, and needs an accuracyNote too (§3.9.10)', () => {
    const sourceRef = { title: 'Hwaseong', publisher: 'Encyclopedia of Korean Culture', url: 'https://example.org/hwaseong', accessed: '2026-10-10' };
    const building = makeProp({ kind: 'architecture', tags: { heritage: true } });
    expect(checkItem(building)).toContainEqual(expect.objectContaining({ rule: 'I-heritage', severity: 'error' }));
    const noNote = checkItem(makeProp({ kind: 'architecture', tags: { heritage: true }, sourceRef }));
    expect(noNote).toContainEqual(expect.objectContaining({ rule: 'I-heritage', message: expect.stringContaining('accuracyNote') }));
    expect(ids(checkItem(makeProp({ kind: 'object', tags: { heritage: true }, sourceRef })))).toContain('I-heritage');
    expect(ids(checkItem(makeProp({ kind: 'architecture', tags: { heritage: true }, sourceRef, accuracyNote: 'Gate roof simplified.' })))).not.toContain('I-heritage');
    expect(ids(checkItem(makeProp({ kind: 'architecture' })))).not.toContain('I-heritage');
  });

  it('limits serialised size to 3 KB for a prop and 6 KB for a setting', () => {
    const pad = (item: ItemDef, bytes: number): ItemDef => ({ ...item, alt: 'x'.repeat(bytes - serializedBytes({ ...item, alt: '' })) });
    const propAtLimit = pad(makeProp(), LIMITS.propBytes);
    expect(serializedBytes(propAtLimit)).toBe(LIMITS.propBytes);
    expect(ids(checkItem(propAtLimit))).not.toContain('I-size');
    expect(ids(checkItem(pad(makeProp(), LIMITS.propBytes + 1)))).toContain('I-size');
    const settingAtLimit = pad(makeSetting(), LIMITS.settingBytes);
    expect(ids(checkItem(settingAtLimit))).not.toContain('I-size');
    expect(ids(checkItem(pad(makeSetting(), LIMITS.settingBytes + 1)))).toContain('I-size');
    expect(LIMITS.propBytes).toBe(3072);
    expect(LIMITS.settingBytes).toBe(6144);
  });

  it('requires a setting to declare a horizon inside its box', () => {
    expect(ids(checkItem(makeSetting({ horizonY: undefined })))).toContain('I-horizon');
    expect(ids(checkItem(makeSetting({ horizonY: 301 })))).toContain('I-horizon');
    expect(ids(checkItem(makeSetting({ horizonY: -1 })))).toContain('I-horizon');
    expect(ids(checkItem(makeSetting({ horizonY: 0 })))).not.toContain('I-horizon');
    expect(ids(checkItem(makeProp()))).not.toContain('I-horizon');
  });

  it('tolerates an item with no nodes', () => {
    expect(checkItem(makeProp({ nodes: [] }))).toEqual([]);
  });
});

describe('checkScene', () => {
  const reg = makeRegistry([makeHoya({ id: 'hoya:waving' })]);

  it('passes the baseline scene, with and without Hoya', () => {
    expect(checkScene(makeArt(), reg)).toEqual([]);
    const withHoya = makeArt({ layers: [{ ref: 'prop:desk', x: 200, y: 220, s: 1.5 }, { ref: 'hoya:idle', x: 100, y: 250, s: 0.8 }] });
    expect(checkScene(withHoya, reg)).toEqual([]);
  });

  it('reports unresolved and ill-tinted layers as errors', () => {
    const art = makeArt({ layers: [{ ref: 'prop:ghost', x: 10, y: 250 }, { ref: 'prop:desk', x: 200, y: 220, s: 1.5, tint: 'theme.rites' }] });
    const f = checkScene(art, reg).filter((x) => x.rule === 'S-resolve');
    expect(f).toHaveLength(2);
    expect(f.every((x) => x.severity === 'error')).toBe(true);
    expect(f[0]).toMatchObject({ layerIndex: 0, ref: 'prop:ghost' });
    const noSetting = checkScene(makeArt({ setting: 'scene:missing' }), reg);
    expect(ids(noSetting)).toContain('S-resolve');
    expect(ids(noSetting)).not.toContain('S-horizon');
    expect(ids(noSetting)).not.toContain('S-ground');
  });

  it('keeps layer anchors inside the canvas and overhang within 20 units', () => {
    const at = (x: number, y = 220): string[] => ids(checkScene(makeArt({ layers: [{ ref: 'prop:desk', x, y, s: 1.5 }] }), reg));
    expect(at(401)).toContain('S-canvas');
    expect(at(-1)).toContain('S-canvas');
    expect(at(200, 301)).toContain('S-canvas');
    expect(at(200, -1)).toContain('S-canvas');
    expect(at(380)).toContain('S-canvas');
    expect(at(345)).not.toContain('S-canvas');
    expect(at(54)).toContain('S-canvas');
    expect(at(55)).not.toContain('S-canvas');
        expect(checkScene(makeArt({ layers: [{ ref: 'prop:desk', x: 401, y: 220, s: 1.5 }] }), reg).find((x) => x.rule === 'S-canvas')).toMatchObject({ severity: 'error', layerIndex: 0 });
  });

  it('wants upright items to stand on the ground, except symbols and sky', () => {
    const on = (item: ItemDef, y: number): string[] => {
      const r = makeRegistry([item]);
      return ids(checkScene(makeArt({ layers: [{ ref: item.id, x: 200, y, s: 1.5 }] }), r));
    };
    expect(on(makeProp(), 150)).toContain('S-horizon');
    expect(on(makeProp(), 180)).not.toContain('S-horizon');
    expect(on(makeProp({ id: 'prop:star', kind: 'symbol' }), 150)).not.toContain('S-horizon');
    expect(on(makeProp({ id: 'prop:cloud', kind: 'nature', tags: { sky: true } }), 150)).not.toContain('S-horizon');
    expect(on(makeProp({ id: 'prop:tree', kind: 'nature' }), 150)).toContain('S-horizon');
    const f = checkScene(makeArt({ layers: [{ ref: 'prop:desk', x: 200, y: 150, s: 1.5 }] }), reg).find((x) => x.rule === 'S-horizon');
    expect(f).toMatchObject({ severity: 'warning', layerIndex: 0 });
  });

  it('needs a focal layer, central or on a third line', () => {
    const none = makeArt({ layers: [{ ref: 'prop:desk', x: 200, y: 220, s: 1.5, z: 'back' }, { ref: 'prop:desk', x: 100, y: 220, s: 1.5, z: 'front' }] });
    expect(ids(checkScene(none, reg))).toContain('S-focal');
    expect(ids(checkScene(makeArt({ layers: [] }), reg))).toContain('S-focal');
    const at = (x: number, y: number): string[] => ids(checkScene(makeArt({ layers: [{ ref: 'prop:desk', x, y, s: 1 }] }), reg));
    expect(at(40, 280)).toContain('S-focal');
    expect(at(360, 280)).toContain('S-focal');
    expect(at(134, 280)).not.toContain('S-focal');
    expect(at(266, 280)).not.toContain('S-focal');
    expect(at(40, 230)).not.toContain('S-focal'); // vertical centre on the lower third line
    expect(at(40, 130)).not.toContain('S-focal'); // vertical centre on the upper third line
    expect(checkScene(makeArt({ layers: [{ ref: 'prop:desk', x: 40, y: 280 }] }), reg).find((x) => x.rule === 'S-focal')).toMatchObject({ severity: 'warning' });
  });

  it('takes the largest mid item or Hoya as the focus and ignores card layers', () => {
    // Hoya bigger than the desk: Hoya is the focus and sits off-centre -> flagged
    const art = makeArt({ layers: [{ ref: 'prop:desk', x: 200, y: 220, s: 0.5 }, { ref: 'hoya:idle', x: 40, y: 280, s: 1 }] });
    expect(ids(checkScene(art, reg))).toContain('S-focal');
    const card = makeArt({ layers: [{ ref: 'card:hangul-day', x: 200, y: 250 }, { ref: 'prop:desk', x: 200, y: 220, s: 1.5 }] });
    expect(ids(checkScene(card, reg))).not.toContain('S-focal');
  });

  it('flags layers that overlap more than 60 percent unless one is back', () => {
    const two = (z?: 'back'): string[] =>
      ids(checkScene(makeArt({ layers: [{ ref: 'prop:desk', x: 200, y: 220, s: 1.5 }, { ref: 'prop:desk', x: 205, y: 220, s: 1.5, ...(z ? { z } : {}) }] }), reg));
    expect(two()).toContain('S-overlap');
    expect(two('back')).not.toContain('S-overlap');
    const apart = makeArt({ layers: [{ ref: 'prop:desk', x: 150, y: 220, s: 1 }, { ref: 'prop:desk', x: 250, y: 220, s: 1 }] });
    expect(ids(checkScene(apart, reg))).not.toContain('S-overlap');
    // exactly 60 percent is allowed, 61 is not
    const sixty = makeArt({ layers: [{ ref: 'prop:desk', x: 150, y: 220, s: 1 }, { ref: 'prop:desk', x: 190, y: 220, s: 1 }] });
    expect(ids(checkScene(sixty, reg))).not.toContain('S-overlap');
    const sixtyOne = makeArt({ layers: [{ ref: 'prop:desk', x: 150, y: 220, s: 1 }, { ref: 'prop:desk', x: 189, y: 220, s: 1 }] });
    expect(ids(checkScene(sixtyOne, reg))).toContain('S-overlap');
  });

  describe('Hoya', () => {
    const hoyaScene = (...layers: Array<{ ref: string; x: number; y: number; s?: number; z?: 'back' | 'mid' | 'front' }>): Finding[] =>
      checkScene(makeArt({ layers: [{ ref: 'prop:desk', x: 200, y: 220, s: 1.5 }, ...layers] }), reg);

    it('allows one, at scale 0.5 to 1.1', () => {
      expect(ids(hoyaScene({ ref: 'hoya:idle', x: 60, y: 250, s: 0.5 }, { ref: 'hoya:waving', x: 340, y: 250, s: 0.5 }))).toContain('S-hoya-count');
      expect(ids(hoyaScene({ ref: 'hoya:idle', x: 60, y: 250, s: 0.5 }))).not.toContain('S-hoya-scale');
      expect(ids(hoyaScene({ ref: 'hoya:idle', x: 60, y: 250 }))).not.toContain('S-hoya-scale'); // s defaults to 1
      expect(ids(hoyaScene({ ref: 'hoya:idle', x: 60, y: 250, s: 1.1 }))).not.toContain('S-hoya-scale');
      expect(ids(hoyaScene({ ref: 'hoya:idle', x: 60, y: 250, s: 0.49 }))).toContain('S-hoya-scale');
      expect(ids(hoyaScene({ ref: 'hoya:idle', x: 60, y: 250, s: 1.2 }))).toContain('S-hoya-scale');
      expect(hoyaScene({ ref: 'hoya:idle', x: 60, y: 250, s: 1.2 }).find((x) => x.rule === 'S-hoya-scale')).toMatchObject({ severity: 'error', layerIndex: 1 });
    });

    it('lives in the lower 60 percent of the canvas', () => {
      expect(ids(hoyaScene({ ref: 'hoya:idle', x: 60, y: 110, s: 0.5 }))).toContain('S-hoya-place');
      expect(ids(hoyaScene({ ref: 'hoya:idle', x: 60, y: 250, s: 0.5 }))).not.toContain('S-hoya-place');
    });

    it('does not cover the focal artefact', () => {
      const covering = hoyaScene({ ref: 'hoya:idle', x: 200, y: 220, s: 1, z: 'front' });
      expect(ids(covering)).toContain('S-hoya-cover');
      // behind the focal item (drawn before it): a peek, allowed
      expect(ids(hoyaScene({ ref: 'hoya:idle', x: 200, y: 220, s: 1, z: 'back' }))).not.toContain('S-hoya-cover');
      // when Hoya is the focus there is nothing to cover
      const focus = makeArt({ layers: [{ ref: 'prop:desk', x: 200, y: 220, s: 0.3 }, { ref: 'hoya:idle', x: 200, y: 220, s: 1, z: 'front' }] });
      expect(ids(checkScene(focus, reg))).not.toContain('S-hoya-cover');
    });
  });

  it('caps the palette at 8 tokens and wants 2 surface or text tokens', () => {
    const wide = makeRegistry([
      makeProp({ id: 'prop:a', nodes: (['theme.life', 'theme.rites', 'theme.crafts', 'stage.stage1', 'stage.stage2'] as const).map((fill, i) => ({ t: 'rect', x: i, y: 0, w: 1, h: 1, fill }) as Shape) }),
      makeProp({ id: 'prop:b', nodes: (['stage.stage3', 'stage.stage4', 'stage.stage5', 'stage.stage6', 'stage.stage7'] as const).map((fill, i) => ({ t: 'rect', x: i, y: 0, w: 1, h: 1, fill }) as Shape) }),
    ]);
    const art = makeArt({ layers: [{ ref: 'prop:a', x: 100, y: 250, s: 3 }, { ref: 'prop:b', x: 200, y: 250, s: 1 }] });
    expect(checkScene(art, wide).find((x) => x.rule === 'S-palette-cap')).toMatchObject({ severity: 'error' });

    const dull = makeRegistry([
      makeSetting({ nodes: [{ t: 'rect', x: 0, y: 180, w: 400, h: 120, fill: 'theme.nature' }, { t: 'rect', x: 0, y: 0, w: 400, h: 180, fill: 'surface.canvas' }] }),
      makeProp({ id: 'prop:c', nodes: [{ t: 'rect', x: 0, y: 20, w: 100, h: 60, fill: 'theme.life' }] }),
    ]);
    const art2 = makeArt({ layers: [{ ref: 'prop:c', x: 200, y: 220, s: 1.5 }] });
    expect(checkScene(art2, dull).find((x) => x.rule === 'S-palette-ink')).toMatchObject({ severity: 'warning' });
  });

  // F-STORY-002 decision 15 (main session, under the owner's standing delegation,
  // 2026-10-11; §3.9.5 R-S5): Hoya's fixed character palette does not count toward
  // the scene cap; the cap applies to everything else in the scene, as checkItem
  // exempts his palette from the item cap.
  describe('palette cap leaves out Hoya', () => {
    const seven = (['theme.life', 'theme.rites', 'theme.crafts', 'stage.stage1', 'stage.stage2', 'stage.stage3', 'stage.stage4'] as const).map(
      (fill, i) => ({ t: 'rect', x: i, y: 0, w: 1, h: 1, fill }) as Shape,
    );
    // a two-token setting (surface.canvas, surface.sunken) and props drawing up to seven more
    const setting = makeSetting({ nodes: [{ t: 'rect', x: 0, y: 0, w: 400, h: 180, fill: 'surface.canvas' }, { t: 'rect', x: 0, y: 180, w: 400, h: 120, fill: 'surface.sunken' }] });
    const reg = (...items: ItemDef[]): Record<string, ItemDef> => makeRegistry([setting, ...HOYA_POSES.map(hoyaItem), ...items]);

    it('does not count the tokens only Hoya draws, in every pose', () => {
      // setting 2 + prop 5 = 7 tokens; every Hoya pose adds 7-9 tokens of his own
      const prop = makeProp({ id: 'prop:five', nodes: seven.slice(0, 5) });
      for (const pose of HOYA_POSES) {
        const art = makeArt({ layers: [{ ref: 'prop:five', x: 200, y: 250, s: 3 }, { ref: `hoya:${pose}`, x: 80, y: 280, s: 0.6 }] });
        const scene = resolveScene(art, reg(prop));
        expect(scene.stats.colors.length, pose).toBeGreaterThan(LIMITS.sceneColors);
        expect(cappedPalette(scene), pose).toEqual(['stage.stage1', 'stage.stage2', 'surface.canvas', 'surface.sunken', 'theme.crafts', 'theme.life', 'theme.rites']);
        expect(ids(checkScene(art, reg(prop))), pose).not.toContain('S-palette-cap');
      }
    });

    it('still counts a token Hoya shares with another item, through that item', () => {
      // hoya:idle draws surface.paper; the prop drawing it too makes it count: 2 + 6 + 1 = 9
      const prop = makeProp({ id: 'prop:six', nodes: [...seven.slice(0, 6), { t: 'rect', x: 0, y: 2, w: 1, h: 1, fill: 'surface.paper' }] });
      const art = makeArt({ layers: [{ ref: 'prop:six', x: 200, y: 250, s: 3 }, { ref: 'hoya:idle', x: 80, y: 280, s: 0.6 }] });
      expect(cappedPalette(resolveScene(art, reg(prop)))).toContain('surface.paper');
      expect(checkScene(art, reg(prop)).find((x) => x.rule === 'S-palette-cap')).toMatchObject({ severity: 'error', message: "9 colour tokens besides Hoya's own palette, at most 8" });
    });

    it('leaves out exactly the tokens only Hoya draws, in every pose', () => {
      // the setting draws surface.paper, which every pose but cheering shares with Hoya: it stays counted
      const paperSetting = makeSetting({ nodes: [{ t: 'rect', x: 0, y: 0, w: 400, h: 180, fill: 'surface.paper' }, { t: 'rect', x: 0, y: 180, w: 400, h: 120, fill: 'surface.sunken' }] });
      const prop = makeProp({ id: 'prop:five', nodes: seven.slice(0, 5) });
      const registry = makeRegistry([paperSetting, ...HOYA_POSES.map(hoyaItem), prop]);
      for (const pose of HOYA_POSES) {
        const art = makeArt({ layers: [{ ref: 'prop:five', x: 200, y: 250, s: 3 }, { ref: `hoya:${pose}`, x: 80, y: 280, s: 0.6 }] });
        const scene = resolveScene(art, registry);
        const capped = cappedPalette(scene);
        expect(capped, pose).toContain('surface.paper');
        expect(new Set([...capped, ...paletteOf(hoyaItem(pose))]), pose).toEqual(new Set(scene.stats.colors));
        expect(capped.filter((c) => !['surface.paper', 'surface.sunken', ...seven.slice(0, 5).map((s) => s.fill)].includes(c)), pose).toEqual([]);
      }
    });

    it('counts a colour a tint brings onto Hoya', () => {
      // setting 2 + prop 6 = 8 tokens; tinting Hoya's fur to a ninth token is not his fixed palette
      const prop = makeProp({ id: 'prop:six', nodes: seven.slice(0, 6) });
      const tinted = makeArt({ layers: [{ ref: 'prop:six', x: 200, y: 250, s: 3 }, { ref: 'hoya:idle', x: 80, y: 280, s: 0.6, tint: 'theme.nature' }] });
      expect(cappedPalette(resolveScene(tinted, reg(prop)))).toContain('theme.nature');
      expect(checkScene(tinted, reg(prop)).find((x) => x.rule === 'S-palette-cap')).toMatchObject({ severity: 'error', message: "9 colour tokens besides Hoya's own palette, at most 8" });
      // a tint to another token of his own palette stays outside the cap
      const own = makeArt({ layers: [{ ref: 'prop:six', x: 200, y: 250, s: 3 }, { ref: 'hoya:idle', x: 80, y: 280, s: 0.6, tint: 'hoya.furDark' }] });
      expect(ids(checkScene(own, reg(prop)))).not.toContain('S-palette-cap');
    });

    it('names Hoya in the cap message only when he is in the scene', () => {
      const prop = makeProp({ id: 'prop:seven', nodes: seven });
      const art = makeArt({ layers: [{ ref: 'prop:seven', x: 200, y: 250, s: 3 }] });
      expect(checkScene(art, reg(prop)).find((x) => x.rule === 'S-palette-cap')).toMatchObject({ message: '9 colour tokens, at most 8' });
    });

    it('applies the cap to everything else in the scene', () => {
      // setting 2 + prop 7 = 9 tokens without Hoya: an error with or without him
      const prop = makeProp({ id: 'prop:seven', nodes: seven });
      for (const layers of [[{ ref: 'prop:seven', x: 200, y: 250, s: 3 }], [{ ref: 'prop:seven', x: 200, y: 250, s: 3 }, { ref: 'hoya:waving', x: 80, y: 280, s: 0.6 }]]) {
        expect(ids(checkScene(makeArt({ layers }), reg(prop)))).toContain('S-palette-cap');
      }
    });

    it('keeps the other palette rules on the whole scene', () => {
      // the ink rule still reads Hoya's surface.paper: setting surface.canvas + Hoya surface.paper = 2
      const prop = makeProp({ id: 'prop:plain', nodes: [{ t: 'rect', x: 0, y: 20, w: 100, h: 60, fill: 'theme.life' }] });
      const dull = makeRegistry([makeSetting({ nodes: [{ t: 'rect', x: 0, y: 0, w: 400, h: 180, fill: 'surface.canvas' }, { t: 'rect', x: 0, y: 180, w: 400, h: 120, fill: 'theme.nature' }] }), hoyaItem('idle'), prop]);
      const without = makeArt({ layers: [{ ref: 'prop:plain', x: 200, y: 250, s: 1.5 }] });
      const withHoya = makeArt({ layers: [{ ref: 'prop:plain', x: 200, y: 250, s: 1.5 }, { ref: 'hoya:idle', x: 80, y: 280, s: 0.6 }] });
      expect(ids(checkScene(without, dull))).toContain('S-palette-ink');
      expect(ids(checkScene(withHoya, dull))).not.toContain('S-palette-ink');
    });
  });

  it('wants the focal item to differ from the ground', () => {
    const same = makeRegistry([makeProp({ id: 'prop:grass', nodes: [{ t: 'rect', x: 0, y: 20, w: 100, h: 60, fill: 'theme.nature' }, { t: 'rect', x: 0, y: 0, w: 10, h: 10, fill: 'surface.paper' }] })]);
    const art = makeArt({ layers: [{ ref: 'prop:grass', x: 200, y: 220, s: 1.5 }] });
    expect(checkScene(art, same).find((x) => x.rule === 'S-ground')).toMatchObject({ severity: 'warning' });
    // a setting with no shape at the horizon has no ground fill to compare
    const noGround = makeRegistry([makeSetting({ nodes: [{ t: 'rect', x: 0, y: 0, w: 400, h: 100, fill: 'surface.canvas' }] }), makeProp({ id: 'prop:grass', nodes: [{ t: 'rect', x: 0, y: 20, w: 100, h: 60, fill: 'theme.nature' }] })]);
    expect(ids(checkScene(art, noGround))).not.toContain('S-ground');
    // the focal item with no fills at all has no dominant fill
    const bare = makeRegistry([makeProp({ id: 'prop:grass', nodes: [{ t: 'rect', x: 0, y: 20, w: 100, h: 60, stroke: 'text.primary' }] })]);
    expect(ids(checkScene(art, bare))).not.toContain('S-ground');
    // shapes that cannot be measured are ignored; a smaller ground shape does not displace the biggest
    const messy = makeRegistry([
      makeSetting({ nodes: [{ t: 'path', d: 'garbage', fill: 'theme.life' }, { t: 'rect', x: 0, y: 180, w: 400, h: 120, fill: 'theme.nature' }, { t: 'rect', x: 0, y: 250, w: 20, h: 20, fill: 'theme.life' }] }),
      makeProp({ id: 'prop:grass', nodes: [{ t: 'path', d: 'garbage', fill: 'theme.life' }, { t: 'rect', x: 0, y: 20, w: 100, h: 60, fill: 'theme.nature' }] }),
    ]);
    expect(ids(checkScene(art, messy))).toContain('S-ground');
    // a setting whose only shape at the horizon is a stroke has no ground fill
    const strokeOnly = makeRegistry([makeSetting({ nodes: [{ t: 'rect', x: 0, y: 180, w: 400, h: 120, stroke: 'border.strong' }] }), makeProp({ id: 'prop:grass', nodes: [{ t: 'rect', x: 0, y: 20, w: 100, h: 60, fill: 'theme.nature' }] })]);
    expect(ids(checkScene(art, strokeOnly))).not.toContain('S-ground');
  });

  it('wants the focal item to be 25 percent of the height and survive the thumb', () => {
    const small = makeArt({ layers: [{ ref: 'prop:desk', x: 200, y: 220, s: 0.8 }] });
    expect(checkScene(small, reg).find((x) => x.rule === 'S-legible-size')).toMatchObject({ severity: 'warning' });
    const exact = makeArt({ layers: [{ ref: 'prop:desk', x: 200, y: 220, s: 1.25 }] }); // 60 * 1.25 = 75
    expect(ids(checkScene(exact, reg))).not.toContain('S-legible-size');

    const sparse = makeRegistry([
      makeProp({
        id: 'prop:sparse',
        nodes: [
          { t: 'rect', x: 0, y: 20, w: 100, h: 60, fill: 'text.secondary' },
          { t: 'circle', cx: 50, cy: 50, r: 5, fill: 'surface.paper', det: true },
          { t: 'circle', cx: 30, cy: 50, r: 5, fill: 'surface.paper', det: true },
          { t: 'circle', cx: 70, cy: 50, r: 5, fill: 'surface.paper', stroke: 'border.strong', sw: 'thin', det: true },
        ],
      }),
    ]);
    const art = makeArt({ layers: [{ ref: 'prop:sparse', x: 200, y: 220, s: 1.5 }] });
    expect(checkScene(art, sparse).find((x) => x.rule === 'S-legible-thumb')).toMatchObject({ severity: 'warning' });
  });

  it('caps layers at 8 and resolved shapes at 160 full and 80 thumb', () => {
    const nine = makeArt({ layers: Array.from({ length: 9 }, (_, i) => ({ ref: 'prop:desk', x: 20 + i * 40, y: 250 })) });
    expect(checkScene(nine, reg).find((x) => x.rule === 'S-layers')).toMatchObject({ severity: 'error' });
    const eight = makeArt({ layers: Array.from({ length: 8 }, (_, i) => ({ ref: 'prop:desk', x: 20 + i * 45, y: 250 })) });
    expect(ids(checkScene(eight, reg))).not.toContain('S-layers');

    const many = (n: number, extra: Partial<Shape> = {}) => makeProp({ id: `prop:m${n}`, nodes: rects(n, 'surface.paper', extra) });
    const big = makeRegistry([many(40), makeProp({ id: 'prop:d', nodes: rects(40, 'surface.paper', { det: true }) })]);
    const full = makeArt({ layers: [0, 1, 2, 3, 4].map((i) => ({ ref: 'prop:m40', x: 50 + i * 75, y: 250 })) });
    expect(checkScene(full, big).find((x) => x.rule === 'S-shapes')).toMatchObject({ severity: 'error' });
    // 5 x 40 detail-free shapes + setting: thumb count is also over 80
    expect(ids(checkScene(full, big))).toContain('S-shapes-thumb');
    // detail shapes vanish in the thumb: over 160 full but under 80 thumb
    const detail = makeArt({ layers: [0, 1, 2, 3, 4].map((i) => ({ ref: 'prop:d', x: 50 + i * 75, y: 250 })) });
    const f = ids(checkScene(detail, big));
    expect(f).toContain('S-shapes');
    expect(f).not.toContain('S-shapes-thumb');
    // under both
    const small = makeArt({ layers: [0, 1].map((i) => ({ ref: 'prop:m40', x: 100 + i * 100, y: 250 })) });
    const g = ids(checkScene(small, big));
    expect(g).not.toContain('S-shapes');
    expect(g).toContain('S-shapes-thumb');
    expect(ids(checkScene(makeArt({ layers: [{ ref: 'prop:m40', x: 200, y: 250 }] }), big))).not.toContain('S-shapes-thumb');
  });

  it('keeps one scene description under 700 bytes', () => {
    const fat = makeArt({ layers: [{ ref: `prop:${'a'.repeat(700)}`, x: 1, y: 1 }] });
    expect(checkScene(fat, reg).find((x) => x.rule === 'S-size')).toMatchObject({ severity: 'error' });
    expect(ids(checkScene(makeArt(), reg))).not.toContain('S-size');
    expect(LIMITS.sceneBytes).toBe(700);
  });

  it('checks the alt text', () => {
    const alt = (altEn: string): string[] => ids(checkScene(makeArt({ altEn }), reg));
    expect(alt('')).toContain('S-alt');
    expect(alt('   ')).toContain('S-alt');
    expect(alt('x'.repeat(141))).toContain('S-alt');
    expect(alt('x'.repeat(140))).not.toContain('S-alt');
    expect(alt('Hoya reads 한글 at a desk')).toContain('S-alt');
    expect(alt('Image of Hoya at a desk')).toContain('S-alt');
    expect(alt('  image of Hoya at a desk')).toContain('S-alt');
    expect(alt('Hoya reads at a desk')).not.toContain('S-alt');
    expect(checkScene(makeArt({ altEn: '' }), reg).find((x) => x.rule === 'S-alt')).toMatchObject({ severity: 'error' });
  });
});

import { HOYA_POSES, SCENE_ART_REGISTRY, checkScene, resolveScene, type ItemDef } from '@hangul-route/design-system/scene-art';
import { describe, expect, it } from 'vitest';
import { PREVIEW_SETTING_ID, buildLibrary, previewScene } from '../library';

describe('buildLibrary', () => {
  const lib = buildLibrary(SCENE_ART_REGISTRY);

  it('groups every registry entry into settings, props and the five Hoya poses', () => {
    const ids = [...lib.settings, ...lib.props, ...lib.hoya].map((e) => e.id).sort();
    expect(ids).toEqual(Object.keys(SCENE_ART_REGISTRY).sort());
    expect(lib.hoya.map((e) => e.id)).toEqual(HOYA_POSES.map((p) => `hoya:${p}`));
    expect(lib.settings.every((e) => e.kind === 'setting')).toBe(true);
    expect(lib.props.every((e) => e.kind !== 'setting')).toBe(true);
    expect(lib.settings.map((e) => e.id)).toEqual([...lib.settings.map((e) => e.id)].sort());
  });

  it('carries id, kind, box, palette, shape count, bytes, source and note', () => {
    const king = lib.props.find((e) => e.id === 'prop:fig-king')!;
    const def = SCENE_ART_REGISTRY['prop:fig-king']!;
    expect(king).toMatchObject({ kind: 'figure', box: def.box, z: def.z, alt: def.alt, accuracyNote: def.accuracyNote, sourceRef: def.sourceRef });
    expect(king.colors.length).toBeGreaterThan(1);
    expect(king.colors).toEqual([...king.colors].sort());
    expect(king.shapes).toBeGreaterThan(5);
    expect(king.bytes).toBeGreaterThan(200);
    expect(king.findings).toEqual([]);
  });

  it("leaves Hoya's palette cap out of his findings and says so", () => {
    for (const h of lib.hoya) {
      expect(h.findings.filter((f) => f.rule === 'I-palette')).toEqual([]);
      expect(h.paletteExempt).toBe(true);
    }
    expect(lib.props.every((e) => e.paletteExempt === false)).toBe(true);
  });

  it('reports item findings for a broken item', () => {
    const bad: ItemDef = { id: 'prop:bad', kind: 'object', box: { w: 10, h: 10 }, z: 'mid', alt: 'bad', nodes: [{ t: 'rect', x: 0, y: 0, w: 40, h: 4, fill: 'brand.primary' }] };
    const one = buildLibrary({ ...SCENE_ART_REGISTRY, [bad.id]: bad });
    expect(one.props.find((e) => e.id === 'prop:bad')!.findings.map((f) => f.rule)).toEqual(expect.arrayContaining(['I-box', 'I-red']));
  });
});

describe('previewScene', () => {
  it('draws a setting on its own', () => {
    const hall = SCENE_ART_REGISTRY['scene:palace-hall']!;
    const { art, registry } = previewScene(hall, SCENE_ART_REGISTRY);
    expect(art).toEqual({ setting: 'scene:palace-hall', layers: [], altEn: hall.alt });
    expect(registry).toBe(SCENE_ART_REGISTRY);
  });

  it('places a prop or Hoya on a blank setting, fitted inside the canvas and anchored at the bottom', () => {
    for (const id of ['prop:fig-king', 'prop:writing-set', 'prop:books-case', 'hoya:waving']) {
      const item = SCENE_ART_REGISTRY[id]!;
      const { art, registry } = previewScene(item, SCENE_ART_REGISTRY);
      expect(art.setting).toBe(PREVIEW_SETTING_ID);
      expect(art.layers).toHaveLength(1);
      const scene = resolveScene(art, registry);
      expect(scene.issues).toEqual([]);
      const b = scene.layers[0]!.bounds!;
      expect(b.minX, id).toBeGreaterThanOrEqual(0);
      expect(b.minY, id).toBeGreaterThanOrEqual(0);
      expect(b.maxX, id).toBeLessThanOrEqual(400);
      expect(b.maxY, id).toBeLessThanOrEqual(300);
      // fills most of the frame one way or the other, unless already drawn at the largest scale
      if ((art.layers[0]!.s ?? 1) < 3) expect(Math.max((b.maxX - b.minX) / 400, (b.maxY - b.minY) / 300), id).toBeGreaterThan(0.6);
      expect(checkScene(art, registry).filter((f) => f.rule === 'S-resolve')).toEqual([]);
    }
  });

  it('never scales a tiny item past 3', () => {
    const tiny: ItemDef = { id: 'prop:dot', kind: 'object', box: { w: 4, h: 4 }, z: 'mid', alt: 'a dot', nodes: [{ t: 'circle', cx: 2, cy: 2, r: 2, fill: 'text.primary' }] };
    expect(previewScene(tiny, { [tiny.id]: tiny }).art.layers[0]!.s).toBe(3);
  });
});

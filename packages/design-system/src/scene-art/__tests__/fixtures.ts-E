import type { ItemDef, SceneArtLike } from '../types';
import type { Registry } from '../resolve';

/** Shared builders for the scene-art suites. Not a test file. */

export function makeProp(overrides: Partial<ItemDef> = {}): ItemDef {
  return {
    id: 'prop:desk',
    kind: 'furniture',
    box: { w: 100, h: 80 },
    z: 'mid',
    alt: 'A low writing desk',
    nodes: [
      { t: 'rect', x: 0, y: 40, w: 100, h: 10, fill: 'brand.secondary' },
      { t: 'rect', x: 10, y: 50, w: 10, h: 30, fill: 'text.secondary' },
      { t: 'rect', x: 80, y: 50, w: 10, h: 30, fill: 'text.secondary' },
      { t: 'circle', cx: 50, cy: 30, r: 10, fill: 'surface.paper', stroke: 'border.strong', sw: 'base' },
    ],
    ...overrides,
  };
}

/** A 400 x 300 setting: pale wall above `horizonY`, green ground below. */
export function makeSetting(overrides: Partial<ItemDef> = {}): ItemDef {
  return {
    id: 'scene:hall',
    kind: 'setting',
    box: { w: 400, h: 300 },
    z: 'back',
    horizonY: 180,
    alt: 'A palace hall',
    nodes: [
      { t: 'rect', x: 0, y: 0, w: 400, h: 180, fill: 'surface.canvas' },
      { t: 'rect', x: 0, y: 180, w: 400, h: 120, fill: 'theme.nature' },
      { t: 'line', x1: 0, y1: 180, x2: 400, y2: 180, stroke: 'border.strong', sw: 'thin', d: true },
    ],
    ...overrides,
  };
}

export function makeHoya(overrides: Partial<ItemDef> = {}): ItemDef {
  return {
    id: 'hoya:idle',
    kind: 'figure',
    box: { w: 96, h: 96 },
    z: 'mid',
    alt: 'Hoya, standing',
    nodes: [
      { t: 'circle', cx: 48, cy: 48, r: 40, fill: 'hoya.fur', stroke: 'hoya.stripes', sw: 'base' },
      { t: 'ellipse', cx: 48, cy: 60, rx: 20, ry: 14, fill: 'surface.paper' },
      { t: 'circle', cx: 38, cy: 40, r: 4, fill: 'hoya.stripes' },
      { t: 'circle', cx: 58, cy: 40, r: 4, fill: 'hoya.stripes' },
    ],
    ...overrides,
  };
}

export function makeRegistry(extra: ItemDef[] = []): Registry {
  const items = [makeSetting(), makeProp(), makeHoya(), ...extra];
  return Object.fromEntries(items.map((i) => [i.id, i]));
}

export function makeArt(overrides: Partial<SceneArtLike> = {}): SceneArtLike {
  return {
    setting: 'scene:hall',
    layers: [{ ref: 'prop:desk', x: 200, y: 220, s: 1.5 }],
    altEn: 'Hoya sits at a low desk in a palace hall.',
    ...overrides,
  };
}

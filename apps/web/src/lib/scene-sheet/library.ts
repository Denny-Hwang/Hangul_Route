/**
 * The library page's view model (F-STORY-002 §3.9.6): every setting, prop and
 * Hoya pose with what a reviewer checks, and a way to draw one item on its
 * own through the same scene pipeline the app uses. Pure.
 */
import {
  SCENE_CANVAS,
  checkItem,
  nodeCount,
  paletteOf,
  serializedBytes,
  type ColorToken,
  type Finding,
  type ItemDef,
  type Registry,
  type SceneArtLike,
} from '@hangul-route/design-system/scene-art';

export interface LibraryEntry {
  id: string;
  kind: ItemDef['kind'];
  box: ItemDef['box'];
  z: ItemDef['z'];
  alt: string;
  colors: ColorToken[];
  shapes: number;
  bytes: number;
  tintable?: ColorToken;
  sourceRef?: ItemDef['sourceRef'];
  accuracyNote?: string;
  /** checkItem findings; Hoya's character palette cap is left out (he is a character, not a prop). */
  findings: Finding[];
  /** True for `hoya:*`: exempt from the item and scene palette caps (F-STORY-002 R-I, R-S5). */
  paletteExempt: boolean;
}

export interface Library {
  settings: LibraryEntry[];
  props: LibraryEntry[];
  /** In registry order: idle, cheering, thinking, reading, waving. */
  hoya: LibraryEntry[];
}

function entryOf(item: ItemDef): LibraryEntry {
  const hoya = item.id.startsWith('hoya:');
  return {
    id: item.id,
    kind: item.kind,
    box: item.box,
    z: item.z,
    alt: item.alt,
    colors: paletteOf(item),
    shapes: nodeCount(item.nodes),
    bytes: serializedBytes(item),
    ...(item.tintable ? { tintable: item.tintable } : {}),
    ...(item.sourceRef ? { sourceRef: item.sourceRef } : {}),
    ...(item.accuracyNote ? { accuracyNote: item.accuracyNote } : {}),
    findings: checkItem(item).filter((f) => !(hoya && f.rule === 'I-palette')),
    paletteExempt: hoya,
  };
}

export function buildLibrary(registry: Registry): Library {
  const items = Object.values(registry);
  const byId = (a: LibraryEntry, b: LibraryEntry): number => a.id.localeCompare(b.id);
  return {
    settings: items.filter((i) => i.kind === 'setting').map(entryOf).sort(byId),
    props: items.filter((i) => i.kind !== 'setting' && !i.id.startsWith('hoya:')).map(entryOf).sort(byId),
    hoya: items.filter((i) => i.id.startsWith('hoya:')).map(entryOf),
  };
}

/** A setting with nothing in it, for drawing one prop alone. */
export const PREVIEW_SETTING_ID = 'scene:preview-blank';
const BLANK: ItemDef = { id: PREVIEW_SETTING_ID, kind: 'setting', box: { w: SCENE_CANVAS.width, h: SCENE_CANVAS.height }, z: 'back', horizonY: SCENE_CANVAS.height, alt: 'blank', nodes: [] };
/** Share of the canvas a lone item may fill, and the largest scale it is drawn at. */
const FIT = 0.85;
const MAX_SCALE = 3;
const round2 = (v: number): number => Math.round(v * 100) / 100;

/** A one-item scene: a setting as itself, anything else centred on a blank setting, scaled to fit. */
export function previewScene(item: ItemDef, registry: Registry): { art: SceneArtLike; registry: Registry } {
  if (item.kind === 'setting') return { art: { setting: item.id, layers: [], altEn: item.alt }, registry };
  const { width: W, height: H } = SCENE_CANVAS;
  const s = round2(Math.min(MAX_SCALE, (FIT * W) / item.box.w, (FIT * H) / item.box.h));
  const bottom = H - ((1 - FIT) * H) / 2;
  return {
    art: { setting: PREVIEW_SETTING_ID, layers: [{ ref: item.id, x: W / 2, y: bottom, s }], altEn: item.alt },
    registry: { ...registry, [item.id]: item, [PREVIEW_SETTING_ID]: BLANK },
  };
}

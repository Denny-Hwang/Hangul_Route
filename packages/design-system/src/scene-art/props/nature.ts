/**
 * Nature props (F-STORY-002 §3.9.4, PR 2.10a). Animals have calm faces: an
 * eye dot at most, no mouth, no teeth.
 */
import type { ItemDef, Shape } from '../types';

/** A horse in side view, 110 x 80, grazing or walking with its head up; shared by the horse prop and the palanquin. */
export const horseShapes = (headUp = false): Shape[] => [
  { t: 'rect', x: 34, y: 44, w: 6, h: 30, r: 2, fill: 'text.secondary' },
  { t: 'rect', x: 76, y: 44, w: 6, h: 30, r: 2, fill: 'text.secondary' },
  { t: 'ellipse', cx: 60, cy: 38, rx: 30, ry: 15, fill: 'text.secondary' },
  { t: 'rect', x: 42, y: 44, w: 6, h: 30, r: 2, fill: 'text.secondary' },
  { t: 'rect', x: 84, y: 44, w: 6, h: 30, r: 2, fill: 'text.secondary' },
  headUp
    ? { t: 'path', d: 'M38 34 Q28 24 24 12 L12 9 Q7 12 11 17 L21 21 Q25 34 34 44 Z', fill: 'text.secondary' }
    : { t: 'path', d: 'M36 30 Q22 30 16 50 L10 64 Q9 71 15 71 L21 69 Q26 56 40 44 Z', fill: 'text.secondary' },
  headUp ? { t: 'path', d: 'M39 29 Q30 22 26 10', stroke: 'text.primary', sw: 'thick' } : { t: 'path', d: 'M37 26 Q24 29 18 48', stroke: 'text.primary', sw: 'thick' },
  { t: 'path', d: 'M89 32 Q100 40 97 60', stroke: 'text.primary', sw: 'thick' },
  { t: 'path', d: 'M33 74 H41 V78 H33 Z M41 74 H49 V78 H41 Z M75 74 H83 V78 H75 Z M83 74 H91 V78 H83 Z', fill: 'text.primary' },
  headUp ? { t: 'circle', cx: 17, cy: 13, r: 1.5, fill: 'text.primary', det: true } : { t: 'circle', cx: 15.5, cy: 61, r: 1.5, fill: 'text.primary', det: true },
];

export const HORSE: ItemDef = {
  id: 'prop:horse',
  kind: 'nature',
  box: { w: 110, h: 80 },
  z: 'mid',
  alt: 'A brown horse standing calmly, its head lowered to graze',
  accuracyNote:
    'A generic brown horse in side view, head lowered to the grass, calm and unhurt. No saddle, harness or breed is shown, so it claims nothing about the horses of any particular rider or event. The eye is a dot; there is no mouth.',
  nodes: [{ t: 'ellipse', cx: 56, cy: 78, rx: 50, ry: 2, fill: 'text.primary', o: 0.08, det: true }, ...horseShapes()],
};

export const PINE_TREE: ItemDef = {
  id: 'prop:pine-tree',
  kind: 'nature',
  box: { w: 90, h: 150 },
  z: 'mid',
  alt: 'A Korean red pine with a bending trunk and flat layers of needles',
  accuracyNote:
    'A generic Korean red pine (sonamu): a leaning, slightly bending trunk with flat, cloud-like layers of foliage, the shape common in Korean landscapes. Not a portrait of a named tree.',
  nodes: [
    { t: 'ellipse', cx: 46, cy: 148, rx: 24, ry: 2, fill: 'text.primary', o: 0.08, det: true },
    { t: 'path', d: 'M40 148 Q46 112 38 86 Q30 60 46 30 L52 32 Q38 60 46 86 Q54 114 52 148 Z', fill: 'text.secondary' },
    { t: 'path', d: 'M42 92 Q58 82 70 82 M40 62 Q28 56 20 56', stroke: 'text.secondary', sw: 'thick' },
    { t: 'ellipse', cx: 48, cy: 26, rx: 26, ry: 12, fill: 'theme.nature' },
    { t: 'ellipse', cx: 22, cy: 54, rx: 20, ry: 10, fill: 'theme.nature' },
    { t: 'ellipse', cx: 68, cy: 78, rx: 22, ry: 10, fill: 'theme.nature' },
    { t: 'ellipse', cx: 30, cy: 104, rx: 18, ry: 8, fill: 'theme.nature' },
    { t: 'path', d: 'M30 30 Q48 24 66 30 M10 58 Q22 54 34 58 M54 82 Q68 78 82 82 M18 108 Q30 104 42 108', stroke: 'text.secondary', sw: 'base', o: 0.35 },
  ],
};

export const FLAT_ROCK: ItemDef = {
  id: 'prop:flat-rock',
  kind: 'nature',
  box: { w: 70, h: 26 },
  z: 'mid',
  alt: 'A broad flat rock',
  accuracyNote: 'A generic flat grey rock of the kind found in a clear mountain stream, wide enough to sit on or to spread paper on.',
  nodes: [
    { t: 'path', d: 'M2 24 Q0 12 14 8 Q34 2 56 6 Q70 10 68 24 Z', fill: 'border.strong', stroke: 'text.secondary', sw: 'thin' },
    { t: 'path', d: 'M14 12 Q34 6 54 10', stroke: 'surface.paper', sw: 'base', o: 0.6, det: true },
  ],
};

import type { ItemDef } from '../types';

/** A plain warm paper wall over a wooden floor, for close-up scenes (F-STORY-002 PR 2.10a). */
export const HANJI_BACKDROP: ItemDef = {
  id: 'scene:hanji-backdrop',
  kind: 'setting',
  box: { w: 400, h: 300 },
  z: 'back',
  horizonY: 152,
  alt: 'A plain wall of warm paper over a wooden floor',
  accuracyNote:
    'A neutral stage for close-ups of books and objects: a wall covered in warm, pale paper with a few faint fibres, a dark skirting board and a floor of wide boards. It stands for no particular room or building and carries no pattern, seal or writing.',
  nodes: [
    { t: 'rect', x: 0, y: 0, w: 400, h: 152, fill: 'surface.canvas' },
    { t: 'path', d: 'M30 34 Q60 30 90 38 M150 76 Q180 70 214 80 M286 44 Q316 40 352 48 M60 118 Q96 112 128 120 M250 106 Q282 102 318 110', stroke: 'border.strong', sw: 'thin', o: 0.35, det: true },
    { t: 'path', d: 'M132 0 V142 M268 0 V142', stroke: 'border.strong', sw: 'base', o: 0.2 },
    { t: 'rect', x: 0, y: 142, w: 400, h: 12, fill: 'text.secondary' },
    { t: 'rect', x: 0, y: 154, w: 400, h: 146, fill: 'surface.sunken' },
    { t: 'path', d: 'M0 184 H400 M0 222 H400 M0 268 H400', stroke: 'border.strong', sw: 'thin', o: 0.6, det: true },
    { t: 'path', d: 'M96 154 L60 300 M208 154 V300 M316 154 L352 300', stroke: 'border.strong', sw: 'thin', o: 0.35, det: true },
  ],
};

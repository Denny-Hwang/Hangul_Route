import type { ItemDef } from '../types';

/** A Joseon palace hall seen across its stone courtyard (F-STORY-002 PR 2.3b). */
export const PALACE_COURTYARD: ItemDef = {
  id: 'scene:palace-courtyard',
  kind: 'setting',
  box: { w: 400, h: 300 },
  z: 'back',
  horizonY: 190,
  alt: 'A Joseon palace courtyard with a wooden hall, curved tiled roof and stone steps',
  accuracyNote:
    'A generic Joseon palace main hall seen straight on from its stone-paved courtyard: a stone platform with central steps, red wooden columns, pale latticed doors and a tiled roof with upturned eave corners (from the front a hip-and-gable roof shows this same outline; its side gables are not visible). The dark roof stands for grey clay tiles in the nearest warm token. It is not a copy of one named hall (Gyeongbokgung, Changdeokgung and others differ), and dancheong painting, rank stones and roof figurines are left out. No signboard or inscription is drawn.',
  nodes: [
    { t: 'rect', x: 0, y: 0, w: 400, h: 190, fill: 'brand.secondaryLight' },
    { t: 'path', d: 'M0 128 Q60 76 124 108 Q176 66 236 102 Q300 62 360 106 Q384 98 400 108 L400 190 L0 190 Z', fill: 'border.strong', o: 0.35 },
    // hall: wall, doors, columns, platform
    { t: 'rect', x: 80, y: 114, w: 240, h: 60, fill: 'surface.paper' },
    { t: 'path', d: 'M108 114 V174 M140 114 V174 M172 114 V174 M228 114 V174 M260 114 V174 M292 114 V174', stroke: 'border.strong', sw: 'thin', det: true },
    { t: 'path', d: 'M80 134 H320 M80 154 H320', stroke: 'border.strong', sw: 'thin', o: 0.35, det: true },
    { t: 'path', d: 'M76 110 H86 V176 H76 Z M136 110 H144 V176 H136 Z M196 110 H204 V176 H196 Z M256 110 H264 V176 H256 Z M314 110 H324 V176 H314 Z', fill: 'brand.primary' },
    { t: 'rect', x: 72, y: 106, w: 256, h: 10, fill: 'surface.sunken' },
    { t: 'rect', x: 56, y: 174, w: 288, h: 14, fill: 'border.strong' },
    // roof: hipped, the eave corners swept up
    { t: 'path', d: 'M126 52 L274 52 Q294 94 376 96 Q346 108 328 108 L72 108 Q54 108 24 96 Q106 94 126 52 Z', fill: 'text.secondary' },
    { t: 'path', d: 'M144 60 L132 98 M170 58 L160 100 M200 58 V102 M230 58 L240 100 M256 60 L268 98', stroke: 'surface.paper', sw: 'thin', o: 0.2, det: true },
    { t: 'rect', x: 120, y: 48, w: 160, h: 6, r: 2, fill: 'text.secondary' },
    // courtyard: steps and paving
    { t: 'rect', x: 0, y: 190, w: 400, h: 110, fill: 'surface.sunken' },
    { t: 'poly', pts: [[164, 188], [236, 188], [248, 204], [152, 204]], fill: 'border.strong' },
    { t: 'path', d: 'M156 196 H244', stroke: 'surface.sunken', sw: 'thin', det: true },
    { t: 'path', d: 'M0 224 H400 M0 256 H400 M0 288 H400 M132 204 L96 300 M268 204 L304 300', stroke: 'border.strong', sw: 'thin', o: 0.35, det: true },
  ],
};

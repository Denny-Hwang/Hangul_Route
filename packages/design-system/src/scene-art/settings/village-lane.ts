import type { ItemDef } from '../types';

/** A village lane between thatched houses (F-STORY-002 PR 2.3b). */
export const VILLAGE_LANE: ItemDef = {
  id: 'scene:village-lane',
  kind: 'setting',
  box: { w: 400, h: 300 },
  z: 'back',
  horizonY: 176,
  alt: 'A sunny village lane between two thatched-roof houses with hills behind',
  accuracyNote:
    'A generic Joseon commoner village: two thatched-roof houses (choga) with plain walls and wooden doors on a dirt lane, with hills behind. It is not a copy of one village or region; regional house shapes differ. Stalls, signs and anything with writing are left out, so it can serve as a lane or a market street.',
  nodes: [
    { t: 'rect', x: 0, y: 0, w: 400, h: 176, fill: 'brand.secondaryLight' },
    { t: 'path', d: 'M0 130 Q70 82 150 118 Q230 70 320 114 Q372 94 400 108 L400 176 L0 176 Z', fill: 'theme.nature', o: 0.6 },
    // left house
    { t: 'rect', x: 24, y: 120, w: 124, h: 56, fill: 'surface.paper' },
    { t: 'rect', x: 72, y: 134, w: 30, h: 42, r: 1, fill: 'text.secondary' },
    { t: 'path', d: 'M6 126 Q8 84 48 74 L112 74 Q152 84 166 126 Q86 112 6 126 Z', fill: 'feedback.nudge' },
    { t: 'path', d: 'M30 112 Q86 100 142 112 M24 98 Q86 84 150 98', stroke: 'text.secondary', sw: 'thin', o: 0.35, det: true },
    { t: 'rect', x: 108, y: 132, w: 24, h: 22, fill: 'text.secondary', o: 0.6, det: true },
    // right house
    { t: 'rect', x: 252, y: 124, w: 124, h: 52, fill: 'surface.paper' },
    { t: 'rect', x: 296, y: 136, w: 30, h: 40, r: 1, fill: 'text.secondary' },
    { t: 'path', d: 'M236 130 Q240 90 280 80 L348 80 Q388 90 394 130 Q316 116 236 130 Z', fill: 'feedback.nudge' },
    { t: 'path', d: 'M262 116 Q316 104 372 116 M254 102 Q316 90 380 102', stroke: 'text.secondary', sw: 'thin', o: 0.35, det: true },
    // a tree between and behind
    { t: 'rect', x: 196, y: 128, w: 6, h: 48, fill: 'text.secondary' },
    { t: 'circle', cx: 199, cy: 118, r: 20, fill: 'theme.nature' },
    // dirt lane
    { t: 'rect', x: 0, y: 176, w: 400, h: 124, fill: 'surface.sunken' },
    { t: 'poly', pts: [[150, 176], [250, 176], [340, 300], [60, 300]], fill: 'surface.paper', o: 0.6 },
    { t: 'path', d: 'M20 190 H120 M280 190 H380 M10 250 H70 M330 250 H392', stroke: 'text.secondary', sw: 'thin', o: 0.2, det: true },
  ],
};

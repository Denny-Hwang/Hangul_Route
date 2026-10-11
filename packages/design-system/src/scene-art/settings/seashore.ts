import type { ItemDef } from '../types';

/** A calm southern coast: sea, small islands and a sandy shore (F-STORY-002 PR 2.10c). */
export const SEASHORE: ItemDef = {
  id: 'scene:seashore',
  kind: 'setting',
  box: { w: 400, h: 300 },
  z: 'back',
  horizonY: 196,
  alt: 'A calm sea with small distant islands under a clear sky, and a sandy shore in front',
  accuracyNote:
    "A generic stretch of Korea's island-dotted southern coast; not a map of any harbour. No buildings, piers or boats are part of the setting, so scenes add their own.",
  nodes: [
    { t: 'rect', x: 0, y: 0, w: 400, h: 300, fill: 'brand.secondaryLight' },
    { t: 'path', d: 'M30 118 Q60 92 96 112 Q118 100 140 118 Z M250 118 Q290 86 336 110 Q356 100 380 118 Z', fill: 'theme.crafts', o: 0.35 },
    { t: 'rect', x: 0, y: 116, w: 400, h: 84, fill: 'theme.crafts' },
    { t: 'path', d: 'M20 140 Q40 134 60 140 M150 150 Q170 144 190 150 M300 136 Q320 130 340 136 M90 170 Q110 164 130 170 M240 176 Q260 170 280 176', stroke: 'surface.paper', sw: 'base', o: 0.6, det: true },
    { t: 'path', d: 'M0 198 Q100 188 200 196 Q300 204 400 192 V300 H0 Z', fill: 'feedback.nudgeLight' },
    { t: 'path', d: 'M0 200 Q100 190 200 198 Q300 206 400 194', stroke: 'surface.paper', sw: 'thick' },
    { t: 'path', d: 'M40 240 Q50 236 60 240 M300 262 Q310 258 320 262 M180 280 Q190 276 200 280', stroke: 'surface.paper', sw: 'thick', det: true },
  ],
};

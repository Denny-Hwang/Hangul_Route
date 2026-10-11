import type { ItemDef } from '../types';

/** Pine-covered mountain ridges with clouds below the peaks and a path in front (F-STORY-002 PR 2.10a). */
export const MOUNTAINS: ItemDef = {
  id: 'scene:mountains',
  kind: 'setting',
  box: { w: 400, h: 300 },
  z: 'back',
  horizonY: 196,
  alt: 'Steep green mountain ridges with clouds drifting below the peaks and a path in front',
  accuracyNote:
    'Generic Korean mountains: layered steep ridges, clouds drifting below the peaks and a grassy slope with a footpath. It stands for the deep-mountain archive sites (Odaesan, Taebaeksan and the like) without copying any one of them; the ridgelines are invented and no temple, archive or sign is part of the setting.',
  nodes: [
    { t: 'rect', x: 0, y: 0, w: 400, h: 196, fill: 'brand.secondaryLight' },
    { t: 'path', d: 'M0 110 L50 54 L96 92 L150 30 L214 96 L262 46 L320 98 L366 60 L400 84 V196 H0 Z', fill: 'theme.nature', o: 0.35 },
    { t: 'ellipse', cx: 120, cy: 100, rx: 64, ry: 10, fill: 'surface.paper', o: 0.85 },
    { t: 'ellipse', cx: 300, cy: 92, rx: 56, ry: 9, fill: 'surface.paper', o: 0.85 },
    { t: 'path', d: 'M0 150 Q40 104 92 128 Q140 90 196 132 Q246 100 300 126 Q350 100 400 120 V196 H0 Z', fill: 'theme.nature', o: 0.6 },
    { t: 'ellipse', cx: 220, cy: 138, rx: 70, ry: 8, fill: 'surface.paper', o: 0.6, det: true },
    { t: 'path', d: 'M0 184 Q70 158 150 176 Q240 156 320 172 Q366 162 400 168 V196 H0 Z', fill: 'theme.nature' },
    { t: 'rect', x: 0, y: 194, w: 400, h: 106, fill: 'feedback.successLight' },
    { t: 'path', d: 'M196 194 Q232 230 214 262 Q200 286 230 300 L170 300 Q150 284 170 258 Q186 230 178 194 Z', fill: 'surface.paper', o: 0.85 },
    { t: 'path', d: 'M40 230 Q50 222 60 230 M330 240 Q340 232 350 240 M80 282 Q90 274 100 282', stroke: 'theme.nature', sw: 'base', det: true },
  ],
};

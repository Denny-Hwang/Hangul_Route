import type { ItemDef } from '../types';

/** Pine-covered mountain ridges with clouds below the peaks and a path in front (F-STORY-002 PR 2.10a). */
export const MOUNTAINS: ItemDef = {
  id: 'scene:mountains',
  kind: 'setting',
  box: { w: 400, h: 300 },
  z: 'back',
  horizonY: 196,
  alt: 'Steep green mountain ridges with a bare rocky peak, pines and clouds drifting below the peaks, and a path in front',
  accuracyNote:
    'Generic Korean mountains: layered steep ridges, clouds drifting below the peaks and a grassy slope with a footpath. It stands for the deep-mountain archive sites (Odaesan, Taebaeksan and the like) without copying any one of them; the ridgelines, the bare granite peak and the pines are invented and no temple, archive or sign is part of the setting.',
  nodes: [
    { t: 'rect', x: 0, y: 0, w: 400, h: 196, fill: 'brand.secondaryLight' },
    { t: 'path', d: 'M0 110 L50 54 L96 92 L150 30 L214 96 L262 46 L320 98 L366 60 L400 84 V196 H0 Z', fill: 'theme.nature', o: 0.35 },
    // [PX] PX-4: a bare rocky peak with its crags, the signature the green ridges lacked
    { t: 'path', d: 'M150 30L136 58L144 56L132 80L166 80L158 60L170 64Z', fill: 'surface.paper', o: 0.85 },
    { t: 'path', d: 'M150 30L144 56M150 30L158 60M140 68L150 66', stroke: 'theme.nature', sw: 'base', o: 0.6 },
    { t: 'ellipse', cx: 120, cy: 100, rx: 64, ry: 10, fill: 'surface.paper', o: 0.85 },
    { t: 'ellipse', cx: 300, cy: 92, rx: 56, ry: 9, fill: 'surface.paper', o: 0.85 },
    { t: 'path', d: 'M0 150 Q40 104 92 128 Q140 90 196 132 Q246 100 300 126 Q350 100 400 120 V196 H0 Z', fill: 'theme.nature', o: 0.6 },
    { t: 'ellipse', cx: 220, cy: 138, rx: 70, ry: 8, fill: 'surface.paper', o: 0.6, det: true },
    { t: 'path', d: 'M0 184 Q70 158 150 176 Q240 156 320 172 Q366 162 400 168 V196 H0 Z', fill: 'theme.nature' },
    // [PX] PX-4: pines on the near ridge, darker than the hills
    { t: 'path', d: 'M22 142L10 162H17L2 179.5H20.5V186H23.5V179.5H42L27 162H34ZM50 146L41 161.5H46L34.5 175H48.5V180H51.5V175H65.5L54 161.5H59Z', fill: 'theme.nature' },
    { t: 'path', d: 'M352 136L340.5 155H347.5L333 171.5H350.5V178H353.5V171.5H371L356.5 155H363.5ZM380 148L371.5 162.5H376.5L365.5 175H378.5V180H381.5V175H394.5L383.5 162.5H388.5Z', fill: 'theme.nature' },
    { t: 'rect', x: 0, y: 194, w: 400, h: 106, fill: 'feedback.successLight' },
    { t: 'path', d: 'M196 194 Q232 230 214 262 Q200 286 230 300 L170 300 Q150 284 170 258 Q186 230 178 194 Z', fill: 'surface.paper', o: 0.85 },
    { t: 'path', d: 'M40 230 Q50 222 60 230 M330 240 Q340 232 350 240 M80 282 Q90 274 100 282', stroke: 'theme.nature', sw: 'base', det: true },
  ],
};

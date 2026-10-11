import type { ItemDef } from '../types';

/** A clear stream running between grassy banks below a ridge (F-STORY-002 PR 2.10a). */
export const MOUNTAIN_STREAM: ItemDef = {
  id: 'scene:mountain-stream',
  kind: 'setting',
  box: { w: 400, h: 300 },
  z: 'back',
  horizonY: 170,
  alt: 'A clear stream running over flat rocks between grassy banks, a green ridge behind',
  accuracyNote:
    'A generic clear stream with flat rocks below a wooded ridge. It stands for the stream by the government paper office where used drafts were washed (secho) but copies no surveyed place; the banks, rocks and ridgeline are invented and no pavilion, sign or carving is drawn.',
  nodes: [
    { t: 'rect', x: 0, y: 0, w: 400, h: 170, fill: 'brand.secondaryLight' },
    { t: 'path', d: 'M0 130 Q60 66 140 106 Q210 58 290 100 Q352 70 400 90 V170 H0 Z', fill: 'theme.nature', o: 0.6 },
    { t: 'rect', x: 0, y: 166, w: 400, h: 134, fill: 'feedback.successLight' },
    { t: 'path', d: 'M150 166 L250 166 Q290 210 400 226 L400 300 L0 300 L0 262 Q110 236 150 166 Z', fill: 'brand.secondary', o: 0.35 },
    { t: 'path', d: 'M180 186 Q200 182 220 188 M120 238 Q150 232 180 240 M260 232 Q290 228 320 236 M60 280 Q90 274 120 282 M300 278 Q330 272 360 280', stroke: 'surface.paper', sw: 'base', o: 0.85, det: true },
    { t: 'ellipse', cx: 232, cy: 214, rx: 26, ry: 6, fill: 'border.strong' },
    { t: 'ellipse', cx: 92, cy: 270, rx: 30, ry: 7, fill: 'border.strong' },
    { t: 'path', d: 'M20 190 Q30 182 40 190 M350 190 Q360 182 370 190', stroke: 'theme.nature', sw: 'base', det: true },
  ],
};

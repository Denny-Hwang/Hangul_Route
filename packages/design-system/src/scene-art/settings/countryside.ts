import type { ItemDef } from '../types';

/** Open country: rolling hills and a meadow (F-STORY-002 PR 2.10a). */
export const COUNTRYSIDE: ItemDef = {
  id: 'scene:countryside',
  kind: 'setting',
  box: { w: 400, h: 300 },
  z: 'back',
  horizonY: 170,
  alt: 'Open country with green hills and a wide meadow under a clear sky',
  accuracyNote:
    'Generic Korean countryside: low rounded hills behind a wide grassy meadow. It is not a map of any place; hunting grounds, roads, villages and fields differed from place to place, so no buildings, crops or signs are drawn. Kept to two colours so the people and objects placed on it have room in the scene palette.',
  nodes: [
    { t: 'rect', x: 0, y: 0, w: 400, h: 300, fill: 'brand.secondaryLight' },
    { t: 'path', d: 'M0 120 Q60 70 140 104 Q210 64 290 98 Q350 74 400 92 V170 H0 Z', fill: 'theme.nature', o: 0.35 },
    { t: 'path', d: 'M0 150 Q90 112 190 140 Q280 116 400 136 V170 H0 Z', fill: 'theme.nature', o: 0.6 },
    { t: 'rect', x: 0, y: 168, w: 400, h: 132, fill: 'theme.nature' },
    { t: 'path', d: 'M0 196 Q100 186 200 194 Q300 202 400 190 M0 250 Q120 240 240 250 Q330 258 400 246', stroke: 'brand.secondaryLight', sw: 'thick', o: 0.2, det: true },
    { t: 'path', d: 'M20 222 Q30 214 40 222 M90 272 Q100 264 110 272 M360 230 Q370 222 380 230 M300 282 Q310 274 320 282', stroke: 'brand.secondaryLight', sw: 'base', o: 0.6, det: true },
  ],
};

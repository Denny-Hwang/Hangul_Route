import type { ItemDef } from '../types';

/** Open country: rolling hills, terraced paddies and a meadow (F-STORY-002 PR 2.10a; paddies [PX] PX-4). */
export const COUNTRYSIDE: ItemDef = {
  id: 'scene:countryside',
  kind: 'setting',
  box: { w: 400, h: 300 },
  z: 'back',
  horizonY: 170,
  alt: 'Open country with green hills, terraced rice paddies and a wide meadow under a clear sky',
  accuracyNote:
    'Generic Korean countryside: low rounded hills behind a wide grassy meadow. It is not a map of any place; hunting grounds, roads, villages and fields differed from place to place, so no buildings or signs are drawn; terraced paddies on one hill are the one cue of farmland ([PX] PX-4). Kept to two colours so the people and objects placed on it have room in the scene palette.',
  nodes: [
    { t: 'rect', x: 0, y: 0, w: 400, h: 300, fill: 'brand.secondaryLight' },
    { t: 'path', d: 'M0 120 Q60 70 140 104 Q210 64 290 98 Q350 74 400 92 V170 H0 Z', fill: 'theme.nature', o: 0.35 },
    { t: 'path', d: 'M0 150 Q90 112 190 140 Q280 116 400 136 V170 H0 Z', fill: 'theme.nature', o: 0.6 },
    // [PX] PX-4: terraced rice paddies stepping down the right-hand hill, water in each terrace, so it is not the mountains
    { t: 'path', d: 'M196 170Q226 128 296 118Q352 112 400 116V170Z', fill: 'theme.nature', o: 0.6 },
    { t: 'path', d: 'M232 136Q300 116 400 124V136Q306 128 226 148ZM220 152Q300 134 400 142V154Q306 146 214 166ZM208 168Q300 152 400 160V168Z', fill: 'brand.secondaryLight', o: 0.85 },
    { t: 'path', d: 'M232 136Q300 116 400 124M226 148Q306 128 400 136M220 152Q300 134 400 142M214 166Q306 146 400 154M208 168Q300 152 400 160', stroke: 'theme.nature', sw: 'thick' },
    { t: 'rect', x: 0, y: 168, w: 400, h: 132, fill: 'theme.nature' },
    { t: 'path', d: 'M0 196 Q100 186 200 194 Q300 202 400 190 M0 250 Q120 240 240 250 Q330 258 400 246', stroke: 'brand.secondaryLight', sw: 'thick', o: 0.2, det: true },
    { t: 'path', d: 'M20 222 Q30 214 40 222 M90 272 Q100 264 110 272 M360 230 Q370 222 380 230 M300 282 Q310 274 320 282', stroke: 'brand.secondaryLight', sw: 'base', o: 0.6, det: true },
  ],
};

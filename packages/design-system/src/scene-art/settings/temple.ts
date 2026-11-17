import type { ItemDef } from '../types';

/** A mountain temple: ridges behind, tiled roofs of lower halls, a courtyard and stone steps (F-STORY-002 PR 2.10b). */
export const TEMPLE: ItemDef = {
  id: 'scene:temple',
  kind: 'setting',
  box: { w: 400, h: 300 },
  z: 'back',
  horizonY: 196,
  alt: 'A Korean mountain temple: wooded ridges behind, the tiled roofs of two halls at the sides, a stone pagoda in a sandy courtyard and stone steps',
  accuracyNote: 'Generic Korean mountain temple for Haeinsa and the Goryeo temple of the Jikji story: wooded ridges, two tiled-roof halls with a band of dancheong under the eaves, a three-storey stone pagoda in the courtyard, and steps ([PX] PX-4). It copies no temple plan or pagoda; the dancheong is a plain band, and signboards are left out.',
  nodes: [
    { t: 'rect', x: 0, y: 0, w: 400, h: 196, fill: 'brand.secondaryLight' },
    { t: 'path', d: 'M0 96 L60 50 L118 84 L190 28 L262 82 L322 44 L400 88 V196 H0 Z', fill: 'theme.nature', o: 0.35 },
    { t: 'path', d: 'M0 140 Q60 100 128 124 Q200 92 262 122 Q330 98 400 118 V196 H0 Z', fill: 'theme.nature', o: 0.6 },
    { t: 'path', d: 'M0 170 Q90 150 200 164 Q300 150 400 160 V196 H0 Z', fill: 'theme.nature' },
    // the lower halls, left and right
    { t: 'rect', x: 14, y: 168, w: 74, h: 28, fill: 'surface.paper', stroke: 'text.secondary', sw: 'base' },
    { t: 'path', d: 'M14 168 V196 M38 168 V196 M64 168 V196 M88 168 V196', stroke: 'text.secondary', sw: 'base' },
    { t: 'path', d: 'M12 150 H90 Q98 162 112 168 H0 Q4 162 12 150 Z', fill: 'text.secondary' },
    { t: 'rect', x: 312, y: 168, w: 74, h: 28, fill: 'surface.paper', stroke: 'text.secondary', sw: 'base' },
    { t: 'path', d: 'M312 168 V196 M336 168 V196 M362 168 V196 M386 168 V196', stroke: 'text.secondary', sw: 'base' },
    { t: 'path', d: 'M310 150 H388 Q396 162 400 168 H288 Q302 162 310 150 Z', fill: 'text.secondary' },
    // [PX] PX-4: dancheong under the eaves, a blue-green band with light motifs
    { t: 'path', d: 'M14 168H88V174H14ZM312 168H386V174H312Z', fill: 'theme.nature' },
    { t: 'path', d: 'M22 171H30M46 171H56M72 171H80M320 171H328M344 171H354M370 171H378', stroke: 'surface.paper', sw: 'base' },
    { t: 'path', d: 'M24 154 L20 166 M44 152 V166 M64 152 V166 M84 154 L88 166 M320 154 L316 166 M340 152 V166 M360 152 V166 M380 154 L384 166', stroke: 'surface.paper', sw: 'thin', o: 0.2, det: true },
    // courtyard and steps
    { t: 'rect', x: 0, y: 194, w: 400, h: 106, fill: 'surface.sunken' },
    // [PX] PX-4: a three-storey stone pagoda in the court, between the halls
    { t: 'rect', x: 180, y: 184, w: 40, h: 14, fill: 'border.strong', stroke: 'text.secondary', sw: 'base' },
    { t: 'path', d: 'M188 184V170H212V184ZM191 164V154H209V164ZM194 148V140H206V148Z', fill: 'border.strong', stroke: 'text.secondary', sw: 'base' },
    { t: 'path', d: 'M180 170Q200 166 220 170L222 164H178ZM184 154Q200 150 216 154L218 148H182ZM187 140Q200 136 213 140L215 134H185Z', fill: 'text.secondary' },
    { t: 'path', d: 'M200 134V120M196 128H204M197 124H203', stroke: 'text.secondary', sw: 'base' },
    { t: 'path', d: 'M150 300 L162 252 H238 L250 300 Z', fill: 'border.strong' },
    { t: 'path', d: 'M158 268 H242 M154 284 H246', stroke: 'text.secondary', sw: 'thin', o: 0.6 },
    { t: 'path', d: 'M30 236 Q60 230 90 236 M300 250 Q330 244 360 250 M60 284 Q90 278 120 284', stroke: 'border.strong', sw: 'base', det: true },
  ],
};

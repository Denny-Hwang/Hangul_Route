import { describe, expect, it } from 'vitest';
import { HOYA_POSES } from '../hoya';
import { SCENE_ART_REGISTRY, hasItem } from '../registry';
import { checkItem, checkScene } from '../rules';

/** PR 2.3a seeded the Hoya poses; PR 2.3b adds the first library batch; PR 2.10a the records-joseon batch. */
const SETTINGS = [
  'scene:palace-courtyard',
  'scene:palace-hall',
  'scene:village-lane',
  'scene:hanji-backdrop',
  'scene:hanok-room',
  'scene:countryside',
  'scene:mountains',
  'scene:mountain-stream',
  'scene:modern-room',
];
const PROPS = [
  'prop:fig-king',
  'prop:fig-official',
  'prop:fig-scholar',
  'prop:fig-historian',
  'prop:fig-villager',
  'prop:fig-grandmother',
  'prop:fig-child',
  'prop:desk-low',
  'prop:writing-set',
  'prop:writing-lines',
  'prop:book-thread-bound',
  'prop:books-case',
  'prop:document-box',
  // PR 2.10a: records-joseon cluster
  'prop:fig-officials-kneeling',
  'prop:fig-king-seated',
  'prop:fig-writer-seated',
  'prop:fig-artisan',
  'prop:fig-dancer',
  'prop:fig-modern',
  'prop:fig-worker',
  'prop:fig-researcher',
  'prop:books-stack',
  'prop:book-bundle',
  'prop:book-chest-open',
  'prop:books-airing',
  'prop:book-open-entry',
  'prop:uigwe-open',
  'prop:book-geojunggi',
  'prop:banchado-strip',
  'prop:paper-stack',
  'prop:papers-loose',
  'prop:sheet-cursive',
  'prop:print-sheet',
  'prop:type-tray',
  'prop:horse',
  'prop:pine-tree',
  'prop:flat-rock',
  'prop:sago-archive',
  'prop:fortress-gate',
  'prop:fortress-wall',
  'prop:night-window',
  'prop:oil-lamp',
  'prop:tablet',
  'prop:weather-signs',
  'prop:signpost',
  'prop:archive-shelf',
  'prop:craft-wood',
  'prop:craft-embroidery',
  'prop:craft-painting',
  'prop:palanquin',
  'prop:procession-row',
  'prop:feast-table',
  'prop:bead-curtain',
  'prop:silk-bolts',
  'prop:ceremony-goods',
];

const entries = Object.entries(SCENE_ART_REGISTRY);
const library = entries.filter(([id]) => !id.startsWith('hoya:'));

describe('SCENE_ART_REGISTRY', () => {
  it('holds the five Hoya poses and the library batches, keyed by their layer ref', () => {
    const expected = [...HOYA_POSES.map((p) => `hoya:${p}`), ...SETTINGS, ...PROPS].sort();
    expect(Object.keys(SCENE_ART_REGISTRY).sort()).toEqual(expected);
    for (const [key, item] of entries) expect(item.id).toBe(key);
  });

  it('is frozen', () => {
    expect(Object.isFrozen(SCENE_ART_REGISTRY)).toBe(true);
  });

  it('has well-formed ids: three settings as scene:, the rest as prop:, kebab-case', () => {
    for (const [id, item] of library) {
      expect(id).toMatch(/^(scene|prop):[a-z]+(-[a-z]+)*$/);
      expect(id.startsWith('scene:')).toBe(item.kind === 'setting');
    }
    expect(library.filter(([id]) => id.startsWith('scene:'))).toHaveLength(SETTINGS.length);
  });

  it('every library entry passes every item rule', () => {
    for (const [, item] of library) expect(checkItem(item)).toEqual([]);
  });

  // Documented exemption: Hoya is a character, not a prop. His pose palettes use
  // 7-9 colour tokens (the shipped Hoya.tsx palette), above the 5-colour prop cap
  // (rule I-palette); checkItem exempts that fixed palette, and every other rule
  // still applies to him.
  it('every hoya:* entry passes the item rules, his fixed palette exempt from the cap', () => {
    for (const [id, item] of entries.filter(([k]) => k.startsWith('hoya:'))) {
      expect(checkItem(item), id).toEqual([]);
    }
  });

  it('exempts only hoya:* from the palette cap: no library entry exceeds it', () => {
    for (const [, item] of library) expect(checkItem(item).filter((f) => f.rule === 'I-palette')).toEqual([]);
  });

  it('every library entry has alt text, an accuracy note and no Hangul in either', () => {
    for (const [id, item] of library) {
      expect(item.alt.trim().length, id).toBeGreaterThan(0);
      expect(item.accuracyNote?.trim().length ?? 0, id).toBeGreaterThan(20);
      expect(`${item.alt} ${item.accuracyNote}`, id).not.toMatch(/[ᄀ-ᇿ㄰-㆏가-퟿]/);
    }
  });

  // F-STORY-002 §3.9.10: heritage artefacts are objects or buildings.
  it('every heritage artefact is an object or a building with a sourceRef and an accuracyNote', () => {
    const heritage = library.filter(([, item]) => item.tags?.heritage);
    expect(heritage.length).toBeGreaterThanOrEqual(3);
    for (const [id, item] of heritage) {
      expect(['object', 'architecture'], id).toContain(item.kind);
      expect(item.sourceRef, id).toBeDefined();
      expect(item.accuracyNote, id).toBeDefined();
    }
  });

  it('every sourceRef is a complete citation to an https page accessed on a real date', () => {
    for (const [id, item] of library.filter(([, i]) => i.sourceRef)) {
      const ref = item.sourceRef!;
      expect(ref.title.length, id).toBeGreaterThan(0);
      expect(ref.publisher.length, id).toBeGreaterThan(0);
      expect(ref.url, id).toMatch(/^https:\/\/\S+$/);
      expect(ref.accessed, id).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(Number.isNaN(Date.parse(ref.accessed)), id).toBe(false);
    }
  });

  it('settings declare a horizon, props do not', () => {
    for (const [id, item] of library) expect(item.horizonY !== undefined, id).toBe(item.kind === 'setting');
  });

  it('tintable figures name a tintable token that their nodes use', () => {
    for (const id of [
      'prop:fig-official',
      'prop:fig-scholar',
      'prop:fig-historian',
      'prop:fig-villager',
      'prop:fig-grandmother',
      'prop:fig-child',
      'prop:fig-officials-kneeling',
      'prop:fig-writer-seated',
      'prop:fig-artisan',
      'prop:fig-modern',
    ]) {
      const item = SCENE_ART_REGISTRY[id]!;
      expect(item.tintable, id).toBeDefined();
      expect(JSON.stringify(item.nodes), id).toContain(item.tintable!);
    }
  });

  // 2.3b convention and §3.9.10: every figure in historical dress has a sourceRef
  // and its costume is period-labelled in alt; people of today say so.
  it('labels every figure by period, and sources every figure in historical dress', () => {
    for (const [id, item] of library.filter(([, it]) => it.kind === 'figure')) {
      if (/\bof today\b/.test(item.alt)) continue;
      expect(item.alt, id).toMatch(/\bJoseon\b|\bhanbok\b/);
      expect(item.sourceRef, id).toBeDefined();
    }
  });

  it('draws people faceless: a blank paper oval outlined with border.strong, and no figure uses a skin token', () => {
    for (const [id, item] of library.filter(([, i]) => i.kind === 'figure')) {
      const json = JSON.stringify(item.nodes);
      expect(json, id).toContain('"fill":"surface.paper","stroke":"border.strong"');
      expect(json, id).not.toMatch(/skin|hoya\./);
    }
  });

  // The flagship court scene (sillok-royal-historians s2, the spec's worked
  // example): the palace hall must leave room in the 8-colour scene palette for
  // the king, his officials and the historian.
  it('composes the flagship court scene without an error', () => {
    const art = {
      setting: 'scene:palace-hall',
      altEn: 'The king on a raised seat in a palace hall, officials on both sides and a historian writing at the side',
      layers: [
        { ref: 'prop:fig-king', x: 200, y: 186, s: 0.9 },
        { ref: 'prop:fig-official', x: 90, y: 256 },
        { ref: 'prop:fig-official', x: 310, y: 256, flip: true, tint: 'text.secondary' },
        { ref: 'prop:fig-historian', x: 330, y: 292, s: 1.1, flip: true },
      ],
    };
    expect(checkScene(art, SCENE_ART_REGISTRY).filter((f) => f.severity === 'error')).toEqual([]);
  });

  // F-STORY-002 decision 15 (main session, owner's standing delegation, 2026-10-11;
  // R-S5): Hoya's own palette is outside the scene cap, so the flagship court scene
  // still composes with Hoya watching from the side.
  it('composes the flagship court scene with Hoya beside it, in every pose', () => {
    for (const pose of HOYA_POSES) {
      const art = {
        setting: 'scene:palace-hall',
        altEn: 'Hoya watches from the side as the king sits on a raised seat and a historian writes down what is said',
        layers: [
          { ref: 'prop:fig-king', x: 200, y: 186, s: 0.9 },
          { ref: 'prop:fig-official', x: 300, y: 256, flip: true, tint: 'text.secondary' },
          { ref: 'prop:fig-historian', x: 330, y: 292, s: 1.1, flip: true },
          { ref: `hoya:${pose}`, x: 70, y: 292, s: 0.7 },
        ],
      };
      expect(checkScene(art, SCENE_ART_REGISTRY).filter((f) => f.severity === 'error'), pose).toEqual([]);
    }
  });

  it('every tintable item uses its tintable token, so a tint has something to recolour', () => {
    for (const [id, item] of library.filter(([, i]) => i.tintable)) expect(JSON.stringify(item.nodes), id).toContain(`"${item.tintable}"`);
  });

  it('the archive door tint recolours only the doors', () => {
    const sago = SCENE_ART_REGISTRY['prop:sago-archive']!;
    const doors = JSON.stringify(sago.nodes).split(`"${sago.tintable}"`).length - 1;
    expect(doors).toBe(2);
  });

  it('answers hasItem for registered refs only', () => {
    expect(hasItem('hoya:idle')).toBe(true);
    expect(hasItem('prop:fig-king')).toBe(true);
    expect(hasItem('scene:palace-hall')).toBe(true);
    expect(hasItem('hoya:dancing')).toBe(false);
    expect(hasItem('prop:desk')).toBe(false);
    expect(hasItem('toString')).toBe(false);
    expect(hasItem('__proto__')).toBe(false);
  });
});

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { REALIA_KIND_PROPS } from '../props/realia-kinds';
import { REALIA_KIND_REGISTRY, REALIA_KIND_REGISTRY_RAW_MAX } from '../realia-kinds-registry';
import { REALIA_REGISTRY } from '../realia-registry';
import { SCENE_ART_REGISTRY } from '../registry';
import { checkItem, serializedBytes } from '../rules';
import { nodeCount, paletteOf } from '../resolve';

/**
 * The CM-47 realia dressings (F-CURR-002 row CM-47; design/screens/minigame-realia-read/README.md, "Drawn parts"):
 * one prop per new kind, each passing every scene-art item rule, with no text, logo or Hangul and no reserved colour,
 * inside the row's art budget, and never in the start bundle's barrels.
 */
const IDS = [
  'prop:realia-recipe-bowl',
  'prop:realia-receipt-edge',
  'prop:realia-label-pack',
  'prop:realia-forecast-sky',
  'prop:realia-calendar-rings',
  'prop:realia-timetable-clock',
  'prop:realia-map-park',
  'prop:realia-poster-bunting',
];

/** Shapes per prop, as the README "Drawn parts" table records them (the art budget: at most 8 each). */
const SHAPES: Record<string, number> = {
  'prop:realia-recipe-bowl': 6,
  'prop:realia-receipt-edge': 1,
  'prop:realia-label-pack': 5,
  'prop:realia-forecast-sky': 4,
  'prop:realia-calendar-rings': 5,
  'prop:realia-timetable-clock': 4,
  'prop:realia-map-park': 8,
  'prop:realia-poster-bunting': 6,
};

describe('REALIA_KIND_REGISTRY (row CM-47)', () => {
  it('holds the eight dressings, keyed by id, frozen', () => {
    expect(Object.keys(REALIA_KIND_REGISTRY)).toEqual(IDS);
    for (const [id, item] of Object.entries(REALIA_KIND_REGISTRY)) expect(item.id).toBe(id);
    expect(REALIA_KIND_PROPS).toHaveLength(IDS.length);
    expect(Object.isFrozen(REALIA_KIND_REGISTRY)).toBe(true);
  });

  it('never shares an id with the story registry or the G-2 realia registry', () => {
    for (const id of IDS) {
      expect(Object.prototype.hasOwnProperty.call(SCENE_ART_REGISTRY, id), id).toBe(false);
      expect(Object.prototype.hasOwnProperty.call(REALIA_REGISTRY, id), id).toBe(false);
    }
  });

  it('every dressing passes every item rule (shapes, palette, box, size)', () => {
    for (const item of REALIA_KIND_PROPS) expect(checkItem(item), item.id).toEqual([]);
  });

  it('keeps the art small: the shape counts of the README table, at most five tokens, no reserved or failure colour', () => {
    for (const item of REALIA_KIND_PROPS) {
      expect(nodeCount(item.nodes), item.id).toBe(SHAPES[item.id]);
      expect(nodeCount(item.nodes), item.id).toBeLessThanOrEqual(8);
      const palette = paletteOf(item);
      expect(palette.length, item.id).toBeLessThanOrEqual(5);
      expect(palette, item.id).not.toContain('feedback.danger');
      expect(palette, item.id).not.toContain('brand.primary');
    }
  });

  it('has alt text and an accuracy note that say no brand, and no Hangul anywhere', () => {
    for (const item of REALIA_KIND_PROPS) {
      expect(item.alt.trim().length, item.id).toBeGreaterThan(0);
      expect(item.accuracyNote ?? '', item.id).toMatch(/\bNo\b|\bNot\b/);
      expect(JSON.stringify(item), item.id).not.toMatch(/[ᄀ-ᇿ㄰-㆏가-힯]/);
    }
  });

  it('stays inside its raw budget (the row art budget)', () => {
    expect(serializedBytes(REALIA_KIND_REGISTRY)).toBeLessThanOrEqual(REALIA_KIND_REGISTRY_RAW_MAX);
  });

  it('is reached only by its own path: neither barrel of the design system exports it (the start bundle never carries it)', () => {
    const read = (rel: string): string => readFileSync(join(__dirname, '..', '..', rel), 'utf8');
    for (const barrel of ['index.ts', 'scene-art/index.ts', 'components/RealiaSheet/index.ts']) {
      expect(read(barrel), barrel).not.toMatch(/realia-kinds|RealiaKindSheet|kinds-style/);
    }
  });
});

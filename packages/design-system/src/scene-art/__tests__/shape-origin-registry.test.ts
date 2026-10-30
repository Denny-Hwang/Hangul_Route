import { describe, expect, it } from 'vitest';
import { SHAPE_ORIGIN_PROPS } from '../props/shape-origins';
import { SHAPE_ORIGIN_REGISTRY, SHAPE_ORIGIN_REGISTRY_RAW_MAX } from '../shape-origin-registry';
import { SCENE_ART_REGISTRY } from '../registry';
import { REALIA_REGISTRY } from '../realia-registry';
import { checkItem, serializedBytes } from '../rules';
import { nodeCount, paletteOf } from '../resolve';

/**
 * Match Shape's origin pictures (F-CURR-002 row CM-33; design/screens/minigame-variety/README.md D6 and "Drawn parts"):
 * the five consonant pictures and the vowel bases, each passing every scene-art item rule, at most 5 shapes and the
 * 5 colours of the D6 table, each with the source of the fact it shows.
 */
const IDS = ['giyeok', 'nieun', 'mieum', 'siot', 'ieung', 'eu', 'i', 'a'].map((l) => `prop:shape-origin-${l}`);
const D6_COLOURS = new Set(['hoya.belly', 'border.shape', 'surface.sunken', 'surface.paper', 'text.primary']);
const ALLOWLIST = new Set(['National Institute of Korean Language', 'National Hangeul Museum', 'UNESCO']);

describe('SHAPE_ORIGIN_REGISTRY', () => {
  it('holds the eight pictures, keyed by id, frozen, apart from the story and realia registries', () => {
    expect(Object.keys(SHAPE_ORIGIN_REGISTRY)).toEqual(IDS);
    for (const [id, item] of Object.entries(SHAPE_ORIGIN_REGISTRY)) expect(item.id).toBe(id);
    expect(Object.isFrozen(SHAPE_ORIGIN_REGISTRY)).toBe(true);
    for (const id of IDS) {
      expect(Object.prototype.hasOwnProperty.call(SCENE_ART_REGISTRY, id)).toBe(false);
      expect(Object.prototype.hasOwnProperty.call(REALIA_REGISTRY, id)).toBe(false);
    }
  });

  it('every picture passes every item rule, in at most 5 shapes and the D6 colours', () => {
    for (const item of SHAPE_ORIGIN_PROPS) {
      expect(checkItem(item), item.id).toEqual([]);
      expect(nodeCount(item.nodes), item.id).toBeLessThanOrEqual(5);
      const palette = paletteOf(item);
      expect(palette.length, item.id).toBeLessThanOrEqual(5);
      for (const token of palette) expect(D6_COLOURS.has(token), `${item.id} ${token}`).toBe(true);
    }
  });

  it('draws the shape-making part in text.primary, and every head faces left (its front edge is on the left)', () => {
    for (const item of SHAPE_ORIGIN_PROPS) {
      expect(paletteOf(item), item.id).toContain('text.primary');
      const head = item.nodes.find((n) => n.t === 'path' && n.fill === 'hoya.belly');
      if (head && head.t === 'path') expect(head.d.startsWith('M154 152'), item.id).toBe(true);
    }
  });

  it('names the source of its fact: an allowlisted institution, an https URL and an access date', () => {
    for (const item of SHAPE_ORIGIN_PROPS) {
      expect(item.sourceRef, item.id).toBeDefined();
      expect(ALLOWLIST.has(item.sourceRef!.publisher), item.id).toBe(true);
      expect(item.sourceRef!.url, item.id).toMatch(/^https:\/\//);
      expect(item.sourceRef!.accessed, item.id).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(item.alt.trim().length, item.id).toBeGreaterThan(0);
      expect(item.accuracyNote?.trim().length ?? 0, item.id).toBeGreaterThan(20);
    }
  });

  it('stays inside its raw budget', () => {
    expect(serializedBytes(SHAPE_ORIGIN_REGISTRY)).toBeLessThanOrEqual(SHAPE_ORIGIN_REGISTRY_RAW_MAX);
  });
});

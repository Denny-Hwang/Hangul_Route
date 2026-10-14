import { describe, expect, it } from 'vitest';
import { REALIA_PROPS } from '../props/realia';
import { REALIA_REGISTRY, REALIA_REGISTRY_RAW_MAX } from '../realia-registry';
import { SCENE_ART_REGISTRY } from '../registry';
import { checkItem, serializedBytes } from '../rules';
import { paletteOf } from '../resolve';

/**
 * The realia dressings (F-CURR-001 G-2; design/screens/minigame-realia-read/README.md,
 * "Drawn parts"): the nine props of the D-2 table, each passing every scene-art item rule,
 * with no text, logo or Hangul and no reserved colour.
 */
const IDS = [
  'prop:realia-awning',
  'prop:realia-counter',
  'prop:realia-train-band',
  'prop:realia-ticket-stub',
  'prop:realia-mountains',
  'prop:realia-post-foot',
  'prop:realia-goods-apples',
  'prop:realia-goods-fan',
  'prop:realia-goods-hanji',
];

describe('REALIA_REGISTRY', () => {
  it('holds the nine dressings of the D-2 table, keyed by id, frozen', () => {
    expect(Object.keys(REALIA_REGISTRY)).toEqual(IDS);
    for (const [id, item] of Object.entries(REALIA_REGISTRY)) expect(item.id).toBe(id);
    expect(REALIA_PROPS).toHaveLength(IDS.length);
    expect(Object.isFrozen(REALIA_REGISTRY)).toBe(true);
  });

  it('never shares an id with the story registry', () => {
    for (const id of IDS) expect(Object.prototype.hasOwnProperty.call(SCENE_ART_REGISTRY, id)).toBe(false);
  });

  it('every dressing passes every item rule (shapes, palette, box, size)', () => {
    for (const item of REALIA_PROPS) expect(checkItem(item), item.id).toEqual([]);
  });

  it('uses no reserved or failure colour and at most five tokens each', () => {
    for (const item of REALIA_PROPS) {
      const palette = paletteOf(item);
      expect(palette.length, item.id).toBeLessThanOrEqual(5);
      expect(palette, item.id).not.toContain('feedback.danger');
      expect(palette, item.id).not.toContain('brand.primary');
    }
  });

  it('has alt text and an accuracy note that say no brand, and no Hangul anywhere', () => {
    for (const item of REALIA_PROPS) {
      expect(item.alt.trim().length, item.id).toBeGreaterThan(0);
      expect(item.accuracyNote?.trim().length ?? 0, item.id).toBeGreaterThan(20);
      expect(JSON.stringify(item), item.id).not.toMatch(/[ᄀ-ᇿ㄰-㆏가-힯]/);
    }
  });

  it('stays inside its raw budget', () => {
    expect(serializedBytes(REALIA_REGISTRY)).toBeLessThanOrEqual(REALIA_REGISTRY_RAW_MAX);
  });
});

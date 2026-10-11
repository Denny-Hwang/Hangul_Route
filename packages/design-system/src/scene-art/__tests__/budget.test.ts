import { gzipSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import type { Registry } from '../resolve';
import { LIMITS, checkItem, checkScene, serializedBytes } from '../rules';
import type { ItemDef, Shape } from '../types';
import { makeArt, makeProp, makeRegistry, makeSetting } from './fixtures';

/**
 * F-STORY-002 §3.9.7 budgets. The registry itself arrives in PR 2.3a/2.3b;
 * `registryBudget` is the measurement those PRs point at SCENE_ART_REGISTRY.
 */
const REGISTRY_RAW_MAX = 200 * 1024;
const REGISTRY_GZIP_MAX = 55 * 1024;

function registryBudget(registry: Registry): { raw: number; gzip: number } {
  const json = JSON.stringify(registry);
  return { raw: Buffer.byteLength(json, 'utf8'), gzip: gzipSync(json).length };
}

describe('budget constants', () => {
  it('match the spec table', () => {
    expect(LIMITS).toMatchObject({
      propShapes: 40,
      settingShapes: 60,
      propBytes: 3 * 1024,
      settingBytes: 6 * 1024,
      sceneBytes: 700,
      sceneLayers: 8,
      sceneShapes: 160,
      sceneShapesThumb: 80,
    });
  });
});

describe('registry budget', () => {
  // About the estimated library: 14 settings and 90 props at roughly 1 KB each.
  const detailed = (i: number): Shape[] =>
    Array.from({ length: 12 }, (_, k) => ({ t: 'path', d: `M ${k} ${i % 40} L ${k + 4} ${k + 3} Q ${k + 8} ${i % 30} ${k + 9} ${k + 6} Z`, fill: 'surface.paper', stroke: 'border.strong', sw: 'base' }) as Shape);
  const items: ItemDef[] = [
    ...Array.from({ length: 14 }, (_, i) => makeSetting({ id: `scene:s${i}`, nodes: detailed(i).concat(makeSetting().nodes) })),
    ...Array.from({ length: 90 }, (_, i) => makeProp({ id: `prop:p${i}`, nodes: detailed(i) })),
  ];
  const registry: Registry = Object.fromEntries(items.map((i) => [i.id, i]));

  it('stays inside 200 KB raw and 55 KB gzip at the estimated library size', () => {
    const { raw, gzip } = registryBudget(registry);
    expect(raw).toBeLessThanOrEqual(REGISTRY_RAW_MAX);
    expect(gzip).toBeLessThanOrEqual(REGISTRY_GZIP_MAX);
  });

  it('every synthetic entry is itself within the per-item budget', () => {
    for (const item of items) {
      expect(serializedBytes(item)).toBeLessThanOrEqual(item.kind === 'setting' ? LIMITS.settingBytes : LIMITS.propBytes);
      expect(checkItem(item).filter((f) => f.rule === 'I-size' || f.rule === 'I-shapes')).toEqual([]);
    }
  });

  it('would notice an oversized library', () => {
    const fat = Object.fromEntries(Array.from({ length: 80 }, (_, i) => [`prop:f${i}`, makeProp({ id: `prop:f${i}`, alt: 'x'.repeat(3000 + (i % 7)) })]));
    expect(registryBudget(fat).raw).toBeGreaterThan(REGISTRY_RAW_MAX);
  });
});

describe('scene budget', () => {
  it('flags a description over 700 bytes and accepts one under it', () => {
    const reg = makeRegistry();
    expect(serializedBytes(makeArt())).toBeLessThan(LIMITS.sceneBytes);
    const layers = Array.from({ length: 8 }, (_, i) => ({ ref: 'prop:desk', x: 20 + i * 45, y: 250, s: 1.25, flip: true as const, z: 'mid' as const, tint: 'theme.rites' }));
    const art = makeArt({ layers, altEn: 'a'.repeat(140) });
    expect(serializedBytes(art) > LIMITS.sceneBytes).toBe(true);
    expect(checkScene(art, reg).map((f) => f.rule)).toContain('S-size');
  });
});

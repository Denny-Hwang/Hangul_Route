import { describe, expect, it } from 'vitest';
import { HOYA_POSES } from '../hoya';
import { SCENE_ART_REGISTRY, hasItem } from '../registry';
import { checkItem } from '../rules';

describe('SCENE_ART_REGISTRY (PR 2.3a: Hoya only)', () => {
  it('holds the five Hoya poses, keyed by their layer ref', () => {
    expect(Object.keys(SCENE_ART_REGISTRY).sort()).toEqual(HOYA_POSES.map((p) => `hoya:${p}`).sort());
    for (const [key, item] of Object.entries(SCENE_ART_REGISTRY)) expect(item.id).toBe(key);
  });

  it('is frozen', () => {
    expect(Object.isFrozen(SCENE_ART_REGISTRY)).toBe(true);
  });

  it('every entry passes the item rules except the character palette cap', () => {
    for (const item of Object.values(SCENE_ART_REGISTRY)) expect(checkItem(item).filter((f) => f.rule !== 'I-palette')).toEqual([]);
  });

  it('answers hasItem for registered refs only', () => {
    expect(hasItem('hoya:idle')).toBe(true);
    expect(hasItem('hoya:dancing')).toBe(false);
    expect(hasItem('prop:desk')).toBe(false);
    expect(hasItem('toString')).toBe(false);
    expect(hasItem('__proto__')).toBe(false);
  });
});

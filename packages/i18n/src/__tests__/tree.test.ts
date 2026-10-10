import { describe, expect, it } from 'vitest';
import { deepMerge, isPlainObject, leafPaths, lookup } from '../tree';

describe('isPlainObject', () => {
  it('objects only: not arrays, functions, null or primitives', () => {
    expect(isPlainObject({})).toBe(true);
    expect(isPlainObject([])).toBe(false);
    expect(isPlainObject(() => 'x')).toBe(false);
    expect(isPlainObject(null)).toBe(false);
    expect(isPlainObject('s')).toBe(false);
  });
});

describe('deepMerge', () => {
  const base = {
    a: 'A',
    group: { x: 'X', y: 'Y', deeper: { z: 'Z' } },
    list: ['one', 'two'],
    fn: (n: number): string => `en ${n}`,
  };

  it('fills missing keys from the base', () => {
    const merged = deepMerge(base, { group: { x: 'overlay X' } });
    expect(merged.a).toBe('A');
    expect(merged.group.x).toBe('overlay X');
    expect(merged.group.y).toBe('Y');
    expect(merged.group.deeper.z).toBe('Z');
  });

  it('replaces arrays and functions whole', () => {
    const merged = deepMerge(base, { list: ['uno'], fn: (n: number) => `es ${n}` });
    expect(merged.list).toEqual(['uno']);
    expect(merged.fn(2)).toBe('es 2');
  });

  it('treats undefined overlay values as missing and ignores unknown overlay keys', () => {
    const merged = deepMerge(base, { a: undefined, ghost: 'boo' } as Record<string, unknown>);
    expect(merged.a).toBe('A');
    expect('ghost' in merged).toBe(false);
  });

  it('a non-object overlay for an object branch is ignored', () => {
    const merged = deepMerge(base, { group: 'nope' } as Record<string, unknown>);
    expect(merged.group.x).toBe('X');
  });

  it('does not mutate base or overlay and returns fresh objects', () => {
    const overlay = { group: { x: 'o' } };
    const merged = deepMerge(base, overlay);
    expect(base.group.x).toBe('X');
    expect(merged.group).not.toBe(base.group);
    expect(merged.group.deeper).not.toBe(base.group.deeper);
  });

  it('an empty overlay yields an equal tree', () => {
    expect(deepMerge(base, {}).group).toEqual(base.group);
  });
});

describe('leafPaths', () => {
  it('lists dotted paths of strings, functions and arrays', () => {
    expect(leafPaths({ a: 'x', g: { b: () => 'y', c: ['z'] } }).sort()).toEqual(['a', 'g.b', 'g.c']);
  });

  it('prefixes paths', () => {
    expect(leafPaths({ b: 'x' }, 'root')).toEqual(['root.b']);
  });
});

describe('lookup', () => {
  const tree = { a: { b: { c: 'leaf' } }, fn: () => 'x' };

  it('reads a dotted path', () => {
    expect(lookup(tree, 'a.b.c')).toBe('leaf');
    expect(lookup(tree, 'a.b')).toEqual({ c: 'leaf' });
  });

  it('returns undefined for a missing or blocked path', () => {
    expect(lookup(tree, 'a.x.c')).toBeUndefined();
    expect(lookup(tree, 'a.b.c.d')).toBeUndefined();
    expect(lookup(tree, 'fn.name')).toBeUndefined();
    expect(lookup(tree, '')).toBeUndefined();
  });
});

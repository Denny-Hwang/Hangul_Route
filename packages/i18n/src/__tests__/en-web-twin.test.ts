import { describe, expect, it } from 'vitest';
import { en } from '../messages/en';
import { consoleMsgs } from '../messages/en/console';
import { en as webEn } from '../messages/en/index.web';

/**
 * AMENDMENTS-FINISH-2026-11 FN-7: the learner PWA's English twin (`messages/en/index.web.ts`, picked by Metro's web build
 * only) is the dictionary without the public site's `landing` namespace; every other namespace is the same object, but
 * `console` (AMENDMENTS-START-BUNDLE-2026-11 SB-1).
 */
describe('the learner PWA English twin (FN-7)', () => {
  it('has every namespace of the dictionary, the same objects, but landing and console', () => {
    expect(Object.keys(webEn)).toEqual(Object.keys(en));
    for (const key of Object.keys(en) as (keyof typeof en)[]) {
      if (key === 'landing' || key === 'console') continue;
      expect(webEn[key], key).toBe(en[key]);
    }
  });

  it('landing is empty there', () => {
    expect(webEn.landing).toEqual({});
    expect(Object.keys(en.landing).length).toBeGreaterThan(0);
  });
});

/**
 * SB-1: the twin's `console` holds only the subtrees a web source of the learner app reads (the app's
 * `start-bundle-content.test.ts` derives that list from the sources), each equal to the one in `console.ts`.
 */
const WEB_READ = [
  'confirm.remove',
  'space.learner.lastActive',
  'placement.startingSpot',
  'parentHome.minutes7d',
  'parentHome.lastActive.notStarted',
  'transfer.consent',
] as const;

type Tree = { readonly [key: string]: unknown };
const isTree = (v: unknown): v is Tree => typeof v === 'object' && v !== null;
const at = (tree: unknown, path: string): unknown => path.split('.').reduce<unknown>((node, key) => (isTree(node) ? node[key] : undefined), tree);
const leaves = (tree: Tree, prefix = ''): string[] =>
  Object.entries(tree).flatMap(([key, value]) => (isTree(value) ? leaves(value, `${prefix}${key}.`) : [`${prefix}${key}`]));
/** Sample arguments by position: a count first (plural), then words. */
const sampleArgs = (arity: number): unknown[] => Array.from({ length: arity }, (_, i) => (i === 0 ? 3 : `w${i}`));

describe('the twin\'s console strings (AMENDMENTS-START-BUNDLE-2026-11 SB-1)', () => {
  const twin: Tree = webEn.console as unknown as Tree;
  const full: Tree = consoleMsgs as unknown as Tree;

  it('is not console.ts, and much smaller', () => {
    expect(twin).not.toBe(full);
    expect(en.console).toBe(consoleMsgs);
    expect(leaves(twin).length).toBeLessThan(leaves(full).length / 20);
  });

  it('holds every web-read path, and nothing outside them', () => {
    for (const path of WEB_READ) expect(at(twin, path), path).toBeDefined();
    const outside = leaves(twin).filter((leaf) => !WEB_READ.some((path) => leaf === path || leaf.startsWith(`${path}.`)));
    expect(outside).toEqual([]);
  });

  it('every value is the one in console.ts: equal strings, functions with the same source and the same output', () => {
    const kept = leaves(twin);
    expect(kept.length).toBeGreaterThan(20);
    for (const leaf of kept) {
      const mine = at(twin, leaf);
      const source = at(full, leaf);
      if (typeof source === 'function') {
        expect(typeof mine, leaf).toBe('function');
        const fn = mine as (...args: unknown[]) => unknown;
        const original = source as (...args: unknown[]) => unknown;
        expect(fn.toString(), leaf).toBe(original.toString());
        const args = sampleArgs(original.length);
        expect(fn(...args), leaf).toBe(original(...args));
      } else {
        expect(typeof source, leaf).toBe('string');
        expect(mine, leaf).toBe(source);
      }
    }
    // Every leaf of a kept subtree of console.ts is in the twin (a key added there must be copied here).
    for (const path of WEB_READ) {
      const node = at(full, path);
      const sourceLeaves = isTree(node) ? leaves(node, `${path}.`) : [path];
      for (const leaf of sourceLeaves) expect(kept, leaf).toContain(leaf);
    }
  });
});

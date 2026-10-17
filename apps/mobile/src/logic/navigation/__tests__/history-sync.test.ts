import { describe, expect, it } from 'vitest';
import { browserMove, closeDistance, linkEntryDepth, mergeEntry, navDepth, readEntry, reconcile } from '../history-sync';

/** The web history bridge's rules (AMENDMENTS-DISPLAY-NAV section 7.2, row DN-4). */
const stack = (index: number, routes: { state?: unknown }[] = Array.from({ length: index + 1 }, () => ({}))) => ({ type: 'stack', index, routes }) as never;

describe('navDepth', () => {
  it('counts the routes above the root along the focused path of nested stacks', () => {
    expect(navDepth(undefined)).toBe(0);
    expect(navDepth(stack(0))).toBe(0);
    expect(navDepth(stack(2))).toBe(2);
    // [Onboarding [Welcome, CreateProfile]]: one level inside the nested stack.
    expect(navDepth(stack(0, [{ state: stack(1) }]))).toBe(1);
    // [Main, Placement [PlacementItem]]: the nested stack adds nothing at its root.
    expect(navDepth(stack(1, [{}, { state: stack(0) }]))).toBe(1);
  });

  it('a tab navigator adds nothing; only the focused branch counts', () => {
    const tabs = { type: 'tab', index: 2, routes: [{}, {}, {}, {}] };
    expect(navDepth(stack(0, [{ state: tabs }]))).toBe(0);
    expect(navDepth(stack(1, [{ state: tabs }, {}]))).toBe(1);
    // An unfocused nested stack is not counted.
    expect(navDepth(stack(1, [{ state: stack(3) }, {}]))).toBe(1);
  });

  it('a nested state not built yet counts its last route as focused; an empty one counts nothing', () => {
    expect(navDepth({ routes: [{}, {}, {}] })).toBe(2);
    expect(navDepth({ routes: [] })).toBe(0);
    expect(navDepth({ type: 'stack', index: 5, routes: [{}, {}] })).toBe(5);
  });
});

describe('readEntry and mergeEntry', () => {
  it('reads hrNav and hrBrowseDepth; anything else is absent', () => {
    expect(readEntry({ hrNav: 2, hrBrowseDepth: 1 })).toEqual({ nav: 2, browseDepth: 1 });
    expect(readEntry(null)).toEqual({ nav: null, browseDepth: 0 });
    expect(readEntry({ hrNav: -1, hrBrowseDepth: 1.5 })).toEqual({ nav: null, browseDepth: 0 });
    expect(readEntry('x')).toEqual({ nav: null, browseDepth: 0 });
  });

  it('writes one key over the entry\'s state and keeps every other key (one object for both)', () => {
    expect(mergeEntry({ hrBrowseDepth: 2, other: 'x' }, { hrNav: 1 })).toEqual({ hrBrowseDepth: 2, other: 'x', hrNav: 1 });
    expect(mergeEntry(null, { hrNav: 0 })).toEqual({ hrNav: 0 });
    expect(mergeEntry([1], { hrNav: 0 })).toEqual({ hrNav: 0 });
  });
});

describe('reconcile', () => {
  it('deeper: one entry per new level; shallower: back past the levels left; same depth: nothing', () => {
    expect(reconcile(0, 2)).toEqual({ kind: 'push', navs: [1, 2] });
    expect(reconcile(3, 1)).toEqual({ kind: 'back', by: 2 });
    expect(reconcile(1, 1)).toEqual({ kind: 'none' });
  });
});

describe('browserMove', () => {
  it('back pops the app that many levels; Forward is never replayed', () => {
    expect(browserMove(1, 3)).toEqual({ kind: 'pop', levels: 2 });
    expect(browserMove(2, 1)).toEqual({ kind: 'refuse-forward', by: 1 });
    expect(browserMove(1, 1)).toEqual({ kind: 'none' });
  });
});

describe('All lessons link depth and Close', () => {
  it('a later link counts the entries under it, so Close lands on the page that opened All lessons', () => {
    // First entry (depth 0) with two depth entries above it, then a link: three entries under the link entry.
    expect(linkEntryDepth({ nav: 2, browseDepth: 0 })).toBe(3);
    expect(linkEntryDepth({ nav: null, browseDepth: 3 })).toBe(4);
    expect(closeDistance({ nav: 1, browseDepth: 3 })).toBe(5);
    expect(closeDistance({ nav: null, browseDepth: 0 })).toBe(1);
  });
});

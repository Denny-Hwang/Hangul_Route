import { describe, expect, it } from 'vitest';
import { pickRoot as pickNativeRoot } from '../app-root';
import { pickRoot } from '../app-root.web';

/**
 * F-BROWSE-001 §4.1 (BR-3): the root chooser picks the browse root for
 * `/browse` and `/browse/...` before `App` mounts. F-TCH-004 PR 6
 * (`/present`) and F-APP-001 A-6 (the grown-up bounce) add their branches
 * here; until then those paths still get the learner app, as today.
 */
describe('pickRoot (web)', () => {
  it('chooses the browse root for /browse and every path under it', () => {
    for (const pathname of ['/browse', '/browse/', '/browse/x', '/browse/episode/stage1-letters', '/browse.html']) {
      expect(pickRoot({ pathname }), pathname).toBe('browse');
    }
  });

  it('keeps the learner app everywhere else', () => {
    for (const pathname of ['/', '', '/browsex', '/browser', '/Browse', '/x/browse', '/present', '/teach', '/parent/space', '/index.html']) {
      expect(pickRoot({ pathname }), pathname).toBe('app');
    }
  });
});

describe('pickRoot (native stub)', () => {
  it('always chooses the learner app: native builds have no /browse root (OD-10)', () => {
    expect(pickNativeRoot({ pathname: '/browse' })).toBe('app');
    expect(pickNativeRoot({ pathname: '/' })).toBe('app');
    expect(pickNativeRoot()).toBe('app');
  });
});

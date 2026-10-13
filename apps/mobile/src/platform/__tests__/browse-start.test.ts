import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * F-BROWSE-001 BR-6 (sections 4.3, 4.4, 4.10; BD1 and BD3): the browse root's
 * first step runs the fences and the browse queue before anything else, takes
 * the fragment out of the address, clears the grown-up unlock only in a tab
 * with nothing to go back to, reads the session pass, and sends nothing.
 */
const calls: string[] = [];
let goBack = true;
let fragment = '';

vi.mock('../browse-fences', () => ({
  applyBrowseFences: () => calls.push('fences'),
}));
vi.mock('../browse-env', () => ({
  takeFragment: () => {
    calls.push('takeFragment');
    return fragment;
  },
  canGoBack: () => {
    calls.push('canGoBack');
    return goBack;
  },
}));
vi.mock('../browse', () => ({
  clearGrownUpSession: () => calls.push('clearGrownUpSession'),
}));
vi.mock('../browse-boot', () => ({
  resolveSessionNow: (now: number) => {
    calls.push(`resolveSessionNow:${now}`);
    return null;
  },
}));
vi.mock('../telemetry', () => ({
  track: () => {
    calls.push('track');
    return Promise.resolve(true);
  },
}));

const { startBrowse } = await import('../browse-start');

beforeEach(() => {
  calls.length = 0;
  goBack = true;
  fragment = '';
});

describe('startBrowse', () => {
  it('applies the fences and the browse queue first, then the fragment, then the session pass, and sends nothing', () => {
    fragment = '#t=quest:stage1-letters-q1&s=gate';
    const start = startBrowse(1234);
    expect(calls).toEqual(['fences', 'takeFragment', 'canGoBack', 'resolveSessionNow:1234']);
    expect(start.fragment).toEqual({ target: { kind: 'quest', id: 'quest:stage1-letters-q1' }, source: 'gate' });
    expect(start.fast).toBeNull();
  });

  it('keeps the unlock and the console session when the tab can go back to the page that opened it (BD1)', () => {
    goBack = true;
    startBrowse(1);
    expect(calls).not.toContain('clearGrownUpSession');
  });

  it('clears them in a tab with nothing to go back to: a new tab or an address typed in', () => {
    goBack = false;
    startBrowse(1);
    expect(calls).toEqual(['fences', 'takeFragment', 'canGoBack', 'clearGrownUpSession', 'resolveSessionNow:1']);
  });

  it('a missing or bad fragment is a direct visit', () => {
    fragment = '#t=nope';
    expect(startBrowse(1).fragment).toEqual({ target: null, source: 'direct' });
  });
});

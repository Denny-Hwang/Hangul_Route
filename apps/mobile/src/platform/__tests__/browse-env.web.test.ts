import { afterEach, describe, expect, it, vi } from 'vitest';
import * as nativeEnv from '../browse-env';
import { cameFromSameOrigin, goBack, isOnline, leaveTo, onFragmentChange, takeFragment } from '../browse-env.web';

/**
 * F-BROWSE-001 sections 4.1 and 4.4 (BR-6): the browse root reads the link's
 * fragment and takes it out of the address before first paint, reads a later
 * `hashchange` the same way, and leaves through the page it came from. Every
 * browser call is guarded: a missing or refusing API never throws.
 */
interface FakeWindow {
  location: { hash: string; origin: string; assign: ReturnType<typeof vi.fn> };
  history: { replaceState: ReturnType<typeof vi.fn>; back: ReturnType<typeof vi.fn> };
  document: { referrer: string };
  navigator: { onLine?: boolean };
  listeners: Map<string, () => void>;
  addEventListener: (type: string, fn: () => void) => void;
  removeEventListener: (type: string, fn: () => void) => void;
}

function stubWindow(over: { hash?: string; referrer?: string; onLine?: boolean } = {}): FakeWindow {
  const listeners = new Map<string, () => void>();
  const w: FakeWindow = {
    location: { hash: over.hash ?? '', origin: 'https://app.hangulroute.com', assign: vi.fn() },
    history: { replaceState: vi.fn(), back: vi.fn() },
    document: { referrer: over.referrer ?? '' },
    navigator: over.onLine === undefined ? {} : { onLine: over.onLine },
    listeners,
    addEventListener: (type, fn) => listeners.set(type, fn),
    removeEventListener: (type, fn) => {
      if (listeners.get(type) === fn) listeners.delete(type);
    },
  };
  vi.stubGlobal('location', w.location);
  vi.stubGlobal('history', w.history);
  vi.stubGlobal('document', w.document);
  vi.stubGlobal('navigator', w.navigator);
  vi.stubGlobal('addEventListener', w.addEventListener);
  vi.stubGlobal('removeEventListener', w.removeEventListener);
  return w;
}

afterEach(() => vi.unstubAllGlobals());

describe('takeFragment', () => {
  it('returns the fragment and leaves /browse in the address, before anything paints', () => {
    const w = stubWindow({ hash: '#t=quest:stage1-letters-q1&s=report' });
    expect(takeFragment()).toBe('#t=quest:stage1-letters-q1&s=report');
    expect(w.history.replaceState).toHaveBeenCalledWith(null, '', '/browse');
  });

  it('with no fragment the address is still /browse (an unknown path under it shows home)', () => {
    const w = stubWindow();
    expect(takeFragment()).toBe('');
    expect(w.history.replaceState).toHaveBeenCalledWith(null, '', '/browse');
  });

  it('a history that refuses keeps the fragment readable and never throws', () => {
    const w = stubWindow({ hash: '#s=gate' });
    w.history.replaceState.mockImplementation(() => {
      throw new Error('SecurityError');
    });
    expect(takeFragment()).toBe('#s=gate');
  });

  it('no browser globals: no fragment', () => {
    vi.stubGlobal('location', undefined);
    vi.stubGlobal('history', undefined);
    expect(takeFragment()).toBe('');
  });
});

describe('onFragmentChange', () => {
  it('reads a later hashchange the same way, and stops on unsubscribe', () => {
    const w = stubWindow();
    const seen: string[] = [];
    const off = onFragmentChange((raw) => seen.push(raw));
    w.location.hash = '#t=jamo:nieun&s=report';
    w.listeners.get('hashchange')?.();
    expect(seen).toEqual(['#t=jamo:nieun&s=report']);
    expect(w.history.replaceState).toHaveBeenLastCalledWith(null, '', '/browse');
    off();
    expect(w.listeners.has('hashchange')).toBe(false);
  });

  it('the strip itself (an empty hash) is not a new link', () => {
    const w = stubWindow();
    const handler = vi.fn();
    onFragmentChange(handler);
    w.location.hash = '';
    w.listeners.get('hashchange')?.();
    expect(handler).not.toHaveBeenCalled();
  });

  it('without window events it returns a no-op', () => {
    vi.stubGlobal('addEventListener', undefined);
    expect(() => onFragmentChange(() => undefined)()).not.toThrow();
  });
});

describe('cameFromSameOrigin', () => {
  it('true only for a referrer on this origin', () => {
    stubWindow({ referrer: 'https://app.hangulroute.com/parent' });
    expect(cameFromSameOrigin()).toBe(true);
    stubWindow({ referrer: 'https://hangulroute.com/' });
    expect(cameFromSameOrigin()).toBe(false);
    stubWindow({ referrer: 'https://app.hangulroute.com.evil.example/x' });
    expect(cameFromSameOrigin()).toBe(false);
    stubWindow({ referrer: '' });
    expect(cameFromSameOrigin()).toBe(false);
    stubWindow({ referrer: 'not a url' });
    expect(cameFromSameOrigin()).toBe(false);
  });

  it('no document: false', () => {
    stubWindow();
    vi.stubGlobal('document', undefined);
    expect(cameFromSameOrigin()).toBe(false);
  });
});

describe('leaving', () => {
  it('leaveTo assigns the address in this tab; goBack goes back one page', () => {
    const w = stubWindow();
    leaveTo('/parent');
    expect(w.location.assign).toHaveBeenCalledWith('/parent');
    goBack();
    expect(w.history.back).toHaveBeenCalledTimes(1);
  });

  it('a browser that refuses never throws', () => {
    const w = stubWindow();
    w.location.assign.mockImplementation(() => {
      throw new Error('blocked');
    });
    w.history.back.mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(() => leaveTo('/')).not.toThrow();
    expect(() => goBack()).not.toThrow();
  });
});

describe('isOnline', () => {
  it('follows navigator.onLine; unknown counts as online', () => {
    stubWindow({ onLine: false });
    expect(isOnline()).toBe(false);
    stubWindow({ onLine: true });
    expect(isOnline()).toBe(true);
    stubWindow();
    expect(isOnline()).toBe(true);
  });
});

describe('native stub (All lessons is web only, OD-10)', () => {
  it('has no fragment, no referrer and nowhere to go', () => {
    expect(nativeEnv.takeFragment()).toBe('');
    expect(nativeEnv.cameFromSameOrigin()).toBe(false);
    expect(nativeEnv.isOnline()).toBe(true);
    expect(() => nativeEnv.onFragmentChange(() => undefined)()).not.toThrow();
    expect(() => nativeEnv.leaveTo('/')).not.toThrow();
    expect(() => nativeEnv.goBack()).not.toThrow();
  });
});

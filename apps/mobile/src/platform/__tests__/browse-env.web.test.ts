import { afterEach, describe, expect, it, vi } from 'vitest';
import * as nativeEnv from '../browse-env';
import { cameFromSameOrigin, canGoBack, goBack, isOnline, leaveTo, onFragmentChange, onPageVisible, takeFragment } from '../browse-env.web';

/**
 * F-BROWSE-001 sections 4.1 and 4.4 (BR-6): the browse root reads the link's
 * fragment and takes it out of the address before first paint, reads a later
 * `hashchange` the same way, and leaves through the page it came from. Every
 * browser call is guarded: a missing or refusing API never throws.
 */
interface FakeWindow {
  location: { hash: string; origin: string; assign: ReturnType<typeof vi.fn> };
  history: { replaceState: ReturnType<typeof vi.fn>; go: ReturnType<typeof vi.fn>; length: number; state: unknown };
  document: {
    referrer: string;
    visibilityState?: string;
    listeners: Map<string, () => void>;
    addEventListener: (type: string, fn: () => void) => void;
    removeEventListener: (type: string, fn: () => void) => void;
  };
  navigator: { onLine?: boolean };
  listeners: Map<string, () => void>;
  addEventListener: (type: string, fn: () => void) => void;
  removeEventListener: (type: string, fn: () => void) => void;
}

function stubWindow(over: { hash?: string; referrer?: string; onLine?: boolean; length?: number; state?: unknown } = {}): FakeWindow {
  const listeners = new Map<string, () => void>();
  const docListeners = new Map<string, () => void>();
  const history: FakeWindow['history'] = {
    replaceState: vi.fn((state: unknown) => {
      history.state = state;
    }),
    go: vi.fn(),
    length: over.length ?? 1,
    state: over.state ?? null,
  };
  const w: FakeWindow = {
    location: { hash: over.hash ?? '', origin: 'https://app.hangulroute.com', assign: vi.fn() },
    history,
    document: {
      referrer: over.referrer ?? '',
      listeners: docListeners,
      addEventListener: (type, fn) => docListeners.set(type, fn),
      removeEventListener: (type, fn) => {
        if (docListeners.get(type) === fn) docListeners.delete(type);
      },
    },
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
    expect(w.history.replaceState).toHaveBeenCalledWith({ hrBrowseDepth: 0 }, '', '/browse');
  });

  it('with no fragment the address is still /browse (an unknown path under it shows home)', () => {
    const w = stubWindow();
    expect(takeFragment()).toBe('');
    expect(w.history.replaceState).toHaveBeenCalledWith({ hrBrowseDepth: 0 }, '', '/browse');
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
    expect(w.history.replaceState).toHaveBeenLastCalledWith({ hrBrowseDepth: 1 }, '', '/browse');
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
  afterEach(() => vi.useRealTimers());

  it('leaveTo assigns the address in this tab', () => {
    const w = stubWindow();
    leaveTo('/parent');
    expect(w.location.assign).toHaveBeenCalledWith('/parent');
  });

  it('goBack goes back past the page, and leaves for the fallback when nothing unloads', () => {
    vi.useFakeTimers();
    const w = stubWindow({ length: 3 });
    takeFragment();
    goBack('/parent');
    expect(w.history.go).toHaveBeenCalledWith(-1);
    vi.advanceTimersByTime(999);
    expect(w.location.assign).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(w.location.assign).toHaveBeenCalledWith('/parent');
  });

  it('goBack does not use the fallback once the page starts to leave or unloads', () => {
    vi.useFakeTimers();
    for (const event of ['beforeunload', 'pagehide']) {
      const w = stubWindow({ length: 3 });
      takeFragment();
      goBack('/');
      w.listeners.get(event)?.();
      vi.advanceTimersByTime(2000);
      expect(w.location.assign, event).not.toHaveBeenCalled();
      expect(w.listeners.has('pagehide')).toBe(false);
    }
  });

  it('a later link adds a history entry: goBack skips it too, and canGoBack counts it', () => {
    vi.useFakeTimers();
    const w = stubWindow({ referrer: 'https://app.hangulroute.com/teach/home', length: 2 });
    takeFragment();
    const off = onFragmentChange(() => undefined);
    // The hash a second link sets pushes one entry.
    w.history.length = 3;
    w.location.hash = '#t=jamo:nieun&s=report';
    w.listeners.get('hashchange')?.();
    expect(canGoBack()).toBe(true);
    goBack('/teach/home');
    expect(w.history.go).toHaveBeenCalledWith(-2);
    off();
  });

  it('a reload keeps the count from the entry, and a back or forward inside the page reads it again', () => {
    const w = stubWindow({ referrer: 'https://app.hangulroute.com/parent', length: 3, state: { hrBrowseDepth: 1 } });
    takeFragment();
    expect(w.history.replaceState).toHaveBeenCalledWith({ hrBrowseDepth: 1 }, '', '/browse');
    const off = onFragmentChange(() => undefined);
    goBack('/parent');
    expect(w.history.go).toHaveBeenLastCalledWith(-2);
    w.history.state = { hrBrowseDepth: 0 };
    w.listeners.get('popstate')?.();
    goBack('/parent');
    expect(w.history.go).toHaveBeenLastCalledWith(-1);
    w.history.state = 'not ours';
    w.listeners.get('popstate')?.();
    goBack('/parent');
    expect(w.history.go).toHaveBeenLastCalledWith(-1);
    off();
    expect(w.listeners.has('popstate')).toBe(false);
  });

  it('a browser that refuses never throws', () => {
    vi.useFakeTimers();
    const w = stubWindow();
    w.location.assign.mockImplementation(() => {
      throw new Error('blocked');
    });
    w.history.go.mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(() => leaveTo('/')).not.toThrow();
    expect(() => goBack('/')).not.toThrow();
    expect(() => vi.advanceTimersByTime(1500)).not.toThrow();
  });
});

describe('canGoBack', () => {
  it('needs a same-origin referrer and an earlier entry in this tab', () => {
    stubWindow({ referrer: 'https://app.hangulroute.com/parent', length: 2 });
    takeFragment();
    expect(canGoBack()).toBe(true);
    // A new tab (or a middle-click) from a console page: a referrer, but nothing to go back to.
    stubWindow({ referrer: 'https://app.hangulroute.com/parent', length: 1 });
    takeFragment();
    expect(canGoBack()).toBe(false);
    stubWindow({ referrer: '', length: 4 });
    takeFragment();
    expect(canGoBack()).toBe(false);
  });

  it('no history: false', () => {
    stubWindow({ referrer: 'https://app.hangulroute.com/parent', length: 2 });
    vi.stubGlobal('history', undefined);
    expect(canGoBack()).toBe(false);
  });
});

describe('onPageVisible', () => {
  it('hears visibilitychange on the document (where the browser fires it) and focus on the window, and stops on unsubscribe', () => {
    const w = stubWindow();
    const seen = vi.fn();
    const off = onPageVisible(seen);
    expect(w.listeners.has('visibilitychange')).toBe(false);
    expect(w.document.listeners.has('visibilitychange')).toBe(true);
    w.document.visibilityState = 'hidden';
    w.document.listeners.get('visibilitychange')?.();
    expect(seen).not.toHaveBeenCalled();
    w.document.visibilityState = 'visible';
    w.document.listeners.get('visibilitychange')?.();
    w.listeners.get('focus')?.();
    expect(seen).toHaveBeenCalledTimes(2);
    off();
    expect(w.document.listeners.has('visibilitychange')).toBe(false);
    expect(w.listeners.has('focus')).toBe(false);
  });

  it('a document without listeners, or one that refuses them, still has the window focus', () => {
    const w = stubWindow();
    vi.stubGlobal('document', { visibilityState: 'visible' });
    const seen = vi.fn();
    const off = onPageVisible(seen);
    w.listeners.get('focus')?.();
    expect(seen).toHaveBeenCalledTimes(1);
    expect(() => off()).not.toThrow();
    const refusing = {
      addEventListener: () => {
        throw new Error('refused');
      },
      removeEventListener: () => {
        throw new Error('refused');
      },
    };
    vi.stubGlobal('document', refusing);
    const off2 = onPageVisible(seen);
    w.listeners.get('focus')?.();
    expect(seen).toHaveBeenCalledTimes(2);
    expect(() => off2()).not.toThrow();
  });

  it('without window events it returns a no-op', () => {
    vi.stubGlobal('addEventListener', undefined);
    expect(() => onPageVisible(() => undefined)()).not.toThrow();
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
    expect(nativeEnv.canGoBack()).toBe(false);
    expect(() => nativeEnv.onPageVisible(() => undefined)()).not.toThrow();
    expect(nativeEnv.isOnline()).toBe(true);
    expect(() => nativeEnv.onFragmentChange(() => undefined)()).not.toThrow();
    expect(() => nativeEnv.leaveTo('/')).not.toThrow();
    expect(() => nativeEnv.goBack('/')).not.toThrow();
  });
});

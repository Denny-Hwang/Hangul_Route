import { LECTURE_CONSOLE_ORIGINS, LECTURE_MESSAGE_NS, type LectureDeck } from '@hangul-route/content-schema';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { clearPickerLabels, heldLabels } from '../../logic/lecture/picker-labels';
import * as native from '../presenter';
import {
  PRESENTER_PATH,
  announceReady,
  enterFullscreen,
  exitFullscreen,
  fullscreenSupported,
  isFullscreen,
  isPresenterRoute,
  isReloadNavigation,
  keepScreenAwake,
  listenForRoster,
  lockLandscape,
  presenterConsoleOrigins,
  releaseScreenAwake,
  setPresenterDocTitle,
  subscribeFullscreen,
  subscribeKeys,
  takeDeckFragment,
  unlockOrientation,
  waitForPresenterFont,
  wakeLockSupported,
  type PresenterEnv,
} from '../presenter.web';

/**
 * The presenter's web platform layer (F-TCH-004 sections 3.1, 3.2, 3.5, 3.8; spec section 5
 * `presenter.web.test.ts`): route, fragment read and strip with the fixed `document.title`, the
 * roster hand-off (`announceReady` posts only to `window.opener` and only to allowed origins; a
 * roster is held only from the opener), keys, and the Start-tap device features, each feature
 * detected and failure tolerant. Every browser global is injected.
 */

const deck = (picker: LectureDeck['picker']): Pick<LectureDeck, 'id' | 'picker'> => ({ id: 'lecture:abc123', picker });

type Listener = (event: never) => void;

function fakeTarget() {
  const listeners = new Map<string, Set<Listener>>();
  return {
    listeners,
    addEventListener: vi.fn((type: string, fn: Listener) => {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type)!.add(fn);
    }),
    removeEventListener: vi.fn((type: string, fn: Listener) => {
      listeners.get(type)?.delete(fn);
    }),
    fire(type: string, event: unknown): void {
      for (const fn of listeners.get(type) ?? []) (fn as (e: unknown) => void)(event);
    },
    count(type: string): number {
      return listeners.get(type)?.size ?? 0;
    },
  };
}

function env(overrides: Partial<PresenterEnv> = {}): PresenterEnv {
  return { ...overrides };
}

afterEach(() => {
  clearPickerLabels();
  vi.useRealTimers();
});

describe('route', () => {
  it('is the presenter for /present and every path under it, never for a look-alike', () => {
    for (const pathname of ['/present', '/present/', '/present/x']) expect(isPresenterRoute({ pathname }), pathname).toBe(true);
    for (const pathname of ['/', '/presentx', '/presenter', '/x/present']) expect(isPresenterRoute({ pathname }), pathname).toBe(false);
  });

  it('the native stub never presents and does nothing', async () => {
    expect(native.isPresenterRoute({ pathname: '/present' })).toBe(false);
    expect(native.takeDeckFragment()).toBeNull();
    expect(native.announceReady(deck({ mode: 'names', count: 2 }))).toBe(0);
    expect(native.fullscreenSupported()).toBe(false);
    expect(native.wakeLockSupported()).toBe(false);
    expect(native.isReloadNavigation()).toBe(false);
    expect(native.isFullscreen()).toBe(false);
    expect(await native.waitForPresenterFont(1)).toBe(false);
    expect(native.presenterConsoleOrigins()).toEqual([...LECTURE_CONSOLE_ORIGINS]);
    native.setPresenterDocTitle('x');
    native.listenForRoster(deck(null))();
    native.subscribeKeys(() => undefined)();
    native.subscribeFullscreen(() => undefined)();
    await native.enterFullscreen();
    await native.exitFullscreen();
    await native.keepScreenAwake();
    await native.releaseScreenAwake();
    await native.lockLandscape();
    native.unlockOrientation();
  });
});

describe('takeDeckFragment', () => {
  function addressEnv(href: { pathname: string; hash: string }) {
    const calls: string[] = [];
    const e = env({
      location: { pathname: href.pathname, hash: href.hash },
      history: {
        replaceState: (_state: unknown, _unused: string, url: string) => {
          calls.push(url);
        },
      },
    });
    return { e, calls };
  }

  it('reads the d= value and takes the fragment out of the address before the first paint', () => {
    const { e, calls } = addressEnv({ pathname: '/present', hash: '#d=1.eyJ2IjoxfQ' });
    expect(takeDeckFragment(e)).toBe('1.eyJ2IjoxfQ');
    expect(calls).toEqual([PRESENTER_PATH]);
  });

  it('an empty d= is an empty fragment (the codec rejects it as empty); the address is cleaned all the same', () => {
    const { e, calls } = addressEnv({ pathname: '/present', hash: '#d=' });
    expect(takeDeckFragment(e)).toBe('');
    expect(calls).toEqual([PRESENTER_PATH]);
  });

  it('a fragment without d= is not a deck, and the fragment still leaves the address', () => {
    const { e, calls } = addressEnv({ pathname: '/present', hash: '#x=1' });
    expect(takeDeckFragment(e)).toBeNull();
    expect(calls).toEqual([PRESENTER_PATH]);
  });

  it('a d= among other keys is found', () => {
    const { e } = addressEnv({ pathname: '/present', hash: '#a=1&d=1.abc&b=2' });
    expect(takeDeckFragment(e)).toBe('1.abc');
  });

  it('an unknown path under /present is cleaned to /present (the presenter home, no 404)', () => {
    const { e, calls } = addressEnv({ pathname: '/present/old/link', hash: '' });
    expect(takeDeckFragment(e)).toBeNull();
    expect(calls).toEqual([PRESENTER_PATH]);
  });

  it('/present with no fragment leaves the history alone', () => {
    const { e, calls } = addressEnv({ pathname: '/present', hash: '' });
    expect(takeDeckFragment(e)).toBeNull();
    expect(calls).toEqual([]);
  });

  it('a history that refuses (a sandboxed frame) still returns the deck', () => {
    const e = env({
      location: { pathname: '/present', hash: '#d=1.abc' },
      history: {
        replaceState: () => {
          throw new Error('SecurityError');
        },
      },
    });
    expect(takeDeckFragment(e)).toBe('1.abc');
  });

  it('no location (not a browser): nothing', () => {
    expect(takeDeckFragment(env())).toBeNull();
  });
});

describe('document title and navigation type', () => {
  it('sets the fixed title only', () => {
    const doc = { title: 'Deck title with a name' };
    setPresenterDocTitle('Hangul Route lecture', env({ document: doc }));
    expect(doc.title).toBe('Hangul Route lecture');
    expect(() => setPresenterDocTitle('x', env())).not.toThrow();
  });

  it('reads a reload from the navigation timing entry', () => {
    const perf = (type: string) => ({ getEntriesByType: () => [{ type }] });
    expect(isReloadNavigation(env({ performance: perf('reload') }))).toBe(true);
    expect(isReloadNavigation(env({ performance: perf('navigate') }))).toBe(false);
    expect(isReloadNavigation(env({ performance: { getEntriesByType: () => [] } }))).toBe(false);
    expect(
      isReloadNavigation(
        env({
          performance: {
            getEntriesByType: () => {
              throw new Error('no');
            },
          },
        }),
      ),
    ).toBe(false);
    expect(isReloadNavigation(env())).toBe(false);
  });
});

describe('console origins', () => {
  it('adds the build-time preview list to the shared list', () => {
    expect(presenterConsoleOrigins('https://preview.example.dev, https://*.pages.dev')).toEqual([
      ...LECTURE_CONSOLE_ORIGINS,
      'https://preview.example.dev',
    ]);
    expect(presenterConsoleOrigins(undefined)).toEqual([...LECTURE_CONSOLE_ORIGINS]);
  });
});

describe('announceReady', () => {
  it('posts one ready message per allowed origin to window.opener only', () => {
    const post = vi.fn();
    const n = announceReady(deck({ mode: 'names', count: 2 }), env({ opener: { postMessage: post }, consoleOrigins: ['https://a.example', 'https://b.example'] }));
    expect(n).toBe(2);
    expect(post.mock.calls).toEqual([
      [{ ns: LECTURE_MESSAGE_NS, v: 1, type: 'ready', deckId: 'lecture:abc123' }, 'https://a.example'],
      [{ ns: LECTURE_MESSAGE_NS, v: 1, type: 'ready', deckId: 'lecture:abc123' }, 'https://b.example'],
    ]);
  });

  it('posts nothing without an opener, for a numbers deck or a deck with no picker', () => {
    const post = vi.fn();
    expect(announceReady(deck({ mode: 'names', count: 2 }), env({ opener: null }))).toBe(0);
    expect(announceReady(deck({ mode: 'numbers', count: 12 }), env({ opener: { postMessage: post } }))).toBe(0);
    expect(announceReady(deck(null), env({ opener: { postMessage: post } }))).toBe(0);
    expect(post).not.toHaveBeenCalled();
  });

  it('a post that throws (a closed opener) is skipped and the rest still go', () => {
    const post = vi
      .fn()
      .mockImplementationOnce(() => {
        throw new Error('closed');
      })
      .mockImplementation(() => undefined);
    expect(announceReady(deck({ mode: 'initials', count: 1 }), env({ opener: { postMessage: post }, consoleOrigins: ['https://a.example', 'https://b.example'] }))).toBe(1);
  });
});

describe('listenForRoster', () => {
  const roster = (labels: string[], extra: Record<string, unknown> = {}) => ({
    ns: LECTURE_MESSAGE_NS,
    v: 1,
    type: 'roster',
    deckId: 'lecture:abc123',
    mode: 'names',
    labels,
    ...extra,
  });

  it('holds the labels of a roster from the opener and an allowed origin, and calls back once', () => {
    const win = fakeTarget();
    const opener = { postMessage: vi.fn() };
    const onRoster = vi.fn();
    const d = deck({ mode: 'names', count: 2 });
    const stop = listenForRoster(d, onRoster, env({ window: win, opener, consoleOrigins: ['https://app.example'] }));
    win.fire('message', { origin: 'https://app.example', source: opener, data: roster(['Mina', 'Joon']) });
    expect(onRoster).toHaveBeenCalledTimes(1);
    expect(heldLabels({ id: d.id, picker: d.picker })).toEqual(['Mina', 'Joon']);
    stop();
    expect(win.count('message')).toBe(0);
  });

  it('ignores a message from another window, another origin or with the wrong shape, silently', () => {
    const win = fakeTarget();
    const opener = { postMessage: vi.fn() };
    const onRoster = vi.fn();
    const d = deck({ mode: 'names', count: 2 });
    listenForRoster(d, onRoster, env({ window: win, opener, consoleOrigins: ['https://app.example'] }));
    win.fire('message', { origin: 'https://app.example', source: {}, data: roster(['Mina', 'Joon']) });
    win.fire('message', { origin: 'https://evil.example', source: opener, data: roster(['Mina', 'Joon']) });
    win.fire('message', { origin: 'https://app.example', source: opener, data: roster(['Mina']) });
    win.fire('message', { origin: 'https://app.example', source: opener, data: roster(['Mina', 'Joon'], { extra: 1 }) });
    expect(onRoster).not.toHaveBeenCalled();
    expect(heldLabels({ id: d.id, picker: d.picker })).toBeNull();
  });

  it('listens to nothing without an opener or for a numbers deck', () => {
    const win = fakeTarget();
    listenForRoster(deck({ mode: 'names', count: 2 }), vi.fn(), env({ window: win, opener: null }))();
    listenForRoster(deck({ mode: 'numbers', count: 2 }), vi.fn(), env({ window: win, opener: {} }))();
    expect(win.addEventListener).not.toHaveBeenCalled();
  });
});

describe('subscribeKeys', () => {
  function press(win: ReturnType<typeof fakeTarget>, init: Record<string, unknown>) {
    const event = { preventDefault: vi.fn(), ...init };
    win.fire('keydown', event);
    return event;
  }

  it('maps a key to its command and prevents only handled keys', () => {
    const doc = fakeTarget();
    const handler = vi.fn();
    const stop = subscribeKeys(handler, env({ keyTarget: doc }));
    const next = press(doc, { key: 'PageDown', code: 'PageDown' });
    const unknown = press(doc, { key: 'q', code: 'KeyQ' });
    expect(handler.mock.calls).toEqual([['next']]);
    expect(next.preventDefault).toHaveBeenCalled();
    expect(unknown.preventDefault).not.toHaveBeenCalled();
    stop();
    expect(doc.count('keydown')).toBe(0);
  });

  it('leaves Enter and Space to a focused button, but arrows still move', () => {
    const doc = fakeTarget();
    const handler = vi.fn();
    const button = { tagName: 'BUTTON', getAttribute: () => null };
    subscribeKeys(handler, env({ keyTarget: doc, activeElement: () => button }));
    press(doc, { key: 'Enter' });
    press(doc, { key: ' ' });
    press(doc, { key: 'ArrowRight' });
    expect(handler.mock.calls).toEqual([['next']]);
  });

  it('treats role=button, role=radio and links as activatable, and ignores keys typed in a field', () => {
    const doc = fakeTarget();
    const handler = vi.fn();
    let focused: unknown = { tagName: 'DIV', getAttribute: (n: string) => (n === 'role' ? 'radio' : null) };
    subscribeKeys(handler, env({ keyTarget: doc, activeElement: () => focused }));
    press(doc, { key: 'Enter' });
    focused = { tagName: 'A', getAttribute: () => null };
    press(doc, { key: ' ' });
    focused = { tagName: 'INPUT', getAttribute: () => null };
    press(doc, { key: 'ArrowRight' });
    focused = { tagName: 'DIV', isContentEditable: true, getAttribute: () => null };
    press(doc, { key: 'ArrowRight' });
    focused = { tagName: 'DIV', getAttribute: () => null };
    press(doc, { key: 'Enter' });
    expect(handler.mock.calls).toEqual([['next']]);
  });

  it('passes repeat, modifiers and the physical code to the key map', () => {
    const doc = fakeTarget();
    const handler = vi.fn();
    subscribeKeys(handler, env({ keyTarget: doc }));
    press(doc, { key: 'ArrowRight', repeat: true });
    press(doc, { key: 'f', ctrlKey: true });
    press(doc, { key: '\u3139', code: 'KeyF' });
    press(doc, { key: 'R', shiftKey: true });
    press(doc, { key: 'Escape', defaultPrevented: true });
    expect(handler.mock.calls).toEqual([['fullscreen'], ['toggle-romanization']]);
  });

  it('no document: a no-op', () => {
    expect(() => subscribeKeys(vi.fn(), env())()).not.toThrow();
  });
});

describe('fullscreen', () => {
  it('uses the standard API, then the webkit one, and tolerates a refusal', async () => {
    const request = vi.fn(async () => undefined);
    const root = { requestFullscreen: request };
    const doc: Record<string, unknown> = { documentElement: root, fullscreenEnabled: true, fullscreenElement: null, exitFullscreen: vi.fn(async () => undefined) };
    const e = env({ document: doc });
    expect(fullscreenSupported(e)).toBe(true);
    expect(await enterFullscreen(e)).toBe(true);
    expect(request).toHaveBeenCalled();
    expect(isFullscreen(e)).toBe(false);
    doc.fullscreenElement = root;
    expect(isFullscreen(e)).toBe(true);
    await exitFullscreen(e);
    expect(doc.exitFullscreen).toHaveBeenCalled();

    const webkit = vi.fn();
    const old = { documentElement: { webkitRequestFullscreen: webkit }, webkitFullscreenEnabled: true, webkitFullscreenElement: {}, webkitExitFullscreen: vi.fn() };
    expect(fullscreenSupported(env({ document: old }))).toBe(true);
    expect(await enterFullscreen(env({ document: old }))).toBe(true);
    expect(webkit).toHaveBeenCalled();
    expect(isFullscreen(env({ document: old }))).toBe(true);
    await exitFullscreen(env({ document: old }));
    expect(old.webkitExitFullscreen).toHaveBeenCalled();

    const refusing = { documentElement: { requestFullscreen: vi.fn(async () => Promise.reject(new Error('denied'))) }, fullscreenEnabled: true };
    expect(await enterFullscreen(env({ document: refusing }))).toBe(false);
    const throwingExit = { fullscreenElement: {}, exitFullscreen: () => Promise.reject(new Error('no')) };
    await expect(exitFullscreen(env({ document: throwingExit }))).resolves.toBeUndefined();
  });

  it('an iPhone (no API) is unsupported and every call is silent', async () => {
    const doc = { documentElement: {} };
    expect(fullscreenSupported(env({ document: doc }))).toBe(false);
    expect(await enterFullscreen(env({ document: doc }))).toBe(false);
    await exitFullscreen(env({ document: doc }));
    expect(fullscreenSupported(env())).toBe(false);
    expect(isFullscreen(env())).toBe(false);
  });

  it('a page not in fullscreen does not call exit', async () => {
    const exit = vi.fn();
    await exitFullscreen(env({ document: { fullscreenElement: null, exitFullscreen: exit } }));
    expect(exit).not.toHaveBeenCalled();
  });

  it('reports changes from both event names', () => {
    const doc = fakeTarget();
    const handler = vi.fn();
    const stop = subscribeFullscreen(handler, env({ document: { ...doc, fullscreenElement: {} } as never }));
    doc.fire('fullscreenchange', {});
    doc.fire('webkitfullscreenchange', {});
    expect(handler).toHaveBeenCalledTimes(2);
    stop();
    expect(doc.count('fullscreenchange')).toBe(0);
    expect(() => subscribeFullscreen(handler, env())()).not.toThrow();
  });
});

describe('wake lock', () => {
  it('requests the screen lock, re-requests it when the page is shown again, and releases it', async () => {
    const sentinel = { release: vi.fn(async () => undefined), released: false };
    const request = vi.fn(async () => sentinel);
    const doc = { ...fakeTarget(), visibilityState: 'visible' };
    const e = env({ navigator: { wakeLock: { request } }, document: doc as never });
    expect(wakeLockSupported(e)).toBe(true);
    await keepScreenAwake(e);
    expect(request).toHaveBeenCalledWith('screen');
    doc.fire('visibilitychange', {});
    await Promise.resolve();
    expect(request).toHaveBeenCalledTimes(2);
    await releaseScreenAwake(e);
    expect(sentinel.release).toHaveBeenCalled();
    expect(doc.count('visibilitychange')).toBe(0);
  });

  it('a hidden page does not re-request', async () => {
    const request = vi.fn(async () => ({ release: async () => undefined }));
    const doc = { ...fakeTarget(), visibilityState: 'hidden' };
    const e = env({ navigator: { wakeLock: { request } }, document: doc as never });
    await keepScreenAwake(e);
    doc.fire('visibilitychange', {});
    expect(request).toHaveBeenCalledTimes(1);
    await releaseScreenAwake(e);
  });

  it('unsupported or refused: silent', async () => {
    expect(wakeLockSupported(env({ navigator: {} }))).toBe(false);
    await expect(keepScreenAwake(env({ navigator: {} }))).resolves.toBeUndefined();
    const refused = env({ navigator: { wakeLock: { request: async () => Promise.reject(new Error('NotAllowed')) } } });
    await expect(keepScreenAwake(refused)).resolves.toBeUndefined();
    await expect(releaseScreenAwake(refused)).resolves.toBeUndefined();
    const badRelease = env({ navigator: { wakeLock: { request: async () => ({ release: () => Promise.reject(new Error('x')) }) } } });
    await keepScreenAwake(badRelease);
    await expect(releaseScreenAwake(badRelease)).resolves.toBeUndefined();
  });
});

describe('orientation', () => {
  it('locks landscape and unlocks, tolerating a refusal or a missing API', async () => {
    const lock = vi.fn(async () => undefined);
    const unlock = vi.fn();
    const e = env({ screen: { orientation: { lock, unlock } } });
    await lockLandscape(e);
    expect(lock).toHaveBeenCalledWith('landscape');
    unlockOrientation(e);
    expect(unlock).toHaveBeenCalled();
    await expect(lockLandscape(env({ screen: { orientation: { lock: async () => Promise.reject(new Error('x')), unlock: () => { throw new Error('y'); } } } }))).resolves.toBeUndefined();
    expect(() => unlockOrientation(env({ screen: { orientation: { unlock: () => { throw new Error('y'); } } } }))).not.toThrow();
    await expect(lockLandscape(env())).resolves.toBeUndefined();
    expect(() => unlockOrientation(env())).not.toThrow();
  });
});

describe('waitForPresenterFont', () => {
  it('resolves true when the face loads in time', async () => {
    const load = vi.fn(async () => [{}]);
    expect(await waitForPresenterFont(1500, env({ document: { fonts: { load } } }))).toBe(true);
    expect(load).toHaveBeenCalledWith('700 1em "HR Presenter KR"');
  });

  it('falls back silently: no face, a failure or a timeout resolve false', async () => {
    expect(await waitForPresenterFont(1500, env({ document: { fonts: { load: async () => [] } } }))).toBe(false);
    expect(await waitForPresenterFont(1500, env({ document: { fonts: { load: () => Promise.reject(new Error('x')) } } }))).toBe(false);
    expect(await waitForPresenterFont(1500, env({ document: {} }))).toBe(false);
    vi.useFakeTimers();
    const pending = waitForPresenterFont(1500, env({ document: { fonts: { load: () => new Promise(() => undefined) } } }));
    vi.advanceTimersByTime(1500);
    expect(await pending).toBe(false);
  });
});

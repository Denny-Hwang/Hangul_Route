import { LECTURE_CONSOLE_ORIGINS, LECTURE_MESSAGE_NS, type LectureDeck } from '@hangul-route/content-schema';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { clearPickerLabels, heldLabels } from '../../logic/lecture/picker-labels';
import * as native from '../presenter';
import {
  PRESENTER_PATH,
  announceReady,
  checkForUpdate,
  enterFullscreen,
  enterFullscreenLandscape,
  exitFullscreen,
  forgetOpenDeck,
  holdOpenDeck,
  fullscreenSupported,
  hasOpener,
  isFullscreen,
  isPresenterRoute,
  keepScreenAwake,
  listenForRoster,
  lockLandscape,
  playChime,
  presenterConsoleOrigins,
  releaseScreenAwake,
  reloadForUpdate,
  reloadOnDeckLink,
  setPresenterDocTitle,
  subscribeActivity,
  subscribeFullscreen,
  subscribeKeys,
  takeDeckFragment,
  trapFocus,
  focusablesIn,
  rememberFocus,
  unlockChime,
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
    expect(native.hasOpener()).toBe(false);
    expect(native.wakeLockSupported()).toBe(false);
    native.forgetOpenDeck();
    native.holdOpenDeck('1.abc');
    native.reloadOnDeckLink()();
    await native.checkForUpdate();
    await native.reloadForUpdate('2.abc');
    expect(native.isFullscreen()).toBe(false);
    expect(await native.waitForPresenterFont(1, 'HR Presenter KR')).toBe(false);
    expect(native.playChime(false)).toBe(false);
    expect(() => native.unlockChime()).not.toThrow();
    expect(native.presenterConsoleOrigins()).toEqual([...LECTURE_CONSOLE_ORIGINS]);
    native.setPresenterDocTitle('x');
    native.listenForRoster(deck(null))();
    native.subscribeKeys(() => undefined)();
    native.subscribeActivity(() => undefined)();
    native.subscribeFullscreen(() => undefined)();
    await native.enterFullscreen();
    await native.exitFullscreen();
    await native.keepScreenAwake();
    await native.releaseScreenAwake();
    await native.lockLandscape();
    expect(await native.enterFullscreenLandscape()).toBe(false);
    native.unlockOrientation();
  });
});

describe('takeDeckFragment', () => {
  function addressEnv(href: { pathname: string; hash: string }, state: unknown = null) {
    const calls: { state: unknown; url: string }[] = [];
    const history = {
      state,
      replaceState(next: unknown, _unused: string, url: string) {
        this.state = next;
        calls.push({ state: next, url });
      },
    };
    return { e: env({ location: { pathname: href.pathname, hash: href.hash }, history }), calls, history };
  }

  it('reads the d= value, takes the fragment out of the address and keeps the deck in the history state', () => {
    const { e, calls } = addressEnv({ pathname: '/present', hash: '#d=1.eyJ2IjoxfQ' });
    expect(takeDeckFragment(e)).toEqual({ raw: '1.eyJ2IjoxfQ', reloaded: false });
    expect(calls).toEqual([{ state: { hrLectureFragment: '1.eyJ2IjoxfQ' }, url: PRESENTER_PATH }]);
  });

  it('a reload (no fragment, the state kept) returns the same deck as reloaded and leaves the history alone', () => {
    const { e, calls } = addressEnv({ pathname: '/present', hash: '' }, { hrLectureFragment: '1.abc' });
    expect(takeDeckFragment(e)).toEqual({ raw: '1.abc', reloaded: true });
    expect(calls).toEqual([]);
  });

  it('a new link in a tab that held another deck replaces it', () => {
    const { e, history } = addressEnv({ pathname: '/present', hash: '#d=1.new' }, { hrLectureFragment: '1.old' });
    expect(takeDeckFragment(e)).toEqual({ raw: '1.new', reloaded: false });
    expect(history.state).toEqual({ hrLectureFragment: '1.new' });
  });

  it('an empty d= is an empty fragment (the codec rejects it as empty)', () => {
    const { e } = addressEnv({ pathname: '/present', hash: '#d=' });
    expect(takeDeckFragment(e)).toEqual({ raw: '', reloaded: false });
    const bare = addressEnv({ pathname: '/present', hash: '#d' });
    expect(takeDeckFragment(bare.e)).toEqual({ raw: '', reloaded: false });
  });

  it('a fragment without d= is not a deck, and the fragment still leaves the address', () => {
    const { e, calls } = addressEnv({ pathname: '/present', hash: '#x=1' });
    expect(takeDeckFragment(e)).toBeNull();
    expect(calls).toEqual([{ state: null, url: PRESENTER_PATH }]);
  });

  it('keeps a ?lang= hand-off for the locale store to take, and drops every other query', () => {
    const calls: { state: unknown; url: string }[] = [];
    const history = { state: null as unknown, replaceState: (next: unknown, _u: string, url: string) => calls.push({ state: next, url }) };
    const e = env({ location: { pathname: '/present', search: '?x=1&lang=es', hash: '#d=1.abc' }, history });
    expect(takeDeckFragment(e)).toEqual({ raw: '1.abc', reloaded: false });
    expect(calls).toEqual([{ state: { hrLectureFragment: '1.abc' }, url: `${PRESENTER_PATH}?lang=es` }]);
    const plain = env({ location: { pathname: '/present/x', search: '?x=1', hash: '' }, history });
    takeDeckFragment(plain);
    expect(calls[1]!.url).toBe(PRESENTER_PATH);
  });

  it('a d= among other keys is found', () => {
    const { e } = addressEnv({ pathname: '/present', hash: '#a=1&d=1.abc&b=2' });
    expect(takeDeckFragment(e)).toEqual({ raw: '1.abc', reloaded: false });
  });

  it('an unknown path under /present is cleaned to /present (the presenter home, no 404), keeping a held deck', () => {
    const { e, calls } = addressEnv({ pathname: '/present/old/link', hash: '' });
    expect(takeDeckFragment(e)).toBeNull();
    expect(calls).toEqual([{ state: null, url: PRESENTER_PATH }]);
    const held = addressEnv({ pathname: '/present/', hash: '' }, { hrLectureFragment: '1.abc' });
    expect(takeDeckFragment(held.e)).toEqual({ raw: '1.abc', reloaded: true });
    expect(held.history.state).toEqual({ hrLectureFragment: '1.abc' });
  });

  it('ignores a state that is not a deck', () => {
    expect(takeDeckFragment(addressEnv({ pathname: '/present', hash: '' }, { hrLectureFragment: 3 }).e)).toBeNull();
    expect(takeDeckFragment(addressEnv({ pathname: '/present', hash: '' }, 'x').e)).toBeNull();
  });

  it('holdOpenDeck keeps a deck started from the home in this tab, so a reload reopens it', () => {
    const { e, history } = addressEnv({ pathname: '/present', hash: '' }, null);
    holdOpenDeck('1.abc', {}, e);
    expect(history.state).toEqual({ hrLectureFragment: '1.abc' });
    expect(takeDeckFragment(e)).toEqual({ raw: '1.abc', reloaded: true });
  });

  it('holdOpenDeck marks a Start over deck fresh, and a reload keeps the mark until Start holds it again', () => {
    const { e, history } = addressEnv({ pathname: '/present', hash: '' }, null);
    holdOpenDeck('1.abc', { fresh: true }, e);
    expect(history.state).toEqual({ hrLectureFragment: '1.abc', hrLectureFresh: true });
    expect(takeDeckFragment(e)).toEqual({ raw: '1.abc', reloaded: true, fresh: true });
    holdOpenDeck('1.abc', {}, e);
    expect(takeDeckFragment(e)).toEqual({ raw: '1.abc', reloaded: true });
  });

  it('a fresh held deck keeps its mark when the address is cleaned', () => {
    const { e, history } = addressEnv({ pathname: '/present/x', hash: '' }, { hrLectureFragment: '1.abc', hrLectureFresh: true });
    expect(takeDeckFragment(e)).toEqual({ raw: '1.abc', reloaded: true, fresh: true });
    expect(history.state).toEqual({ hrLectureFragment: '1.abc', hrLectureFresh: true });
  });

  it('forgetOpenDeck clears the held deck', () => {
    const { e, history } = addressEnv({ pathname: '/present', hash: '' }, { hrLectureFragment: '1.abc' });
    forgetOpenDeck(e);
    expect(history.state).toBeNull();
    expect(takeDeckFragment(e)).toBeNull();
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
    expect(takeDeckFragment(e)).toEqual({ raw: '1.abc', reloaded: false });
    expect(() => forgetOpenDeck(e)).not.toThrow();
  });

  it('no location (not a browser): nothing', () => {
    expect(takeDeckFragment(env())).toBeNull();
  });
});

describe('reloadOnDeckLink', () => {
  it('reloads when a deck link arrives in the open tab, not for another fragment', () => {
    const win = fakeTarget();
    const reload = vi.fn();
    const location = { pathname: '/present', hash: '#x=1' };
    const stop = reloadOnDeckLink(env({ window: win, location, reload }));
    win.fire('hashchange', {});
    expect(reload).not.toHaveBeenCalled();
    location.hash = '#d=1.abc';
    win.fire('hashchange', {});
    expect(reload).toHaveBeenCalledTimes(1);
    location.hash = '';
    win.fire('hashchange', {});
    expect(reload).toHaveBeenCalledTimes(1);
    stop();
    expect(win.count('hashchange')).toBe(0);
    expect(() => reloadOnDeckLink(env())()).not.toThrow();
  });
});

describe('document title', () => {
  it('sets the fixed title only', () => {
    const doc = { title: 'Deck title with a name' };
    setPresenterDocTitle('Hangul Route lecture', env({ document: doc }));
    expect(doc.title).toBe('Hangul Route lecture');
    expect(() => setPresenterDocTitle('x', env())).not.toThrow();
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
  it('knows whether a console tab opened this one', () => {
    expect(hasOpener(env({ opener: {} }))).toBe(true);
    expect(hasOpener(env({ opener: null }))).toBe(false);
    expect(hasOpener(env())).toBe(false);
  });

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

  it('a handler that returns false leaves the key its browser meaning (the home Help scrolls)', () => {
    const doc = fakeTarget();
    const handler = vi.fn((command: unknown) => command === 'escape');
    subscribeKeys(handler, env({ keyTarget: doc }));
    const pageDown = press(doc, { key: 'PageDown', code: 'PageDown' });
    const escape = press(doc, { key: 'Escape', code: 'Escape' });
    expect(handler.mock.calls).toEqual([['next'], ['escape']]);
    expect(pageDown.preventDefault).not.toHaveBeenCalled();
    expect(escape.preventDefault).toHaveBeenCalled();
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

describe('subscribeActivity', () => {
  it('reports pointer, touch, key and wheel activity until unsubscribed', () => {
    const win = fakeTarget();
    const handler = vi.fn();
    const stop = subscribeActivity(handler, env({ window: win }));
    for (const type of ['pointermove', 'pointerdown', 'touchstart', 'keydown', 'wheel']) win.fire(type, {});
    expect(handler).toHaveBeenCalledTimes(5);
    stop();
    win.fire('pointermove', {});
    expect(handler).toHaveBeenCalledTimes(5);
    expect(() => subscribeActivity(handler, env())()).not.toThrow();
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

describe('trapFocus (the Exit confirm)', () => {
  const button = () => ({ focus: vi.fn() });
  const tab = (shiftKey = false, key = 'Tab') => ({ key, shiftKey, preventDefault: vi.fn() });

  it('cycles Tab and Shift+Tab through the dialog buttons and pulls an outside focus back in', () => {
    const doc = fakeTarget();
    const exit = button();
    const keep = button();
    let focused: unknown = keep;
    const stop = trapFocus(() => [exit, keep], env({ keyTarget: doc, activeElement: () => focused }));
    const forward = tab();
    doc.fire('keydown', forward);
    expect(forward.preventDefault).toHaveBeenCalled();
    expect(exit.focus).toHaveBeenCalledTimes(1);
    focused = exit;
    doc.fire('keydown', tab(true));
    expect(keep.focus).toHaveBeenCalledTimes(1);
    focused = { tagName: 'BUTTON' };
    doc.fire('keydown', tab());
    expect(exit.focus).toHaveBeenCalledTimes(2);
    doc.fire('keydown', tab(true));
    expect(keep.focus).toHaveBeenCalledTimes(2);
    const other = tab(false, 'Enter');
    doc.fire('keydown', other);
    expect(other.preventDefault).not.toHaveBeenCalled();
    stop();
    expect(doc.count('keydown')).toBe(0);
  });

  it('with nothing to focus, or no document, does nothing', () => {
    const doc = fakeTarget();
    trapFocus(() => [null], env({ keyTarget: doc }));
    const key = tab();
    doc.fire('keydown', key);
    expect(key.preventDefault).not.toHaveBeenCalled();
    expect(() => trapFocus(() => [], env())()).not.toThrow();
    expect(() => native.trapFocus(() => [])()).not.toThrow();
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

  it('an Exit before the lock arrives releases the late lock at once (no screen kept awake on the home)', async () => {
    const sentinel = { release: vi.fn(async () => undefined), released: false };
    let grant: (value: typeof sentinel) => void = () => undefined;
    const request = vi.fn(() => new Promise<typeof sentinel>((resolve) => (grant = resolve)));
    const doc = { ...fakeTarget(), visibilityState: 'visible' };
    const e = env({ navigator: { wakeLock: { request } }, document: doc as never });
    const asked = keepScreenAwake(e);
    await releaseScreenAwake(e);
    grant(sentinel);
    await asked;
    expect(sentinel.release).toHaveBeenCalledTimes(1);
    // A later lesson takes and releases its own lock as usual.
    const second = { release: vi.fn(async () => undefined), released: false };
    request.mockImplementationOnce(async () => second);
    await keepScreenAwake(e);
    expect(second.release).not.toHaveBeenCalled();
    await releaseScreenAwake(e);
    expect(second.release).toHaveBeenCalledTimes(1);
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

describe('enterFullscreenLandscape', () => {
  it('asks for fullscreen in the gesture and locks landscape only after that request settles', async () => {
    const order: string[] = [];
    let settle: () => void = () => undefined;
    const request = vi.fn(() => {
      order.push('fullscreen');
      return new Promise<void>((resolve) => {
        settle = () => {
          order.push('fullscreen settled');
          resolve();
        };
      });
    });
    const lock = vi.fn(async () => {
      order.push('lock');
    });
    const e = env({ document: { documentElement: { requestFullscreen: request }, fullscreenEnabled: true }, screen: { orientation: { lock } } });
    const done = enterFullscreenLandscape(e);
    // The fullscreen request is made at once, inside the tap; the lock waits for it.
    expect(order).toEqual(['fullscreen']);
    await Promise.resolve();
    expect(lock).not.toHaveBeenCalled();
    settle();
    expect(await done).toBe(true);
    expect(order).toEqual(['fullscreen', 'fullscreen settled', 'lock']);
    expect(lock).toHaveBeenCalledWith('landscape');
  });

  it('still tries the lock after a refused fullscreen, and tolerates a refused lock', async () => {
    const lock = vi.fn(async () => Promise.reject(new Error('not in fullscreen')));
    const refusing = { documentElement: { requestFullscreen: vi.fn(async () => Promise.reject(new Error('denied'))) }, fullscreenEnabled: true };
    expect(await enterFullscreenLandscape(env({ document: refusing, screen: { orientation: { lock } } }))).toBe(false);
    expect(lock).toHaveBeenCalledWith('landscape');
    expect(await enterFullscreenLandscape(env())).toBe(false);
  });
});

describe('waitForPresenterFont', () => {
  it('resolves true when the face loads in time', async () => {
    const load = vi.fn(async () => [{}]);
    expect(await waitForPresenterFont(1500, 'HR Presenter KR', env({ document: { fonts: { load } } }))).toBe(true);
    expect(load).toHaveBeenCalledWith('700 1em "HR Presenter KR"');
  });

  it('falls back silently: no face, a failure or a timeout resolve false', async () => {
    expect(await waitForPresenterFont(1500, 'HR Presenter KR', env({ document: { fonts: { load: async () => [] } } }))).toBe(false);
    expect(await waitForPresenterFont(1500, 'HR Presenter KR', env({ document: { fonts: { load: () => Promise.reject(new Error('x')) } } }))).toBe(false);
    expect(await waitForPresenterFont(1500, 'HR Presenter KR', env({ document: {} }))).toBe(false);
    vi.useFakeTimers();
    const pending = waitForPresenterFont(1500, 'HR Presenter KR', env({ document: { fonts: { load: () => new Promise(() => undefined) } } }));
    vi.advanceTimersByTime(1500);
    expect(await pending).toBe(false);
  });
});

describe('the timer chime (section 3.5: two soft notes, never speech, never an alarm)', () => {
  function fakeContext(state = 'running') {
    const oscillators: { type: string; frequency: { value: number }; start: ReturnType<typeof vi.fn>; stop: ReturnType<typeof vi.fn>; connect: ReturnType<typeof vi.fn> }[] = [];
    const resume = vi.fn(async () => undefined);
    const ctx = {
      state,
      currentTime: 10,
      destination: {},
      resume,
      createOscillator: () => {
        const o = { type: 'square', frequency: { value: 0 }, start: vi.fn(), stop: vi.fn(), connect: vi.fn((n: unknown) => n) };
        oscillators.push(o);
        return o;
      },
      createGain: () => ({
        gain: { value: 1, setValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
        connect: vi.fn((n: unknown) => n),
      }),
    };
    return { ctx, oscillators, resume };
  }

  it('plays two sine notes on the context the Start tap unlocked', () => {
    const { ctx, oscillators, resume } = fakeContext('suspended');
    const create = vi.fn(() => ctx);
    const e = env({ createAudioContext: create });
    unlockChime(e);
    unlockChime(e);
    expect(create).toHaveBeenCalledTimes(1);
    expect(resume).toHaveBeenCalled();
    expect(playChime(false, e)).toBe(true);
    expect(oscillators).toHaveLength(2);
    expect(oscillators.every((o) => o.type === 'sine')).toBe(true);
    expect(oscillators[0]!.frequency.value).toBeLessThan(oscillators[1]!.frequency.value);
    expect(oscillators[1]!.start.mock.calls[0]![0]).toBeGreaterThan(oscillators[0]!.start.mock.calls[0]![0]);
  });

  it('is silent when muted, without Web Audio, or when the context fails', () => {
    const { ctx, oscillators } = fakeContext();
    const e = env({ createAudioContext: () => ctx });
    unlockChime(e);
    expect(playChime(true, e)).toBe(false);
    expect(oscillators).toHaveLength(0);
    expect(playChime(false, env({ createAudioContext: null }))).toBe(false);
    expect(() =>
      unlockChime(
        env({
          createAudioContext: () => {
            throw new Error('no audio');
          },
        }),
      ),
    ).not.toThrow();
    const broken = { ...fakeContext().ctx, createOscillator: () => { throw new Error('x'); } };
    const b = env({ createAudioContext: () => broken });
    unlockChime(b);
    expect(playChime(false, b)).toBe(false);
  });
});

describe('focusablesIn and rememberFocus (every covering overlay keeps Tab inside and gives focus back)', () => {
  it('lists the tabbable controls inside an overlay, in document order, leaving out disabled and tabindex -1 ones', () => {
    const a = { focus: vi.fn(), getAttribute: () => null };
    const off = { focus: vi.fn(), getAttribute: (n: string) => (n === 'aria-disabled' ? 'true' : null) };
    const skip = { focus: vi.fn(), getAttribute: (n: string) => (n === 'tabindex' ? '-1' : null) };
    const b = { focus: vi.fn(), getAttribute: () => null, disabled: false };
    const gone = { focus: vi.fn(), getAttribute: () => null, disabled: true };
    const root = { querySelectorAll: vi.fn(() => [a, off, skip, b, gone]) };
    expect(focusablesIn(root)).toEqual([a, b]);
    expect(root.querySelectorAll).toHaveBeenCalledWith(expect.stringContaining('button'));
  });

  it('is empty for anything that is not an element', () => {
    expect(focusablesIn(null)).toEqual([]);
    expect(focusablesIn({})).toEqual([]);
  });

  it('gives focus back to the control that had it, only while that control is still on the page', () => {
    const opener = { focus: vi.fn(), isConnected: true };
    rememberFocus(env({ activeElement: () => opener }))();
    expect(opener.focus).toHaveBeenCalledTimes(1);
    const removed = { focus: vi.fn(), isConnected: false };
    rememberFocus(env({ activeElement: () => removed }))();
    expect(removed.focus).not.toHaveBeenCalled();
    expect(() => rememberFocus(env({ activeElement: () => null }))()).not.toThrow();
    expect(() => rememberFocus(env())()).not.toThrow();
  });
});

describe('stale presenter: checkForUpdate and reloadForUpdate (AMENDMENTS-LECTURE-V2 section 4.5)', () => {
  type Worker = { state?: string; postMessage: ReturnType<typeof vi.fn>; addEventListener?: (type: 'statechange', fn: () => void) => void };
  function swEnv(reg: { update: () => Promise<unknown>; waiting?: Worker | null; installing?: Worker | null } | undefined | 'throws') {
    const container = fakeTarget();
    const history = { state: null as unknown, replaceState: vi.fn((next: unknown) => void (history.state = next)) };
    const reload = vi.fn();
    const e = env({
      location: { pathname: '/present', hash: '' },
      history,
      reload,
      serviceWorker: {
        getRegistration: vi.fn(async () => {
          if (reg === 'throws') throw new Error('no sw');
          return reg;
        }),
        addEventListener: container.addEventListener,
      },
    });
    return { e, reload, history, container };
  }
  const worker = (state?: string): Worker => {
    const w: Worker & { fire?: () => void } = { state, postMessage: vi.fn() };
    w.addEventListener = (_type, fn) => {
      w.fire = fn;
    };
    return w;
  };

  it('checkForUpdate asks the registration for an update and never throws', async () => {
    const update = vi.fn(async () => undefined);
    await checkForUpdate(swEnv({ update }).e, 50);
    expect(update).toHaveBeenCalledTimes(1);
    await expect(checkForUpdate(swEnv({ update: async () => Promise.reject(new Error('offline')) }).e, 50)).resolves.toBeUndefined();
    await expect(checkForUpdate(swEnv({ update: () => { throw new Error('sync'); } }).e, 50)).resolves.toBeUndefined();
    await expect(checkForUpdate(swEnv('throws').e, 50)).resolves.toBeUndefined();
    await expect(checkForUpdate(swEnv(undefined).e, 50)).resolves.toBeUndefined();
    await expect(checkForUpdate(env(), 50)).resolves.toBeUndefined();
  });

  it('holds the link in the tab again, so the reload opens it', async () => {
    const { e, reload } = swEnv(undefined);
    await reloadForUpdate('2.abc', e, 50);
    expect(takeDeckFragment(e)).toEqual({ raw: '2.abc', reloaded: true });
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('no service worker, no registration, or nothing newer: reloads at once', async () => {
    for (const reg of [undefined, 'throws' as const, { update: async () => undefined }, { update: async () => Promise.reject(new Error('offline')) }]) {
      const { e, reload } = swEnv(reg);
      await reloadForUpdate('2.abc', e, 50);
      expect(reload).toHaveBeenCalledTimes(1);
    }
    const bare = vi.fn();
    await reloadForUpdate('2.abc', env({ reload: bare }), 50);
    expect(bare).toHaveBeenCalledTimes(1);
  });

  it('a waiting presenter takes over (SKIP_WAITING) and the page reloads once on controllerchange', async () => {
    const waiting = worker('installed');
    const { e, reload, container } = swEnv({ update: async () => undefined, waiting });
    await reloadForUpdate('2.abc', e, 50);
    expect(waiting.postMessage).toHaveBeenCalledWith({ type: 'SKIP_WAITING' });
    expect(reload).not.toHaveBeenCalled();
    container.fire('controllerchange', {});
    expect(reload).toHaveBeenCalledTimes(1);
    await new Promise((r) => setTimeout(r, 80));
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('an installing presenter is awaited until installed; a takeover that never comes still reloads after the wait', async () => {
    const installing = worker('installing') as Worker & { fire?: () => void };
    const reg = { update: async () => undefined, installing };
    const { e, reload } = swEnv(reg);
    const done = reloadForUpdate('2.abc', e, 50);
    await new Promise((r) => setTimeout(r, 5));
    installing.state = 'activating';
    installing.fire?.();
    installing.state = 'installed';
    installing.fire?.();
    await done;
    expect(installing.postMessage).toHaveBeenCalledWith({ type: 'SKIP_WAITING' });
    expect(reload).not.toHaveBeenCalled();
    await new Promise((r) => setTimeout(r, 80));
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('an install that does not finish in time, or a worker that refuses the message, reloads', async () => {
    const stuck = swEnv({ update: async () => undefined, installing: worker('installing') });
    await reloadForUpdate('2.abc', stuck.e, 20);
    expect(stuck.reload).toHaveBeenCalledTimes(1);
    const refusing = worker('installed');
    refusing.postMessage.mockImplementation(() => {
      throw new Error('gone');
    });
    const refused = swEnv({ update: async () => undefined, waiting: refusing });
    await reloadForUpdate('2.abc', refused.e, 50);
    expect(refused.reload).toHaveBeenCalledTimes(1);
  });
});

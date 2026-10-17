import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as native from '../presenter';
import {
  LEAVE_WAIT_MS,
  PRESENTER_PATH,
  RETURN_WAIT_MS,
  checkForUpdate,
  clearPresenterForward,
  currentPresenterEntry,
  leavePresenter,
  presenterHomeBack,
  pushPresenterEntry,
  returnToPresenterHome,
  stepBackPresenter,
  subscribePresenterPop,
  enterFullscreen,
  enterFullscreenLandscape,
  exitFullscreen,
  forgetOpenDeck,
  holdOpenDeck,
  fullscreenSupported,
  isFullscreen,
  isPresenterRoute,
  keepScreenAwake,
  lockLandscape,
  playChime,
  releaseScreenAwake,
  otherTabsOpen,
  reloadForUpdate,
  UPDATE_WAIT_MS,
  reloadOnDeckLink,
  setPresenterDocTitle,
  subscribeActivity,
  subscribeFullscreen,
  subscribeInputKind,
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
  type TabsChannelLike,
} from '../presenter.web';

/**
 * The presenter's web platform layer (F-TCH-004 sections 3.1, 3.2, 3.5, 3.8; spec section 5
 * `presenter.web.test.ts`): route, fragment read and strip with the fixed `document.title`, keys,
 * and the Start-tap device features, each feature
 * detected and failure tolerant. Every browser global is injected.
 */

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
    expect(native.fullscreenSupported()).toBe(false);
    expect(native.wakeLockSupported()).toBe(false);
    native.forgetOpenDeck();
    native.holdOpenDeck('1.abc');
    expect(native.currentPresenterEntry()).toBeNull();
    expect(native.presenterHomeBack()).toBe(false);
    await native.pushPresenterEntry('ready', '1.abc');
    await native.returnToPresenterHome();
    await native.clearPresenterForward();
    await native.stepBackPresenter();
    native.subscribePresenterPop(() => undefined)();
    native.leavePresenter();
    native.reloadOnDeckLink()();
    await native.checkForUpdate();
    await native.reloadForUpdate('2.abc');
    expect(native.isFullscreen()).toBe(false);
    expect(await native.waitForPresenterFont(1, 'HR Presenter KR')).toBe(false);
    expect(native.playChime(false)).toBe(false);
    expect(() => native.unlockChime()).not.toThrow();
    native.setPresenterDocTitle('x');
    native.subscribeKeys(() => undefined)();
    native.subscribeActivity(() => undefined)();
    native.subscribeInputKind(() => undefined)();
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

describe('takeDeckFragment (section 3.5 "History", rules 1, 5 and 6)', () => {
  function addressEnv(href: { pathname: string; hash: string; search?: string }, state: unknown = null, extra: Partial<PresenterEnv> = {}) {
    const calls: { kind: 'replace' | 'push'; state: unknown; url: string }[] = [];
    const history = {
      state,
      length: 1,
      replaceState(next: unknown, _unused: string, url: string) {
        this.state = next;
        calls.push({ kind: 'replace', state: next, url });
      },
      pushState(next: unknown, _unused: string, url: string) {
        this.state = next;
        this.length += 1;
        calls.push({ kind: 'push', state: next, url });
      },
    };
    return { e: env({ location: { origin: 'https://app.example', ...href }, history, ...extra }), calls, history };
  }
  const home = { hrPresenter: 'home', hrIndex: 0, hrHomeBack: false };

  it('a link: the address is cleaned, the entry becomes the home and a start-screen entry holding the deck is pushed over it', () => {
    const { e, calls } = addressEnv({ pathname: '/present', hash: '#d=1.eyJ2IjoxfQ' });
    expect(takeDeckFragment(e)).toEqual({ raw: '1.eyJ2IjoxfQ', reloaded: false });
    expect(calls).toEqual([
      { kind: 'replace', state: home, url: PRESENTER_PATH },
      { kind: 'push', state: { hrPresenter: 'ready', hrIndex: 1, hrLectureFragment: '1.eyJ2IjoxfQ', hrHomeBack: false }, url: PRESENTER_PATH },
    ]);
  });

  it('a link the presenter cannot open pushes nothing (the invalid page sits on the home entry)', () => {
    const { e, calls } = addressEnv({ pathname: '/present', hash: '#d=9.bad' });
    expect(takeDeckFragment(e, () => false)).toEqual({ raw: '9.bad', reloaded: false });
    expect(calls).toEqual([{ kind: 'replace', state: home, url: PRESENTER_PATH }]);
  });

  it('a reload on the start screen returns the deck as reloaded and leaves the history alone', () => {
    const state = { hrPresenter: 'ready', hrIndex: 1, hrLectureFragment: '1.abc', hrHomeBack: true };
    const { e, calls, history } = addressEnv({ pathname: '/present', hash: '' }, state);
    expect(takeDeckFragment(e)).toEqual({ raw: '1.abc', reloaded: true });
    expect(calls).toHaveLength(1);
    expect(history.state).toEqual(state);
  });

  it('a Start over deck keeps its fresh mark through a reload and a cleaned address', () => {
    const { e, history } = addressEnv({ pathname: '/present/x', hash: '' }, { hrPresenter: 'ready', hrIndex: 1, hrLectureFragment: '1.abc', hrLectureFresh: true });
    expect(takeDeckFragment(e)).toEqual({ raw: '1.abc', reloaded: true, fresh: true });
    expect(history.state).toMatchObject({ hrLectureFresh: true });
  });

  it('a reload in a lesson steps back to its start-screen entry (the step is the presenter\'s own, never reported)', async () => {
    const { history, win } = fakeHistory({ hrPresenter: 'home', hrIndex: 0 });
    history.pushState({ hrPresenter: 'ready', hrIndex: 1, hrLectureFragment: '1.abc' });
    history.pushState({ hrPresenter: 'running', hrIndex: 2, hrLectureFragment: '1.abc' });
    const e = env({ location: { pathname: '/present/', hash: '' }, history, window: win });
    const onPop = vi.fn();
    subscribePresenterPop(onPop, e);
    expect(takeDeckFragment(e)).toEqual({ raw: '1.abc', reloaded: true });
    await vi.waitFor(() => expect(history.index).toBe(1));
    expect(history.entries).toHaveLength(3);
    expect(onPop).not.toHaveBeenCalled();
  });

  it('an entry from a build before this plan (only the fragment) opens as a link', () => {
    const { e, calls } = addressEnv({ pathname: '/present', hash: '' }, { hrLectureFragment: '1.old' });
    expect(takeDeckFragment(e)).toEqual({ raw: '1.old', reloaded: true });
    expect(calls.map((c) => c.kind)).toEqual(['replace', 'push']);
  });

  it('the home Back is decided at boot: a same-origin referrer and a page before it', () => {
    const same = addressEnv({ pathname: '/present', hash: '' }, null, { document: { referrer: 'https://app.example/browse' } });
    same.history.length = 3;
    takeDeckFragment(same.e);
    expect(presenterHomeBack(same.e)).toBe(true);
    const other = addressEnv({ pathname: '/present', hash: '' }, null, { document: { referrer: 'https://classroom.example/' } });
    other.history.length = 3;
    takeDeckFragment(other.e);
    expect(presenterHomeBack(other.e)).toBe(false);
    const fresh = addressEnv({ pathname: '/present', hash: '' }, null, { document: { referrer: 'https://app.example/browse' } });
    takeDeckFragment(fresh.e);
    expect(presenterHomeBack(fresh.e)).toBe(false);
    const broken = addressEnv({ pathname: '/present', hash: '' }, null, { document: { referrer: 'not a url' } });
    broken.history.length = 2;
    takeDeckFragment(broken.e);
    expect(presenterHomeBack(broken.e)).toBe(false);
    // A reload keeps what the entry holds.
    const kept = addressEnv({ pathname: '/present', hash: '' }, { hrPresenter: 'home', hrIndex: 0, hrHomeBack: true });
    takeDeckFragment(kept.e);
    expect(presenterHomeBack(kept.e)).toBe(true);
  });

  it('an empty d= is an empty fragment (the codec rejects it as empty)', () => {
    expect(takeDeckFragment(addressEnv({ pathname: '/present', hash: '#d=' }).e)).toEqual({ raw: '', reloaded: false });
    expect(takeDeckFragment(addressEnv({ pathname: '/present', hash: '#d' }).e)).toEqual({ raw: '', reloaded: false });
  });

  it('a fragment without d= is not a deck, and the fragment still leaves the address', () => {
    const { e, calls } = addressEnv({ pathname: '/present', hash: '#x=1' });
    expect(takeDeckFragment(e)).toBeNull();
    expect(calls).toEqual([{ kind: 'replace', state: home, url: PRESENTER_PATH }]);
  });

  it('keeps a ?lang= hand-off for the locale store to take, and drops every other query', () => {
    const { e, calls } = addressEnv({ pathname: '/present', search: '?x=1&lang=es', hash: '#d=1.abc' });
    expect(takeDeckFragment(e)).toEqual({ raw: '1.abc', reloaded: false });
    expect(calls.map((c) => c.url)).toEqual([`${PRESENTER_PATH}?lang=es`, `${PRESENTER_PATH}?lang=es`]);
    const plain = addressEnv({ pathname: '/present/x', search: '?x=1', hash: '' });
    takeDeckFragment(plain.e);
    expect(plain.calls[0]!.url).toBe(PRESENTER_PATH);
  });

  it('a d= among other keys is found', () => {
    expect(takeDeckFragment(addressEnv({ pathname: '/present', hash: '#a=1&d=1.abc&b=2' }).e)).toEqual({ raw: '1.abc', reloaded: false });
  });

  it('an unknown path under /present is cleaned to /present (the presenter home, no 404)', () => {
    const { e, calls } = addressEnv({ pathname: '/present/old/link', hash: '' });
    expect(takeDeckFragment(e)).toBeNull();
    expect(calls).toEqual([{ kind: 'replace', state: home, url: PRESENTER_PATH }]);
  });

  it('a running entry with a dirty address is cleaned in place before the step back', () => {
    const { e, calls } = addressEnv({ pathname: '/present/x', hash: '' }, { hrPresenter: 'running', hrIndex: 2, hrLectureFragment: '1.abc' });
    expect(takeDeckFragment(e)).toEqual({ raw: '1.abc', reloaded: true });
    expect(calls).toEqual([{ kind: 'replace', state: { hrPresenter: 'running', hrIndex: 2, hrLectureFragment: '1.abc' }, url: PRESENTER_PATH }]);
  });

  it('ignores a state that is not the presenter\'s', () => {
    expect(takeDeckFragment(addressEnv({ pathname: '/present', hash: '' }, { hrLectureFragment: 3 }).e)).toBeNull();
    expect(takeDeckFragment(addressEnv({ pathname: '/present', hash: '' }, 'x').e)).toBeNull();
  });

  it('holdOpenDeck writes a start screen at the entry\'s place; forgetOpenDeck makes it the home again', () => {
    const { e, history } = addressEnv({ pathname: '/present', hash: '' }, { hrPresenter: 'home', hrIndex: 0, hrHomeBack: true });
    holdOpenDeck('1.abc', { fresh: true }, e);
    expect(history.state).toEqual({ hrPresenter: 'ready', hrIndex: 0, hrLectureFragment: '1.abc', hrLectureFresh: true, hrHomeBack: true });
    forgetOpenDeck(e);
    expect(history.state).toEqual({ hrPresenter: 'home', hrIndex: 0, hrHomeBack: true });
    const bare = addressEnv({ pathname: '/present', hash: '' });
    holdOpenDeck('1.abc', {}, bare.e);
    expect(bare.history.state).toEqual({ hrPresenter: 'ready', hrIndex: 0, hrLectureFragment: '1.abc' });
    forgetOpenDeck(bare.e);
    expect(bare.history.state).toEqual({ hrPresenter: 'home', hrIndex: 0 });
  });

  it('a history that refuses (a sandboxed frame) still returns the deck', () => {
    const refusing = () => {
      throw new Error('SecurityError');
    };
    const e = env({ location: { pathname: '/present', hash: '#d=1.abc' }, history: { replaceState: refusing, pushState: refusing } });
    expect(takeDeckFragment(e)).toEqual({ raw: '1.abc', reloaded: false });
    expect(() => forgetOpenDeck(e)).not.toThrow();
    // Without pushState the start screen's entry is written over the one there is.
    const flat = { state: null as unknown, replaceState: vi.fn((next: unknown) => void (flat.state = next)) };
    expect(takeDeckFragment(env({ location: { pathname: '/present', hash: '#d=1.abc' }, history: flat }))).toEqual({ raw: '1.abc', reloaded: false });
    expect(flat.state).toEqual({ hrPresenter: 'ready', hrIndex: 1, hrLectureFragment: '1.abc', hrHomeBack: false });
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

/** A tab's session history: entries, the current index, pushState, replaceState and go (which fires popstate). */
function fakeHistory(first: unknown = null, win = fakeTarget()) {
  const entries: unknown[] = [first];
  const h = {
    index: 0,
    entries,
    get state(): unknown {
      return entries[h.index];
    },
    get length(): number {
      return entries.length;
    },
    replaceState: vi.fn((next: unknown) => {
      entries[h.index] = next;
    }),
    pushState: vi.fn((next: unknown) => {
      entries.splice(h.index + 1);
      entries.push(next);
      h.index = entries.length - 1;
    }),
    go: vi.fn((delta: number) => {
      const to = Math.max(0, Math.min(entries.length - 1, h.index + delta));
      if (to === h.index) return;
      h.index = to;
      win.fire('popstate', {});
    }),
  };
  return { history: h, win };
}

describe('the way back: one history entry per phase (section 3.5 "History", owner report 2026-10-16 item 3)', () => {
  const location = { pathname: '/present', hash: '', origin: 'https://app.example' };
  const deckEntry = (step: 'ready' | 'running', index: number) => ({ hrPresenter: step, hrIndex: index, hrLectureFragment: '1.abc' });

  /** A tab at the presenter home with a fresh boot. */
  function boot(first: unknown = { hrPresenter: 'home', hrIndex: 0 }) {
    const { history, win } = fakeHistory(first);
    const e = env({ location, history, window: win });
    const onPop = vi.fn();
    subscribePresenterPop(onPop, e);
    return { history, win, e, onPop };
  }

  it('the home pushes the start screen, Start pushes the lesson; a second push of the same step writes over it', async () => {
    const { history, e } = boot();
    await pushPresenterEntry('ready', '1.abc', { fresh: true }, e);
    expect(history.entries).toEqual([{ hrPresenter: 'home', hrIndex: 0 }, { hrPresenter: 'ready', hrIndex: 1, hrLectureFragment: '1.abc', hrLectureFresh: true }]);
    await pushPresenterEntry('running', '1.abc', {}, e);
    expect(history.entries[2]).toEqual(deckEntry('running', 2));
    await pushPresenterEntry('running', '1.abc', {}, e);
    expect(history.entries).toHaveLength(3);
    expect(currentPresenterEntry(e)).toEqual({ step: 'running', index: 2, fragment: '1.abc' });
    // A deck too long for a link still gets its entry (a reload then opens the home).
    await pushPresenterEntry('running', null, {}, e);
    expect(history.state).toEqual({ hrPresenter: 'running', hrIndex: 2 });
  });

  it("the browser's Back is reported with the entry it landed on", async () => {
    const { history, e, onPop } = boot();
    await pushPresenterEntry('ready', '1.abc', {}, e);
    await pushPresenterEntry('running', '1.abc', {}, e);
    history.go(-1);
    expect(onPop).toHaveBeenLastCalledWith({ step: 'ready', index: 1, fragment: '1.abc' });
    history.go(-1);
    expect(onPop).toHaveBeenLastCalledWith({ step: 'home', index: 0 });
  });

  it('Exit (or Back to lessons) goes back to the home (history.go(-hrIndex)) and clears the entries ahead, so a Forward finds no deck', async () => {
    const { history, e, onPop } = boot();
    await pushPresenterEntry('ready', '1.abc', {}, e);
    await pushPresenterEntry('running', '1.abc', {}, e);
    await returnToPresenterHome(e);
    expect(history.go).toHaveBeenCalledWith(-2);
    expect(history.index).toBe(0);
    expect(history.entries).toEqual([{ hrPresenter: 'home', hrIndex: 0 }, { hrPresenter: 'home', hrIndex: 1 }]);
    expect(onPop).not.toHaveBeenCalled();
    // The browser's Forward lands on the placeholder: reported, and it holds no deck.
    history.go(1);
    expect(onPop).toHaveBeenLastCalledWith({ step: 'home', index: 1 });
    await stepBackPresenter(e);
    expect(history.index).toBe(0);
    expect(onPop).toHaveBeenCalledTimes(1);
  });

  it('a back onto the home from the start screen clears the entries ahead (rule 7)', async () => {
    const { history, e, onPop } = boot({ hrPresenter: 'home', hrIndex: 0, hrHomeBack: true });
    await pushPresenterEntry('ready', '1.abc', {}, e);
    history.go(-1);
    expect(onPop).toHaveBeenCalledTimes(1);
    await clearPresenterForward(e);
    expect(history.entries).toEqual([{ hrPresenter: 'home', hrIndex: 0, hrHomeBack: true }, { hrPresenter: 'home', hrIndex: 1, hrHomeBack: true }]);
    expect(history.index).toBe(0);
  });

  it('Exit after a reload in the lesson lands on the home', async () => {
    const { history, e } = boot();
    history.pushState(deckEntry('ready', 1));
    history.pushState(deckEntry('running', 2));
    expect(takeDeckFragment(e)).toEqual({ raw: '1.abc', reloaded: true });
    await pushPresenterEntry('running', '1.abc', {}, e);
    expect(history.index).toBe(2);
    await returnToPresenterHome(e);
    expect(history.index).toBe(0);
  });

  it('the presenter\'s own steps run one after another: a push made during a return lands after it', async () => {
    const { history, e } = boot();
    await pushPresenterEntry('ready', '1.abc', {}, e);
    void returnToPresenterHome(e);
    await pushPresenterEntry('ready', '1.def', {}, e);
    expect(history.entries.slice(0, history.index + 1)).toEqual([{ hrPresenter: 'home', hrIndex: 0 }, { hrPresenter: 'ready', hrIndex: 1, hrLectureFragment: '1.def' }]);
  });

  it('a return whose popstate never comes stops being expected, so a later Back is reported', async () => {
    vi.useFakeTimers();
    const win = fakeTarget();
    const history = { state: deckEntry('ready', 1) as unknown, replaceState: vi.fn(), go: vi.fn() };
    const e = env({ location, history, window: win });
    const onPop = vi.fn();
    subscribePresenterPop(onPop, e);
    const done = returnToPresenterHome(e);
    await vi.advanceTimersByTimeAsync(RETURN_WAIT_MS);
    await done;
    win.fire('popstate', {});
    expect(onPop).toHaveBeenCalledTimes(1);
  });

  it('a go that throws, no go, no pushState or no window: the steps still finish', async () => {
    const throwing = { ...fakeHistory(deckEntry('ready', 1)).history, go: vi.fn(() => {
      throw new Error('no');
    }) };
    await expect(returnToPresenterHome(env({ location, history: throwing, window: fakeTarget() }))).resolves.toBeUndefined();
    expect(throwing.replaceState).toHaveBeenCalledWith({ hrPresenter: 'home', hrIndex: 0 }, '', PRESENTER_PATH);
    const flat = { state: deckEntry('ready', 1) as unknown, replaceState: vi.fn() };
    await expect(returnToPresenterHome(env({ location, history: flat }))).resolves.toBeUndefined();
    const noWindow = fakeHistory(deckEntry('running', 2));
    await stepBackPresenter(env({ location, history: noWindow.history }));
    expect(noWindow.history.go).toHaveBeenCalledWith(-1);
    const noWindowThrows = { state: null as unknown, replaceState: vi.fn(), go: vi.fn(() => {
      throw new Error('no');
    }) };
    await expect(stepBackPresenter(env({ location, history: noWindowThrows }))).resolves.toBeUndefined();
    const refusingPush = { ...fakeHistory({ hrPresenter: 'home', hrIndex: 0 }).history, pushState: vi.fn(() => {
      throw new Error('denied');
    }) };
    await expect(clearPresenterForward(env({ location, history: refusingPush, window: fakeTarget() }))).resolves.toBeUndefined();
  });

  it('without a window nothing is listened to', () => {
    expect(() => subscribePresenterPop(vi.fn(), env())()).not.toThrow();
  });
});

describe("leavePresenter: the home's Back (rule 5)", () => {
  const location = { pathname: '/present', hash: '', origin: 'https://app.example' };

  it('a tab that came from a page of this origin goes back to it, past its own entries', () => {
    const { history, win } = fakeHistory({ hrPresenter: 'home', hrIndex: 0, hrHomeBack: true });
    const assign = vi.fn();
    leavePresenter(env({ location, history, window: win, assign }));
    expect(history.go).toHaveBeenCalledWith(-1);
    const placeholder = fakeHistory({ hrPresenter: 'home', hrIndex: 1, hrHomeBack: true });
    leavePresenter(env({ location, history: placeholder.history, window: placeholder.win, assign }));
    expect(placeholder.history.go).toHaveBeenCalledWith(-2);
    expect(assign).not.toHaveBeenCalled();
  });

  it('leaves for / when going back does not start leaving the page in 1 s', () => {
    vi.useFakeTimers();
    const win = fakeTarget();
    const assign = vi.fn();
    const history = { state: { hrPresenter: 'home', hrIndex: 0, hrHomeBack: true } as unknown, replaceState: vi.fn(), go: vi.fn() };
    leavePresenter(env({ location, history, window: win, assign }));
    vi.advanceTimersByTime(LEAVE_WAIT_MS);
    expect(assign).toHaveBeenCalledWith('/');
    expect(win.count('pagehide')).toBe(0);
  });

  it('once the page starts to leave, the fallback stays away', () => {
    vi.useFakeTimers();
    const win = fakeTarget();
    const assign = vi.fn();
    const history = { state: { hrPresenter: 'home', hrIndex: 0, hrHomeBack: true } as unknown, replaceState: vi.fn(), go: vi.fn(() => win.fire('pagehide', {})) };
    leavePresenter(env({ location, history, window: win, assign }));
    vi.advanceTimersByTime(LEAVE_WAIT_MS);
    expect(assign).not.toHaveBeenCalled();
  });

  it('every new tab (the console, All lessons, E5) and a link from elsewhere is a link to /', () => {
    const assign = vi.fn();
    leavePresenter(env({ location, history: { state: { hrPresenter: 'home', hrIndex: 0, hrHomeBack: false }, replaceState: vi.fn(), go: vi.fn() }, assign }));
    leavePresenter(env({ location, history: { state: null, replaceState: vi.fn() }, assign }));
    leavePresenter(env({ location, history: { state: { hrPresenter: 'home', hrIndex: 0, hrHomeBack: true }, replaceState: vi.fn() }, assign }));
    expect(assign.mock.calls).toEqual([['/'], ['/'], ['/']]);
  });

  it('a go that throws still leaves', () => {
    vi.useFakeTimers();
    const assign = vi.fn();
    const win = fakeTarget();
    leavePresenter(env({ location, window: win, assign, history: { state: { hrPresenter: 'home', hrIndex: 0, hrHomeBack: true }, replaceState: vi.fn(), go: () => {
      throw new Error('no');
    } } }));
    vi.advanceTimersByTime(LEAVE_WAIT_MS);
    expect(assign).toHaveBeenCalledWith('/');
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

describe('subscribeInputKind', () => {
  it('reports a pointer or touch press as the pointer and a key as the key, until unsubscribed', () => {
    const win = fakeTarget();
    const kinds: string[] = [];
    const stop = subscribeInputKind((kind) => kinds.push(kind), env({ window: win }));
    win.fire('pointerdown', {});
    win.fire('touchstart', {});
    win.fire('keydown', {});
    expect(kinds).toEqual(['pointer', 'pointer', 'key']);
    stop();
    win.fire('keydown', {});
    expect(kinds).toHaveLength(3);
    expect(win.count('pointerdown') + win.count('touchstart') + win.count('keydown')).toBe(0);
    expect(() => subscribeInputKind(() => undefined, env())()).not.toThrow();
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
  function swEnv(reg: { update: () => Promise<unknown>; waiting?: Worker | null; installing?: Worker | null } | undefined | 'throws', tabs?: TabsChannelLike) {
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
      ...(tabs ? { tabs } : {}),
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

  // Fake timers throughout: every wait below is the code's own, advanced by hand, never wall clock.
  beforeEach(() => {
    vi.useFakeTimers();
  });
  /** Runs `reloadForUpdate` and lets `ms` of fake time pass; `settled` says whether it resolved. */
  async function run(e: ReturnType<typeof swEnv>['e'], wait: number, advance: number = wait) {
    let settled = false;
    const done = reloadForUpdate('2.abc', e, wait).then(() => {
      settled = true;
    });
    await vi.advanceTimersByTimeAsync(advance);
    return { done, settled: () => settled };
  }

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
    const r = await run(e, 1000, 0);
    expect(waiting.postMessage).toHaveBeenCalledWith({ type: 'SKIP_WAITING' });
    expect(reload).not.toHaveBeenCalled();
    expect(r.settled()).toBe(false);
    container.fire('controllerchange', {});
    await r.done;
    expect(reload).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(2000);
    container.fire('controllerchange', {});
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('an installing presenter is awaited until installed; a takeover that never comes still reloads at the deadline', async () => {
    const installing = worker('installing') as Worker & { fire?: () => void };
    const { e, reload } = swEnv({ update: async () => undefined, installing });
    const r = await run(e, 1000, 100);
    installing.state = 'activating';
    installing.fire?.();
    installing.state = 'installed';
    installing.fire?.();
    await vi.advanceTimersByTimeAsync(0);
    expect(installing.postMessage).toHaveBeenCalledWith({ type: 'SKIP_WAITING' });
    expect(reload).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(899);
    expect(reload).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    await r.done;
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('one deadline covers every stage: slow registration, update and install still reload once at `ms`', async () => {
    const slow = (after: number) => new Promise<void>((r) => setTimeout(r, after));
    const installing = worker('installing');
    const reg = { update: () => slow(400), installing };
    const container = fakeTarget();
    const reload = vi.fn();
    const e = env({
      location: { pathname: '/present', hash: '' },
      history: { state: null, replaceState: vi.fn() },
      reload,
      serviceWorker: { getRegistration: () => slow(400).then(() => reg), addEventListener: container.addEventListener },
      tabs: { postMessage: () => undefined, addEventListener: () => undefined, removeEventListener: () => undefined },
    });
    const r = await run(e, 1000, 999);
    expect(reload).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    await r.done;
    expect(reload).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(5000);
    expect(reload).toHaveBeenCalledTimes(1);
    expect(installing.postMessage).not.toHaveBeenCalled();
  });

  /** A `hr-tabs` channel; `answers` other tabs reply to the ping (this tab's own channel never hears itself). */
  function tabsChannel(answers: number): TabsChannelLike & { posted: unknown[] } {
    const listeners = new Set<(event: { data?: unknown }) => void>();
    const posted: unknown[] = [];
    return {
      posted,
      addEventListener: (_type, fn) => void listeners.add(fn),
      removeEventListener: (_type, fn) => void listeners.delete(fn),
      postMessage: (message) => {
        posted.push(message);
        for (let i = 0; i < answers; i += 1) setTimeout(() => listeners.forEach((fn) => fn({ data: { type: 'hr-tab-here' } })), 5);
      },
    };
  }

  it('otherTabsOpen: true only when another tab answers the ping; no channel or a broken one is false', async () => {
    const one = tabsChannel(1);
    const open = otherTabsOpen(env({ tabs: one }), 50);
    await vi.advanceTimersByTimeAsync(5);
    expect(await open).toBe(true);
    expect(one.posted).toEqual([{ type: 'hr-tab-ping' }]);
    const silent = otherTabsOpen(env({ tabs: tabsChannel(0) }), 30);
    await vi.advanceTimersByTimeAsync(30);
    expect(await silent).toBe(false);
    expect(await otherTabsOpen(env(), 30)).toBe(false);
    const broken: TabsChannelLike = {
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      postMessage: () => {
        throw new Error('closed');
      },
    };
    expect(await otherTabsOpen(env({ tabs: broken }), 30)).toBe(false);
  });

  it('with another tab of the app open, a waiting presenter never takes over: the page only reloads', async () => {
    const waiting = worker('installed');
    const { e, reload } = swEnv({ update: async () => undefined, waiting }, tabsChannel(1));
    const r = await run(e, 1000, 5);
    await r.done;
    expect(waiting.postMessage).not.toHaveBeenCalled();
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('alone (no tab answers the ping within 300 ms), the waiting presenter takes over as before', async () => {
    const waiting = worker('installed');
    const { e, reload, container } = swEnv({ update: async () => undefined, waiting }, tabsChannel(0));
    await run(e, UPDATE_WAIT_MS, 299);
    expect(waiting.postMessage).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(waiting.postMessage).toHaveBeenCalledWith({ type: 'SKIP_WAITING' });
    container.fire('controllerchange', {});
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('an install that does not finish in time, or a worker that refuses the message, reloads', async () => {
    const stuck = swEnv({ update: async () => undefined, installing: worker('installing') });
    const r = await run(stuck.e, 20);
    await r.done;
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

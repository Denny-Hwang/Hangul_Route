import { CONSOLE_SESSION_KEY, UNLOCK_SESSION_KEY, type GrownUpUnlock } from '@hangul-route/content-schema';
import { getMessages, type UiLocale } from '@hangul-route/i18n';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { DeviceGateRead, LockDecision } from '@/lib/console/grown-up-lock';

const idb = vi.hoisted(() => ({ values: new Map<string, unknown>() }));
const ui = vi.hoisted(() => ({ locale: 'en' }));
vi.mock('@/lib/i18n/locale-context', async () => {
  const i18n = await import('@hangul-route/i18n');
  const view = () => ({ locale: ui.locale as UiLocale, messages: i18n.getMessages(ui.locale as UiLocale), available: ['en'], setLocale: () => undefined });
  return { useConsoleLocale: view, useMessages: () => view().messages, useLocale: () => ui.locale };
});
vi.mock('idb-keyval', () => ({
  get: async (key: string) => idb.values.get(key),
  set: async () => undefined,
  del: async () => undefined,
  createStore: () => () => undefined,
}));

import {
  GrownUpLock,
  GrownUpLockGate,
  GrownUpLockScreen,
  browserLockEnvironment,
  createGrownUpLockController,
  lockView,
  type GrownUpLockEnvironment,
  type LockState,
} from '../GrownUpLock';
import { expectAllPseudo } from './pseudo-text';

/**
 * F-APP-001 A-4a, section 3.9 (wireframe shell/grown-up-lock.md). The repo's web tests run in
 * node without a DOM, so the component is split: `createGrownUpLockController` owns the reads,
 * the decision and the back/forward-cache and tab re-checks (driven here with real
 * EventTargets), `lockView` picks what to render, and `GrownUpLockGate` / `GrownUpLockScreen`
 * render it (server-rendered here). `GrownUpLock` binds them with two effects.
 */
const lock = getMessages('en').console.lock;
const NOW = 1_800_000_000_000;
const EPOCH = 1_790_000_000_000;

const text = (html: string): string => html.replace(/<[^>]+>/g, ' ').replace(/&#x27;/g, "'").replace(/\s+/g, ' ').trim();

class FakeDocument extends EventTarget {
  visibilityState: DocumentVisibilityState = 'visible';
}

function pageEvent(type: 'pageshow' | 'pagehide', persisted: boolean): Event {
  return Object.assign(new Event(type), { persisted });
}

interface Harness {
  env: GrownUpLockEnvironment;
  win: EventTarget;
  doc: FakeDocument;
  device: { value: DeviceGateRead };
  unlock: { value: GrownUpUnlock | null };
  trusted: { value: number | null };
  calls: string[];
  assigned: string[];
}

function harness(): Harness {
  const win = new EventTarget();
  const doc = new FakeDocument();
  const device = { value: { readable: true, marker: { v: 1, gate: 'pin', pinEpoch: EPOCH }, hasProfiles: true } as DeviceGateRead };
  const unlock = { value: null as GrownUpUnlock | null };
  const trusted = { value: EPOCH as number | null };
  const calls: string[] = [];
  const assigned: string[] = [];
  const env: GrownUpLockEnvironment = {
    now: () => NOW,
    readDevice: async () => {
      calls.push('readDevice');
      return device.value;
    },
    readTrustedEpoch: async () => {
      calls.push('readTrustedEpoch');
      return trusted.value;
    },
    readUnlock: () => {
      calls.push('readUnlock');
      return unlock.value;
    },
    touchUnlock: () => {
      calls.push('touchUnlock');
    },
    clearConsoleSession: () => {
      calls.push('clearConsoleSession');
    },
    clearGrownUpTab: () => {
      calls.push('clearGrownUpTab');
    },
    origin: () => 'https://app.hangulroute.com',
    assign: (url) => {
      assigned.push(url);
    },
    window: win,
    document: doc,
  };
  return { env, win, doc, device, unlock, trusted, calls, assigned };
}

const flush = async (): Promise<void> => {
  for (let i = 0; i < 5; i += 1) await Promise.resolve();
};

function recorder(): { states: LockState[]; hides: number[]; latest: () => LockState | undefined } {
  const states: LockState[] = [];
  const hides: number[] = [];
  return { states, hides, latest: () => states[states.length - 1] };
}

describe('createGrownUpLockController: the decision', () => {
  it('reads the marker, the trusted epoch and the unlock, then decides; a locked decision removes the console session', async () => {
    const h = harness();
    const r = recorder();
    const c = createGrownUpLockController({ env: h.env, getPath: () => '/parent', onState: (s) => r.states.push(s), onHide: () => r.hides.push(1) });
    c.start();
    c.check();
    await flush();
    expect(r.latest()).toEqual({ path: '/parent', decision: { state: 'locked', pinPath: true, line: 'default' }, hidden: false });
    expect(h.calls).toEqual(expect.arrayContaining(['readDevice', 'readTrustedEpoch', 'readUnlock', 'clearConsoleSession']));
    expect(h.calls).not.toContain('touchUnlock');
    c.stop();
  });

  it('an open decision refreshes seen (a navigation) and keeps the console session', async () => {
    const h = harness();
    h.unlock.value = { v: 1, at: NOW - 1000, seen: NOW - 1000, src: 'signin' };
    const r = recorder();
    const c = createGrownUpLockController({ env: h.env, getPath: () => '/teach/home', onState: (s) => r.states.push(s), onHide: () => r.hides.push(1) });
    c.start();
    c.check();
    await flush();
    expect(r.latest()?.decision).toEqual({ state: 'open' });
    expect(h.calls).toContain('touchUnlock');
    expect(h.calls).not.toContain('clearConsoleSession');
    c.stop();
  });

  it('only the latest check wins: a slow earlier read is dropped', async () => {
    const h = harness();
    let release: (value: DeviceGateRead) => void = () => undefined;
    let first = true;
    h.env.readDevice = () => {
      if (first) {
        first = false;
        return new Promise((resolve) => {
          release = resolve;
        });
      }
      return Promise.resolve({ readable: true, marker: { v: 1, gate: 'none' }, hasProfiles: false });
    };
    let path = '/parent';
    const r = recorder();
    const c = createGrownUpLockController({ env: h.env, getPath: () => path, onState: (s) => r.states.push(s), onHide: () => r.hides.push(1) });
    c.start();
    c.check();
    path = '/teach/home';
    c.check();
    await flush();
    release({ readable: true, marker: { v: 1, gate: 'nopin' }, hasProfiles: true });
    await flush();
    expect(r.states).toEqual([{ path: '/teach/home', decision: { state: 'open' }, hidden: false }]);
    c.stop();
  });

  it('after stop nothing is reported and no listener is left', async () => {
    const h = harness();
    const r = recorder();
    const c = createGrownUpLockController({ env: h.env, getPath: () => '/parent', onState: (s) => r.states.push(s), onHide: () => r.hides.push(1) });
    c.start();
    c.check();
    c.stop();
    await flush();
    h.win.dispatchEvent(pageEvent('pageshow', true));
    h.doc.dispatchEvent(new Event('visibilitychange'));
    await flush();
    expect(r.states).toEqual([]);
    expect(r.hides).toEqual([]);
  });
});

describe('createGrownUpLockController: back/forward cache and tab re-checks (section 3.9)', () => {
  async function opened(): Promise<{ h: Harness; r: ReturnType<typeof recorder>; c: ReturnType<typeof createGrownUpLockController> }> {
    const h = harness();
    h.unlock.value = { v: 1, at: NOW - 1000, seen: NOW - 1000, src: 'signin' };
    const r = recorder();
    const c = createGrownUpLockController({ env: h.env, getPath: () => '/parent', onState: (s) => r.states.push(s), onHide: () => r.hides.push(r.states.length) });
    c.start();
    c.check();
    await flush();
    expect(r.latest()?.decision).toEqual({ state: 'open' });
    return { h, r, c };
  }

  it('pageshow persisted hides synchronously, then re-reads and re-decides (now locked)', async () => {
    const { h, r, c } = await opened();
    h.unlock.value = null; // Back to learning cleared the unlock before the child pressed Back
    h.calls.length = 0;
    h.win.dispatchEvent(pageEvent('pageshow', true));
    expect(r.hides).toHaveLength(1); // before any await
    expect(h.calls).not.toContain('readUnlock');
    await flush();
    expect(r.latest()).toEqual({ path: '/parent', decision: { state: 'locked', pinPath: true, line: 'default' }, hidden: false });
    expect(h.calls).toEqual(expect.arrayContaining(['readDevice', 'readUnlock', 'clearConsoleSession']));
    c.stop();
  });

  it('a pageshow that is not a restore does nothing', async () => {
    const { h, r, c } = await opened();
    const before = r.states.length;
    h.win.dispatchEvent(pageEvent('pageshow', false));
    await flush();
    expect(r.hides).toEqual([]);
    expect(r.states).toHaveLength(before);
    c.stop();
  });

  it('visibilitychange to visible hides synchronously, then re-decides (the idle time ran out)', async () => {
    const { h, r, c } = await opened();
    h.unlock.value = { v: 1, at: NOW - 20 * 60_000, seen: NOW - 16 * 60_000, src: 'signin' };
    h.doc.visibilityState = 'visible';
    h.doc.dispatchEvent(new Event('visibilitychange'));
    expect(r.hides).toHaveLength(1);
    await flush();
    expect(r.latest()?.decision).toEqual({ state: 'locked', pinPath: true, line: 'default' });
    c.stop();
  });

  it('visibilitychange to hidden does nothing', async () => {
    const { h, r, c } = await opened();
    h.doc.visibilityState = 'hidden';
    h.doc.dispatchEvent(new Event('visibilitychange'));
    await flush();
    expect(r.hides).toEqual([]);
    c.stop();
  });

  it('pagehide into the back/forward cache hides the content, so a restore never paints it', async () => {
    const { h, r, c } = await opened();
    h.win.dispatchEvent(pageEvent('pagehide', false));
    expect(r.hides).toEqual([]);
    h.win.dispatchEvent(pageEvent('pagehide', true));
    expect(r.hides).toHaveLength(1);
    c.stop();
  });

  it('a re-check that opens again reports the page visible', async () => {
    const { h, r, c } = await opened();
    h.doc.dispatchEvent(new Event('visibilitychange'));
    await flush();
    expect(r.latest()).toEqual({ path: '/parent', decision: { state: 'open' }, hidden: false });
    c.stop();
  });

  it('without window or document (SSR) start and stop are harmless', () => {
    const h = harness();
    const c = createGrownUpLockController({ env: { ...h.env, window: null, document: null }, getPath: () => '/parent', onState: () => undefined, onHide: () => undefined });
    expect(() => {
      c.start();
      c.stop();
    }).not.toThrow();
  });
});

describe('lockView: what to render for this path', () => {
  const open: LockDecision = { state: 'open' };
  const locked: LockDecision = { state: 'locked', pinPath: false, line: 'noPin' };

  it('pending before any decision, and for a decision made for another path (a navigation)', () => {
    expect(lockView(null, '/parent')).toEqual({ kind: 'pending' });
    expect(lockView({ path: '/parent', decision: open, hidden: false }, '/teach/home')).toEqual({ kind: 'pending' });
  });

  it('open, open but hidden while a re-check runs, or locked', () => {
    expect(lockView({ path: '/parent', decision: open, hidden: false }, '/parent')).toEqual({ kind: 'open', hidden: false });
    expect(lockView({ path: '/parent', decision: open, hidden: true }, '/parent')).toEqual({ kind: 'open', hidden: true });
    expect(lockView({ path: '/parent', decision: locked, hidden: false }, '/parent')).toEqual({ kind: 'locked', decision: locked });
    // the lock screen shows no data, so it stays up (no flicker, focus kept) while a re-check runs
    expect(lockView({ path: '/parent', decision: locked, hidden: true }, '/parent')).toEqual({ kind: 'locked', decision: locked });
  });
});

describe('GrownUpLockGate: locked and pending render no children', () => {
  const handlers = { onUsePin: () => undefined, onSignInAgain: () => undefined, onBackToLearning: () => undefined };

  function Child({ probe }: { probe: () => void }): JSX.Element {
    probe();
    return <p>Mina, 42 minutes</p>;
  }

  it('pending: an empty busy region, the child never renders (so it cannot fetch)', () => {
    const probe = vi.fn();
    const html = renderToStaticMarkup(
      <GrownUpLockGate view={{ kind: 'pending' }} {...handlers}>
        <Child probe={probe} />
      </GrownUpLockGate>,
    );
    expect(probe).not.toHaveBeenCalled();
    expect(html).toBe('<div aria-busy="true" data-testid="grown-up-lock-pending"></div>');
  });

  it('locked: the lock screen only, no child', () => {
    const probe = vi.fn();
    const html = renderToStaticMarkup(
      <GrownUpLockGate view={{ kind: 'locked', decision: { state: 'locked', pinPath: true, line: 'default' } }} {...handlers}>
        <Child probe={probe} />
      </GrownUpLockGate>,
    );
    expect(probe).not.toHaveBeenCalled();
    expect(html).not.toContain('Mina');
    expect(html).toContain('data-testid="grown-up-lock"');
  });

  it('open: the child inside a wrapper that stays mounted; hidden while a re-check runs', () => {
    const shown = renderToStaticMarkup(
      <GrownUpLockGate view={{ kind: 'open', hidden: false }} {...handlers}>
        <Child probe={() => undefined} />
      </GrownUpLockGate>,
    );
    expect(shown).toBe('<div data-testid="grown-up-content"><p>Mina, 42 minutes</p></div>');
    const hidden = renderToStaticMarkup(
      <GrownUpLockGate view={{ kind: 'open', hidden: true }} {...handlers}>
        <Child probe={() => undefined} />
      </GrownUpLockGate>,
    );
    expect(hidden).toMatch(/^<div hidden="" aria-hidden="true" style="display:none" data-testid="grown-up-content">/);
  });
});

describe('GrownUpLock: first paint', () => {
  it('renders nothing of the page before the decision (static HTML, effects have not run)', () => {
    const probe = vi.fn();
    function Child(): JSX.Element {
      probe();
      return <p>roster</p>;
    }
    const html = renderToStaticMarkup(
      <GrownUpLock path="/parent" onSignInAgain={() => undefined}>
        <Child />
      </GrownUpLock>,
    );
    expect(probe).not.toHaveBeenCalled();
    expect(html).toBe('<div aria-busy="true" data-testid="grown-up-lock-pending"></div>');
  });

  it('is exempt on /signin: the page renders at once', () => {
    const html = renderToStaticMarkup(
      <GrownUpLock path="/signin" exempt onSignInAgain={() => undefined}>
        <p>sign-in widget</p>
      </GrownUpLock>,
    );
    expect(html).toBe('<p>sign-in widget</p>');
  });
});

describe('GrownUpLockScreen (wireframe Panels A and B)', () => {
  const handlers = { onUsePin: () => undefined, onSignInAgain: () => undefined, onBackToLearning: () => undefined };
  const screen = (decision: Extract<LockDecision, { state: 'locked' }>): string => renderToStaticMarkup(<GrownUpLockScreen decision={decision} {...handlers} />);

  it('Panel A: PIN path first as the primary, Sign in again second, Back to learning first in tab order', () => {
    const html = screen({ state: 'locked', pinPath: true, line: 'default' });
    expect(text(html)).toBe(`${lock.backToLearning.cta} ${lock.title} ${lock.line} ${lock.usePin.cta} ${lock.signInAgain.cta}`);
    const buttons = [...html.matchAll(/<button[^>]*data-testid="([^"]+)"/g)].map((m) => m[1]);
    expect(buttons).toEqual(['grown-up-lock-back', 'grown-up-lock-pin', 'grown-up-lock-signin']);
    expect(html).toMatch(/<button[^>]*data-tone="primary"[^>]*data-testid="grown-up-lock-pin"/);
    expect(html).toMatch(/<button[^>]*data-tone="secondary"[^>]*data-testid="grown-up-lock-signin"/);
  });

  it('Panel B: sign-in only with the line of its case, Sign in again becomes the primary', () => {
    for (const line of ['pinChanged', 'firstSignIn', 'noPin'] as const) {
      const html = screen({ state: 'locked', pinPath: false, line });
      expect(text(html)).toBe(`${lock.backToLearning.cta} ${lock.title} ${lock[line]} ${lock.signInAgain.cta}`);
      expect(html).not.toContain('grown-up-lock-pin');
      expect(html).toMatch(/<button[^>]*data-tone="primary"[^>]*data-testid="grown-up-lock-signin"/);
    }
  });

  it('is a region labelled by its heading, which takes focus; no timer, no name, no number', () => {
    const html = screen({ state: 'locked', pinPath: true, line: 'default' });
    expect(html).toMatch(/<section role="region" aria-labelledby="grown-up-lock-title"/);
    expect(html).toMatch(/<h1 id="grown-up-lock-title" tabindex="-1"[^>]*>Grown-ups only<\/h1>/i);
    expect(text(html)).not.toMatch(/\d/);
    expect(html).not.toMatch(/role="timer"|aria-live/);
  });

  it('every button meets the 64 px touch target and uses type="button"', () => {
    const html = screen({ state: 'locked', pinPath: true, line: 'default' });
    const buttons = [...html.matchAll(/<button[^>]*>/g)].map((m) => m[0]);
    expect(buttons).toHaveLength(3);
    for (const b of buttons) {
      expect(b).toContain('type="button"');
      expect(b).toMatch(/min-height:64px/);
    }
  });

  it('takes every word from the dictionary (en-XA)', () => {
    vi.stubEnv('NEXT_PUBLIC_PSEUDO_LOCALE', '1');
    ui.locale = 'en-XA';
    try {
      expect(getMessages('en-XA' as UiLocale).console.lock.title).toMatch(/^\[/);
      for (const decision of [{ state: 'locked', pinPath: true, line: 'default' }, { state: 'locked', pinPath: false, line: 'noPin' }] as const) {
        expectAllPseudo(screen(decision), [], 4);
      }
    } finally {
      ui.locale = 'en';
      vi.unstubAllEnvs();
    }
  });
});

describe('browserLockEnvironment: the default wiring', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    idb.values.clear();
  });

  function storage(): Storage & { map: Map<string, string> } {
    const map = new Map<string, string>();
    return {
      map,
      get length() {
        return map.size;
      },
      clear: () => map.clear(),
      key: (i: number) => [...map.keys()][i] ?? null,
      getItem: (k: string) => map.get(k) ?? null,
      setItem: (k: string, v: string) => {
        map.set(k, v);
      },
      removeItem: (k: string) => {
        map.delete(k);
      },
    };
  }

  it('a lock render removes hr:console:session from this tab; the device and the unlock come from the real readers', async () => {
    const session = storage();
    session.map.set(CONSOLE_SESSION_KEY, JSON.stringify({ token: 't', accountId: 'a', displayName: 'n' }));
    session.map.set(UNLOCK_SESSION_KEY, JSON.stringify({ v: 1, at: 1, seen: 1, src: 'signin' })); // long expired
    const win = Object.assign(new EventTarget(), { sessionStorage: session, location: { origin: 'https://app.hangulroute.com', assign: vi.fn() } });
    vi.stubGlobal('window', win);
    vi.stubGlobal('document', Object.assign(new EventTarget(), { visibilityState: 'visible' }));
    vi.stubGlobal('indexedDB', {});
    idb.values.set('hr:device:gate', JSON.stringify({ v: 1, gate: 'nopin' }));
    idb.values.set('hr:profiles', '[{"id":"p1"}]');

    const states: LockState[] = [];
    const c = createGrownUpLockController({ env: browserLockEnvironment(), getPath: () => '/parent', onState: (s) => states.push(s), onHide: () => undefined });
    c.start();
    c.check();
    await flush();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(states[states.length - 1]?.decision).toEqual({ state: 'locked', pinPath: false, line: 'noPin' });
    expect(session.map.has(CONSOLE_SESSION_KEY)).toBe(false);
    c.stop();
  });

  it('Back to learning clears the unlock and the console session, then leaves for the learner home', () => {
    const session = storage();
    session.map.set(CONSOLE_SESSION_KEY, '{}');
    session.map.set(UNLOCK_SESSION_KEY, '{}');
    const assign = vi.fn();
    vi.stubGlobal('window', Object.assign(new EventTarget(), { sessionStorage: session, location: { origin: 'https://hangulroute.com', assign } }));
    const env = browserLockEnvironment();
    env.clearGrownUpTab();
    expect(session.map.size).toBe(0);
    expect(env.origin()).toBe('https://hangulroute.com');
    env.assign('https://app.hangulroute.com/');
    expect(assign).toHaveBeenCalledWith('https://app.hangulroute.com/');
    expect(env.now()).toBeGreaterThan(0);
  });

  it('in node (no window) it has no event targets and reads nothing', async () => {
    const env = browserLockEnvironment();
    expect(env.window).toBeNull();
    expect(env.document).toBeNull();
    expect(await env.readDevice()).toEqual({ readable: false });
    expect(await env.readTrustedEpoch()).toBeNull();
    expect(env.readUnlock()).toBeNull();
    expect(env.origin()).toBe('');
  });
});

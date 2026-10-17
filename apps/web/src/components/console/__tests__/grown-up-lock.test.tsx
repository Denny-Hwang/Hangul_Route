import { CONSOLE_SESSION_KEY, UNLOCK_SESSION_KEY, type GrownUpUnlock } from '@hangul-route/content-schema';
import { en, getMessages, type UiLocale } from '@hangul-route/i18n';
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
  LOCK_READ_TIMEOUT_MS,
  browserLockEnvironment,
  createGrownUpLockController,
  lockActions,
  lockView,
  returnPath,
  type LockState,
} from '../GrownUpLock';
import { EXPIRED, SIGNED_IN, flush, harness, inputEvent, pageEvent, type Harness } from './lock-harness';
import { expectAllPseudo } from './pseudo-text';

/**
 * F-APP-001 A-4a, section 3.9 (wireframe shell/grown-up-lock.md). The repo's web tests run in
 * node without a DOM, so the component is split: `createGrownUpLockController` owns the reads,
 * the decision and the back/forward-cache and tab re-checks (driven here with real
 * EventTargets), `lockView` picks what to render, and `GrownUpLockGate` / `GrownUpLockScreen`
 * render it (server-rendered here). `GrownUpLock` binds them with two effects; its wiring is
 * covered with react-test-renderer in `grown-up-lock-wiring.test.tsx`.
 */
const lock = getMessages('en').console.lock;
const text = (html: string): string => html.replace(/<[^>]+>/g, ' ').replace(/&#x27;/g, "'").replace(/\s+/g, ' ').trim();

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
    h.unlock.value = SIGNED_IN;
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

describe('createGrownUpLockController: reads that fail or hang fail closed (A-4a review, 2026-10-12)', () => {
  it('a device read that never settles locks to sign-in only after the time limit, with the plain sign-in line', async () => {
    vi.useFakeTimers();
    try {
      const h = harness();
      h.env.readDevice = () => new Promise<DeviceGateRead>(() => undefined); // Safari 14.1: the first IndexedDB open can hang
      const r = recorder();
      const c = createGrownUpLockController({ env: h.env, getPath: () => '/parent', onState: (s) => r.states.push(s), onHide: () => undefined });
      c.start();
      c.check();
      await vi.advanceTimersByTimeAsync(LOCK_READ_TIMEOUT_MS - 1);
      expect(r.states).toEqual([]);
      await vi.advanceTimersByTimeAsync(1);
      expect(r.latest()).toEqual({ path: '/parent', decision: { state: 'locked', pinPath: false, line: 'signInOnly' }, hidden: false });
      expect(h.calls).toContain('clearConsoleSession');
      c.stop();
    } finally {
      vi.useRealTimers();
    }
  });

  it('a sign-in unlock still opens a page whose device read hung (sign-in is the way out)', async () => {
    const h = harness();
    h.env.readDevice = () => new Promise<DeviceGateRead>(() => undefined);
    h.unlock.value = SIGNED_IN;
    const r = recorder();
    const c = createGrownUpLockController({ env: h.env, getPath: () => '/parent', onState: (s) => r.states.push(s), onHide: () => undefined, readTimeoutMs: 5 });
    c.start();
    c.check();
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(r.latest()?.decision).toEqual({ state: 'open' });
    c.stop();
  });

  it('a trusted-epoch read that hangs counts as none: the PIN path stays off', async () => {
    const h = harness();
    h.env.readTrustedEpoch = () => new Promise<number | null>(() => undefined);
    const r = recorder();
    const c = createGrownUpLockController({ env: h.env, getPath: () => '/parent', onState: (s) => r.states.push(s), onHide: () => undefined, readTimeoutMs: 5 });
    c.start();
    c.check();
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(r.latest()?.decision).toEqual({ state: 'locked', pinPath: false, line: 'firstSignIn' });
    c.stop();
  });

  it('reads that reject or throw fail closed the same way, and an unlock read that throws counts as none', async () => {
    const h = harness();
    h.env.readDevice = () => Promise.reject(new Error('UnknownError'));
    h.env.readTrustedEpoch = () => {
      throw new Error('SecurityError');
    };
    h.env.readUnlock = () => {
      throw new Error('blocked');
    };
    const r = recorder();
    const c = createGrownUpLockController({ env: h.env, getPath: () => '/parent', onState: (s) => r.states.push(s), onHide: () => undefined });
    c.start();
    c.check();
    await flush();
    expect(r.latest()?.decision).toEqual({ state: 'locked', pinPath: false, line: 'signInOnly' });
    c.stop();
  });
});

describe('createGrownUpLockController: back/forward cache and tab re-checks (section 3.9)', () => {
  async function opened(): Promise<{ h: Harness; r: ReturnType<typeof recorder>; c: ReturnType<typeof createGrownUpLockController> }> {
    const h = harness();
    h.unlock.value = SIGNED_IN;
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
    h.unlock.value = EXPIRED;
    h.doc.visibilityState = 'visible';
    h.doc.dispatchEvent(new Event('visibilitychange'));
    expect(r.hides).toHaveLength(1);
    await flush();
    expect(r.latest()?.decision).toEqual({ state: 'locked', pinPath: true, line: 'default' });
    c.stop();
  });

  it('visibilitychange to hidden covers a page that only an unlock keeps open, so the tab switcher never shows it', async () => {
    const { h, r, c } = await opened();
    const before = r.states.length;
    h.doc.visibilityState = 'hidden';
    h.doc.dispatchEvent(new Event('visibilitychange'));
    expect(r.hides).toHaveLength(1);
    await flush();
    expect(r.states).toHaveLength(before); // no re-check while hidden
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

  it('a page that cannot lock (marker none) is never covered on a tab switch; a return re-checks in the background', async () => {
    const h = harness();
    h.device.value = { readable: true, marker: { v: 1, gate: 'none' }, hasProfiles: true };
    const r = recorder();
    const c = createGrownUpLockController({ env: h.env, getPath: () => '/teach/home', onState: (s) => r.states.push(s), onHide: () => r.hides.push(1) });
    c.start();
    c.check();
    await flush();
    expect(r.latest()?.decision).toEqual({ state: 'open' });
    h.doc.visibilityState = 'hidden';
    h.doc.dispatchEvent(new Event('visibilitychange'));
    h.doc.visibilityState = 'visible';
    h.calls.length = 0;
    h.doc.dispatchEvent(new Event('visibilitychange'));
    expect(r.hides).toEqual([]); // no flicker, scroll and focus untouched on a teacher laptop
    await flush();
    expect(h.calls).toContain('readDevice');
    // the device gained child profiles meanwhile: the background re-check locks it
    h.device.value = { readable: true, marker: { v: 1, gate: 'nopin' }, hasProfiles: true };
    h.doc.dispatchEvent(new Event('visibilitychange'));
    await flush();
    expect(r.latest()?.decision).toEqual({ state: 'locked', pinPath: false, line: 'noPin' });
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

describe('createGrownUpLockController: interaction within and after the 15 idle minutes (sections 3.9, 3.10)', () => {
  async function opened(unlock: GrownUpUnlock = SIGNED_IN): Promise<{ h: Harness; r: ReturnType<typeof recorder>; c: ReturnType<typeof createGrownUpLockController> }> {
    const h = harness();
    h.unlock.value = unlock;
    const r = recorder();
    const c = createGrownUpLockController({ env: h.env, getPath: () => '/parent', onState: (s) => r.states.push(s), onHide: () => r.hides.push(1) });
    c.start();
    c.check();
    await flush();
    expect(r.latest()?.decision).toEqual({ state: 'open' });
    h.calls.length = 0;
    return { h, r, c };
  }

  it('a pointer, key, click or wheel within the window refreshes seen and lets the action through', async () => {
    const { h, r, c } = await opened();
    for (const type of ['pointerdown', 'keydown', 'click', 'wheel'] as const) {
      const event = inputEvent(type);
      h.win.dispatchEvent(event);
      expect(event.defaultPrevented).toBe(false);
    }
    expect(h.calls.filter((call) => call === 'touchUnlock')).toHaveLength(4);
    expect(r.hides).toEqual([]);
    c.stop();
  });

  it('a pointer after 15 idle minutes is stopped, covers the page before it lands, and the re-check locks', async () => {
    const { h, r, c } = await opened();
    h.unlock.value = EXPIRED;
    const down = inputEvent('pointerdown');
    h.win.dispatchEvent(down);
    expect(down.defaultPrevented).toBe(true);
    expect(r.hides).toHaveLength(1); // synchronously, before the click
    // the click that follows the pointer while the re-check runs never reaches the page
    const click = inputEvent('click');
    h.win.dispatchEvent(click);
    expect(click.defaultPrevented).toBe(true);
    expect(h.calls).not.toContain('touchUnlock');
    await flush();
    expect(r.latest()?.decision).toEqual({ state: 'locked', pinPath: true, line: 'default' });
    c.stop();
  });

  it('a key after 15 idle minutes is stopped the same way (Enter on a button, typing in a field)', async () => {
    const { h, r, c } = await opened();
    h.unlock.value = EXPIRED;
    const key = inputEvent('keydown');
    h.win.dispatchEvent(key);
    expect(key.defaultPrevented).toBe(true);
    expect(r.hides).toHaveLength(1);
    await flush();
    expect(r.latest()?.decision.state).toBe('locked');
    c.stop();
  });

  it('a wheel after 15 idle minutes covers and re-checks (it cannot be stopped: a passive listener)', async () => {
    const { h, r, c } = await opened();
    h.unlock.value = EXPIRED;
    const wheel = inputEvent('wheel');
    h.win.dispatchEvent(wheel);
    expect(wheel.defaultPrevented).toBe(false);
    expect(r.hides).toHaveLength(1);
    await flush();
    expect(r.latest()?.decision.state).toBe('locked');
    c.stop();
  });

  it('interaction on a page that cannot lock, or on the lock screen, is left alone', async () => {
    const h = harness();
    h.device.value = { readable: true, marker: { v: 1, gate: 'none' }, hasProfiles: false };
    const r = recorder();
    const c = createGrownUpLockController({ env: h.env, getPath: () => '/teach/home', onState: (s) => r.states.push(s), onHide: () => r.hides.push(1) });
    c.start();
    c.check();
    await flush();
    h.device.value = { readable: true, marker: { v: 1, gate: 'nopin' }, hasProfiles: true };
    c.check();
    await flush();
    expect(r.latest()?.decision.state).toBe('locked');
    const down = inputEvent('pointerdown');
    h.win.dispatchEvent(down);
    expect(down.defaultPrevented).toBe(false);
    expect(r.hides).toEqual([]);
    c.stop();
  });

  it('while a tab-return re-check covers the page, clicks and keys are held back; after it opens they pass', async () => {
    const { h, r, c } = await opened();
    h.doc.dispatchEvent(new Event('visibilitychange'));
    expect(r.hides).toHaveLength(1);
    const early = inputEvent('click');
    h.win.dispatchEvent(early);
    expect(early.defaultPrevented).toBe(true);
    await flush();
    expect(r.latest()).toEqual({ path: '/parent', decision: { state: 'open' }, hidden: false });
    const later = inputEvent('click');
    h.win.dispatchEvent(later);
    expect(later.defaultPrevented).toBe(false);
    c.stop();
  });

  it('stop removes the interaction listeners', async () => {
    const { h, r, c } = await opened();
    c.stop();
    h.unlock.value = EXPIRED;
    const down = inputEvent('pointerdown');
    h.win.dispatchEvent(down);
    expect(down.defaultPrevented).toBe(false);
    expect(r.hides).toEqual([]);
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

  it('open: the child inside a wrapper that stays mounted; covered, not collapsed, while a re-check runs', () => {
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
    // the page keeps its layout (no scroll jump) and its focus; an opaque cover sits over it
    expect(hidden).toMatch(/^<div aria-hidden="true" data-testid="grown-up-content"><p>Mina, 42 minutes<\/p><\/div><div aria-hidden="true" data-testid="grown-up-cover" style="/);
    expect(hidden).not.toContain('display:none');
    const cover = /data-testid="grown-up-cover" style="([^"]+)"/.exec(hidden)?.[1] ?? '';
    expect(cover).toMatch(/position:fixed/);
    expect(cover).toMatch(/top:0;right:0;bottom:0;left:0/);
    expect(cover).toMatch(/z-index:\d+/);
    expect(cover).toMatch(/background-color:#/); // a token colour, opaque
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
      <GrownUpLock pathname="/parent" search="?id=sp_1" onSignInAgain={() => undefined}>
        <Child />
      </GrownUpLock>,
    );
    expect(probe).not.toHaveBeenCalled();
    expect(html).toBe('<div aria-busy="true" data-testid="grown-up-lock-pending"></div>');
  });

  it('is exempt on /signin: the page renders at once', () => {
    const html = renderToStaticMarkup(
      <GrownUpLock pathname="/signin" exempt onSignInAgain={() => undefined}>
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
    // The Aa button (owner items 6 and 7) comes last: its sign is drawn, its name is "Display".
    expect(text(html)).toBe(`${lock.backToLearning.cta} ${lock.title} ${lock.line} ${lock.usePin.cta} ${lock.signInAgain.cta} ${en.common.display.button}`);
    const buttons = [...html.matchAll(/<button[^>]*data-testid="([^"]+)"/g)].map((m) => m[1]);
    expect(buttons).toEqual(['grown-up-lock-back', 'grown-up-lock-pin', 'grown-up-lock-signin', 'grown-up-lock-display']);
    expect(html).toMatch(/<button[^>]*aria-label="Aa, Display: language and text size"[^>]*aria-haspopup="dialog"[^>]*data-testid="grown-up-lock-display"/);
    expect(html).toMatch(/<button[^>]*data-tone="primary"[^>]*data-testid="grown-up-lock-pin"/);
    expect(html).toMatch(/<button[^>]*data-tone="secondary"[^>]*data-testid="grown-up-lock-signin"/);
  });

  it('Panel B: sign-in only with the line of its case, Sign in again becomes the primary', () => {
    for (const line of ['pinChanged', 'firstSignIn', 'pinRenew', 'signInOnly', 'noPin'] as const) {
      const html = screen({ state: 'locked', pinPath: false, line });
      expect(text(html)).toBe(`${lock.backToLearning.cta} ${lock.title} ${lock[line]} ${lock.signInAgain.cta} ${en.common.display.button}`);
      expect(html).not.toContain('grown-up-lock-pin');
      expect(html).toMatch(/<button[^>]*data-tone="primary"[^>]*data-testid="grown-up-lock-signin"/);
    }
  });

  it('is a region labelled by its heading, which takes focus; no timer, no name, no number', () => {
    const html = screen({ state: 'locked', pinPath: true, line: 'default' });
    expect(html).toMatch(/<section role="region" aria-labelledby="grown-up-lock-title"/);
    expect(html).toMatch(/<h1 id="grown-up-lock-title" tabindex="-1"[^>]*>Grown-ups only<\/h1>/i);
    expect(html).toMatch(/<h1[^>]*style="[^"]*outline:none/);
    expect(text(html)).not.toMatch(/\d/);
    expect(html).not.toMatch(/role="timer"|aria-live/);
  });

  it('every button meets the 64 px touch target and uses type="button"', () => {
    const html = screen({ state: 'locked', pinPath: true, line: 'default' });
    const buttons = [...html.matchAll(/<button[^>]*>/g)].map((m) => m[0]);
    expect(buttons).toHaveLength(4);
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
    expect(await env.readDevice()).toEqual({ readable: false, reason: 'unavailable' });
    expect(await env.readTrustedEpoch()).toBeNull();
    expect(env.readUnlock()).toBeNull();
    expect(env.origin()).toBe('');
  });
});

describe('lockActions: the three buttons (A-4a review, 2026-10-12)', () => {
  it('Use the grown-up PIN opens the learner gate with this page and its query as next', () => {
    const h = harness();
    lockActions(h.env, '/teach/space?id=sp_1', () => undefined, 'en').onUsePin();
    expect(h.assigned).toEqual(['/?gate=grown-up&next=%2Fteach%2Fspace%3Fid%3Dsp_1']);
  });

  it('Sign in again hands /signin with this page as next to the sign-out', () => {
    const h = harness();
    const urls: string[] = [];
    lockActions(h.env, '/parent', (url) => urls.push(url), 'en').onSignInAgain();
    expect(urls).toEqual(['/signin?next=%2Fparent']);
    expect(h.assigned).toEqual([]);
  });

  it('Back to learning clears this tab first, then leaves for the learner home of this origin, with the console language', () => {
    const order: string[] = [];
    const h = harness();
    h.env.clearGrownUpTab = () => {
      order.push('clear');
    };
    h.env.assign = (url) => {
      order.push(`assign ${url}`);
    };
    lockActions(h.env, '/parent', () => undefined, 'en').onBackToLearning();
    expect(order).toEqual(['clear', 'assign /?lang=en']);
    h.env.origin = () => 'https://hangulroute.com';
    order.length = 0;
    lockActions(h.env, '/parent', () => undefined, 'ko').onBackToLearning();
    expect(order).toEqual(['clear', 'assign https://app.hangulroute.com/?lang=ko']);
  });
});

describe('returnPath: the lock targets carry the pathname and the query', () => {
  it('joins them with one ?, with or without a leading ? on the query', () => {
    expect(returnPath('/parent')).toBe('/parent');
    expect(returnPath('/parent', '')).toBe('/parent');
    expect(returnPath('/teach/space', 'id=sp_1')).toBe('/teach/space?id=sp_1');
    expect(returnPath('/teach/space', '?id=sp_1&tab=plan')).toBe('/teach/space?id=sp_1&tab=plan');
    expect(returnPath('/teach/space', '?')).toBe('/teach/space');
  });
});

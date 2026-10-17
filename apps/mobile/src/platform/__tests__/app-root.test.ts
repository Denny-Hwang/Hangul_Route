import { CONSOLE_SESSION_KEY, UNLOCK_SESSION_KEY } from '@hangul-route/content-schema';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../storage', () => ({
  readJson: vi.fn(async () => null),
  readJsonStrict: vi.fn(async () => null),
  writeJson: vi.fn(async () => undefined),
  removeKey: vi.fn(async () => undefined),
}));
vi.mock('../telemetry', () => ({ track: vi.fn(async () => true) }));
vi.mock('../locale', () => ({ deviceLanguages: () => [], takeLangHandoff: () => null, setDocumentLang: () => undefined }));

import * as nativeRoot from '../app-root';
import { bootRoot, consumeBootIntent, peekBootIntent, pickRoot, type RootEnv } from '../app-root.web';
import { LEAVE_TELEMETRY_WAIT_MS, type SessionArea } from '../grown-up-handoff.web';
import type { TelemetryEvent } from '../telemetry';
import { useUiStore } from '../../store/ui-store';

/**
 * The root chooser of the learner web build (F-APP-001 sections 3.4, 3.9 and 3.11; F-BROWSE-001
 * section 4.1), chosen in `index.ts` before `App` mounts. Order: `/present` (F-TCH-004 PR 6),
 * `/browse`, the grown-up bounce, else the app.
 */
describe('pickRoot (web)', () => {
  it('chooses the presenter root for /present and every path under it (F-TCH-004 section 3.1)', () => {
    for (const pathname of ['/present', '/present/', '/present/x', '/present/unknown/deeper', '/present.html']) {
      expect(pickRoot({ pathname }), pathname).toBe('presenter');
    }
  });

  it('chooses the browse root for /browse and every path under it', () => {
    for (const pathname of ['/browse', '/browse/', '/browse/x', '/browse/episode/stage1-letters', '/browse.html']) {
      expect(pickRoot({ pathname }), pathname).toBe('browse');
    }
  });

  it('chooses the grown-up bounce for a grown-up path that is not its own persona entry', () => {
    for (const pathname of ['/teach/zzz', '/teach/space', '/parent/space', '/parent/mina', '/signin/x', '/start', '/start/x', '/account/billing', '/teach.html']) {
      expect(pickRoot({ pathname }), pathname).toBe('grown-up-bounce');
    }
  });

  it('keeps the learner app everywhere else, the persona entries included (no bounce loop on a host without them)', () => {
    for (const pathname of ['/', '', '/browsex', '/browser', '/Browse', '/x/browse', '/presentx', '/presenter', '/Present', '/x/present', '/teach', '/teach/', '/parent', '/signin', '/teacher', '/index.html']) {
      expect(pickRoot({ pathname }), pathname).toBe('app');
    }
  });
});

describe('pickRoot (native stub)', () => {
  it('always chooses the learner app: native builds have no other root (OD-6, F-BROWSE-001 OD-10)', () => {
    expect(nativeRoot.pickRoot({ pathname: '/browse' })).toBe('app');
    expect(nativeRoot.pickRoot({ pathname: '/present' })).toBe('app');
    expect(nativeRoot.pickRoot({ pathname: '/teach/zzz' })).toBe('app');
    expect(nativeRoot.pickRoot({ pathname: '/' })).toBe('app');
    expect(nativeRoot.pickRoot()).toBe('app');
  });

  it('boots the learner app with no intent and nothing to clear', () => {
    expect(nativeRoot.bootRoot()).toBe('app');
    expect(nativeRoot.peekBootIntent()).toBeNull();
    expect(() => nativeRoot.consumeBootIntent()).not.toThrow();
  });
});

function memoryArea(initial: Record<string, string>): SessionArea & { data: Map<string, string> } {
  const data = new Map(Object.entries(initial));
  return {
    data,
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => {
      data.set(key, value);
    },
    removeItem: (key) => {
      data.delete(key);
    },
  };
}

interface Harness {
  env: RootEnv;
  area: ReturnType<typeof memoryArea>;
  log: string[];
  events: TelemetryEvent[];
}

function harness(url: string, options: { replaceStateThrows?: boolean } = {}): Harness {
  const parsed = new URL(url, 'https://app.hangulroute.com');
  const area = memoryArea({ [UNLOCK_SESSION_KEY]: '{"v":1}', [CONSOLE_SESSION_KEY]: '{"token":"t"}', 'hr:browse:pass': '{}' });
  const log: string[] = [];
  const events: TelemetryEvent[] = [];
  const env: RootEnv = {
    location: {
      pathname: parsed.pathname,
      search: parsed.search,
      hash: parsed.hash,
      replace: (to) => {
        log.push(`replace ${to}`);
      },
    },
    history: {
      state: { s: 1 },
      replaceState: (state, _unused, to) => {
        if (options.replaceStateThrows) throw new Error('SecurityError');
        log.push(`replaceState ${JSON.stringify(state)} ${to}`);
      },
    },
    area: () => area,
    track: async (event) => {
      log.push(`track ${event.name}`);
      events.push(event);
      return true;
    },
    wait: () => new Promise(() => undefined),
  };
  return { env, area, log, events };
}

const flush = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

describe('bootRoot (web): what each root does before it mounts', () => {
  afterEach(() => {
    consumeBootIntent();
    vi.unstubAllGlobals();
  });

  it('the app root removes the grown-up unlock, the console session and the All lessons pass of this tab', () => {
    const h = harness('/');
    expect(bootRoot(h.env)).toBe('app');
    // F-BROWSE-001 section 4.3 (BR-6 review): a device handed back cannot reopen All lessons from this tab.
    expect([...h.area.data.keys()]).toEqual([]);
    expect(h.log).toEqual([]);
    expect(peekBootIntent()).toBeNull();
  });

  it('a gate=grown-up intent leaves the address and waits for the navigator; the tab is cleared all the same', () => {
    const h = harness('/?gate=grown-up&next=%2Fparent');
    expect(bootRoot(h.env)).toBe('app');
    // The lock already removed the console session and could not use the unlock; a new one comes after the PIN.
    expect([...h.area.data.keys()]).toEqual([]);
    expect(h.log).toEqual(['replaceState {"s":1} /']);
    expect(peekBootIntent()).toEqual({ kind: 'grown-up', next: '/parent' });
    expect(peekBootIntent()).toEqual({ kind: 'grown-up', next: '/parent' });
    consumeBootIntent();
    expect(peekBootIntent()).toBeNull();
  });

  it('keeps the lang hand-off, the other keys and the hash in the address', () => {
    const h = harness('/?lang=es&gate=grown-up&next=%2Fteach%2Fhome&from=site#top');
    bootRoot(h.env);
    expect(h.log).toEqual(['replaceState {"s":1} /?lang=es&from=site#top']);
    expect(peekBootIntent()).toEqual({ kind: 'grown-up', next: '/teach/home' });
  });

  it('a gate intent whose next is refused is no intent: the keys are cleared and the query still goes', () => {
    const h = harness('/?gate=grown-up&next=https%3A%2F%2Fevil.example');
    expect(bootRoot(h.env)).toBe('app');
    expect(h.area.data.has(UNLOCK_SESSION_KEY)).toBe(false);
    expect(h.area.data.has(CONSOLE_SESSION_KEY)).toBe(false);
    expect(h.log).toEqual(['replaceState {"s":1} /']);
    expect(peekBootIntent()).toBeNull();
  });

  it('a history that refuses still keeps the intent', () => {
    const h = harness('/?gate=grown-up&next=%2Fparent', { replaceStateThrows: true });
    expect(bootRoot(h.env)).toBe('app');
    expect(peekBootIntent()).toEqual({ kind: 'grown-up', next: '/parent' });
  });

  it('a later boot without an intent forgets an earlier one', () => {
    bootRoot(harness('/?gate=grown-up&next=%2Fparent').env);
    bootRoot(harness('/').env);
    expect(peekBootIntent()).toBeNull();
  });

  it('the class join link (owner decision 2026-10-17): the code becomes the intent and leaves the address with the path', () => {
    const h = harness('/join?lang=ko#c=abc234');
    expect(bootRoot(h.env)).toBe('app');
    expect(h.log).toEqual(['replaceState {"s":1} /?lang=ko']);
    expect(peekBootIntent()).toEqual({ kind: 'join', code: 'ABC234' });
    // The tab is cleared as on any app boot.
    expect(h.area.data.has(UNLOCK_SESSION_KEY)).toBe(false);
  });

  it('a join link with no valid code still opens Join a class; a history that refuses keeps the intent', () => {
    const h = harness('/join#c=nope');
    bootRoot(h.env);
    expect(h.log).toEqual(['replaceState {"s":1} /']);
    expect(peekBootIntent()).toEqual({ kind: 'join', code: null });
    const refused = harness('/join#c=ABC234', { replaceStateThrows: true });
    bootRoot(refused.env);
    expect(peekBootIntent()).toEqual({ kind: 'join', code: 'ABC234' });
  });

  it('a fragment that is not on /join is no join intent and stays where it was', () => {
    const h = harness('/#c=ABC234');
    bootRoot(h.env);
    expect(h.log).toEqual([]);
    expect(peekBootIntent()).toBeNull();
  });

  it('a persona entry the host had no page for mounts the learner app (and clears, like any app boot)', () => {
    const h = harness('/teach');
    expect(bootRoot(h.env)).toBe('app');
    expect(h.area.data.has(UNLOCK_SESSION_KEY)).toBe(false);
    expect(h.log).toEqual([]);
  });

  it('/present mounts PresenterApp and clears the grown-up unlock and the console session of its tab (F-TCH-004 section 3.1, F-APP-001 section 3.9)', () => {
    const h = harness('/present');
    expect(bootRoot(h.env)).toBe('presenter');
    expect(h.area.data.has(UNLOCK_SESSION_KEY)).toBe(false);
    expect(h.area.data.has(CONSOLE_SESSION_KEY)).toBe(false);
    // A tab opened from All lessons starts with a copy of its sessionStorage, the full browse pass
    // included; the presenter tab drops it, so typing /browse on a classroom screen asks again (BR-13 review).
    expect(h.area.data.has('hr:browse:pass')).toBe(false);
    // The deck fragment is the presenter's own to read and strip; the chooser leaves the address alone.
    expect(h.log).toEqual([]);
    expect(peekBootIntent()).toBeNull();
  });

  it('/present reads no boot intent and keeps the fragment for the presenter', () => {
    const h = harness('/present?gate=grown-up&next=%2Fparent#d=1.abc');
    expect(bootRoot(h.env)).toBe('presenter');
    expect(h.log).toEqual([]);
    expect(peekBootIntent()).toBeNull();
  });

  it('/browse mounts BrowseApp and the root chooser clears neither the unlock nor the console session (F-BROWSE-001 BD1, section 4.10; BrowseApp removes both itself only in a tab with nothing to go back to, browse-start.test.ts)', () => {
    const h = harness('/browse');
    expect(bootRoot(h.env)).toBe('browse');
    expect(h.area.data.has(UNLOCK_SESSION_KEY)).toBe(true);
    expect(h.area.data.has(CONSOLE_SESSION_KEY)).toBe(true);
    expect(h.area.data.has('hr:browse:pass')).toBe(true);
    expect(h.log).toEqual([]);
  });

  it('/browse reads no boot intent: the query stays for the browse root, nothing opens the PIN screen', () => {
    const h = harness('/browse?gate=grown-up&next=%2Fparent');
    expect(bootRoot(h.env)).toBe('browse');
    expect(peekBootIntent()).toBeNull();
    expect(h.log).toEqual([]);
    expect(h.area.data.has(UNLOCK_SESSION_KEY)).toBe(true);
  });

  it('/browse restored from the back/forward cache clears nothing either: [ Close ] goes back to the console page that needs both', () => {
    const h = harness('/browse');
    const handlers: Array<() => void> = [];
    h.env.onRestore = (handler) => {
      handlers.push(handler);
    };
    bootRoot(h.env);
    expect(handlers).toHaveLength(0);
  });

  it('the bounce carries the query keys its entry reads', async () => {
    const h = harness('/start?persona=teacher&lang=ko&next=%2Fx');
    expect(bootRoot(h.env)).toBe('grown-up-bounce');
    await flush();
    expect(h.log).toEqual(['track shell.path_bounced', 'replace /signin?persona=teacher&lang=ko']);
  });

  it('the grown-up bounce emits shell.path_bounced, then replaces the address with the persona entry; it clears nothing', async () => {
    const h = harness('/teach/does-not-exist?x=1');
    expect(bootRoot(h.env)).toBe('grown-up-bounce');
    await flush();
    expect(h.log).toEqual(['track shell.path_bounced', 'replace /teach']);
    expect(h.events).toEqual([{ name: 'shell.path_bounced', payload: { prefix: 'teach' } }]);
    expect(h.area.data.has(UNLOCK_SESSION_KEY)).toBe(true);
    expect(h.area.data.has(CONSOLE_SESSION_KEY)).toBe(true);
    expect(peekBootIntent()).toBeNull();
  });

  it('bounces each prefix to its entry', async () => {
    for (const [url, target, prefix] of [
      ['/parent/space?id=sp_1', '/parent', 'parent'],
      ['/account/billing', '/signin', 'account'],
      ['/start', '/signin', 'start'],
      ['/signin/x', '/signin', 'signin'],
    ] as const) {
      const h = harness(url);
      expect(bootRoot(h.env), url).toBe('grown-up-bounce');
      await flush();
      expect(h.log, url).toEqual(['track shell.path_bounced', `replace ${target}`]);
      expect(h.events[0]?.payload, url).toEqual({ prefix });
    }
  });

  it('no location (not a browser): the app, untouched', () => {
    const h = harness('/');
    expect(bootRoot({ ...h.env, location: null })).toBe('app');
    expect(h.area.data.has(UNLOCK_SESSION_KEY)).toBe(true);
  });

  it('reads the browser globals by default', async () => {
    const replace = vi.fn();
    const replaceState = vi.fn();
    const area = memoryArea({ [UNLOCK_SESSION_KEY]: '{}', [CONSOLE_SESSION_KEY]: '{}' });
    vi.stubGlobal('location', { pathname: '/', search: '?gate=grown-up&next=%2Fparent', hash: '', replace });
    vi.stubGlobal('history', { state: null, replaceState });
    vi.stubGlobal('sessionStorage', area);
    expect(bootRoot()).toBe('app');
    expect(replaceState).toHaveBeenCalledWith(null, '', '/');
    expect(area.data.size).toBe(0);
    expect(peekBootIntent()).toEqual({ kind: 'grown-up', next: '/parent' });

    vi.stubGlobal('location', { pathname: '/', search: '', hash: '', replace });
    expect(bootRoot()).toBe('app');
    expect(peekBootIntent()).toBeNull();
    expect(replace).not.toHaveBeenCalled();
  });

  describe('a learner page restored from the back/forward cache clears again', () => {
    function withRestore(url: string): Harness & { restore: () => void; registered: () => number } {
      const h = harness(url);
      const handlers: Array<() => void> = [];
      h.env.onRestore = (handler) => {
        handlers.push(handler);
      };
      return { ...h, restore: () => handlers.forEach((f) => f()), registered: () => handlers.length };
    }

    it('the app root clears the unlock, the console session and an All lessons pass written after its boot', () => {
      const h = withRestore('/');
      bootRoot(h.env);
      h.area.data.set(UNLOCK_SESSION_KEY, '{"v":1}');
      h.area.data.set(CONSOLE_SESSION_KEY, '{}');
      // The gate hand-off wrote a pass and left for /browse; Close or Back restored this page.
      h.area.data.set('hr:browse:pass', '{}');
      h.restore();
      expect([...h.area.data.keys()]).toEqual([]);
    });

    it('so does an app root that booted with a gate intent (the unlock it wrote was for the page it left)', () => {
      const h = withRestore('/?gate=grown-up&next=%2Fparent');
      bootRoot(h.env);
      h.area.data.set(UNLOCK_SESSION_KEY, '{"v":1,"src":"pin"}');
      h.area.data.set(CONSOLE_SESSION_KEY, '{}');
      h.restore();
      expect(h.area.data.has(UNLOCK_SESSION_KEY)).toBe(false);
      expect(h.area.data.has(CONSOLE_SESSION_KEY)).toBe(false);
    });

    it('a restore also forgets the fresh PIN of this tab (A-6 review: Back after a hand-off never skips the PIN)', () => {
      const h = withRestore('/');
      const forgetPin = vi.fn();
      h.env.forgetPin = forgetPin;
      bootRoot(h.env);
      expect(forgetPin).not.toHaveBeenCalled();
      h.restore();
      expect(forgetPin).toHaveBeenCalledTimes(1);
    });

    it('the bounce registers nothing', () => {
      const h = withRestore('/teach/zzz');
      bootRoot(h.env);
      expect(h.registered()).toBe(0);
    });

    it('listens for pageshow by default and acts only on a restore', () => {
      const listeners: Array<(event: { persisted?: boolean }) => void> = [];
      const area = memoryArea({ [UNLOCK_SESSION_KEY]: '{}' });
      vi.stubGlobal('location', { pathname: '/', search: '', hash: '', replace: vi.fn() });
      vi.stubGlobal('history', { state: null, replaceState: vi.fn() });
      vi.stubGlobal('sessionStorage', area);
      vi.stubGlobal('addEventListener', (type: string, listener: (event: { persisted?: boolean }) => void) => {
        if (type === 'pageshow') listeners.push(listener);
      });
      bootRoot();
      expect(listeners).toHaveLength(1);
      area.data.set(UNLOCK_SESSION_KEY, '{}');
      listeners[0]?.({ persisted: false });
      expect(area.data.has(UNLOCK_SESSION_KEY)).toBe(true);
      listeners[0]?.({ persisted: true });
      expect(area.data.has(UNLOCK_SESSION_KEY)).toBe(false);
    });

    it('by default a restore resets the in-memory fresh PIN and the parent gate session', () => {
      const listeners: Array<(event: { persisted?: boolean }) => void> = [];
      vi.stubGlobal('location', { pathname: '/', search: '', hash: '', replace: vi.fn() });
      vi.stubGlobal('history', { state: null, replaceState: vi.fn() });
      vi.stubGlobal('sessionStorage', memoryArea({}));
      vi.stubGlobal('addEventListener', (type: string, listener: (event: { persisted?: boolean }) => void) => {
        if (type === 'pageshow') listeners.push(listener);
      });
      bootRoot();
      useUiStore.setState({ lastPinVerifiedAt: Date.now(), parentGateOpenedAt: Date.now() });
      listeners[0]?.({ persisted: true });
      expect(useUiStore.getState().lastPinVerifiedAt).toBeNull();
      expect(useUiStore.getState().parentGateOpenedAt).toBeNull();
    });

    it('a window that throws on addEventListener still boots', () => {
      vi.stubGlobal('location', { pathname: '/', search: '', hash: '', replace: vi.fn() });
      vi.stubGlobal('history', { state: null, replaceState: vi.fn() });
      vi.stubGlobal('addEventListener', () => {
        throw new Error('no events');
      });
      expect(bootRoot()).toBe('app');
    });
  });

  it('blocked sessionStorage: the app still boots and nothing throws', () => {
    vi.stubGlobal('location', { pathname: '/', search: '', hash: '', replace: vi.fn() });
    vi.stubGlobal('history', { state: null, replaceState: vi.fn() });
    Object.defineProperty(globalThis, 'sessionStorage', {
      configurable: true,
      get() {
        throw new Error('SecurityError');
      },
    });
    try {
      expect(bootRoot()).toBe('app');
    } finally {
      delete (globalThis as { sessionStorage?: unknown }).sessionStorage;
    }
  });

  it('the bounce leaves even when telemetry never answers (the cap)', async () => {
    vi.useFakeTimers();
    try {
      const h = harness('/parent/zzz');
      h.env.track = () => new Promise(() => undefined);
      delete h.env.wait;
      expect(bootRoot(h.env)).toBe('grown-up-bounce');
      await vi.advanceTimersByTimeAsync(LEAVE_TELEMETRY_WAIT_MS);
      expect(h.log).toEqual(['replace /parent']);
    } finally {
      vi.useRealTimers();
    }
  });
});

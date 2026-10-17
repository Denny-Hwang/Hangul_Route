import { CONSOLE_SESSION_KEY, GrownUpUnlockSchema, UNLOCK_SESSION_KEY, type DeviceGateMarker } from '@hangul-route/content-schema';
import { afterEach, describe, expect, it, vi } from 'vitest';

// The default state reads the learner stores; their storage and locale wrappers are native modules here.
vi.mock('../storage', () => ({
  readJson: vi.fn(async () => null),
  readJsonStrict: vi.fn(async () => null),
  writeJson: vi.fn(async () => undefined),
  removeKey: vi.fn(async () => undefined),
}));
vi.mock('../locale', () => ({ deviceLanguages: () => [], takeLangHandoff: () => null, setDocumentLang: () => undefined }));

import * as native from '../grown-up-handoff';
import {
  LEAVE_TELEMETRY_WAIT_MS,
  clearGrownUpTab,
  continueToGrownUpPage,
  forgetFreshPin,
  openGrownUpArea,
  trackThenLeave,
  type HandoffEnv,
  type SessionArea,
} from '../grown-up-handoff.web';
import type { TelemetryEvent } from '../telemetry';
import { pinHashFingerprint } from '../../logic/shell/device-gate';
import { useAccountStore } from '../../store/account-store';
import { bindDeviceGateMarker } from '../../store/device-gate';
import { useLocaleStore } from '../../store/locale-store';
import { useProfileStore } from '../../store/profile-store';
import { useUiStore } from '../../store/ui-store';

/**
 * F-APP-001 section 3.9 (A-6): `openGrownUpArea` writes the PIN unlock with the marker epoch
 * into this tab's `sessionStorage` before it leaves, emits `shell.grown_up_handoff` and opens the
 * grown-up page in the same tab, always with `?lang=`, English included.
 */
const NOW = 1_760_100_000_000;

function memoryArea(initial: Record<string, string> = {}): SessionArea & { data: Map<string, string> } {
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

function blockedArea(): SessionArea {
  const fail = (): never => {
    throw new Error('SecurityError');
  };
  return { getItem: fail, setItem: fail, removeItem: fail };
}

interface Harness {
  env: HandoffEnv;
  area: ReturnType<typeof memoryArea>;
  log: string[];
  events: TelemetryEvent[];
}

function harness(state: { marker: DeviceGateMarker | null; lastPinVerifiedAt: number | null; locale?: 'en' | 'es' | 'ko' }, area = memoryArea()): Harness {
  const log: string[] = [];
  const events: TelemetryEvent[] = [];
  const env: HandoffEnv = {
    now: () => NOW,
    area: () => area,
    state: () => ({ marker: state.marker, lastPinVerifiedAt: state.lastPinVerifiedAt, locale: state.locale ?? 'en' }),
    track: async (event) => {
      log.push(`track ${event.name}`);
      events.push(event);
      return true;
    },
    assign: (url) => {
      log.push(`assign ${url}`);
      log.push(`unlock at leave: ${area.data.get(UNLOCK_SESSION_KEY) ?? 'none'}`);
    },
    wait: () => new Promise(() => undefined),
  };
  return { env, area, log, events };
}

const PIN = { v: 1, gate: 'pin', pinEpoch: 1_759_000_000_000 } as const;

describe('openGrownUpArea (web)', () => {
  it('marker pin with a fresh PIN: writes the PIN unlock with the epoch, then emits, then navigates', async () => {
    const h = harness({ marker: PIN, lastPinVerifiedAt: NOW - 119_000 });
    expect(await openGrownUpArea({ via: 'lock', target: '/parent' }, h.env)).toBe('opened');
    const stored = JSON.parse(h.area.data.get(UNLOCK_SESSION_KEY) ?? 'null');
    expect(stored).toEqual({ v: 1, at: NOW, seen: NOW, src: 'pin', pinEpoch: PIN.pinEpoch });
    expect(GrownUpUnlockSchema.safeParse(stored).success).toBe(true);
    expect(h.log).toEqual(['track shell.grown_up_handoff', 'assign /parent?lang=en', `unlock at leave: ${h.area.data.get(UNLOCK_SESSION_KEY)}`]);
    expect(h.events).toEqual([{ name: 'shell.grown_up_handoff', payload: { via: 'lock', target: 'next' } }]);
  });

  it('sends no profile id and only the two payload codes', async () => {
    const h = harness({ marker: PIN, lastPinVerifiedAt: NOW });
    await openGrownUpArea({ via: 'plan', target: '/account/billing' }, h.env);
    expect(h.events).toEqual([{ name: 'shell.grown_up_handoff', payload: { via: 'plan', target: 'billing' } }]);
    expect('profileId' in (h.events[0] ?? {})).toBe(false);
  });

  it('marker pin without a fresh PIN: asks for the PIN, writes nothing, emits nothing, stays', async () => {
    for (const lastPinVerifiedAt of [null, NOW - 120_000, NOW - 600_000]) {
      const h = harness({ marker: PIN, lastPinVerifiedAt });
      expect(await openGrownUpArea({ via: 'dashboard' }, h.env)).toBe('pin');
      expect(h.area.data.size).toBe(0);
      expect(h.log).toEqual([]);
    }
  });

  it('marker none: no unlock is needed; opens the sign-in router', async () => {
    const h = harness({ marker: { v: 1, gate: 'none' }, lastPinVerifiedAt: null });
    expect(await openGrownUpArea({ via: 'profile' }, h.env)).toBe('opened');
    expect(h.area.data.has(UNLOCK_SESSION_KEY)).toBe(false);
    expect(h.log.slice(0, 2)).toEqual(['track shell.grown_up_handoff', 'assign /signin?lang=en']);
    expect(h.events[0]?.payload).toEqual({ via: 'profile', target: 'router' });
  });

  it('marker nopin: writes nothing and navigates (the console lock asks for a sign-in)', async () => {
    const h = harness({ marker: { v: 1, gate: 'nopin' }, lastPinVerifiedAt: NOW });
    expect(await openGrownUpArea({ via: 'lock', target: '/teach/home' }, h.env)).toBe('opened');
    expect(h.area.data.has(UNLOCK_SESSION_KEY)).toBe(false);
    expect(h.log[1]).toBe('assign /teach/home?lang=en');
  });

  it('an unknown device state (stores not loaded) writes no unlock and lets the console decide', async () => {
    const h = harness({ marker: null, lastPinVerifiedAt: NOW });
    expect(await openGrownUpArea({ via: 'lock', target: '/parent' }, h.env)).toBe('opened');
    expect(h.area.data.has(UNLOCK_SESSION_KEY)).toBe(false);
    expect(h.log[1]).toBe('assign /parent?lang=en');
  });

  it('appends lang for every UI locale', async () => {
    const h = harness({ marker: PIN, lastPinVerifiedAt: NOW, locale: 'es' });
    await openGrownUpArea({ via: 'lock', target: '/teach/space?id=sp_1' }, h.env);
    expect(h.log[1]).toBe('assign /teach/space?id=sp_1&lang=es');
    const k = harness({ marker: { v: 1, gate: 'none' }, lastPinVerifiedAt: null, locale: 'ko' });
    await openGrownUpArea({ via: 'profile' }, k.env);
    expect(k.log[1]).toBe('assign /signin?lang=ko');
  });

  it('a target that is not a grown-up path never leaves for it: the sign-in router instead', async () => {
    for (const target of ['https://evil.example/', '//evil.example', '/', '/browse', 'javascript:alert(1)']) {
      const h = harness({ marker: PIN, lastPinVerifiedAt: NOW });
      await openGrownUpArea({ via: 'lock', target }, h.env);
      expect(h.log[1], target).toBe('assign /signin?lang=en');
      expect(h.events[0]?.payload, target).toEqual({ via: 'lock', target: 'router' });
    }
  });

  it('blocked storage: no unlock can be written, and the tab still goes (the console then asks for a sign-in)', async () => {
    const h = harness({ marker: PIN, lastPinVerifiedAt: NOW });
    h.env.area = () => blockedArea();
    expect(await openGrownUpArea({ via: 'lock', target: '/parent' }, h.env)).toBe('opened');
    expect(h.log[1]).toBe('assign /parent?lang=en');
  });

  it('a storage getter that throws counts as blocked storage', async () => {
    const h = harness({ marker: PIN, lastPinVerifiedAt: NOW });
    h.env.area = () => {
      throw new Error('SecurityError');
    };
    expect(await openGrownUpArea({ via: 'lock', target: '/parent' }, h.env)).toBe('opened');
    expect(h.log[1]).toBe('assign /parent?lang=en');
  });
});

describe('trackThenLeave', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  const event: TelemetryEvent = { name: 'shell.path_bounced', payload: { prefix: 'teach' } };

  it('leaves as soon as the event is sent', async () => {
    const leave = vi.fn();
    await trackThenLeave(event, leave, { track: async () => true, wait: () => new Promise(() => undefined) });
    expect(leave).toHaveBeenCalledTimes(1);
  });

  it('never waits longer than the cap for a slow network', async () => {
    vi.useFakeTimers();
    const leave = vi.fn();
    const done = trackThenLeave(event, leave, { track: () => new Promise(() => undefined) });
    await vi.advanceTimersByTimeAsync(LEAVE_TELEMETRY_WAIT_MS - 1);
    expect(leave).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    await done;
    expect(leave).toHaveBeenCalledTimes(1);
    expect(LEAVE_TELEMETRY_WAIT_MS).toBeLessThanOrEqual(1500);
  });

  it('leaves even when sending fails', async () => {
    const leave = vi.fn();
    await trackThenLeave(event, leave, { track: async () => Promise.reject(new Error('boom')), wait: () => new Promise(() => undefined) });
    expect(leave).toHaveBeenCalledTimes(1);
  });
});

describe('forgetFreshPin', () => {
  it('resets the fresh-PIN time and the parent gate session, and nothing else', () => {
    useUiStore.setState({ lastPinVerifiedAt: 5, parentGateOpenedAt: 6, hapticsOn: false });
    forgetFreshPin();
    expect(useUiStore.getState().lastPinVerifiedAt).toBeNull();
    expect(useUiStore.getState().parentGateOpenedAt).toBeNull();
    expect(useUiStore.getState().hapticsOn).toBe(false);
    useUiStore.setState({ hapticsOn: true });
  });
});

describe('clearGrownUpTab', () => {
  it('removes the unlock, the console session and the All lessons pass of this tab, nothing else', () => {
    const area = memoryArea({ [UNLOCK_SESSION_KEY]: '{}', [CONSOLE_SESSION_KEY]: '{}', 'hr:browse:pass': '{}', other: 'x' });
    clearGrownUpTab(area);
    // A device handed back after Close or Back cannot reopen All lessons from this tab (F-BROWSE-001 section 4.3, BR-6 review).
    expect([...area.data.keys()].sort()).toEqual(['other']);
  });

  it('never throws on blocked or missing storage', () => {
    expect(() => clearGrownUpTab(blockedArea())).not.toThrow();
    expect(() => clearGrownUpTab(null)).not.toThrow();
  });

  it('reads the real sessionStorage by default, and a missing one is a no-op', () => {
    const area = memoryArea({ [UNLOCK_SESSION_KEY]: '{}' });
    vi.stubGlobal('sessionStorage', area);
    try {
      clearGrownUpTab();
      expect(area.data.size).toBe(0);
    } finally {
      vi.unstubAllGlobals();
    }
    vi.stubGlobal('sessionStorage', undefined);
    try {
      expect(() => clearGrownUpTab()).not.toThrow();
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

describe('continueToGrownUpPage (the PIN screen with no PIN stored)', () => {
  it('opens the waiting grown-up page, writing nothing', () => {
    const assign = vi.fn();
    const area = memoryArea();
    vi.stubGlobal('sessionStorage', area);
    try {
      continueToGrownUpPage('/parent', 'en', assign);
    } finally {
      vi.unstubAllGlobals();
    }
    expect(assign).toHaveBeenCalledWith('/parent?lang=en');
    expect(area.data.size).toBe(0);
  });

  it('opens the sign-in router without a page, or for a page that is not a grown-up path', () => {
    for (const target of [undefined, null, '', 'https://evil.example', '/']) {
      const assign = vi.fn();
      continueToGrownUpPage(target, 'en', assign);
      expect(assign, String(target)).toHaveBeenCalledWith('/signin?lang=en');
    }
  });

  it('carries the UI locale like the hand-off does', () => {
    const assign = vi.fn();
    continueToGrownUpPage('/teach/space?id=sp_1', 'ko', assign);
    expect(assign).toHaveBeenCalledWith('/teach/space?id=sp_1&lang=ko');
    continueToGrownUpPage(null, 'es', assign);
    expect(assign).toHaveBeenLastCalledWith('/signin?lang=es');
  });

  it('uses location.assign by default', () => {
    const assign = vi.fn();
    vi.stubGlobal('location', { assign });
    try {
      continueToGrownUpPage('/parent', 'en');
    } finally {
      vi.unstubAllGlobals();
    }
    expect(assign).toHaveBeenCalledWith('/parent?lang=en');
  });
});

describe('native stub', () => {
  it('openGrownUpArea throws: native builds have no grown-up entry (OD-6)', async () => {
    await expect(native.openGrownUpArea({ via: 'profile' })).rejects.toThrow(/web only/);
    expect(() => native.continueToGrownUpPage('/parent', 'en')).toThrow(/web only/);
  });

  it('clearGrownUpTab is a no-op (no sessionStorage on native)', () => {
    expect(() => native.clearGrownUpTab()).not.toThrow();
  });
});

describe('openGrownUpArea with the default env (the learner stores and the browser)', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    useUiStore.setState({ lastPinVerifiedAt: null });
    useProfileStore.setState({ profiles: [], activeId: null, hydrated: false });
    useAccountStore.setState({ parentPinHash: null, pinSetAt: null, pinHashSeen: null, hydrated: false });
  });

  it('reads the marker the writer computed, the PIN time and the UI locale; writes this tab; leaves', async () => {
    useLocaleStore.setState({ detected: 'en', device: null, byProfile: {} });
    useProfileStore.setState({
      profiles: [{ id: 'profile:a', displayName: 'A', ageGroup: '8-9', avatar: 'hoya-orange', role: 'learner', createdAt: '2026-10-01T00:00:00.000Z' }],
      activeId: 'profile:a',
      hydrated: true,
    });
    useAccountStore.setState({ parentPinHash: 'salt:hash', pinSetAt: 1_759_000_000_000, pinHashSeen: pinHashFingerprint('salt:hash'), hydrated: true });
    const unbind = bindDeviceGateMarker();
    const area = memoryArea();
    const assign = vi.fn();
    vi.stubGlobal('sessionStorage', area);
    vi.stubGlobal('location', { assign });
    try {
      expect(await openGrownUpArea({ via: 'lock', target: '/parent' })).toBe('pin');
      useUiStore.getState().markPinVerified();
      expect(await openGrownUpArea({ via: 'lock', target: '/parent' })).toBe('opened');
    } finally {
      unbind();
    }
    expect(JSON.parse(area.data.get(UNLOCK_SESSION_KEY) ?? 'null')).toMatchObject({ v: 1, src: 'pin', pinEpoch: 1_759_000_000_000 });
    expect(assign).toHaveBeenCalledWith('/parent?lang=en');
  });
});

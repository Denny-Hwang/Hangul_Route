import { BROWSE_KEEP_MS, type BrowseKeptPass, type BrowsePass } from '@hangul-route/content-schema';
import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * F-BROWSE-001 section 4.3, Keep on this device (OD-4, BR-7): the switch keeps
 * only a pass that is still active, writes `browse:pass` and `browse:prefs`,
 * asks for persistent storage once, and switching it off removes both keys.
 * The Lesson display settings are written only while the switch is on.
 */
const store = new Map<string, unknown>();
let session: BrowsePass | null = null;
let persistAsked = 0;

vi.mock('../storage', () => ({
  readJson: vi.fn(async (key: string) => (store.has(key) ? store.get(key) : null)),
  writeJson: vi.fn(async (key: string, value: unknown) => {
    store.set(key, value);
  }),
  removeKey: vi.fn(async (key: string) => {
    store.delete(key);
  }),
  requestPersistence: vi.fn(async () => {
    persistAsked += 1;
    return true;
  }),
}));
vi.mock('../browse', () => ({
  readSessionPass: () => session,
  removeSessionPass: () => undefined,
}));
vi.mock('../shell-store', () => ({ readLastPersona: async () => null }));

const { keepOff, keepOn, readKeepState, savePrefs } = await import('../browse-keep');
const { BROWSE_KEPT_PASS_KEY, BROWSE_PREFS_KEY } = await import('../browse-boot');

const T0 = Date.parse('2026-10-12T09:00:00.000Z');
const HOUR = 60 * 60_000;
const account = (over: Partial<BrowsePass> = {}): BrowsePass => ({ v: 1, scope: 'full', source: 'account', issuedAt: T0, seen: T0, ...over });
const kept = (over: Partial<BrowseKeptPass> = {}): BrowseKeptPass => ({ v: 1, scope: 'full', keptAt: T0, ...over });

beforeEach(() => {
  store.clear();
  session = null;
});

describe('keepOn', () => {
  it('keeps an active account pass for 7 days from now, with the Lesson display settings, and asks for persistence once', async () => {
    session = account({ scope: 'sampler' });
    const before = persistAsked;
    expect(await keepOn(T0 + HOUR, { v: 1, romanization: 'tap' })).toBe(true);
    expect(store.get(BROWSE_KEPT_PASS_KEY)).toEqual({ v: 1, scope: 'sampler', keptAt: T0 + HOUR });
    expect(store.get(BROWSE_PREFS_KEY)).toEqual({ v: 1, romanization: 'tap' });
    expect(await keepOn(T0 + 2 * HOUR, { v: 1, romanization: 'always' })).toBe(true);
    expect(persistAsked - before).toBe(1);
  });

  it('keeps nothing for a gate pass, a fallback pass, a pass that ran out, or no pass', async () => {
    for (const s of [account({ source: 'gate' }), account({ fallback: true, scope: 'sampler' }), account(), null]) {
      session = s;
      const now = s && s.source === 'account' && !s.fallback ? T0 + 12 * HOUR : T0;
      expect(await keepOn(now, { v: 1, romanization: 'always' }), JSON.stringify(s)).toBe(false);
      expect(store.size).toBe(0);
    }
  });
});

describe('keepOff', () => {
  it('removes the kept pass and its settings', async () => {
    store.set(BROWSE_KEPT_PASS_KEY, kept());
    store.set(BROWSE_PREFS_KEY, { v: 1, romanization: 'tap' });
    await keepOff();
    expect(store.size).toBe(0);
  });
});

describe('readKeepState', () => {
  it('on, with the settings, while a kept pass is active', async () => {
    store.set(BROWSE_KEPT_PASS_KEY, kept());
    store.set(BROWSE_PREFS_KEY, { v: 1, romanization: 'tap', uiLocale: 'es' });
    expect(await readKeepState(T0 + HOUR)).toEqual({ kept: true, prefs: { v: 1, romanization: 'tap', uiLocale: 'es' } });
  });

  it('on with no settings when they are missing; corrupt settings are removed', async () => {
    store.set(BROWSE_KEPT_PASS_KEY, kept());
    expect(await readKeepState(T0)).toEqual({ kept: true, prefs: null });
    store.set(BROWSE_PREFS_KEY, { v: 1, romanization: 'tap', learnerId: 'x' });
    expect(await readKeepState(T0)).toEqual({ kept: true, prefs: null });
    expect(store.has(BROWSE_PREFS_KEY)).toBe(false);
    expect(store.has(BROWSE_KEPT_PASS_KEY)).toBe(true);
  });

  it('off, reading no settings, without a kept pass or once it ran out (an expired one is removed)', async () => {
    store.set(BROWSE_PREFS_KEY, { v: 1, romanization: 'tap' });
    expect(await readKeepState(T0)).toEqual({ kept: false, prefs: null });
    store.set(BROWSE_KEPT_PASS_KEY, kept());
    expect(await readKeepState(T0 + BROWSE_KEEP_MS)).toEqual({ kept: false, prefs: null });
    expect(store.size).toBe(0);
  });
});

describe('savePrefs', () => {
  it('writes the settings only while the switch is on', async () => {
    await savePrefs(false, { v: 1, romanization: 'tap' });
    expect(store.has(BROWSE_PREFS_KEY)).toBe(false);
    await savePrefs(true, { v: 1, romanization: 'tap' });
    expect(store.get(BROWSE_PREFS_KEY)).toEqual({ v: 1, romanization: 'tap' });
  });

  it('a refusing store never throws', async () => {
    const storage = await import('../storage');
    vi.mocked(storage.writeJson).mockRejectedValueOnce(new Error('quota'));
    await expect(savePrefs(true, { v: 1, romanization: 'tap' })).resolves.toBeUndefined();
    session = account();
    vi.mocked(storage.writeJson).mockRejectedValueOnce(new Error('quota'));
    expect(await keepOn(T0, { v: 1, romanization: 'always' })).toBe(false);
  });
});

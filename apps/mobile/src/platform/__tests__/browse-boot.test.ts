import { BROWSE_KEEP_MS, type BrowseKeptPass, type BrowsePass } from '@hangul-route/content-schema';
import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * F-BROWSE-001 section 4.3 (BR-6): the browse root resolves its pass at boot.
 * An active session pass is read synchronously, before first paint, and
 * decides alone; without one the kept pass (IndexedDB `browse:pass`) and the
 * last persona are read, and whatever `resolvePass` names for removal is
 * removed. Corrupt values read as absent and are removed (section 5.3).
 */
const store = new Map<string, unknown>();
const removed: string[] = [];
let session: BrowsePass | null = null;
let sessionRemoved = 0;
let persona: 'parent' | 'teacher' | null = null;
let personaReads = 0;
let hangPersona = false;

vi.mock('../storage', () => ({
  readJson: vi.fn(async (key: string) => (store.has(key) ? store.get(key) : null)),
  removeKey: vi.fn(async (key: string) => {
    removed.push(key);
    store.delete(key);
  }),
}));
vi.mock('../browse', () => ({
  readSessionPass: () => session,
  removeSessionPass: () => {
    sessionRemoved += 1;
    session = null;
  },
  writeSessionPass: (pass: BrowsePass) => {
    session = pass;
    return true;
  },
}));
vi.mock('../shell-store', () => ({
  readLastPersona: () => {
    personaReads += 1;
    return hangPersona ? new Promise<never>(() => undefined) : Promise.resolve(persona);
  },
}));

const { BOOT_READ_TIMEOUT_MS, BROWSE_KEPT_PASS_KEY, BROWSE_PREFS_KEY, readKeptPass, removeKeptPass, resolveBrowseBoot, resolveSessionNow } = await import('../browse-boot');

const T0 = Date.parse('2026-10-12T09:00:00.000Z');
const MIN = 60_000;
const gate = (over: Partial<BrowsePass> = {}): BrowsePass => ({ v: 1, scope: 'full', source: 'gate', issuedAt: T0, seen: T0, ...over });
const account = (over: Partial<BrowsePass> = {}): BrowsePass => ({ v: 1, scope: 'sampler', source: 'account', issuedAt: T0, seen: T0, uiLocale: 'es', ...over });
const kept = (over: Partial<BrowseKeptPass> = {}): BrowseKeptPass => ({ v: 1, scope: 'full', keptAt: T0, ...over });

beforeEach(() => {
  store.clear();
  removed.length = 0;
  session = null;
  sessionRemoved = 0;
  persona = null;
  personaReads = 0;
  hangPersona = false;
  vi.useRealTimers();
});

describe('keys', () => {
  it('the kept pass and Lesson display settings live under browse:* only', () => {
    expect(BROWSE_KEPT_PASS_KEY).toBe('browse:pass');
    expect(BROWSE_PREFS_KEY).toBe('browse:prefs');
  });
});

describe('resolveSessionNow (synchronous, before first paint)', () => {
  it('an active session pass decides alone; the kept pass is not read', () => {
    session = gate();
    expect(resolveSessionNow(T0 + 5 * MIN)).toEqual({
      session: gate(),
      resolved: { status: 'active', scope: 'full', from: 'gate', fallback: false, removeSession: false, removeKept: false },
    });
    session = account();
    expect(resolveSessionNow(T0)?.resolved).toEqual({ status: 'active', scope: 'sampler', from: 'account', fallback: false, uiLocale: 'es', removeSession: false, removeKept: false });
  });

  it('no session pass, or one that ran out: the kept pass must be read first (null)', () => {
    expect(resolveSessionNow(T0)).toBeNull();
    session = gate();
    expect(resolveSessionNow(T0 + 15 * MIN)).toBeNull();
  });
});

describe('readKeptPass and removeKeptPass', () => {
  it('reads a valid kept pass', async () => {
    store.set(BROWSE_KEPT_PASS_KEY, kept());
    expect(await readKeptPass()).toEqual(kept());
    expect(removed).toEqual([]);
  });

  it('a corrupt or foreign value reads as absent and is removed with the settings', async () => {
    for (const value of [{ v: 2, scope: 'full', keptAt: T0 }, { v: 1, scope: 'full', keptAt: T0, accountId: 'acc_1' }, 'x', 7]) {
      store.set(BROWSE_KEPT_PASS_KEY, value);
      store.set(BROWSE_PREFS_KEY, { v: 1, romanization: 'tap' });
      removed.length = 0;
      expect(await readKeptPass()).toBeNull();
      expect(removed.sort()).toEqual([BROWSE_KEPT_PASS_KEY, BROWSE_PREFS_KEY]);
    }
  });

  it('nothing kept: nothing removed', async () => {
    expect(await readKeptPass()).toBeNull();
    expect(removed).toEqual([]);
  });

  it('removeKeptPass removes both keys', async () => {
    await removeKeptPass();
    expect(removed).toEqual([BROWSE_KEPT_PASS_KEY, BROWSE_PREFS_KEY]);
  });
});

describe('resolveBrowseBoot', () => {
  it('an active session pass: kept pass untouched, the persona read for Close', async () => {
    session = account();
    persona = 'teacher';
    store.set(BROWSE_KEPT_PASS_KEY, kept());
    const boot = await resolveBrowseBoot(T0);
    expect(boot.resolved).toMatchObject({ status: 'active', from: 'account', scope: 'sampler' });
    expect(boot.session).toEqual(account());
    expect(boot.lastPersona).toBe('teacher');
    expect(removed).toEqual([]);
    expect(sessionRemoved).toBe(0);
  });

  it('an expired session pass gives way to an active kept pass and is removed (a restored tab gets in as a new one)', async () => {
    session = gate();
    store.set(BROWSE_KEPT_PASS_KEY, kept({ scope: 'sampler', keptAt: T0 - MIN }));
    const boot = await resolveBrowseBoot(T0 + 20 * MIN);
    expect(boot.resolved).toEqual({ status: 'active', scope: 'sampler', from: 'kept', fallback: false, removeSession: true, removeKept: false });
    expect(boot.session).toBeNull();
    expect(sessionRemoved).toBe(1);
    expect(removed).toEqual([]);
  });

  it('a kept pass alone (a new tab) opens; no session pass is written', async () => {
    store.set(BROWSE_KEPT_PASS_KEY, kept());
    const boot = await resolveBrowseBoot(T0 + 6 * 24 * 60 * MIN);
    expect(boot.resolved).toMatchObject({ status: 'active', from: 'kept' });
    expect(session).toBeNull();
  });

  it('an expired kept pass is removed on read; the Access screen gets the account source', async () => {
    store.set(BROWSE_KEPT_PASS_KEY, kept());
    store.set(BROWSE_PREFS_KEY, { v: 1, romanization: 'always' });
    const boot = await resolveBrowseBoot(T0 + BROWSE_KEEP_MS);
    expect(boot.resolved).toEqual({ status: 'none', reason: 'expired', expiredSource: 'account', removeSession: false, removeKept: true });
    expect(removed.sort()).toEqual([BROWSE_KEPT_PASS_KEY, BROWSE_PREFS_KEY]);
  });

  it('an expired session pass with no kept pass stays, for the Access screen source', async () => {
    session = gate();
    const boot = await resolveBrowseBoot(T0 + 15 * MIN);
    expect(boot.resolved).toEqual({ status: 'none', reason: 'expired', expiredSource: 'gate', removeSession: false, removeKept: false });
    expect(boot.session).toEqual(gate());
    expect(sessionRemoved).toBe(0);
  });

  it('no pass at all: none, and the last persona decides between the account and unknown Access forms', async () => {
    persona = 'parent';
    const boot = await resolveBrowseBoot(T0);
    expect(boot.resolved).toEqual({ status: 'none', reason: 'none', expiredSource: null, removeSession: false, removeKept: false });
    expect(boot.lastPersona).toBe('parent');
    expect(personaReads).toBe(1);
  });

  it('a removal that fails never blocks the boot', async () => {
    const storage = await import('../storage');
    vi.mocked(storage.removeKey).mockRejectedValueOnce(new Error('quota'));
    store.set(BROWSE_KEPT_PASS_KEY, kept());
    const boot = await resolveBrowseBoot(T0 + BROWSE_KEEP_MS + 1);
    expect(boot.resolved.status).toBe('none');
  });

  it('a kept pass read that fails reads as no kept pass', async () => {
    const storage = await import('../storage');
    vi.mocked(storage.readJson).mockRejectedValueOnce(new Error('closed'));
    const boot = await resolveBrowseBoot(T0);
    expect(boot.resolved.status).toBe('none');
  });

  it('a store that never answers (a blocked IndexedDB open) reads as nothing kept and no persona, so Access shows instead of a blank page', async () => {
    vi.useFakeTimers();
    const storage = await import('../storage');
    vi.mocked(storage.readJson).mockImplementationOnce(() => new Promise<never>(() => undefined));
    hangPersona = true;
    persona = 'teacher';
    let done: Awaited<ReturnType<typeof resolveBrowseBoot>> | null = null;
    void resolveBrowseBoot(T0).then((boot) => {
      done = boot;
    });
    await vi.advanceTimersByTimeAsync(BOOT_READ_TIMEOUT_MS - 1);
    expect(done).toBeNull();
    await vi.advanceTimersByTimeAsync(1);
    expect(done).toEqual({ session: null, resolved: { status: 'none', reason: 'none', expiredSource: null, removeSession: false, removeKept: false }, lastPersona: null });
  });

  it('an active session pass never waits on a persona read that hangs', async () => {
    vi.useFakeTimers();
    session = gate();
    hangPersona = true;
    const pending = resolveBrowseBoot(T0);
    await vi.advanceTimersByTimeAsync(BOOT_READ_TIMEOUT_MS);
    expect((await pending).lastPersona).toBeNull();
  });
});

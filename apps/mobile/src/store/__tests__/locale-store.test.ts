import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mem = vi.hoisted(() => new Map<string, unknown>());
const storage = vi.hoisted(() => ({ failReads: false, failStrictReads: false, strictReadFailures: 0, failWrites: false, writeFails: [] as string[] }));
/** A strict read that fails: every one while `failStrictReads`, else the next `strictReadFailures`. */
const strictReadFails = (): boolean => {
  if (storage.failReads || storage.failStrictReads) return true;
  if (storage.strictReadFailures === 0) return false;
  storage.strictReadFailures -= 1;
  return true;
};
vi.mock('../../platform/storage', () => ({
  readJson: vi.fn(async (k: string) => {
    if (storage.failReads) return null;
    return mem.get(k) ?? null;
  }),
  readJsonStrict: vi.fn(async (k: string) => {
    if (strictReadFails()) throw new Error('closed');
    return mem.get(k) ?? null;
  }),
  // One step, as one IndexedDB transaction: nothing runs between the read and the write.
  updateJson: vi.fn(async (k: string, next: (current: unknown) => unknown) => {
    await Promise.resolve();
    if (strictReadFails()) throw new Error('closed');
    const value = next(mem.get(k) ?? null);
    if (value === undefined) return false;
    if (storage.failWrites || storage.writeFails.includes(k)) throw new Error('quota');
    mem.set(k, value);
    return true;
  }),
  writeJson: vi.fn(async (k: string, v: unknown) => {
    if (storage.failWrites || storage.writeFails.includes(k)) throw new Error('quota');
    mem.set(k, v);
  }),
  removeKey: vi.fn(async (k: string) => {
    mem.delete(k);
  }),
}));
const track = vi.hoisted(() => vi.fn(async () => true));
vi.mock('../../platform/telemetry', () => ({ track }));
const platform = vi.hoisted(() => ({ languages: [] as string[], handoff: null as string | null }));
const posted = vi.hoisted(() => [] as unknown[]);
const subscription = vi.hoisted(() => ({ onRecord: null as ((v: unknown) => void) | null, onReturn: null as (() => void) | null, stopped: 0 }));
vi.mock('../../platform/prefs-channel', () => ({
  postDeviceSettings: (value: unknown) => posted.push(value),
  subscribeDeviceSettings: (onRecord: (v: unknown) => void, onReturn: () => void) => {
    subscription.onRecord = onRecord;
    subscription.onReturn = onReturn;
    return () => {
      subscription.stopped += 1;
    };
  },
}));
vi.mock('../../platform/locale', () => ({
  deviceLanguages: () => platform.languages,
  takeLangHandoff: () => platform.handoff,
  setDocumentLang: vi.fn(),
}));

// es and ko ship (F-I18N-001 rows 15b / 16b), so nothing is hidden in the real `LOCALE_STATUS`. A fixture keeps
// the hidden-locale paths tested: here es and ko stand in for a locale that has not shipped, available only
// with the QA flag (F-I18N-001 §3.1), the way a future locale starts.
vi.mock('@hangul-route/i18n', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@hangul-route/i18n')>();
  const availableLocales = (showAll: boolean = actual.showAllLocalesEnabled()): import('@hangul-route/i18n').UiLocale[] =>
    showAll ? [...actual.LOCALES] : ['en'];
  return {
    ...actual,
    availableLocales,
    detectLocale: (languages: readonly string[], available = availableLocales()) => actual.detectLocale(languages, available),
  };
});

import { MIGRATED_AT, activeLocale, deviceChose, detectInitialLocale, followDeviceSettings, useLocaleStore } from '../locale-store';
import * as storageModule from '../../platform/storage';
import { useProfileStore } from '../profile-store';

// The fixture's hidden locales (es, ko) are only available when the QA flag is set.
const showAll = (on: boolean): void => {
  if (on) process.env.EXPO_PUBLIC_SHOW_ALL_LOCALES = '1';
  else delete process.env.EXPO_PUBLIC_SHOW_ALL_LOCALES;
};

const reset = (): void => {
  mem.clear();
  posted.length = 0;
  storage.failReads = false;
  storage.failStrictReads = false;
  storage.strictReadFailures = 0;
  storage.failWrites = false;
  storage.writeFails = [];
  platform.handoff = null;
  showAll(true);
  track.mockClear();
  useLocaleStore.setState({ detected: 'en', device: null, deviceAt: null, textSize: 'standard', byProfile: {}, hydrated: false });
};

/** The device record writes read the stored record first, so they land a few ticks later. */
const settle = async (): Promise<void> => {
  for (let i = 0; i < 5; i += 1) await Promise.resolve();
};

const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

afterAll(() => showAll(false));

describe('locale-store: detection at creation', () => {
  beforeEach(reset);

  it('detectInitialLocale reads the platform languages and skips hidden locales', () => {
    platform.languages = ['es-MX', 'en'];
    expect(detectInitialLocale()).toBe('es');
    showAll(false);
    expect(detectInitialLocale()).toBe('en');
    showAll(true);
    platform.languages = [];
    expect(detectInitialLocale()).toBe('en');
  });
});

describe('locale-store: resolution (one UI language per device)', () => {
  beforeEach(reset);

  it('device record > detected > en, the same for every profile', () => {
    useLocaleStore.setState({ detected: 'es', device: 'ko', byProfile: { 'profile:a': { romanizationMode: 'always' } } });
    expect(activeLocale(useLocaleStore.getState())).toBe('ko');
    expect(deviceChose(useLocaleStore.getState())).toBe(true);
    useLocaleStore.setState({ device: null });
    expect(activeLocale(useLocaleStore.getState())).toBe('es');
    expect(deviceChose(useLocaleStore.getState())).toBe(false);
    useLocaleStore.setState({ detected: 'en' });
    expect(activeLocale(useLocaleStore.getState())).toBe('en');
  });

  it('detection is a default, not a choice: device stays null', () => {
    useLocaleStore.setState({ detected: 'es' });
    const s = useLocaleStore.getState();
    expect(s.device).toBeNull();
    expect(activeLocale(s)).toBe('es');
  });

  it('there is no per-profile override and no tab-only session override any more', () => {
    const s = useLocaleStore.getState() as unknown as Record<string, unknown>;
    expect('setProfileLocale' in s).toBe(false);
    expect('setSessionLocale' in s).toBe(false);
    expect('session' in s).toBe(false);
  });
});

describe('locale-store: hydrate', () => {
  beforeEach(reset);

  it('loads the device record (language, its time, text size) and every profile setting', async () => {
    mem.set('device:settings', { uiLocale: 'ko', uiLocaleAt: '2026-10-16T09:00:00.000Z', textSize: 'larger' });
    mem.set('settings:profile:a', { romanizationMode: 'tap' });
    await useLocaleStore.getState().hydrate(['profile:a', 'profile:b']);
    const s = useLocaleStore.getState();
    expect(s).toMatchObject({ hydrated: true, device: 'ko', deviceAt: '2026-10-16T09:00:00.000Z', textSize: 'larger' });
    expect(s.byProfile['profile:a']).toEqual({ romanizationMode: 'tap' });
    expect(s.byProfile['profile:b']).toBeUndefined();
  });

  it('a record stored before the new fields parses unchanged: no time, standard text', async () => {
    mem.set('device:settings', { uiLocale: 'es' });
    await useLocaleStore.getState().hydrate([]);
    expect(useLocaleStore.getState()).toMatchObject({ device: 'es', deviceAt: null, textSize: 'standard' });
    expect(mem.get('device:settings')).toEqual({ uiLocale: 'es' });
  });

  it('ignores a value that fails to parse and starts normally', async () => {
    mem.set('device:settings', { uiLocale: 'fr' });
    mem.set('settings:profile:a', 'not an object');
    mem.set('settings:profile:b', { uiLocale: 'zz' });
    await useLocaleStore.getState().hydrate(['profile:a', 'profile:b']);
    const s = useLocaleStore.getState();
    expect(s).toMatchObject({ hydrated: true, device: null, textSize: 'standard', byProfile: {} });
  });

  it('applies the default romanization mode to a stored profile without one', async () => {
    mem.set('settings:profile:a', { readToMe: true });
    await useLocaleStore.getState().hydrate(['profile:a']);
    expect(useLocaleStore.getState().byProfile['profile:a']).toEqual({ romanizationMode: 'always', readToMe: true });
  });

  it('survives storage that cannot be read (private mode): detection applies, nothing persisted', async () => {
    storage.failReads = true;
    useLocaleStore.setState({ detected: 'es' });
    await useLocaleStore.getState().hydrate(['profile:a']);
    await settle();
    const s = useLocaleStore.getState();
    expect(s.hydrated).toBe(true);
    expect(s.device).toBeNull();
    expect(activeLocale(s)).toBe('es');
    expect(mem.size).toBe(0);
  });

  it('?lang= seeds a device that never chose, stamped 1970 so an account choice beats it (AMENDMENTS-DISPLAY-NAV section 3.4)', async () => {
    platform.handoff = 'ko';
    await useLocaleStore.getState().hydrate([]);
    await settle();
    expect(useLocaleStore.getState()).toMatchObject({ device: 'ko', deviceAt: MIGRATED_AT });
    expect(mem.get('device:settings')).toEqual({ uiLocale: 'ko', uiLocaleAt: MIGRATED_AT });
    expect(posted).toEqual([mem.get('device:settings')]);
    expect(track).toHaveBeenCalledWith({
      name: 'locale.changed',
      payload: { from: 'en', to: 'ko', scope: 'device', source: 'handoff' },
    });
  });

  it('?lang= never overrides a stored device choice', async () => {
    mem.set('device:settings', { uiLocale: 'en', uiLocaleAt: '2026-10-16T09:00:00.000Z' });
    platform.handoff = 'ko';
    await useLocaleStore.getState().hydrate([]);
    await settle();
    expect(useLocaleStore.getState().device).toBe('en');
    expect(mem.get('device:settings')).toEqual({ uiLocale: 'en', uiLocaleAt: '2026-10-16T09:00:00.000Z' });
    expect(track).not.toHaveBeenCalled();
  });

  it("with handoff 'ignore' (the presenter), ?lang= is taken out of the address and never used or stored", async () => {
    platform.handoff = 'ko';
    await useLocaleStore.getState().hydrate([], { handoff: 'ignore' });
    await settle();
    expect(useLocaleStore.getState().device).toBeNull();
    expect(mem.has('device:settings')).toBe(false);
    expect(track).not.toHaveBeenCalled();
  });

  it('a seed keeps the text size already stored', async () => {
    mem.set('device:settings', { textSize: 'largest' });
    platform.handoff = 'es';
    await useLocaleStore.getState().hydrate([]);
    await settle();
    expect(mem.get('device:settings')).toEqual({ textSize: 'largest', uiLocale: 'es', uiLocaleAt: MIGRATED_AT });
  });

  it('a ?lang= on a record the first read could not see changes nothing stored and shows the stored choice', async () => {
    mem.set('device:settings', { uiLocale: 'ko', uiLocaleAt: '2026-10-16T09:00:00.000Z', textSize: 'large' });
    storage.strictReadFailures = 1;
    platform.handoff = 'es';
    await useLocaleStore.getState().hydrate([]);
    await settle();
    expect(mem.get('device:settings')).toEqual({ uiLocale: 'ko', uiLocaleAt: '2026-10-16T09:00:00.000Z', textSize: 'large' });
    expect(useLocaleStore.getState()).toMatchObject({ device: 'ko', deviceAt: '2026-10-16T09:00:00.000Z', textSize: 'large' });
    expect(posted).toEqual([]);
  });

  it('a ?lang= on a record that cannot be read at all holds for this page only: nothing is written', async () => {
    mem.set('device:settings', { uiLocale: 'ko', uiLocaleAt: '2026-10-16T09:00:00.000Z', textSize: 'large' });
    storage.failStrictReads = true;
    platform.handoff = 'es';
    await useLocaleStore.getState().hydrate([]);
    await settle();
    expect(useLocaleStore.getState()).toMatchObject({ device: 'es', deviceAt: MIGRATED_AT });
    expect(mem.get('device:settings')).toEqual({ uiLocale: 'ko', uiLocaleAt: '2026-10-16T09:00:00.000Z', textSize: 'large' });
    expect(posted).toEqual([]);
  });

  it('a write keeps a key and a value this version does not know', async () => {
    mem.set('device:settings', { uiLocale: 'fr', textSize: 'huge', later: { a: 1 } });
    await useLocaleStore.getState().hydrate([]);
    expect(useLocaleStore.getState()).toMatchObject({ device: null, textSize: 'standard' });
    useLocaleStore.getState().setTextSize('large');
    await settle();
    expect(mem.get('device:settings')).toEqual({ uiLocale: 'fr', textSize: 'large', later: { a: 1 } });
    expect(posted).toEqual([{ textSize: 'large' }]);
  });
});

describe('locale-store: the migration from per-profile languages (AMENDMENTS-DISPLAY-NAV section 3.3)', () => {
  beforeEach(reset);

  it('the active profile\'s override becomes the device language, stamped older than any choice; every override is stripped', async () => {
    mem.set('settings:profile:a', { uiLocale: 'es', romanizationMode: 'tap' });
    mem.set('settings:profile:b', { uiLocale: 'ko', romanizationMode: 'always', readToMe: true });
    await useLocaleStore.getState().hydrate(['profile:a', 'profile:b'], { activeProfileId: 'profile:b' });
    await settle();
    expect(useLocaleStore.getState()).toMatchObject({ device: 'ko', deviceAt: MIGRATED_AT });
    expect(MIGRATED_AT).toBe('1970-01-01T00:00:00.000Z');
    expect(mem.get('device:settings')).toEqual({ uiLocale: 'ko', uiLocaleAt: MIGRATED_AT });
    expect(mem.get('settings:profile:a')).toEqual({ romanizationMode: 'tap' });
    expect(mem.get('settings:profile:b')).toEqual({ romanizationMode: 'always', readToMe: true });
    expect(useLocaleStore.getState().byProfile).toEqual({ 'profile:a': { romanizationMode: 'tap' }, 'profile:b': { romanizationMode: 'always', readToMe: true } });
    // A migration is not a person's change: no event.
    expect(track).not.toHaveBeenCalled();
  });

  it('with no active profile, the only profile\'s override is promoted', async () => {
    mem.set('settings:profile:a', { uiLocale: 'es', romanizationMode: 'always' });
    await useLocaleStore.getState().hydrate(['profile:a']);
    await settle();
    expect(mem.get('device:settings')).toEqual({ uiLocale: 'es', uiLocaleAt: MIGRATED_AT });
  });

  it('several profiles and none active: nothing is promoted, the overrides are still stripped', async () => {
    mem.set('settings:profile:a', { uiLocale: 'es', romanizationMode: 'always' });
    mem.set('settings:profile:b', { uiLocale: 'ko', romanizationMode: 'always' });
    await useLocaleStore.getState().hydrate(['profile:a', 'profile:b'], { activeProfileId: null });
    await settle();
    expect(mem.has('device:settings')).toBe(false);
    expect(useLocaleStore.getState().device).toBeNull();
    expect(mem.get('settings:profile:a')).toEqual({ romanizationMode: 'always' });
    expect(mem.get('settings:profile:b')).toEqual({ romanizationMode: 'always' });
  });

  it('a device record that differs from the active override takes the override: it is what that profile saw (the old order put it first)', async () => {
    // As an older build stored it: a language with no time.
    mem.set('device:settings', { uiLocale: 'ko', textSize: 'large' });
    mem.set('settings:profile:a', { uiLocale: 'en', romanizationMode: 'always' });
    await useLocaleStore.getState().hydrate(['profile:a'], { activeProfileId: 'profile:a' });
    await settle();
    expect(useLocaleStore.getState()).toMatchObject({ device: 'en', deviceAt: MIGRATED_AT });
    expect(mem.get('device:settings')).toEqual({ uiLocale: 'en', uiLocaleAt: MIGRATED_AT, textSize: 'large' });
    expect(mem.get('settings:profile:a')).toEqual({ romanizationMode: 'always' });
  });

  it('an override equal to the record keeps the record\'s own time; an override on an inactive profile only keeps the record', async () => {
    mem.set('device:settings', { uiLocale: 'ko', uiLocaleAt: '2026-10-16T09:00:00.000Z' });
    mem.set('settings:profile:a', { uiLocale: 'ko', romanizationMode: 'always' });
    mem.set('settings:profile:b', { uiLocale: 'es', romanizationMode: 'always' });
    await useLocaleStore.getState().hydrate(['profile:a', 'profile:b'], { activeProfileId: 'profile:a' });
    await settle();
    expect(mem.get('device:settings')).toEqual({ uiLocale: 'ko', uiLocaleAt: '2026-10-16T09:00:00.000Z' });
    expect(mem.get('settings:profile:b')).toEqual({ romanizationMode: 'always' });
    reset();
    mem.set('device:settings', { uiLocale: 'ko', uiLocaleAt: '2026-10-16T09:00:00.000Z' });
    mem.set('settings:profile:b', { uiLocale: 'es', romanizationMode: 'always' });
    await useLocaleStore.getState().hydrate(['profile:a', 'profile:b'], { activeProfileId: 'profile:a' });
    await settle();
    expect(useLocaleStore.getState().device).toBe('ko');
    expect(mem.get('device:settings')).toEqual({ uiLocale: 'ko', uiLocaleAt: '2026-10-16T09:00:00.000Z' });
    expect(mem.get('settings:profile:b')).toEqual({ romanizationMode: 'always' });
  });

  it('the overrides are stripped only after the promoted language is stored: a failed write loses nothing', async () => {
    mem.set('settings:profile:a', { uiLocale: 'es', romanizationMode: 'always' });
    storage.writeFails = ['device:settings'];
    await useLocaleStore.getState().hydrate(['profile:a']);
    await settle();
    expect(mem.has('device:settings')).toBe(false);
    expect(mem.get('settings:profile:a')).toEqual({ uiLocale: 'es', romanizationMode: 'always' });
    // The next boot can write: it promotes and strips then.
    storage.writeFails = [];
    reset();
    mem.set('settings:profile:a', { uiLocale: 'es', romanizationMode: 'always' });
    await useLocaleStore.getState().hydrate(['profile:a']);
    await settle();
    expect(mem.get('device:settings')).toEqual({ uiLocale: 'es', uiLocaleAt: MIGRATED_AT });
    expect(mem.get('settings:profile:a')).toEqual({ romanizationMode: 'always' });
  });

  it('a device record that cannot be read skips the migration (a failed read is not "never chose")', async () => {
    storage.failStrictReads = true;
    mem.set('device:settings', { uiLocale: 'ko', uiLocaleAt: '2026-10-16T09:00:00.000Z' });
    mem.set('settings:profile:a', { uiLocale: 'es', romanizationMode: 'always' });
    await useLocaleStore.getState().hydrate(['profile:a']);
    await settle();
    expect(useLocaleStore.getState().device).toBeNull();
    expect(mem.get('device:settings')).toEqual({ uiLocale: 'ko', uiLocaleAt: '2026-10-16T09:00:00.000Z' });
    expect(mem.get('settings:profile:a')).toEqual({ uiLocale: 'es', romanizationMode: 'always' });
  });

  it('runs once: a second start finds nothing to promote or strip', async () => {
    mem.set('settings:profile:a', { uiLocale: 'es', romanizationMode: 'always' });
    await useLocaleStore.getState().hydrate(['profile:a']);
    await settle();
    const before = Object.fromEntries(mem.entries());
    expect(before).toEqual({ 'device:settings': { uiLocale: 'es', uiLocaleAt: MIGRATED_AT }, 'settings:profile:a': { romanizationMode: 'always' } });
    reset();
    mem.set('device:settings', { uiLocale: 'es', uiLocaleAt: MIGRATED_AT });
    mem.set('settings:profile:a', { romanizationMode: 'always' });
    await useLocaleStore.getState().hydrate(['profile:a']);
    await settle();
    expect(Object.fromEntries(mem.entries())).toEqual(before);
    expect(posted).toEqual([]);
  });

  it('a choice made with its time is never replaced by a leftover override (it has no time): the override is only stripped', async () => {
    // Chosen on the Display sheet; then a profile becomes active whose override a cut-short strip
    // (or a cached older build) left behind.
    mem.set('device:settings', { uiLocale: 'es', uiLocaleAt: '2026-10-16T09:00:00.000Z', textSize: 'larger' });
    mem.set('settings:profile:a', { uiLocale: 'ko', romanizationMode: 'tap' });
    await useLocaleStore.getState().hydrate(['profile:a'], { activeProfileId: 'profile:a' });
    await settle();
    expect(useLocaleStore.getState()).toMatchObject({ device: 'es', deviceAt: '2026-10-16T09:00:00.000Z' });
    expect(mem.get('device:settings')).toEqual({ uiLocale: 'es', uiLocaleAt: '2026-10-16T09:00:00.000Z', textSize: 'larger' });
    expect(mem.get('settings:profile:a')).toEqual({ romanizationMode: 'tap' });
    expect(posted).toEqual([]);
  });

  it('an older build that writes the record ({ uiLocale }, no time) and an override again has the override folded at the next boot', async () => {
    mem.set('device:settings', { uiLocale: 'es', uiLocaleAt: MIGRATED_AT, textSize: 'larger' });
    mem.set('settings:profile:a', { uiLocale: 'ko', romanizationMode: 'tap' });
    await useLocaleStore.getState().hydrate(['profile:a'], { activeProfileId: 'profile:a' });
    await settle();
    expect(useLocaleStore.getState().device).toBe('ko');
    expect(mem.get('device:settings')).toEqual({ uiLocale: 'ko', uiLocaleAt: MIGRATED_AT, textSize: 'larger' });
    expect(mem.get('settings:profile:a')).toEqual({ romanizationMode: 'tap' });
  });

  it('a timed choice another tab stores between the read and the fold is kept', async () => {
    mem.set('settings:profile:a', { uiLocale: 'ko', romanizationMode: 'always' });
    const hydrating = useLocaleStore.getState().hydrate(['profile:a']);
    // Another tab chose while this one was still reading the profiles.
    mem.set('device:settings', { uiLocale: 'es', uiLocaleAt: '2026-10-17T09:00:00.000Z' });
    await hydrating;
    await settle();
    expect(mem.get('device:settings')).toEqual({ uiLocale: 'es', uiLocaleAt: '2026-10-17T09:00:00.000Z' });
    expect(mem.get('settings:profile:a')).toEqual({ romanizationMode: 'always' });
  });

  it('an older build that wrote the record as { uiLocale } keeps its language (no time: it counts as 1970)', async () => {
    mem.set('device:settings', { uiLocale: 'es' });
    await useLocaleStore.getState().hydrate([]);
    expect(useLocaleStore.getState()).toMatchObject({ device: 'es', deviceAt: null, textSize: 'standard' });
  });

  it('profiles without an override are not rewritten', async () => {
    mem.set('settings:profile:a', { romanizationMode: 'tap' });
    await useLocaleStore.getState().hydrate(['profile:a']);
    await settle();
    expect(posted).toEqual([]);
    expect([...mem.keys()]).toEqual(['settings:profile:a']);
  });
});

describe('locale-store: device record setters', () => {
  beforeEach(reset);

  it('setDeviceLocale stores the choice with its time, tells the other tabs and reports the change once', async () => {
    useLocaleStore.setState({ detected: 'en' });
    useLocaleStore.getState().setDeviceLocale('es', 'welcome');
    expect(useLocaleStore.getState().device).toBe('es');
    expect(useLocaleStore.getState().deviceAt).toMatch(ISO);
    await settle();
    const stored = mem.get('device:settings') as { uiLocale: string; uiLocaleAt: string };
    expect(stored).toEqual({ uiLocale: 'es', uiLocaleAt: useLocaleStore.getState().deviceAt });
    expect(posted).toEqual([stored]);
    expect(track).toHaveBeenCalledTimes(1);
    expect(track).toHaveBeenCalledWith({
      name: 'locale.changed',
      payload: { from: 'en', to: 'es', scope: 'device', source: 'welcome' },
    });
  });

  it('never reports a profile scope (the Worker still accepts it; nothing sends it)', async () => {
    useLocaleStore.getState().setDeviceLocale('ko');
    useLocaleStore.getState().setDeviceLocale('es', 'settings');
    useLocaleStore.getState().seedDeviceLocale('en');
    await settle();
    for (const [event] of track.mock.calls as unknown as [{ payload: { scope: string } }][]) expect(event.payload.scope).toBe('device');
  });

  it('records the choice without telemetry when the effective locale does not change', async () => {
    useLocaleStore.setState({ detected: 'en' });
    useLocaleStore.getState().setDeviceLocale('en', 'welcome');
    await settle();
    expect(useLocaleStore.getState().device).toBe('en');
    expect(mem.get('device:settings')).toMatchObject({ uiLocale: 'en' });
    expect(track).not.toHaveBeenCalled();
  });

  it('defaults the source to settings', () => {
    useLocaleStore.getState().setDeviceLocale('ko');
    expect(track).toHaveBeenCalledWith(expect.objectContaining({ payload: expect.objectContaining({ source: 'settings' }) }));
  });

  it('a write keeps the fields another tab stored meanwhile (read-modify-write)', async () => {
    mem.set('device:settings', { textSize: 'largest' });
    useLocaleStore.getState().setDeviceLocale('ko');
    await settle();
    expect(mem.get('device:settings')).toMatchObject({ uiLocale: 'ko', textSize: 'largest' });
    mem.set('device:settings', { uiLocale: 'es', uiLocaleAt: '2026-10-16T09:00:00.000Z' });
    useLocaleStore.getState().setTextSize('large');
    await settle();
    expect(mem.get('device:settings')).toEqual({ uiLocale: 'es', uiLocaleAt: '2026-10-16T09:00:00.000Z', textSize: 'large' });
  });

  it('setTextSize stores the step, tells the other tabs, sends no event, and ignores a repeat', async () => {
    useLocaleStore.getState().setTextSize('larger');
    expect(useLocaleStore.getState().textSize).toBe('larger');
    await settle();
    expect(mem.get('device:settings')).toEqual({ textSize: 'larger' });
    expect(posted).toEqual([{ textSize: 'larger' }]);
    useLocaleStore.getState().setTextSize('larger');
    await settle();
    expect(posted).toHaveLength(1);
    expect(track).not.toHaveBeenCalled();
  });

  it('a record that cannot be read is never written: the change holds in this tab only', async () => {
    mem.set('device:settings', { uiLocale: 'es', uiLocaleAt: '2026-10-16T09:00:00.000Z' });
    useLocaleStore.setState({ device: 'ko', deviceAt: '2026-10-16T08:00:00.000Z', textSize: 'large' });
    storage.failStrictReads = true;
    useLocaleStore.getState().setTextSize('largest');
    useLocaleStore.getState().setDeviceLocale('en');
    await settle();
    expect(mem.get('device:settings')).toEqual({ uiLocale: 'es', uiLocaleAt: '2026-10-16T09:00:00.000Z' });
    expect(useLocaleStore.getState()).toMatchObject({ device: 'en', textSize: 'largest' });
    expect(posted).toEqual([]);
  });

  it('two writes at once (a size tap right after Use) both land: neither overwrites the other', async () => {
    mem.set('device:settings', { uiLocale: 'en', uiLocaleAt: '2026-10-16T09:00:00.000Z' });
    useLocaleStore.getState().setDeviceLocale('ko');
    useLocaleStore.getState().setTextSize('large');
    await settle();
    expect(mem.get('device:settings')).toEqual({ uiLocale: 'ko', uiLocaleAt: useLocaleStore.getState().deviceAt, textSize: 'large' });
    // The other tabs are told the record as it stood after each write, so the last message holds both.
    expect(posted.at(-1)).toEqual(mem.get('device:settings'));
  });

  it('a choice with no source (the presenter and All lessons sheets) is stored and told to the other tabs, but not reported', async () => {
    useLocaleStore.getState().setDeviceLocale('ko', null);
    await settle();
    expect(mem.get('device:settings')).toMatchObject({ uiLocale: 'ko' });
    expect(posted).toHaveLength(1);
    expect(track).not.toHaveBeenCalled();
  });

  it('seedDeviceLocale applies only to a device that never chose, and only an available locale', async () => {
    useLocaleStore.setState({ device: 'en', deviceAt: '2026-10-16T09:00:00.000Z' });
    useLocaleStore.getState().seedDeviceLocale('ko');
    expect(useLocaleStore.getState().device).toBe('en');
    reset();
    showAll(false);
    useLocaleStore.getState().seedDeviceLocale('ko');
    expect(useLocaleStore.getState().device).toBeNull();
    showAll(true);
    mem.set('device:settings', { textSize: 'large' });
    useLocaleStore.getState().seedDeviceLocale('es');
    await settle();
    expect(mem.get('device:settings')).toEqual({ textSize: 'large', uiLocale: 'es', uiLocaleAt: MIGRATED_AT });
    // A choice another tab stored before the seed's write is kept.
    reset();
    mem.set('device:settings', { uiLocale: 'ko', uiLocaleAt: '2026-10-16T09:00:00.000Z' });
    useLocaleStore.getState().seedDeviceLocale('es');
    await settle();
    expect(mem.get('device:settings')).toEqual({ uiLocale: 'ko', uiLocaleAt: '2026-10-16T09:00:00.000Z' });
  });

  it('a failing write never throws or loses the in-memory choice', async () => {
    storage.failWrites = true;
    expect(() => useLocaleStore.getState().setDeviceLocale('es')).not.toThrow();
    expect(() => useLocaleStore.getState().setTextSize('large')).not.toThrow();
    await settle();
    expect(useLocaleStore.getState().device).toBe('es');
    expect(useLocaleStore.getState().textSize).toBe('large');
  });
});

describe('locale-store: other tabs (BroadcastChannel hr-prefs, visibilitychange, pageshow)', () => {
  beforeEach(reset);

  it('a record another tab posted applies in memory and is never written back', async () => {
    const stop = followDeviceSettings();
    subscription.onRecord!({ uiLocale: 'ko', uiLocaleAt: '2026-10-16T09:00:00.000Z', textSize: 'largest' });
    expect(useLocaleStore.getState()).toMatchObject({ device: 'ko', deviceAt: '2026-10-16T09:00:00.000Z', textSize: 'largest' });
    await settle();
    expect(mem.size).toBe(0);
    expect(posted).toEqual([]);
    expect(track).not.toHaveBeenCalled();
    stop();
    expect(subscription.stopped).toBe(1);
  });

  it('coming back to the front re-reads the record', async () => {
    followDeviceSettings();
    useLocaleStore.setState({ device: 'en' });
    mem.set('device:settings', { uiLocale: 'es', textSize: 'large' });
    subscription.onReturn!();
    await settle();
    expect(useLocaleStore.getState()).toMatchObject({ device: 'es', deviceAt: null, textSize: 'large' });
  });

  it('a re-read that finds nothing or fails keeps what the tab shows', async () => {
    useLocaleStore.setState({ device: 'ko', textSize: 'larger' });
    await useLocaleStore.getState().rereadDevice();
    expect(useLocaleStore.getState()).toMatchObject({ device: 'ko', textSize: 'larger' });
    mem.set('device:settings', { uiLocale: 'es' });
    storage.failReads = true;
    await useLocaleStore.getState().rereadDevice();
    expect(useLocaleStore.getState().device).toBe('ko');
    storage.failReads = false;
    mem.set('device:settings', 'damaged');
    await useLocaleStore.getState().rereadDevice();
    expect(useLocaleStore.getState().device).toBe('ko');
  });
});

describe('locale-store: per-profile settings that stay per profile', () => {
  beforeEach(reset);

  it('setRomanizationMode persists per profile, keeps the other settings, and fires its event on change only', () => {
    useLocaleStore.getState().setReadToMe('profile:a', true);
    track.mockClear();
    useLocaleStore.getState().setRomanizationMode('profile:a', 'tap');
    expect(useLocaleStore.getState().byProfile['profile:a']).toEqual({ romanizationMode: 'tap', readToMe: true });
    expect(mem.get('settings:profile:a')).toEqual({ romanizationMode: 'tap', readToMe: true });
    expect(track).toHaveBeenCalledTimes(1);
    expect(track).toHaveBeenCalledWith({
      name: 'romanization.mode_changed',
      profileId: 'profile:a',
      payload: { mode: 'tap' },
    });
    useLocaleStore.getState().setRomanizationMode('profile:a', 'tap');
    expect(track).toHaveBeenCalledTimes(1);
  });

  it('setReadToMe (F-STORY-002 §3.4) persists per profile and keeps every other setting', () => {
    useLocaleStore.getState().setRomanizationMode('profile:a', 'tap');
    track.mockClear();
    useLocaleStore.getState().setReadToMe('profile:a', true);
    expect(useLocaleStore.getState().byProfile['profile:a']).toEqual({ romanizationMode: 'tap', readToMe: true });
    expect(mem.get('settings:profile:a')).toEqual({ romanizationMode: 'tap', readToMe: true });
    useLocaleStore.getState().setReadToMe('profile:a', false);
    expect(mem.get('settings:profile:a')).toEqual({ romanizationMode: 'tap', readToMe: false });
    // No telemetry for the switch (§3.12 defines none) and other profiles are untouched.
    expect(track).not.toHaveBeenCalled();
    expect(useLocaleStore.getState().byProfile['profile:b']).toBeUndefined();
  });

  it('setReadToMe on a profile with no stored settings starts from the defaults', () => {
    useLocaleStore.getState().setReadToMe('profile:new', false);
    expect(useLocaleStore.getState().byProfile['profile:new']).toEqual({ romanizationMode: 'always', readToMe: false });
    expect(mem.get('settings:profile:new')).toEqual({ romanizationMode: 'always', readToMe: false });
  });

  it('setChallengeMode (F-VOC-004 S8) persists per profile, keeps every other setting and reports the change', () => {
    useLocaleStore.getState().setReadToMe('profile:a', true);
    track.mockClear();
    useLocaleStore.getState().setChallengeMode('profile:a', true, 'start_sheet');
    expect(useLocaleStore.getState().byProfile['profile:a']).toEqual({ romanizationMode: 'always', readToMe: true, challengeMode: true });
    expect(mem.get('settings:profile:a')).toEqual({ romanizationMode: 'always', readToMe: true, challengeMode: true });
    expect(track).toHaveBeenCalledTimes(1);
    expect(track).toHaveBeenCalledWith({
      name: 'vocab.challenge_toggled',
      profileId: 'profile:a',
      payload: { on: true, source: 'start_sheet', clockScale: 1 },
    });
    useLocaleStore.getState().setChallengeMode('profile:a', false, 'profile');
    expect(mem.get('settings:profile:a')).toMatchObject({ challengeMode: false });
    expect(track).toHaveBeenLastCalledWith({
      name: 'vocab.challenge_toggled',
      profileId: 'profile:a',
      payload: { on: false, source: 'profile', clockScale: 1 },
    });
    expect(useLocaleStore.getState().byProfile['profile:b']).toBeUndefined();
  });

  it('setChallengeMode to the value already stored writes nothing new to telemetry', () => {
    useLocaleStore.getState().setChallengeMode('profile:a', false, 'profile');
    expect(track).not.toHaveBeenCalled();
    expect(useLocaleStore.getState().byProfile['profile:a']).toEqual({ romanizationMode: 'always', challengeMode: false });
    useLocaleStore.getState().setChallengeMode('profile:a', true, 'profile');
    track.mockClear();
    useLocaleStore.getState().setChallengeMode('profile:a', true, 'start_sheet');
    expect(track).not.toHaveBeenCalled();
  });

  it('setChallengeMode with a scale (a screen-reader opt-in) writes both at once and reports one event with the final scale', () => {
    useLocaleStore.getState().setClockScale('profile:a', 1);
    track.mockClear();
    useLocaleStore.getState().setChallengeMode('profile:a', true, 'start_sheet', 2);
    expect(mem.get('settings:profile:a')).toEqual({ romanizationMode: 'always', clockScale: 2, challengeMode: true });
    expect(useLocaleStore.getState().byProfile['profile:a']).toMatchObject({ challengeMode: true, clockScale: 2 });
    expect(track).toHaveBeenCalledTimes(1);
    expect(track).toHaveBeenCalledWith({
      name: 'vocab.challenge_toggled',
      profileId: 'profile:a',
      payload: { on: true, source: 'start_sheet', clockScale: 2 },
    });
    track.mockClear();
    useLocaleStore.getState().setChallengeMode('profile:a', true, 'profile', 2);
    expect(track).not.toHaveBeenCalled();
  });

  it('setClockScale persists the scale and reports it with the current Challenge state', () => {
    useLocaleStore.getState().setChallengeMode('profile:a', true, 'profile');
    track.mockClear();
    useLocaleStore.getState().setClockScale('profile:a', 2);
    expect(useLocaleStore.getState().byProfile['profile:a']).toEqual({ romanizationMode: 'always', challengeMode: true, clockScale: 2 });
    expect(mem.get('settings:profile:a')).toEqual({ romanizationMode: 'always', challengeMode: true, clockScale: 2 });
    expect(track).toHaveBeenCalledWith({
      name: 'vocab.challenge_toggled',
      profileId: 'profile:a',
      payload: { on: true, source: 'profile', clockScale: 2 },
    });
    useLocaleStore.getState().setClockScale('profile:a', 1.5, 'start_sheet');
    expect(track).toHaveBeenLastCalledWith({
      name: 'vocab.challenge_toggled',
      profileId: 'profile:a',
      payload: { on: true, source: 'start_sheet', clockScale: 1.5 },
    });
    track.mockClear();
    useLocaleStore.getState().setClockScale('profile:a', 1.5);
    expect(track).not.toHaveBeenCalled();
  });

  it('setClockScale on a profile that never opted in stores the scale and reports Challenge off', () => {
    useLocaleStore.getState().setClockScale('profile:new', 1.5);
    expect(mem.get('settings:profile:new')).toEqual({ romanizationMode: 'always', clockScale: 1.5 });
    expect(track).toHaveBeenCalledWith({
      name: 'vocab.challenge_toggled',
      profileId: 'profile:new',
      payload: { on: false, source: 'profile', clockScale: 1.5 },
    });
  });

  it('a failing write never throws or loses the in-memory setting', async () => {
    storage.failWrites = true;
    expect(() => useLocaleStore.getState().setRomanizationMode('profile:a', 'tap')).not.toThrow();
    await settle();
    expect(useLocaleStore.getState().byProfile['profile:a']?.romanizationMode).toBe('tap');
  });

  it('forgetProfile drops the profile settings and their key, leaving others alone', () => {
    useLocaleStore.getState().setRomanizationMode('profile:a', 'tap');
    useLocaleStore.getState().setRomanizationMode('profile:b', 'tap');
    useLocaleStore.getState().forgetProfile('profile:a');
    expect(useLocaleStore.getState().byProfile['profile:a']).toBeUndefined();
    expect(mem.has('settings:profile:a')).toBe(false);
    expect(mem.has('settings:profile:b')).toBe(true);
    expect(() => useLocaleStore.getState().forgetProfile('profile:never')).not.toThrow();
  });
});

describe('locale-store: profile removal', () => {
  beforeEach(reset);

  it('removing a profile through the profile store drops its settings and key (F-I18N-001 §3.2)', () => {
    useProfileStore.setState({ profiles: [], activeId: null, hydrated: false });
    const input = { displayName: 'Mina', ageGroup: '8-9' as const, avatar: 'hoya-blue' as const };
    const a = useProfileStore.getState().createProfile(input);
    const b = useProfileStore.getState().createProfile({ ...input, displayName: 'Jin' });
    useLocaleStore.getState().setRomanizationMode(a.id, 'tap');
    useLocaleStore.getState().setRomanizationMode(b.id, 'tap');

    useProfileStore.getState().remove(a.id);

    expect(useLocaleStore.getState().byProfile[a.id]).toBeUndefined();
    expect(mem.has(`settings:${a.id}`)).toBe(false);
    expect(useLocaleStore.getState().byProfile[b.id]?.romanizationMode).toBe('tap');
    expect(mem.has(`settings:${b.id}`)).toBe(true);
  });

  it('switching profiles never changes the UI language', () => {
    useProfileStore.setState({ profiles: [], activeId: null, hydrated: false });
    const input = { displayName: 'Mina', ageGroup: '8-9' as const, avatar: 'hoya-blue' as const };
    const a = useProfileStore.getState().createProfile(input);
    useLocaleStore.getState().setDeviceLocale('ko');
    useProfileStore.getState().createProfile({ ...input, displayName: 'Jin' });
    useProfileStore.getState().setActive(a.id);
    expect(activeLocale(useLocaleStore.getState())).toBe('ko');
  });
});

// Rollback (F-I18N-001 §6): flipping a locale back to 'hidden' ignores stored choices
// in it without touching the stored data, so un-hiding restores them.
describe('locale-store: a stored locale that is currently hidden is ignored', () => {
  beforeEach(reset);

  it('activeLocale skips a hidden device choice and detected locale', () => {
    showAll(false);
    useLocaleStore.setState({ detected: 'es', device: 'ko' });
    expect(activeLocale(useLocaleStore.getState())).toBe('en');
  });

  it('un-hiding the locale brings the stored choice back (no data change)', async () => {
    mem.set('device:settings', { uiLocale: 'ko' });
    showAll(false);
    await useLocaleStore.getState().hydrate([]);
    await settle();
    expect(activeLocale(useLocaleStore.getState())).toBe('en');
    expect(mem.get('device:settings')).toEqual({ uiLocale: 'ko' });
    showAll(true);
    expect(activeLocale(useLocaleStore.getState())).toBe('ko');
  });

  it('hydrate treats a hidden stored device choice as unset, so ?lang= can seed', async () => {
    mem.set('device:settings', { uiLocale: 'ko' });
    platform.handoff = 'en';
    showAll(false);
    await useLocaleStore.getState().hydrate([]);
    await settle();
    expect(useLocaleStore.getState().device).toBe('en');
    expect(mem.get('device:settings')).toEqual({ uiLocale: 'en', uiLocaleAt: expect.stringMatching(ISO) });
  });

  it('telemetry "from" reflects what the learner actually saw, not a hidden stored locale', () => {
    showAll(false);
    useLocaleStore.setState({ detected: 'en', device: 'ko' });
    useLocaleStore.getState().setDeviceLocale('en', 'settings');
    expect(track).not.toHaveBeenCalled();
  });
});

/**
 * AMENDMENTS-DISPLAY-NAV sections 3.3 and 12: the learner app never reads or writes the console's old key
 * `hr:console:uiLocale` (the console folds it on a device with no learner profiles and keeps it as a mirror).
 * Its language comes from the device record, a `?lang=` seed or a choice, never from that key.
 */
describe('locale-store: the learner app never touches hr:console:uiLocale', () => {
  const CONSOLE_KEY = 'hr:console:uiLocale';
  const local = new Map<string, string>();
  const spy = {
    getItem: vi.fn((k: string) => local.get(k) ?? null),
    setItem: vi.fn((k: string, v: string) => {
      local.set(k, v);
    }),
    removeItem: vi.fn((k: string) => {
      local.delete(k);
    }),
    key: vi.fn((i: number) => [...local.keys()][i] ?? null),
    clear: vi.fn(() => local.clear()),
    get length(): number {
      return local.size;
    },
  };
  const touchedConsoleKey = (calls: unknown[][]): boolean => calls.some((args) => typeof args[0] === 'string' && args[0].includes('console:uiLocale'));
  const storageCalls = (): unknown[][] =>
    (['readJson', 'readJsonStrict', 'updateJson', 'writeJson', 'removeKey'] as const).flatMap((name) => vi.mocked(storageModule[name]).mock.calls as unknown[][]);

  beforeEach(() => {
    reset();
    local.clear();
    for (const fn of [spy.getItem, spy.setItem, spy.removeItem, spy.key, spy.clear]) fn.mockClear();
    for (const name of ['readJson', 'readJsonStrict', 'updateJson', 'writeJson', 'removeKey'] as const) vi.mocked(storageModule[name]).mockClear();
    // The console's old choice, in both stores the learner app could reach.
    local.set(CONSOLE_KEY, 'ko');
    mem.set('console:uiLocale', 'ko');
    vi.stubGlobal('localStorage', spy);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const noConsoleKey = (): void => {
    expect(touchedConsoleKey(spy.getItem.mock.calls)).toBe(false);
    expect(touchedConsoleKey(spy.setItem.mock.calls)).toBe(false);
    expect(touchedConsoleKey(spy.removeItem.mock.calls)).toBe(false);
    expect(spy.key).not.toHaveBeenCalled();
    expect(spy.clear).not.toHaveBeenCalled();
    expect(touchedConsoleKey(storageCalls())).toBe(false);
    expect(local.get(CONSOLE_KEY)).toBe('ko');
    expect(mem.get('console:uiLocale')).toBe('ko');
  };

  it('hydrate on a fresh device: the console key is not read, folded or removed', async () => {
    await useLocaleStore.getState().hydrate(['profile:a'], { activeProfileId: 'profile:a' });
    await settle();
    expect(useLocaleStore.getState().device).toBeNull();
    expect(mem.has('device:settings')).toBe(false);
    noConsoleKey();
  });

  it('a ?lang= seed writes the device record only, never the console key', async () => {
    platform.handoff = 'es';
    await useLocaleStore.getState().hydrate([]);
    await settle();
    expect(useLocaleStore.getState()).toMatchObject({ device: 'es', deviceAt: MIGRATED_AT });
    expect(mem.get('device:settings')).toEqual({ uiLocale: 'es', uiLocaleAt: MIGRATED_AT });
    noConsoleKey();
  });

  it('setDeviceLocale writes the device record only, never the console key', async () => {
    await useLocaleStore.getState().hydrate([]);
    useLocaleStore.getState().setDeviceLocale('en', 'settings');
    await settle();
    expect(mem.get('device:settings')).toMatchObject({ uiLocale: 'en' });
    noConsoleKey();
  });

  it('no learner app source outside tests names the console key', () => {
    const root = join(__dirname, '..', '..');
    const files: string[] = [];
    const walk = (dir: string): void => {
      for (const name of readdirSync(dir)) {
        const path = join(dir, name);
        if (statSync(path).isDirectory()) {
          if (name !== '__tests__' && name !== 'node_modules') walk(path);
        } else if (/\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name)) files.push(path);
      }
    };
    walk(root);
    expect(files.length).toBeGreaterThan(100);
    const offenders = files.filter((file) => /console:uiLocale/.test(readFileSync(file, 'utf8')));
    expect(offenders).toEqual([]);
  });
});

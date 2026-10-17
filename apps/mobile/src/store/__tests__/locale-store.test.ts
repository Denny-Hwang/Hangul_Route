import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';

const mem = vi.hoisted(() => new Map<string, unknown>());
const storage = vi.hoisted(() => ({ failReads: false, failWrites: false }));
vi.mock('../../platform/storage', () => ({
  readJson: vi.fn(async (k: string) => {
    if (storage.failReads) return null;
    return mem.get(k) ?? null;
  }),
  writeJson: vi.fn(async (k: string, v: unknown) => {
    if (storage.failWrites) throw new Error('quota');
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

import { activeLocale, deviceChose, detectInitialLocale, followDeviceSettings, useLocaleStore } from '../locale-store';
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
  storage.failWrites = false;
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

  it('?lang= seeds a device that never chose: stored without a time (a seed, not a choice)', async () => {
    platform.handoff = 'ko';
    await useLocaleStore.getState().hydrate([]);
    await settle();
    expect(useLocaleStore.getState()).toMatchObject({ device: 'ko', deviceAt: null });
    expect(mem.get('device:settings')).toEqual({ uiLocale: 'ko' });
    expect(posted).toEqual([{ uiLocale: 'ko' }]);
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
    expect(mem.get('device:settings')).toEqual({ textSize: 'largest', uiLocale: 'es' });
  });
});

describe('locale-store: the one-time migration from per-profile languages', () => {
  beforeEach(reset);

  it('a device that never chose takes the active profile\'s override; every override is stripped', async () => {
    mem.set('settings:profile:a', { uiLocale: 'es', romanizationMode: 'tap' });
    mem.set('settings:profile:b', { uiLocale: 'ko', romanizationMode: 'always', readToMe: true });
    await useLocaleStore.getState().hydrate(['profile:a', 'profile:b'], { activeProfileId: 'profile:b' });
    await settle();
    expect(useLocaleStore.getState().device).toBe('ko');
    expect(mem.get('device:settings')).toEqual({ uiLocale: 'ko' });
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
    expect(mem.get('device:settings')).toEqual({ uiLocale: 'es' });
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

  it('a device that already chose keeps its language; the overrides are stripped', async () => {
    mem.set('device:settings', { uiLocale: 'en', textSize: 'large' });
    mem.set('settings:profile:a', { uiLocale: 'ko', romanizationMode: 'always' });
    await useLocaleStore.getState().hydrate(['profile:a'], { activeProfileId: 'profile:a' });
    await settle();
    expect(useLocaleStore.getState().device).toBe('en');
    expect(mem.get('device:settings')).toEqual({ uiLocale: 'en', textSize: 'large' });
    expect(mem.get('settings:profile:a')).toEqual({ romanizationMode: 'always' });
  });

  it('runs once: a second start finds nothing to promote or strip', async () => {
    mem.set('settings:profile:a', { uiLocale: 'es', romanizationMode: 'always' });
    await useLocaleStore.getState().hydrate(['profile:a']);
    await settle();
    const before = Object.fromEntries(mem.entries());
    expect(before).toEqual({ 'device:settings': { uiLocale: 'es' }, 'settings:profile:a': { romanizationMode: 'always' } });
    reset();
    mem.set('device:settings', { uiLocale: 'es' });
    mem.set('settings:profile:a', { romanizationMode: 'always' });
    await useLocaleStore.getState().hydrate(['profile:a']);
    await settle();
    expect(Object.fromEntries(mem.entries())).toEqual(before);
    expect(posted).toEqual([]);
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

  it('with the record unreadable, a write falls back to what this tab holds', async () => {
    useLocaleStore.setState({ device: 'ko', deviceAt: '2026-10-16T09:00:00.000Z', textSize: 'large' });
    storage.failReads = true;
    useLocaleStore.getState().setTextSize('largest');
    await settle();
    expect(mem.get('device:settings')).toEqual({ uiLocale: 'ko', uiLocaleAt: '2026-10-16T09:00:00.000Z', textSize: 'largest' });
    useLocaleStore.setState({ textSize: 'standard', device: null });
    useLocaleStore.getState().setTextSize('large');
    await settle();
    expect(mem.get('device:settings')).toEqual({ textSize: 'large' });
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
    mem.set('device:settings', { uiLocale: 'ko', uiLocaleAt: 'stale' });
    useLocaleStore.getState().seedDeviceLocale('es');
    await settle();
    expect(mem.get('device:settings')).toEqual({ uiLocale: 'es' });
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
    expect(mem.get('device:settings')).toEqual({ uiLocale: 'en' });
  });

  it('telemetry "from" reflects what the learner actually saw, not a hidden stored locale', () => {
    showAll(false);
    useLocaleStore.setState({ detected: 'en', device: 'ko' });
    useLocaleStore.getState().setDeviceLocale('en', 'settings');
    expect(track).not.toHaveBeenCalled();
  });
});

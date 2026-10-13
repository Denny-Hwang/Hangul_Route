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
vi.mock('../../platform/locale', () => ({
  deviceLanguages: () => platform.languages,
  takeLangHandoff: () => platform.handoff,
  setDocumentLang: vi.fn(),
}));

import { activeLocale, detectInitialLocale, useLocaleStore } from '../locale-store';
import { useProfileStore } from '../profile-store';

// Hidden locales (es, ko) are only available when the QA flag is set (F-I18N-001 §3.1).
const showAll = (on: boolean): void => {
  if (on) process.env.EXPO_PUBLIC_SHOW_ALL_LOCALES = '1';
  else delete process.env.EXPO_PUBLIC_SHOW_ALL_LOCALES;
};

const reset = (): void => {
  mem.clear();
  storage.failReads = false;
  storage.failWrites = false;
  platform.handoff = null;
  showAll(true);
  track.mockClear();
  useLocaleStore.setState({ detected: 'en', device: null, session: null, byProfile: {}, hydrated: false });
};

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

describe('locale-store: resolution (activeLocale)', () => {
  beforeEach(reset);

  it('profile override > device choice > detected', () => {
    useLocaleStore.setState({
      detected: 'es',
      device: 'ko',
      byProfile: { 'profile:a': { uiLocale: 'es', romanizationMode: 'always' }, 'profile:b': { romanizationMode: 'always' } },
    });
    const s = useLocaleStore.getState();
    expect(activeLocale(s, 'profile:a')).toBe('es');
    expect(activeLocale(s, 'profile:b')).toBe('ko');
    expect(activeLocale(s, null)).toBe('ko');
    useLocaleStore.setState({ device: null });
    expect(activeLocale(useLocaleStore.getState(), 'profile:b')).toBe('es');
  });

  it('detection is a default, not a choice: device stays null', () => {
    useLocaleStore.setState({ detected: 'es' });
    const s = useLocaleStore.getState();
    expect(s.device).toBeNull();
    expect(activeLocale(s, null)).toBe('es');
  });
});

describe('locale-store: hydrate', () => {
  beforeEach(reset);

  it('loads the device choice and every profile setting', async () => {
    mem.set('device:settings', { uiLocale: 'ko' });
    mem.set('settings:profile:a', { uiLocale: 'es', romanizationMode: 'tap' });
    await useLocaleStore.getState().hydrate(['profile:a', 'profile:b']);
    const s = useLocaleStore.getState();
    expect(s.hydrated).toBe(true);
    expect(s.device).toBe('ko');
    expect(s.byProfile['profile:a']).toEqual({ uiLocale: 'es', romanizationMode: 'tap' });
    expect(s.byProfile['profile:b']).toBeUndefined();
  });

  it('ignores a value that fails to parse and starts normally', async () => {
    mem.set('device:settings', { uiLocale: 'fr' });
    mem.set('settings:profile:a', 'not an object');
    mem.set('settings:profile:b', { uiLocale: 'zz' });
    await useLocaleStore.getState().hydrate(['profile:a', 'profile:b']);
    const s = useLocaleStore.getState();
    expect(s).toMatchObject({ hydrated: true, device: null, byProfile: {} });
  });

  it('applies the default romanization mode to a stored profile without one', async () => {
    mem.set('settings:profile:a', { uiLocale: 'es' });
    await useLocaleStore.getState().hydrate(['profile:a']);
    expect(useLocaleStore.getState().byProfile['profile:a']).toEqual({ uiLocale: 'es', romanizationMode: 'always' });
  });

  it('keeps a stored readToMe (F-STORY-002 PR 2.5) and parses settings saved before it existed', async () => {
    mem.set('settings:profile:a', { uiLocale: 'es', romanizationMode: 'tap', readToMe: false });
    mem.set('settings:profile:b', { uiLocale: 'es', romanizationMode: 'tap' });
    await useLocaleStore.getState().hydrate(['profile:a', 'profile:b']);
    const s = useLocaleStore.getState();
    expect(s.byProfile['profile:a']).toEqual({ uiLocale: 'es', romanizationMode: 'tap', readToMe: false });
    expect(s.byProfile['profile:b']).toEqual({ uiLocale: 'es', romanizationMode: 'tap' });
    expect('readToMe' in (s.byProfile['profile:b'] ?? {})).toBe(false);
  });

  it('survives storage that cannot be read (private mode): detection applies, nothing persisted', async () => {
    storage.failReads = true;
    useLocaleStore.setState({ detected: 'es' });
    await useLocaleStore.getState().hydrate(['profile:a']);
    const s = useLocaleStore.getState();
    expect(s.hydrated).toBe(true);
    expect(s.device).toBeNull();
    expect(activeLocale(s, 'profile:a')).toBe('es');
    expect(mem.size).toBe(0);
  });

  it('?lang= becomes the device choice when none was ever made', async () => {
    platform.handoff = 'ko';
    await useLocaleStore.getState().hydrate([]);
    expect(useLocaleStore.getState().device).toBe('ko');
    expect(mem.get('device:settings')).toEqual({ uiLocale: 'ko' });
    expect(track).toHaveBeenCalledWith({
      name: 'locale.changed',
      payload: { from: 'en', to: 'ko', scope: 'device', source: 'handoff' },
    });
  });

  it('?lang= never overrides a stored device choice', async () => {
    mem.set('device:settings', { uiLocale: 'en' });
    platform.handoff = 'ko';
    await useLocaleStore.getState().hydrate([]);
    expect(useLocaleStore.getState().device).toBe('en');
    expect(mem.get('device:settings')).toEqual({ uiLocale: 'en' });
    expect(track).not.toHaveBeenCalled();
  });
});

describe('locale-store: setters', () => {
  beforeEach(reset);

  it('setDeviceLocale persists, removes the key when cleared, and reports the effective change once', () => {
    useLocaleStore.setState({ detected: 'en' });
    useLocaleStore.getState().setDeviceLocale('es', 'welcome');
    expect(useLocaleStore.getState().device).toBe('es');
    expect(mem.get('device:settings')).toEqual({ uiLocale: 'es' });
    expect(track).toHaveBeenCalledTimes(1);
    expect(track).toHaveBeenCalledWith({
      name: 'locale.changed',
      payload: { from: 'en', to: 'es', scope: 'device', source: 'welcome' },
    });

    useLocaleStore.getState().setDeviceLocale(null, 'settings');
    expect(useLocaleStore.getState().device).toBeNull();
    expect(mem.has('device:settings')).toBe(false);
    expect(track).toHaveBeenLastCalledWith({
      name: 'locale.changed',
      payload: { from: 'es', to: 'en', scope: 'device', source: 'settings' },
    });
  });

  it('records the choice without telemetry when the effective locale does not change', () => {
    useLocaleStore.setState({ detected: 'en' });
    useLocaleStore.getState().setDeviceLocale('en', 'welcome');
    expect(useLocaleStore.getState().device).toBe('en');
    expect(mem.get('device:settings')).toEqual({ uiLocale: 'en' });
    expect(track).not.toHaveBeenCalled();
  });

  it('defaults the source to settings', () => {
    useLocaleStore.getState().setDeviceLocale('ko');
    expect(track).toHaveBeenCalledWith(expect.objectContaining({ payload: expect.objectContaining({ source: 'settings' }) }));
  });

  it('setProfileLocale stores the override per profile, carries the profile id, and clears it again', () => {
    useLocaleStore.setState({ detected: 'en', device: 'ko' });
    useLocaleStore.getState().setProfileLocale('profile:a', 'es');
    expect(useLocaleStore.getState().byProfile['profile:a']).toEqual({ uiLocale: 'es', romanizationMode: 'always' });
    expect(mem.get('settings:profile:a')).toEqual({ uiLocale: 'es', romanizationMode: 'always' });
    expect(track).toHaveBeenCalledWith({
      name: 'locale.changed',
      profileId: 'profile:a',
      payload: { from: 'ko', to: 'es', scope: 'profile', source: 'settings' },
    });

    useLocaleStore.getState().setProfileLocale('profile:a', null);
    expect(useLocaleStore.getState().byProfile['profile:a']).toEqual({ romanizationMode: 'always' });
    expect(mem.get('settings:profile:a')).toEqual({ romanizationMode: 'always' });
    expect('uiLocale' in (mem.get('settings:profile:a') as object)).toBe(false);
    expect(track).toHaveBeenLastCalledWith({
      name: 'locale.changed',
      profileId: 'profile:a',
      payload: { from: 'es', to: 'ko', scope: 'profile', source: 'settings' },
    });
  });

  it('changing or clearing the locale override keeps the profile\'s readToMe', () => {
    useLocaleStore.setState({
      byProfile: { 'profile:a': { romanizationMode: 'tap', readToMe: true } },
    });
    useLocaleStore.getState().setProfileLocale('profile:a', 'es');
    expect(mem.get('settings:profile:a')).toEqual({ uiLocale: 'es', romanizationMode: 'tap', readToMe: true });
    useLocaleStore.getState().setProfileLocale('profile:a', null);
    expect(useLocaleStore.getState().byProfile['profile:a']).toEqual({ romanizationMode: 'tap', readToMe: true });
    expect(mem.get('settings:profile:a')).toEqual({ romanizationMode: 'tap', readToMe: true });
    useLocaleStore.getState().setRomanizationMode('profile:a', 'always');
    expect(mem.get('settings:profile:a')).toEqual({ romanizationMode: 'always', readToMe: true });
  });

  it('setRomanizationMode persists per profile, keeps the locale override, and fires its event on change only', () => {
    useLocaleStore.getState().setProfileLocale('profile:a', 'es');
    track.mockClear();
    useLocaleStore.getState().setRomanizationMode('profile:a', 'tap');
    expect(useLocaleStore.getState().byProfile['profile:a']).toEqual({ uiLocale: 'es', romanizationMode: 'tap' });
    expect(mem.get('settings:profile:a')).toEqual({ uiLocale: 'es', romanizationMode: 'tap' });
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
    useLocaleStore.getState().setProfileLocale('profile:a', 'es');
    useLocaleStore.getState().setRomanizationMode('profile:a', 'tap');
    track.mockClear();
    useLocaleStore.getState().setReadToMe('profile:a', true);
    expect(useLocaleStore.getState().byProfile['profile:a']).toEqual({ uiLocale: 'es', romanizationMode: 'tap', readToMe: true });
    expect(mem.get('settings:profile:a')).toEqual({ uiLocale: 'es', romanizationMode: 'tap', readToMe: true });
    useLocaleStore.getState().setReadToMe('profile:a', false);
    expect(mem.get('settings:profile:a')).toEqual({ uiLocale: 'es', romanizationMode: 'tap', readToMe: false });
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
    useLocaleStore.getState().setProfileLocale('profile:a', 'es');
    useLocaleStore.getState().setReadToMe('profile:a', true);
    track.mockClear();
    useLocaleStore.getState().setChallengeMode('profile:a', true, 'start_sheet');
    expect(useLocaleStore.getState().byProfile['profile:a']).toEqual({ uiLocale: 'es', romanizationMode: 'always', readToMe: true, challengeMode: true });
    expect(mem.get('settings:profile:a')).toEqual({ uiLocale: 'es', romanizationMode: 'always', readToMe: true, challengeMode: true });
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

  it('a failing write never throws or loses the in-memory choice', async () => {
    storage.failWrites = true;
    expect(() => useLocaleStore.getState().setDeviceLocale('es')).not.toThrow();
    expect(() => useLocaleStore.getState().setProfileLocale('profile:a', 'ko')).not.toThrow();
    await Promise.resolve();
    expect(useLocaleStore.getState().device).toBe('es');
    expect(useLocaleStore.getState().byProfile['profile:a']?.uiLocale).toBe('ko');
  });

  it('forgetProfile drops the profile settings and their key, leaving others alone', () => {
    useLocaleStore.getState().setProfileLocale('profile:a', 'es');
    useLocaleStore.getState().setProfileLocale('profile:b', 'ko');
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
    useLocaleStore.getState().setProfileLocale(a.id, 'es');
    useLocaleStore.getState().setProfileLocale(b.id, 'ko');

    useProfileStore.getState().remove(a.id);

    expect(useLocaleStore.getState().byProfile[a.id]).toBeUndefined();
    expect(mem.has(`settings:${a.id}`)).toBe(false);
    expect(useLocaleStore.getState().byProfile[b.id]?.uiLocale).toBe('ko');
    expect(mem.has(`settings:${b.id}`)).toBe(true);
  });

  it('adding or switching profiles leaves every setting alone', () => {
    useProfileStore.setState({ profiles: [], activeId: null, hydrated: false });
    const input = { displayName: 'Mina', ageGroup: '8-9' as const, avatar: 'hoya-blue' as const };
    const a = useProfileStore.getState().createProfile(input);
    useLocaleStore.getState().setProfileLocale(a.id, 'es');
    useProfileStore.getState().createProfile({ ...input, displayName: 'Jin' });
    useProfileStore.getState().setActive(a.id);
    expect(useLocaleStore.getState().byProfile[a.id]?.uiLocale).toBe('es');
  });
});

// Rollback (F-I18N-001 §6): flipping a locale back to 'hidden' ignores stored choices
// in it without touching the stored data, so un-hiding restores them.
describe('locale-store: a stored locale that is currently hidden is ignored', () => {
  beforeEach(reset);

  it('activeLocale skips a hidden profile override, device choice and detected locale', () => {
    showAll(false);
    useLocaleStore.setState({
      detected: 'es',
      device: 'ko',
      byProfile: { 'profile:a': { uiLocale: 'es', romanizationMode: 'always' } },
    });
    const s = useLocaleStore.getState();
    expect(activeLocale(s, 'profile:a')).toBe('en');
    expect(activeLocale(s, null)).toBe('en');
  });

  it('a hidden override falls through to the next visible level, not straight to English', () => {
    showAll(false);
    useLocaleStore.setState({
      detected: 'en',
      device: 'en',
      byProfile: { 'profile:a': { uiLocale: 'ko', romanizationMode: 'always' } },
    });
    expect(activeLocale(useLocaleStore.getState(), 'profile:a')).toBe('en');
  });

  it('un-hiding the locale brings the stored choice back (no data change)', async () => {
    mem.set('device:settings', { uiLocale: 'ko' });
    mem.set('settings:profile:a', { uiLocale: 'es', romanizationMode: 'tap' });
    showAll(false);
    await useLocaleStore.getState().hydrate(['profile:a']);
    const hidden = useLocaleStore.getState();
    expect(activeLocale(hidden, 'profile:a')).toBe('en');
    expect(mem.get('device:settings')).toEqual({ uiLocale: 'ko' });
    expect(mem.get('settings:profile:a')).toEqual({ uiLocale: 'es', romanizationMode: 'tap' });
    expect(hidden.byProfile['profile:a']?.romanizationMode).toBe('tap');
    showAll(true);
    expect(activeLocale(useLocaleStore.getState(), 'profile:a')).toBe('es');
    expect(activeLocale(useLocaleStore.getState(), null)).toBe('ko');
  });

  it('hydrate treats a hidden stored device choice as unset, so ?lang= can apply', async () => {
    mem.set('device:settings', { uiLocale: 'ko' });
    platform.handoff = 'en';
    showAll(false);
    await useLocaleStore.getState().hydrate([]);
    expect(useLocaleStore.getState().device).toBe('en');
    expect(mem.get('device:settings')).toEqual({ uiLocale: 'en' });
  });

  it('telemetry "from" reflects what the learner actually saw, not a hidden stored locale', () => {
    showAll(false);
    useLocaleStore.setState({ detected: 'en', device: 'ko' });
    useLocaleStore.getState().setDeviceLocale('en', 'settings');
    expect(track).not.toHaveBeenCalled();
    useLocaleStore.setState({ detected: 'en', device: null, byProfile: { 'profile:a': { uiLocale: 'es', romanizationMode: 'always' } } });
    useLocaleStore.getState().setProfileLocale('profile:a', null);
    expect(track).not.toHaveBeenCalled();
  });
});

describe('locale-store: setSessionLocale (F-BROWSE-001 §4.9, BR-5c)', () => {
  beforeEach(reset);

  it('sets the active UI locale in memory only: no storage write and no event', async () => {
    useLocaleStore.setState({ detected: 'en', device: 'ko' });
    useLocaleStore.getState().setSessionLocale('es');
    await Promise.resolve();
    expect(useLocaleStore.getState().session).toBe('es');
    expect(activeLocale(useLocaleStore.getState(), null)).toBe('es');
    expect(useLocaleStore.getState().device).toBe('ko');
    expect(mem.size).toBe(0);
    expect(track).not.toHaveBeenCalled();
  });

  it('wins over a profile override and the device choice while set, and clears back to them', () => {
    useLocaleStore.setState({
      detected: 'en',
      device: 'ko',
      byProfile: { 'profile:a': { uiLocale: 'es', romanizationMode: 'always' } },
    });
    useLocaleStore.getState().setSessionLocale('en');
    expect(activeLocale(useLocaleStore.getState(), 'profile:a')).toBe('en');
    expect(activeLocale(useLocaleStore.getState(), null)).toBe('en');
    useLocaleStore.getState().setSessionLocale(null);
    expect(activeLocale(useLocaleStore.getState(), 'profile:a')).toBe('es');
    expect(activeLocale(useLocaleStore.getState(), null)).toBe('ko');
    expect(mem.size).toBe(0);
    expect(track).not.toHaveBeenCalled();
  });

  it('a hidden session locale falls through to the next visible level', () => {
    showAll(false);
    useLocaleStore.setState({ detected: 'en', device: null });
    useLocaleStore.getState().setSessionLocale('ko');
    expect(activeLocale(useLocaleStore.getState(), null)).toBe('en');
  });

  it('survives hydrate, which never touches it', async () => {
    mem.set('device:settings', { uiLocale: 'ko' });
    useLocaleStore.getState().setSessionLocale('es');
    await useLocaleStore.getState().hydrate([]);
    expect(useLocaleStore.getState().session).toBe('es');
    expect(activeLocale(useLocaleStore.getState(), null)).toBe('es');
    expect(mem.get('device:settings')).toEqual({ uiLocale: 'ko' });
  });
});

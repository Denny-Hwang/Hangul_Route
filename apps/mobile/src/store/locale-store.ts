import {
  DeviceSettingsSchema,
  ProfileSettingsSchema,
  type ProfileSettings,
  type RomanizationMode,
} from '@hangul-route/content-schema';
import { availableLocales, detectLocale, resolveLocale, type UiLocale } from '@hangul-route/i18n';
import { create } from 'zustand';
import { deviceLanguages, takeLangHandoff } from '../platform/locale';
import { readJson, removeKey, writeJson } from '../platform/storage';
import { track } from '../platform/telemetry';
import { onProfileRemoved } from './profile-removal';

/**
 * UI locale and romanization display setting (F-I18N-001 §3.2). A local-first
 * device preference, never part of the synced `Profile`: it lives under
 * `device:settings` and `settings:${profileId}` and only locale codes reach
 * telemetry. Resolution is profile override > device choice > detection > `en`.
 */

const DEVICE_KEY = 'device:settings';
const profileKey = (profileId: string): string => `settings:${profileId}`;

/** Where a locale change came from (telemetry payload `source`). */
export type LocaleChangeSource = 'welcome' | 'settings' | 'handoff';

interface State {
  /** What the platform prefers (hidden locales excluded); a default, not a choice. */
  detected: UiLocale;
  /** The device-level choice; `null` = never chosen. */
  device: UiLocale | null;
  byProfile: Record<string, ProfileSettings>;
  hydrated: boolean;
}

interface Actions {
  hydrate: (profileIds: string[]) => Promise<void>;
  setDeviceLocale: (locale: UiLocale | null, source?: LocaleChangeSource) => void;
  setProfileLocale: (profileId: string, locale: UiLocale | null, source?: LocaleChangeSource) => void;
  setRomanizationMode: (profileId: string, mode: RomanizationMode) => void;
  /** The story reader's Read to me switch (F-STORY-002 §3.4); no telemetry. */
  setReadToMe: (profileId: string, readToMe: boolean) => void;
  /** Profile removal: drop that profile's settings (and their stored key). */
  forgetProfile: (profileId: string) => void;
}

/** Detection from the platform's language list; the very first render already has a sensible locale. */
export function detectInitialLocale(): UiLocale {
  return detectLocale(deviceLanguages());
}

/**
 * A stored locale counts only while it is available. Flipping `LOCALE_STATUS` back to
 * `'hidden'` (the rollback in F-I18N-001 §6) therefore ignores stored non-English choices
 * without a data change: the stored value stays, and un-hiding brings it back.
 */
function visible(locale: UiLocale | null | undefined): UiLocale | undefined {
  return locale != null && availableLocales().includes(locale) ? locale : undefined;
}

/** `resolveLocale` over the levels that are currently visible; a hidden level falls through to the next one. */
function effectiveLocale(levels: { profile?: UiLocale | null; device?: UiLocale | null; detected?: UiLocale | null }): UiLocale {
  return resolveLocale({
    profile: visible(levels.profile),
    device: visible(levels.device),
    detected: visible(levels.detected),
  });
}

/** The locale the UI renders in for the active profile (`null` = no profile yet). */
export function activeLocale(state: Pick<State, 'detected' | 'device' | 'byProfile'>, activeProfileId: string | null): UiLocale {
  return effectiveLocale({
    profile: activeProfileId === null ? undefined : state.byProfile[activeProfileId]?.uiLocale,
    device: state.device,
    detected: state.detected,
  });
}

/** Storage is best effort: a failed write keeps the in-memory choice for the session. */
function persist(write: Promise<void>): void {
  write.catch(() => undefined);
}

function reportLocaleChange(
  from: UiLocale,
  to: UiLocale,
  scope: 'device' | 'profile',
  source: LocaleChangeSource,
  profileId?: string,
): void {
  if (from === to) return;
  void track({
    name: 'locale.changed',
    ...(profileId === undefined ? {} : { profileId }),
    payload: { from, to, scope, source },
  });
}

/** The profile's settings minus the locale override; every other field (romanization, readToMe) is kept. */
function withoutLocale(settings: ProfileSettings | undefined): ProfileSettings {
  const fallback: ProfileSettings = { romanizationMode: 'always' };
  const { uiLocale: _dropped, ...rest } = settings ?? fallback;
  return rest;
}

export const useLocaleStore = create<State & Actions>((set, get) => ({
  detected: detectInitialLocale(),
  device: null,
  byProfile: {},
  hydrated: false,

  hydrate: async (profileIds) => {
    const storedDevice = DeviceSettingsSchema.safeParse(await readJson<unknown>(DEVICE_KEY));
    const byProfile: Record<string, ProfileSettings> = {};
    for (const id of profileIds) {
      const parsed = ProfileSettingsSchema.safeParse(await readJson<unknown>(profileKey(id)));
      if (parsed.success) byProfile[id] = parsed.data;
    }
    // Always taken so the address bar is cleaned; it only counts when the device never chose.
    const handoff = takeLangHandoff();
    const device = (storedDevice.success ? storedDevice.data.uiLocale : undefined) ?? null;
    set({ device, byProfile, hydrated: true });
    // A stored choice in a currently hidden locale is ignored, so it does not block the hand-off either.
    if (visible(device) === undefined && handoff !== null) get().setDeviceLocale(handoff, 'handoff');
  },

  setDeviceLocale: (locale, source = 'settings') => {
    const { detected, device } = get();
    const from = effectiveLocale({ device, detected });
    set({ device: locale });
    persist(locale === null ? removeKey(DEVICE_KEY) : writeJson(DEVICE_KEY, { uiLocale: locale }));
    reportLocaleChange(from, effectiveLocale({ device: locale, detected }), 'device', source);
  },

  setProfileLocale: (profileId, locale, source = 'settings') => {
    const { detected, device, byProfile } = get();
    const previous = byProfile[profileId];
    const from = effectiveLocale({ profile: previous?.uiLocale, device, detected });
    const next: ProfileSettings = locale === null ? withoutLocale(previous) : { ...withoutLocale(previous), uiLocale: locale };
    set({ byProfile: { ...byProfile, [profileId]: next } });
    persist(writeJson(profileKey(profileId), next));
    reportLocaleChange(from, effectiveLocale({ profile: locale, device, detected }), 'profile', source, profileId);
  },

  setRomanizationMode: (profileId, mode) => {
    const { byProfile } = get();
    const previous = byProfile[profileId];
    const next: ProfileSettings = { ...previous, romanizationMode: mode };
    set({ byProfile: { ...byProfile, [profileId]: next } });
    persist(writeJson(profileKey(profileId), next));
    if ((previous?.romanizationMode ?? 'always') !== mode) {
      void track({ name: 'romanization.mode_changed', profileId, payload: { mode } });
    }
  },

  setReadToMe: (profileId, readToMe) => {
    const { byProfile } = get();
    const next: ProfileSettings = { romanizationMode: 'always', ...byProfile[profileId], readToMe };
    set({ byProfile: { ...byProfile, [profileId]: next } });
    persist(writeJson(profileKey(profileId), next));
  },

  forgetProfile: (profileId) => {
    const { [profileId]: _gone, ...rest } = get().byProfile;
    set({ byProfile: rest });
    persist(removeKey(profileKey(profileId)));
  },
}));

// Removing a profile also removes its `settings:${profileId}` (F-I18N-001 §3.2).
onProfileRemoved((profileId) => useLocaleStore.getState().forgetProfile(profileId));

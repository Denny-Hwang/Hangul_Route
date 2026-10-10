import {
  DeviceSettingsSchema,
  ProfileSettingsSchema,
  type ProfileSettings,
  type RomanizationMode,
} from '@hangul-route/content-schema';
import { detectLocale, resolveLocale, type UiLocale } from '@hangul-route/i18n';
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
  /** Profile removal: drop that profile's settings (and their stored key). */
  forgetProfile: (profileId: string) => void;
}

/** Detection from the platform's language list; the very first render already has a sensible locale. */
export function detectInitialLocale(): UiLocale {
  return detectLocale(deviceLanguages());
}

/** The locale the UI renders in for the active profile (`null` = no profile yet). */
export function activeLocale(state: Pick<State, 'detected' | 'device' | 'byProfile'>, activeProfileId: string | null): UiLocale {
  return resolveLocale({
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

function withoutLocale(settings: ProfileSettings | undefined): ProfileSettings {
  return { romanizationMode: settings?.romanizationMode ?? 'always' };
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
    if (device === null && handoff !== null) get().setDeviceLocale(handoff, 'handoff');
  },

  setDeviceLocale: (locale, source = 'settings') => {
    const { detected, device } = get();
    const from = resolveLocale({ device, detected });
    set({ device: locale });
    persist(locale === null ? removeKey(DEVICE_KEY) : writeJson(DEVICE_KEY, { uiLocale: locale }));
    reportLocaleChange(from, resolveLocale({ device: locale, detected }), 'device', source);
  },

  setProfileLocale: (profileId, locale, source = 'settings') => {
    const { detected, device, byProfile } = get();
    const previous = byProfile[profileId];
    const from = resolveLocale({ profile: previous?.uiLocale, device, detected });
    const next: ProfileSettings = locale === null ? withoutLocale(previous) : { ...withoutLocale(previous), uiLocale: locale };
    set({ byProfile: { ...byProfile, [profileId]: next } });
    persist(writeJson(profileKey(profileId), next));
    reportLocaleChange(from, resolveLocale({ profile: locale, device, detected }), 'profile', source, profileId);
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

  forgetProfile: (profileId) => {
    const { [profileId]: _gone, ...rest } = get().byProfile;
    set({ byProfile: rest });
    persist(removeKey(profileKey(profileId)));
  },
}));

// Removing a profile also removes its `settings:${profileId}` (F-I18N-001 §3.2).
onProfileRemoved((profileId) => useLocaleStore.getState().forgetProfile(profileId));

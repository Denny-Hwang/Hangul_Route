import {
  DEFAULT_CHALLENGE_MODE,
  DEFAULT_CLOCK_SCALE,
  DEFAULT_TEXT_SIZE,
  DEVICE_SETTINGS_KEY,
  DeviceSettingsSchema,
  ProfileSettingsSchema,
  type ClockScale,
  type DeviceSettings,
  type ProfileSettings,
  type RomanizationMode,
  type TextSize,
} from '@hangul-route/content-schema';
import { availableLocales, detectLocale, resolveLocale, type UiLocale } from '@hangul-route/i18n';
import { create } from 'zustand';
import { deviceLanguages, takeLangHandoff } from '../platform/locale';
import { postDeviceSettings, subscribeDeviceSettings } from '../platform/prefs-channel';
import { readJson, removeKey, writeJson } from '../platform/storage';
import { track } from '../platform/telemetry';
import { onProfileRemoved } from './profile-removal';

/**
 * UI locale, text size and romanization display settings (F-I18N-001 §3.2; owner items 6 and 7:
 * one UI language per device and per account). A local-first device preference, never part of
 * the synced `Profile`.
 *
 * - The device record `device:settings` holds the language (`uiLocale`, `uiLocaleAt`) and the
 *   text size. Every surface of the origin reads and writes it: the learner app, All lessons,
 *   the presenter and the grown-up pages (which may seed it from a signed-in grown-up's
 *   account). Resolution is device > account seed (written into the record by the grown-up
 *   pages) > detection > `en`; there is no per-profile language and no tab-only override.
 * - `settings:${profileId}` keeps the per-profile settings that are not about the UI language
 *   (romanization, Read to me, Challenge). A language stored there by an older version is
 *   promoted to the device once (when the device never chose) and then stripped.
 *
 * Only locale codes reach telemetry (`locale.changed`, scope `device`); the text size is not
 * reported.
 */

const DEVICE_KEY = DEVICE_SETTINGS_KEY;
const profileKey = (profileId: string): string => `settings:${profileId}`;

/** Where a locale change came from (telemetry payload `source`). */
export type LocaleChangeSource = 'welcome' | 'settings' | 'handoff';

/** Where a Challenge change came from (`vocab.challenge_toggled` payload `source`, F-VOC-004 §3.10). */
export type ChallengeSource = 'profile' | 'start_sheet';

/** What a root does with a `?lang=` hand-off: seed a device that never chose, or only clean the address (the presenter). */
export type HandoffUse = 'seed' | 'ignore';

/**
 * The time a migrated language is stamped with (AMENDMENTS-DISPLAY-NAV section 3.3: older than any
 * real choice), so a signed-in account's choice always wins the merge over it.
 */
export const MIGRATED_AT = new Date(0).toISOString();

interface State {
  /** What the platform prefers (hidden locales excluded); a default, not a choice. */
  detected: UiLocale;
  /** The device record's language; `null` = never chosen. */
  device: UiLocale | null;
  /** When the device language was chosen (ISO); `null` for a choice stored before timestamps; `MIGRATED_AT` for a migrated one. */
  deviceAt: string | null;
  /** The device record's text size. */
  textSize: TextSize;
  byProfile: Record<string, ProfileSettings>;
  hydrated: boolean;
}

interface Actions {
  /**
   * Reads the device record and the profiles' settings. `activeProfileId` names the profile whose
   * old language override is promoted to the device when the device never chose (with no active
   * profile, the only one). `handoff: 'ignore'` (the presenter) takes a `?lang=` out of the
   * address without using it; the default seeds a device that never chose.
   */
  hydrate: (profileIds: string[], options?: { handoff?: HandoffUse; activeProfileId?: string | null }) => Promise<void>;
  /** The person chose a language on this device: stored with its time, told to the other tabs. */
  setDeviceLocale: (locale: UiLocale, source?: LocaleChangeSource) => void;
  /** A `?lang=` or All lessons pass language: only for a device that never chose (stamped now, AMENDMENTS-DISPLAY-NAV section 3.4). */
  seedDeviceLocale: (locale: UiLocale) => void;
  setTextSize: (size: TextSize) => void;
  /** A record another tab wrote (BroadcastChannel) or a re-read found: applied in memory, never written back. */
  applyDeviceRecord: (record: DeviceSettings) => void;
  /** Re-reads the device record (a page back in front); a failed read keeps what is in memory. */
  rereadDevice: () => Promise<void>;
  setRomanizationMode: (profileId: string, mode: RomanizationMode) => void;
  /** The story reader's Read to me switch (F-STORY-002 §3.4); no telemetry. */
  setReadToMe: (profileId: string, readToMe: boolean) => void;
  /**
   * The Speed Round's Challenge opt-in (F-VOC-004 S8); reports `vocab.challenge_toggled` when it changes.
   * `scale`, when given, is written with the mode in one step (the screen-reader opt-in pre-selects 2x, §3.8),
   * so one `vocab.challenge_toggled` reports the clock the learner will actually get.
   */
  setChallengeMode: (profileId: string, on: boolean, source: ChallengeSource, scale?: ClockScale) => void;
  /** The Challenge clock scale (F-VOC-004 §3.1); reports `vocab.challenge_toggled` when it changes. */
  setClockScale: (profileId: string, scale: ClockScale, source?: ChallengeSource) => void;
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
function effectiveLocale(levels: { device?: UiLocale | null; detected?: UiLocale | null }): UiLocale {
  return resolveLocale({ device: visible(levels.device), detected: visible(levels.detected) });
}

/**
 * The locale every screen renders in: the device record, else detection, else English. The same
 * for every profile (one UI language per device); the profile id parameter is gone.
 */
export function activeLocale(state: Pick<State, 'detected' | 'device'>): UiLocale {
  return effectiveLocale({ device: state.device, detected: state.detected });
}

/** Whether the device record holds a language that counts now (a hidden one does not). */
export function deviceChose(state: Pick<State, 'device'>): boolean {
  return visible(state.device) !== undefined;
}

/** The record as the store holds it, for a write. */
function recordOf(state: Pick<State, 'device' | 'deviceAt' | 'textSize'>): DeviceSettings {
  return {
    ...(state.device === null ? {} : { uiLocale: state.device }),
    ...(state.device !== null && state.deviceAt !== null ? { uiLocaleAt: state.deviceAt } : {}),
    ...(state.textSize === DEFAULT_TEXT_SIZE ? {} : { textSize: state.textSize }),
  };
}

/** The store's fields for a record. */
function fieldsOf(record: DeviceSettings): Pick<State, 'device' | 'deviceAt' | 'textSize'> {
  return { device: record.uiLocale ?? null, deviceAt: record.uiLocale !== undefined ? (record.uiLocaleAt ?? null) : null, textSize: record.textSize ?? DEFAULT_TEXT_SIZE };
}

/** Storage is best effort: a failed write keeps the in-memory choice for the session. */
function persist(write: Promise<void>): void {
  write.catch(() => undefined);
}

/**
 * Read-modify-write of the device record, so a field another tab wrote meanwhile (the grown-up
 * pages write the same record) is kept; then the other tabs are told.
 */
async function writeRecord(patch: (stored: DeviceSettings) => DeviceSettings, fallback: DeviceSettings): Promise<void> {
  const read = DeviceSettingsSchema.safeParse(await readJson<unknown>(DEVICE_KEY));
  const next = patch(read.success ? read.data : fallback);
  await writeJson(DEVICE_KEY, next);
  postDeviceSettings(next);
}

function reportLocaleChange(from: UiLocale, to: UiLocale, source: LocaleChangeSource): void {
  if (from === to) return;
  void track({ name: 'locale.changed', payload: { from, to, scope: 'device', source } });
}

function reportChallenge(profileId: string, on: boolean, source: ChallengeSource, clockScale: ClockScale): void {
  void track({ name: 'vocab.challenge_toggled', profileId, payload: { on, source, clockScale } });
}

/** The profile's settings minus a retired language override; every other field is kept. */
function withoutLocale(settings: ProfileSettings): ProfileSettings {
  const { uiLocale: _dropped, ...rest } = settings;
  return rest;
}

/** The profile whose old override may become the device language: the active one, else the only one. */
function promotionSource(profileIds: readonly string[], activeProfileId: string | null | undefined): string | null {
  if (activeProfileId != null && profileIds.includes(activeProfileId)) return activeProfileId;
  return profileIds.length === 1 ? profileIds[0]! : null;
}

export const useLocaleStore = create<State & Actions>((set, get) => ({
  detected: detectInitialLocale(),
  device: null,
  deviceAt: null,
  textSize: DEFAULT_TEXT_SIZE,
  byProfile: {},
  hydrated: false,

  hydrate: async (profileIds, options) => {
    const storedDevice = DeviceSettingsSchema.safeParse(await readJson<unknown>(DEVICE_KEY));
    let record: DeviceSettings = storedDevice.success ? storedDevice.data : {};
    const byProfile: Record<string, ProfileSettings> = {};
    const overrides: Record<string, UiLocale> = {};
    for (const id of profileIds) {
      const parsed = ProfileSettingsSchema.safeParse(await readJson<unknown>(profileKey(id)));
      if (!parsed.success) continue;
      if (parsed.data.uiLocale !== undefined) overrides[id] = parsed.data.uiLocale;
      byProfile[id] = withoutLocale(parsed.data);
    }
    // One-time migration (AMENDMENTS-DISPLAY-NAV section 3.3): a device that never chose takes the
    // active (or only) profile's old override, stamped older than any real choice, then every
    // profile's stored override is stripped.
    const source = promotionSource(profileIds, options?.activeProfileId);
    const promoted = record.uiLocale === undefined && source !== null ? overrides[source] : undefined;
    if (promoted !== undefined) {
      record = { ...record, uiLocale: promoted, uiLocaleAt: MIGRATED_AT };
      persist(writeRecord((stored) => (stored.uiLocale === undefined ? { ...stored, uiLocale: promoted, uiLocaleAt: MIGRATED_AT } : stored), record));
    }
    for (const id of Object.keys(overrides)) persist(writeJson(profileKey(id), byProfile[id]!));
    // Always taken so the address bar is cleaned; it only counts when the device never chose.
    const handoff = takeLangHandoff();
    set({ ...fieldsOf(record), byProfile, hydrated: true });
    if (handoff !== null && options?.handoff !== 'ignore') get().seedDeviceLocale(handoff);
  },

  setDeviceLocale: (locale, source = 'settings') => {
    const from = activeLocale(get());
    const at = new Date().toISOString();
    set({ device: locale, deviceAt: at });
    persist(writeRecord((stored) => ({ ...stored, uiLocale: locale, uiLocaleAt: at }), recordOf(get())));
    reportLocaleChange(from, activeLocale(get()), source);
  },

  seedDeviceLocale: (locale) => {
    // A stored choice in a currently hidden locale is ignored, so it does not block the seed either.
    if (deviceChose(get()) || visible(locale) === undefined) return;
    const from = activeLocale(get());
    const at = new Date().toISOString();
    set({ device: locale, deviceAt: at });
    persist(writeRecord((stored) => ({ ...stored, uiLocale: locale, uiLocaleAt: at }), recordOf(get())));
    reportLocaleChange(from, activeLocale(get()), 'handoff');
  },

  setTextSize: (size) => {
    if (get().textSize === size) return;
    set({ textSize: size });
    persist(writeRecord((stored) => ({ ...stored, textSize: size }), recordOf(get())));
  },

  applyDeviceRecord: (record) => {
    set(fieldsOf(record));
  },

  rereadDevice: async () => {
    const raw = await readJson<unknown>(DEVICE_KEY);
    // A missing or failed read (both null) is not "never chose": keep what this tab already shows.
    if (raw === null) return;
    const parsed = DeviceSettingsSchema.safeParse(raw);
    if (parsed.success) set(fieldsOf(parsed.data));
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

  setChallengeMode: (profileId, on, source, scale) => {
    const { byProfile } = get();
    const previous = byProfile[profileId];
    const next: ProfileSettings = { romanizationMode: 'always', ...previous, challengeMode: on, ...(scale === undefined ? {} : { clockScale: scale }) };
    set({ byProfile: { ...byProfile, [profileId]: next } });
    persist(writeJson(profileKey(profileId), next));
    const scaleChanged = scale !== undefined && (previous?.clockScale ?? DEFAULT_CLOCK_SCALE) !== scale;
    if ((previous?.challengeMode ?? DEFAULT_CHALLENGE_MODE) !== on || scaleChanged) {
      reportChallenge(profileId, on, source, next.clockScale ?? DEFAULT_CLOCK_SCALE);
    }
  },

  setClockScale: (profileId, scale, source = 'profile') => {
    const { byProfile } = get();
    const previous = byProfile[profileId];
    const next: ProfileSettings = { romanizationMode: 'always', ...previous, clockScale: scale };
    set({ byProfile: { ...byProfile, [profileId]: next } });
    persist(writeJson(profileKey(profileId), next));
    if ((previous?.clockScale ?? DEFAULT_CLOCK_SCALE) !== scale) {
      reportChallenge(profileId, next.challengeMode ?? DEFAULT_CHALLENGE_MODE, source, scale);
    }
  },

  forgetProfile: (profileId) => {
    const { [profileId]: _gone, ...rest } = get().byProfile;
    set({ byProfile: rest });
    persist(removeKey(profileKey(profileId)));
  },
}));

/**
 * Follows the device record across tabs: a record another tab posted is applied, and the page
 * re-reads the record when it comes back to the front. Each root (learner app, All lessons, the
 * presenter) calls this once at boot; returns the unsubscribe.
 */
export function followDeviceSettings(): () => void {
  return subscribeDeviceSettings(
    (record) => useLocaleStore.getState().applyDeviceRecord(record),
    () => {
      void useLocaleStore
        .getState()
        .rereadDevice()
        .catch(() => undefined);
    },
  );
}

// Removing a profile also removes its `settings:${profileId}` (F-I18N-001 §3.2).
onProfileRemoved((profileId) => useLocaleStore.getState().forgetProfile(profileId));

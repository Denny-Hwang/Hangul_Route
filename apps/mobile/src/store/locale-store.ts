import {
  DEFAULT_CHALLENGE_MODE,
  DEFAULT_CLOCK_SCALE,
  DEFAULT_TEXT_SIZE,
  DEVICE_SETTINGS_KEY,
  DeviceSettingsSchema,
  MIGRATED_AT,
  ProfileSettingsSchema,
  mergeDeviceSettings,
  type ClockScale,
  type DeviceSettings,
  type DeviceSettingsPatch,
  type ProfileSettings,
  type RomanizationMode,
  type TextSize,
} from '@hangul-route/content-schema';
import { availableLocales, detectLocale, resolveLocale, type UiLocale } from '@hangul-route/i18n';
import { create } from 'zustand';
import { deviceLanguages, takeLangHandoff } from '../platform/locale';
import { postDeviceSettings, subscribeDeviceSettings } from '../platform/prefs-channel';
import { readJson, readJsonStrict, removeKey, updateJson, writeJson } from '../platform/storage';
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
 *   (romanization, Read to me, Challenge). A language stored there by an older version is the
 *   language the active profile saw (the old resolution put it above the device), so it is
 *   promoted to the device (stamped `MIGRATED_AT`) and then stripped (AMENDMENTS-DISPLAY-NAV
 *   section 3.3).
 *
 * Only locale codes reach telemetry (`locale.changed`, scope `device`), and only from the learner
 * app: the presenter's and All lessons' Display sheets report nothing (AMENDMENTS-DISPLAY-NAV
 * section 11). The text size is not reported.
 */

const DEVICE_KEY = DEVICE_SETTINGS_KEY;
/** The per-profile settings record (`hr:settings:<id>`); exported for the removal sweep (row OA-7a). */
export const SETTINGS_KEY = (profileId: string): string => `settings:${profileId}`;
const profileKey = SETTINGS_KEY;

/** Where a locale change came from (telemetry payload `source`). */
export type LocaleChangeSource = 'welcome' | 'settings' | 'handoff';

/** Where a Challenge change came from (`vocab.challenge_toggled` payload `source`, F-VOC-004 §3.10). */
export type ChallengeSource = 'profile' | 'start_sheet';

/** What a root does with a `?lang=` hand-off: seed a device that never chose, or only clean the address (the presenter). */
export type HandoffUse = 'seed' | 'ignore';

/**
 * The time a migrated or seeded language is stamped with (AMENDMENTS-DISPLAY-NAV sections 3.3 and
 * 3.4: older than any real choice), so a signed-in account's choice always wins the merge over it.
 */
export { MIGRATED_AT };

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
   * old language override is promoted to the device (with no active profile, the only one): it is
   * what that profile saw, unless the record holds a choice made with its time (section 3.3).
   * `handoff: 'ignore'` (the presenter) takes a `?lang=` out of the address without using it; the
   * default seeds a device that never chose.
   */
  hydrate: (profileIds: string[], options?: { handoff?: HandoffUse; activeProfileId?: string | null }) => Promise<void>;
  /**
   * The person chose a language on this device: stored with its time, told to the other tabs, and
   * reported as `locale.changed` with `source`. `null` reports nothing: the presenter and All
   * lessons send no event for a display choice (AMENDMENTS-DISPLAY-NAV section 11).
   */
  setDeviceLocale: (locale: UiLocale, source?: LocaleChangeSource | null) => void;
  /**
   * A `?lang=` or All lessons pass language: only for a device that never chose, stamped
   * `MIGRATED_AT` (AMENDMENTS-DISPLAY-NAV section 3.4): it is not a choice made here, so a
   * signed-in account's choice beats it and it never overwrites the account.
   */
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

/** The store's fields for a record. */
function fieldsOf(record: DeviceSettings): Pick<State, 'device' | 'deviceAt' | 'textSize'> {
  return { device: record.uiLocale ?? null, deviceAt: record.uiLocale !== undefined ? (record.uiLocaleAt ?? null) : null, textSize: record.textSize ?? DEFAULT_TEXT_SIZE };
}

/** A stored value as a record: a field this version does not know reads as absent. */
function settingsOf(raw: unknown): DeviceSettings {
  const parsed = DeviceSettingsSchema.safeParse(raw ?? {});
  return parsed.success ? parsed.data : {};
}

/** Storage is best effort: a failed write keeps the in-memory choice for the session. */
function persist(write: Promise<unknown>): void {
  write.catch(() => undefined);
}

/** A language chosen on a device with its time: not a migrated or seeded one (`MIGRATED_AT`), and not one stored before times. */
function timedChoice(record: DeviceSettings): boolean {
  return record.uiLocale !== undefined && record.uiLocaleAt !== undefined && record.uiLocaleAt !== MIGRATED_AT;
}

/** What a record write found: the record as stored now, and whether this call wrote it. */
interface RecordWrite {
  record: DeviceSettings;
  wrote: boolean;
}

/**
 * Read-modify-write of the device record (AMENDMENTS-DISPLAY-NAV section 3.1), in one step
 * (`updateJson`: one IndexedDB transaction on the web), so a field another tab or another call
 * writes in between is never lost. `decide` sees what is stored now and returns the fields to
 * change, or null to change nothing. Only those fields change, so a key this build does not know
 * (a newer build's field or value) survives. A record that cannot be read is never written: the
 * write rejects and the change stays in this tab's memory. A written record is told to the other
 * tabs; resolves to the record as stored now.
 */
async function writeRecord(decide: (stored: DeviceSettings) => DeviceSettingsPatch | null): Promise<RecordWrite> {
  let record: DeviceSettings = {};
  const wrote = await updateJson<unknown>(DEVICE_KEY, (raw) => {
    record = settingsOf(raw);
    const patch = decide(record);
    if (patch === null) return undefined;
    const next = mergeDeviceSettings(raw, patch);
    record = settingsOf(next);
    return next;
  });
  if (wrote) postDeviceSettings(record);
  return { record, wrote };
}

function reportLocaleChange(from: UiLocale, to: UiLocale, source: LocaleChangeSource | null): void {
  if (from === to || source === null) return;
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
    // A failed read is not "never chose": the migration then waits for a boot that can read it.
    let readable = true;
    let raw: unknown = null;
    try {
      raw = await readJsonStrict<unknown>(DEVICE_KEY);
    } catch {
      readable = false;
    }
    let record = settingsOf(raw);
    const byProfile: Record<string, ProfileSettings> = {};
    const overrides: Record<string, UiLocale> = {};
    for (const id of profileIds) {
      const parsed = ProfileSettingsSchema.safeParse(await readJson<unknown>(profileKey(id)));
      if (!parsed.success) continue;
      if (parsed.data.uiLocale !== undefined) overrides[id] = parsed.data.uiLocale;
      byProfile[id] = withoutLocale(parsed.data);
    }
    // Migration (AMENDMENTS-DISPLAY-NAV section 3.3): the active (or only) profile's old override
    // is the language that profile saw (the old resolution put it above the device), so it becomes
    // the device's, stamped older than any real choice, whatever language the record held, unless
    // the record holds a choice made with its time: that one was made on this build, after the
    // override (a leftover from a strip cut short, or one written again by a cached older build,
    // which has no time), so it stays and the override is only stripped. Only after the fold is
    // stored is every profile's override stripped, so a failed write loses nothing.
    const source = promotionSource(profileIds, options?.activeProfileId);
    const promoted = readable && source !== null ? overrides[source] : undefined;
    const fold = promoted !== undefined && promoted !== record.uiLocale && !timedChoice(record);
    if (fold) record = { ...record, uiLocale: promoted, uiLocaleAt: MIGRATED_AT };
    const strip = readable ? Object.keys(overrides) : [];
    if (fold || strip.length > 0) {
      persist(
        (async () => {
          // Decided again on what is stored when the write runs: a timed choice another tab stored meanwhile stays.
          if (fold) await writeRecord((stored) => (timedChoice(stored) ? null : { uiLocale: promoted, uiLocaleAt: MIGRATED_AT }));
          for (const id of strip) await writeJson(profileKey(id), byProfile[id]!);
        })(),
      );
    }
    // Always taken so the address bar is cleaned; it only counts when the device never chose. On a
    // record that could not be read it holds for this page only: the seed's write reads the record
    // again and changes nothing it finds chosen, and writes nothing when it still cannot read it.
    const handoff = takeLangHandoff();
    set({ ...fieldsOf(record), byProfile, hydrated: true });
    if (handoff !== null && options?.handoff !== 'ignore') get().seedDeviceLocale(handoff);
  },

  setDeviceLocale: (locale, source = 'settings') => {
    const from = activeLocale(get());
    const at = new Date().toISOString();
    set({ device: locale, deviceAt: at });
    persist(writeRecord(() => ({ uiLocale: locale, uiLocaleAt: at })));
    reportLocaleChange(from, activeLocale(get()), source);
  },

  seedDeviceLocale: (locale) => {
    // A stored choice in a currently hidden locale is ignored, so it does not block the seed either.
    if (deviceChose(get()) || visible(locale) === undefined) return;
    const from = activeLocale(get());
    set({ device: locale, deviceAt: MIGRATED_AT });
    // A choice stored meanwhile (another tab, or one this tab's first read could not see) is kept and shown.
    persist(
      writeRecord((stored) => (visible(stored.uiLocale) !== undefined ? null : { uiLocale: locale, uiLocaleAt: MIGRATED_AT })).then(({ record, wrote }) => {
        if (!wrote && visible(record.uiLocale) !== undefined) get().applyDeviceRecord(record);
      }),
    );
    reportLocaleChange(from, activeLocale(get()), 'handoff');
  },

  setTextSize: (size) => {
    if (get().textSize === size) return;
    set({ textSize: size });
    persist(writeRecord(() => ({ textSize: size })));
  },

  applyDeviceRecord: (record) => {
    set(fieldsOf(record));
  },

  rereadDevice: async () => {
    const raw = await readJson<unknown>(DEVICE_KEY);
    // A missing or failed read (both null), or a damaged value, is not "never chose": keep what this tab already shows.
    if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) return;
    set(fieldsOf(settingsOf(raw)));
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

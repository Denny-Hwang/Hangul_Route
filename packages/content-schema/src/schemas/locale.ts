import { z } from 'zod';

/**
 * UI locale and local-first display settings (F-I18N-001 §3.2).
 *
 * Locale is a device preference, not part of the synced `Profile`: it is stored
 * under `device:settings` (one language per device since owner items 6 and 7; a
 * signed-in grown-up's account may carry it too) and never reaches a learner
 * record (only locale ids reach telemetry). `packages/i18n` re-exports these.
 */
export const UI_LOCALES = ['en', 'es', 'ko'] as const;
export const UiLocaleSchema = z.enum(UI_LOCALES);
export type UiLocale = z.infer<typeof UiLocaleSchema>;
export const DEFAULT_UI_LOCALE: UiLocale = 'en';

/** Whether taught-Korean romanization is always visible or hidden until tapped (D2). */
export const RomanizationModeSchema = z.enum(['always', 'tap']);
export type RomanizationMode = z.infer<typeof RomanizationModeSchema>;

/**
 * Challenge mode clock scales (F-VOC-004 §3.1, S8): the one Challenge clock is
 * 60 s x scale. Labelled "Normal / A bit longer / Twice as long" in the UI.
 */
export const CLOCK_SCALES = [1, 1.5, 2] as const;
/** Built from `CLOCK_SCALES`, so the list and the schema cannot drift apart. */
export const ClockScaleSchema = z.union([z.literal(CLOCK_SCALES[0]), z.literal(CLOCK_SCALES[1]), z.literal(CLOCK_SCALES[2])]);
export type ClockScale = z.infer<typeof ClockScaleSchema>;
/** Challenge is opt-in: off unless the learner or a caregiver turns it on (D3). */
export const DEFAULT_CHALLENGE_MODE = false;
export const DEFAULT_CLOCK_SCALE: ClockScale = 1;

/** Per-profile local settings; other specs may add optional fields (additive only). */
export const ProfileSettingsSchema = z.object({
  /**
   * Retired (owner items 6 and 7: one UI language per device). Still parsed so a stored override
   * can be promoted to the device once and then stripped; nothing reads it for the UI.
   */
  uiLocale: UiLocaleSchema.optional(),
  romanizationMode: RomanizationModeSchema.default('always'),
  /**
   * Story reader "Read to me" (F-STORY-002 §3.4, PR 2.5). Additive and optional:
   * absent means "use the level default" (`readToMeDefault`), so settings stored
   * before this field existed keep parsing unchanged.
   */
  readToMe: z.boolean().optional(),
  /**
   * Challenge mode (F-VOC-004 S8): the app's one Challenge setting, shared with
   * F-RVW-001's Daily Test. Additive and optional: absent means
   * `DEFAULT_CHALLENGE_MODE` (off), so settings stored before this field existed
   * keep parsing and keep their stored shape. A value this version does not
   * know (a later spec's scale read after a rollback, say) reads as absent
   * instead of failing the whole record, which would reset the learner's other
   * settings.
   */
  challengeMode: z.boolean().optional().catch(undefined),
  /** Challenge clock scale (F-VOC-004 §3.1); absent or unknown means `DEFAULT_CLOCK_SCALE`. */
  clockScale: ClockScaleSchema.optional().catch(undefined),
});
export type ProfileSettings = z.infer<typeof ProfileSettingsSchema>;

/**
 * Display text size steps (owner items 6 and 7): one per device, read by every surface (learner
 * app, All lessons, the presenter's chrome and the grown-up pages). `standard` is the size the
 * type scale was designed at; the factor of each step lives in `@hangul-route/design-system`
 * (`TEXT_SIZE_FACTORS`).
 */
export const TEXT_SIZES = ['standard', 'large', 'larger', 'largest'] as const;
export const TextSizeSchema = z.enum(TEXT_SIZES);
export type TextSize = z.infer<typeof TextSizeSchema>;
export const DEFAULT_TEXT_SIZE: TextSize = 'standard';

/**
 * The time a language that nobody chose on this device is stamped with: a language migrated from
 * an old per-profile override, a stored console choice folded in, a `?lang=` hand-off or an All
 * lessons pass that seeded a device that never chose (AMENDMENTS-DISPLAY-NAV sections 3.3 and
 * 3.4). It is older than any real choice, so a signed-in grown-up's account choice always wins the
 * newer-wins merge over it, and a link never overwrites the account.
 */
export const MIGRATED_AT = '1970-01-01T00:00:00.000Z';

/**
 * Per-device settings, the one display record of a device (`device:settings`, stored by the
 * learner app as `hr:device:settings`; the grown-up pages on the same origin read and write the
 * same record). Additive only: a record stored before a field existed keeps parsing, and every
 * field reads a value this version does not know (a later locale or step, a rollback) as absent
 * instead of failing the whole record. Writers patch the stored object (`mergeDeviceSettings`),
 * so a field a newer build added survives a write by an older one.
 */
export const DeviceSettingsSchema = z.object({
  /** Absent = never chosen: use the account seed, then platform detection. */
  uiLocale: UiLocaleSchema.optional().catch(undefined),
  /**
   * When `uiLocale` was chosen (ISO 8601), for the newer-wins merge with a signed-in grown-up's
   * account. A choice on the Display sheet or Welcome is stamped with the time it was made; a
   * migrated or seeded language is stamped `MIGRATED_AT`. Absent (a choice stored before this
   * field existed, or a value that is not an ISO date-time) counts as `MIGRATED_AT`.
   */
  uiLocaleAt: z.string().datetime({ offset: true }).optional().catch(undefined),
  /** Absent = `DEFAULT_TEXT_SIZE`. A step this version does not know reads as absent, never resetting the record. */
  textSize: TextSizeSchema.optional().catch(undefined),
});
export type DeviceSettings = z.infer<typeof DeviceSettingsSchema>;

/** The device record's storage key (the learner app's wrapper adds the `hr:` prefix). */
export const DEVICE_SETTINGS_KEY = 'device:settings';

/** A change to the device record: the fields to set, or `clearLocale` to forget the language (and its time). */
export interface DeviceSettingsPatch {
  uiLocale?: UiLocale;
  uiLocaleAt?: string;
  textSize?: TextSize;
  clearLocale?: true;
}

/** The stored record as a plain object (every key kept), or `{}` when it is missing or not an object. */
export function rawDeviceSettings(raw: unknown): Record<string, unknown> {
  return raw !== null && typeof raw === 'object' && !Array.isArray(raw) ? { ...(raw as Record<string, unknown>) } : {};
}

/**
 * Read-modify-write of the device record (AMENDMENTS-DISPLAY-NAV section 3.1): the stored object
 * with only the named fields changed, so a key this build does not know (a later field, or a
 * value of a later locale or step) survives the write. The record is never removed: clearing the
 * language deletes `uiLocale` and `uiLocaleAt` only.
 */
export function mergeDeviceSettings(raw: unknown, patch: DeviceSettingsPatch): Record<string, unknown> {
  const next = rawDeviceSettings(raw);
  if (patch.clearLocale === true) {
    delete next.uiLocale;
    delete next.uiLocaleAt;
  }
  if (patch.uiLocale !== undefined) next.uiLocale = patch.uiLocale;
  if (patch.uiLocaleAt !== undefined) next.uiLocaleAt = patch.uiLocaleAt;
  if (patch.textSize !== undefined) next.textSize = patch.textSize;
  return next;
}

/**
 * The BroadcastChannel every surface on the app origin posts a display record change on (the
 * learner app, All lessons, the presenter and the grown-up pages), so an open tab switches its
 * language and text size live. A tab also re-reads the record on `visibilitychange` and
 * `pageshow`, for a browser without BroadcastChannel and a page restored from the back cache.
 */
export const PREFS_CHANNEL = 'hr-prefs';

/** What a surface posts on `PREFS_CHANNEL` after it wrote the record. Strict: anything else on the channel is ignored. */
export const PrefsMessageSchema = z
  .object({
    ns: z.literal(PREFS_CHANNEL),
    v: z.literal(1),
    type: z.literal('device-settings'),
    settings: DeviceSettingsSchema,
  })
  .strict();
export type PrefsMessage = z.infer<typeof PrefsMessageSchema>;

/** The message a surface posts after it wrote the device record (only the fields this version knows). */
export function prefsMessage(settings: DeviceSettings): PrefsMessage {
  return { ns: PREFS_CHANNEL, v: 1, type: 'device-settings', settings: DeviceSettingsSchema.parse(settings) };
}

/**
 * A signed-in grown-up's language as the account keeps it (Clerk `unsafeMetadata`, owner items
 * 6 and 7). Lenient: an account written by an older page, or edited by hand, reads as no
 * language rather than failing the sign-in.
 */
export const AccountLocaleSchema = z.object({
  uiLocale: UiLocaleSchema.optional().catch(undefined),
  uiLocaleAt: z.string().datetime({ offset: true }).optional().catch(undefined),
});
export type AccountLocale = z.infer<typeof AccountLocaleSchema>;

export interface LocaleMergeResult {
  /** The device record's new language (written and broadcast), or null when the device keeps what it has. */
  device: { uiLocale: UiLocale; uiLocaleAt: string } | null;
  /** The language to write to the account, or null when the account keeps what it has. */
  account: { uiLocale: UiLocale; uiLocaleAt: string } | null;
}

/** A choice's time in ms; a missing or unparsable time is `MIGRATED_AT` (0). */
const choiceMs = (iso: string | undefined): number => {
  const ms = iso === undefined ? Number.NaN : Date.parse(iso);
  return Number.isFinite(ms) ? ms : 0;
};

/** A stored time as written, or `MIGRATED_AT` when it is missing or does not parse. */
const choiceAt = (iso: string | undefined): string => (iso !== undefined && Number.isFinite(Date.parse(iso)) ? iso : MIGRATED_AT);

/**
 * The newer-wins merge of the device record and a signed-in grown-up's account (owner items 6 and
 * 7; AMENDMENTS-DISPLAY-NAV section 5). Each side may hold a language and when it was chosen; a
 * missing time counts as `MIGRATED_AT`, so a migrated, seeded or pre-timestamp language never
 * beats a real choice:
 *
 * - neither has a language: nothing to do;
 * - only the account has one: it seeds the device, with the account's time;
 * - only the device has one: the account takes it, with the device's time (never "now", so a
 *   device that never really chose cannot outrank a later choice made elsewhere);
 * - both, and they agree: nothing to do, except that a real device time fills an account that has
 *   none;
 * - both differ: the later time wins on both sides; a tie keeps each side as it is.
 *
 * The text size is a device setting only and is never touched.
 */
export function mergeAccountLocale(device: DeviceSettings, account: AccountLocale | null): LocaleMergeResult {
  const acc = account?.uiLocale;
  const dev = device.uiLocale;
  if (dev === undefined && acc === undefined) return { device: null, account: null };
  if (dev === undefined) return { device: { uiLocale: acc!, uiLocaleAt: choiceAt(account?.uiLocaleAt) }, account: null };
  const devMs = choiceMs(device.uiLocaleAt);
  if (acc === undefined) return { device: null, account: { uiLocale: dev, uiLocaleAt: choiceAt(device.uiLocaleAt) } };
  const accMs = choiceMs(account?.uiLocaleAt);
  if (acc === dev) {
    const fill = accMs === 0 && devMs > 0;
    return { device: null, account: fill ? { uiLocale: dev, uiLocaleAt: choiceAt(device.uiLocaleAt) } : null };
  }
  if (accMs > devMs) return { device: { uiLocale: acc, uiLocaleAt: choiceAt(account?.uiLocaleAt) }, account: null };
  if (devMs > accMs) return { device: null, account: { uiLocale: dev, uiLocaleAt: choiceAt(device.uiLocaleAt) } };
  return { device: null, account: null };
}

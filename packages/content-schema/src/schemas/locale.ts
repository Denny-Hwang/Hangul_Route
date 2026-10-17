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
 * Per-device settings, the one display record of a device (`device:settings`, stored by the
 * learner app as `hr:device:settings`; the grown-up pages on the same origin read and write the
 * same record). Additive only: a record stored before a field existed keeps parsing.
 */
export const DeviceSettingsSchema = z.object({
  /** Absent = never chosen: use the account seed, then platform detection. */
  uiLocale: UiLocaleSchema.optional(),
  /**
   * When `uiLocale` was chosen (ISO 8601), for the newer-wins merge with a signed-in grown-up's
   * account; a `?lang=` seed is stamped when it seeds. A language migrated from an old per-profile
   * override is stamped 1970-01-01 (older than any real choice, AMENDMENTS-DISPLAY-NAV section 3.3).
   * Absent only on a choice stored before this field existed: such a device choice wins the merge.
   * A value that is not an ISO date-time reads as absent.
   */
  uiLocaleAt: z.string().datetime({ offset: true }).optional().catch(undefined),
  /** Absent = `DEFAULT_TEXT_SIZE`. A step this version does not know reads as absent, never resetting the record. */
  textSize: TextSizeSchema.optional().catch(undefined),
});
export type DeviceSettings = z.infer<typeof DeviceSettingsSchema>;

/** The device record's storage key (the learner app's wrapper adds the `hr:` prefix). */
export const DEVICE_SETTINGS_KEY = 'device:settings';

/**
 * The BroadcastChannel every surface on the app origin posts a display record change on (the
 * learner app, All lessons, the presenter and the grown-up pages), so an open tab switches its
 * language and text size live. A tab also re-reads the record on `visibilitychange` and
 * `pageshow`, for a browser without BroadcastChannel and a page restored from the back cache.
 */
export const PREFS_CHANNEL = 'hr-prefs';

export const PrefsMessageSchema = z.object({
  v: z.literal(1),
  kind: z.literal('device-settings'),
  value: DeviceSettingsSchema,
});
export type PrefsMessage = z.infer<typeof PrefsMessageSchema>;

/** The message a surface posts after it wrote the device record. */
export function prefsMessage(value: DeviceSettings): PrefsMessage {
  return { v: 1, kind: 'device-settings', value };
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
  /** The device record to write (and broadcast), or null when the device keeps what it has. */
  device: DeviceSettings | null;
  /** The language to write to the account, or null when the account already agrees or the device has none. */
  account: { uiLocale: UiLocale; uiLocaleAt: string } | null;
}

const time = (iso: string | undefined): number | null => {
  if (iso === undefined) return null;
  const ms = Date.parse(iso);
  return Number.isFinite(ms) ? ms : null;
};

/**
 * The newer-wins merge after a grown-up signs in (owner items 6 and 7). The device record and the
 * account each may hold a language and when it was chosen:
 *
 * - neither has a language: nothing to do;
 * - only the account has one: it seeds the device (with the account's timestamp);
 * - only the device has one: the account takes it;
 * - both, and they agree: nothing to do (a missing account timestamp is filled in);
 * - both differ: the newer timestamp wins on both sides. A missing timestamp means the device
 *   wins (a choice stored before timestamps existed is still a choice made on this device); an
 *   account with no timestamp loses to any device choice. A migrated language (stamped 1970) loses
 *   to any stamped account choice.
 *
 * `now` stamps a device choice that has no timestamp when it is copied to the account. The text
 * size is a device setting only and is kept as it is.
 */
export function mergeAccountLocale(device: DeviceSettings, account: AccountLocale | null, now: string): LocaleMergeResult {
  const acc = account?.uiLocale;
  const dev = device.uiLocale;
  if (dev === undefined && acc === undefined) return { device: null, account: null };
  if (dev === undefined) {
    const seeded: DeviceSettings = { ...device, uiLocale: acc! };
    if (account?.uiLocaleAt !== undefined) seeded.uiLocaleAt = account.uiLocaleAt;
    else delete seeded.uiLocaleAt;
    return { device: seeded, account: null };
  }
  const deviceAt = device.uiLocaleAt ?? now;
  if (acc === undefined) return { device: null, account: { uiLocale: dev, uiLocaleAt: deviceAt } };
  if (acc === dev) {
    return { device: null, account: account?.uiLocaleAt === undefined ? { uiLocale: dev, uiLocaleAt: deviceAt } : null };
  }
  const devMs = time(device.uiLocaleAt);
  const accMs = time(account?.uiLocaleAt);
  const accountWins = devMs !== null && accMs !== null && accMs > devMs;
  if (accountWins) return { device: { ...device, uiLocale: acc, uiLocaleAt: account!.uiLocaleAt! }, account: null };
  return { device: null, account: { uiLocale: dev, uiLocaleAt: deviceAt } };
}

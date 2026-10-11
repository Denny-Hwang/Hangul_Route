import { z } from 'zod';

/**
 * UI locale and local-first display settings (F-I18N-001 §3.2).
 *
 * Locale is a device preference, not part of the synced `Profile`: it is stored
 * under `device:settings` and `settings:${profileId}` and never leaves the
 * device (only locale ids reach telemetry). `packages/i18n` re-exports these.
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
export const ClockScaleSchema = z.union([z.literal(1), z.literal(1.5), z.literal(2)]);
export type ClockScale = z.infer<typeof ClockScaleSchema>;
/** Challenge is opt-in: off unless the learner or a caregiver turns it on (D3). */
export const DEFAULT_CHALLENGE_MODE = false;
export const DEFAULT_CLOCK_SCALE: ClockScale = 1;

/** Per-profile local settings; other specs may add optional fields (additive only). */
export const ProfileSettingsSchema = z.object({
  /** Absent = "same as this device". */
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
   * keep parsing and keep their stored shape.
   */
  challengeMode: z.boolean().optional(),
  /** Challenge clock scale (F-VOC-004 §3.1); absent means `DEFAULT_CLOCK_SCALE`. */
  clockScale: ClockScaleSchema.optional(),
});
export type ProfileSettings = z.infer<typeof ProfileSettingsSchema>;

/** Per-device settings. */
export const DeviceSettingsSchema = z.object({
  /** Absent = never chosen: use platform detection. */
  uiLocale: UiLocaleSchema.optional(),
});
export type DeviceSettings = z.infer<typeof DeviceSettingsSchema>;

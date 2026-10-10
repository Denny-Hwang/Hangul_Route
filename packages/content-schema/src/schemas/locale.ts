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

/** Per-profile local settings; other specs may add optional fields (additive only). */
export const ProfileSettingsSchema = z.object({
  /** Absent = "same as this device". */
  uiLocale: UiLocaleSchema.optional(),
  romanizationMode: RomanizationModeSchema.default('always'),
});
export type ProfileSettings = z.infer<typeof ProfileSettingsSchema>;

/** Per-device settings. */
export const DeviceSettingsSchema = z.object({
  /** Absent = never chosen: use platform detection. */
  uiLocale: UiLocaleSchema.optional(),
});
export type DeviceSettings = z.infer<typeof DeviceSettingsSchema>;

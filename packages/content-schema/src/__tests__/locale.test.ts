import { describe, expect, it } from 'vitest';
import {
  DEFAULT_UI_LOCALE,
  DeviceSettingsSchema,
  ProfileSettingsSchema,
  RomanizationModeSchema,
  UI_LOCALES,
  UiLocaleSchema,
  isTelemetryEventName,
} from '../index';

describe('UI locale schemas (F-I18N-001 §3.2)', () => {
  it('lists exactly en, es, ko and defaults to en', () => {
    expect([...UI_LOCALES]).toEqual(['en', 'es', 'ko']);
    expect(DEFAULT_UI_LOCALE).toBe('en');
    for (const l of UI_LOCALES) expect(UiLocaleSchema.safeParse(l).success).toBe(true);
  });

  it('rejects unknown, regional, cased and non-string locales', () => {
    for (const bad of ['fr', 'es-MX', 'EN', '', 'ko_KR', 42, null, undefined]) {
      expect(UiLocaleSchema.safeParse(bad).success).toBe(false);
    }
  });

  it('romanization mode is always or tap', () => {
    expect(RomanizationModeSchema.safeParse('always').success).toBe(true);
    expect(RomanizationModeSchema.safeParse('tap').success).toBe(true);
    expect(RomanizationModeSchema.safeParse('hidden').success).toBe(false);
  });

  it('ProfileSettings defaults romanizationMode to always and leaves uiLocale unset', () => {
    const parsed = ProfileSettingsSchema.parse({});
    expect(parsed).toEqual({ romanizationMode: 'always' });
    expect(parsed.uiLocale).toBeUndefined();
  });

  it('ProfileSettings keeps an explicit locale and mode, and rejects bad values', () => {
    expect(ProfileSettingsSchema.parse({ uiLocale: 'ko', romanizationMode: 'tap' })).toEqual({
      uiLocale: 'ko',
      romanizationMode: 'tap',
    });
    expect(ProfileSettingsSchema.safeParse({ uiLocale: 'fr' }).success).toBe(false);
    expect(ProfileSettingsSchema.safeParse({ romanizationMode: 'never' }).success).toBe(false);
    expect(ProfileSettingsSchema.safeParse('en').success).toBe(false);
  });

  it('DeviceSettings: locale optional (absent = never chosen), unknown rejected', () => {
    expect(DeviceSettingsSchema.parse({})).toEqual({});
    expect(DeviceSettingsSchema.parse({ uiLocale: 'es' })).toEqual({ uiLocale: 'es' });
    expect(DeviceSettingsSchema.safeParse({ uiLocale: 'de' }).success).toBe(false);
  });
});

describe('F-I18N-001 telemetry names (§3.12)', () => {
  it('are accepted by isTelemetryEventName, past-tense spelling only', () => {
    expect(isTelemetryEventName('locale.changed')).toBe(true);
    expect(isTelemetryEventName('romanization.mode_changed')).toBe(true);
    expect(isTelemetryEventName('locale.change')).toBe(false);
    expect(isTelemetryEventName('romanization.mode_change')).toBe(false);
  });
});

import { describe, expect, it } from 'vitest';
import {
  CLOCK_SCALES,
  ClockScaleSchema,
  DEFAULT_CHALLENGE_MODE,
  DEFAULT_CLOCK_SCALE,
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

  it('ProfileSettings.readToMe is an additive optional boolean (F-STORY-002 PR 2.5)', () => {
    expect(ProfileSettingsSchema.parse({ readToMe: true })).toEqual({ romanizationMode: 'always', readToMe: true });
    expect(ProfileSettingsSchema.parse({ readToMe: false }).readToMe).toBe(false);
    // Absent stays absent: the reader falls back to the level default, the schema never invents one.
    expect('readToMe' in ProfileSettingsSchema.parse({})).toBe(false);
    for (const bad of ['yes', 1, null]) {
      expect(ProfileSettingsSchema.safeParse({ readToMe: bad }).success).toBe(false);
    }
  });

  it('settings stored before readToMe existed still parse unchanged', () => {
    const stored = { uiLocale: 'es', romanizationMode: 'tap' };
    expect(ProfileSettingsSchema.parse(stored)).toEqual(stored);
    expect(ProfileSettingsSchema.parse({ uiLocale: 'ko' })).toEqual({ uiLocale: 'ko', romanizationMode: 'always' });
  });

  it('ProfileSettings.challengeMode is off unless chosen, and only a boolean (F-VOC-004 S8)', () => {
    expect(DEFAULT_CHALLENGE_MODE).toBe(false);
    // Absent stays absent so stored settings keep their shape; readers resolve it to DEFAULT_CHALLENGE_MODE.
    const parsed = ProfileSettingsSchema.parse({});
    expect('challengeMode' in parsed).toBe(false);
    expect(parsed.challengeMode ?? DEFAULT_CHALLENGE_MODE).toBe(false);
    expect(ProfileSettingsSchema.parse({ challengeMode: true }).challengeMode).toBe(true);
    expect(ProfileSettingsSchema.parse({ challengeMode: false }).challengeMode).toBe(false);
    // Anything but a boolean reads as absent (off), and never fails the record.
    for (const bad of ['on', 1, 0, null]) {
      const read = ProfileSettingsSchema.parse({ uiLocale: 'es', challengeMode: bad });
      expect(read.challengeMode).toBeUndefined();
      expect(read.uiLocale).toBe('es');
    }
  });

  it('ProfileSettings.clockScale accepts only 1, 1.5 and 2, and defaults to 1 (F-VOC-004 §3.1)', () => {
    expect([...CLOCK_SCALES]).toEqual([1, 1.5, 2]);
    expect(DEFAULT_CLOCK_SCALE).toBe(1);
    expect(ProfileSettingsSchema.parse({}).clockScale ?? DEFAULT_CLOCK_SCALE).toBe(1);
    for (const scale of CLOCK_SCALES) {
      expect(ClockScaleSchema.parse(scale)).toBe(scale);
      expect(ProfileSettingsSchema.parse({ clockScale: scale }).clockScale).toBe(scale);
    }
    for (const bad of [0, 0.5, 1.25, 3, -1, '1', '2', null, Number.NaN]) {
      expect(ClockScaleSchema.safeParse(bad).success).toBe(false);
      expect(ProfileSettingsSchema.parse({ clockScale: bad }).clockScale).toBeUndefined();
    }
  });

  it('ClockScaleSchema accepts exactly CLOCK_SCALES (one list, no drift)', () => {
    expect(ClockScaleSchema.options.map((o) => o.value)).toEqual([...CLOCK_SCALES]);
  });

  it('an unknown challenge value never resets the rest of the stored settings (rollback safety)', () => {
    // A later spec adds scale 3; an older bundle reads it after a rollback.
    const read = ProfileSettingsSchema.parse({ uiLocale: 'ko', romanizationMode: 'tap', readToMe: true, clockScale: 3, challengeMode: true });
    expect(read).toMatchObject({ uiLocale: 'ko', romanizationMode: 'tap', readToMe: true, challengeMode: true });
    expect(read.clockScale ?? DEFAULT_CLOCK_SCALE).toBe(1);
    // Written back as JSON, the unknown value is simply gone; nothing else changes.
    expect(JSON.parse(JSON.stringify(read))).toEqual({ uiLocale: 'ko', romanizationMode: 'tap', readToMe: true, challengeMode: true });
  });

  it('settings stored before challengeMode and clockScale existed still parse unchanged', () => {
    const stored = { uiLocale: 'ko', romanizationMode: 'tap', readToMe: true };
    expect(ProfileSettingsSchema.parse(stored)).toEqual(stored);
    const withChallenge = { romanizationMode: 'always', challengeMode: true, clockScale: 1.5 };
    expect(ProfileSettingsSchema.parse(withChallenge)).toEqual(withChallenge);
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

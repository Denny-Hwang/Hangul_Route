import { describe, expect, it } from 'vitest';
import {
  CLOCK_SCALES,
  ClockScaleSchema,
  DEFAULT_CHALLENGE_MODE,
  DEFAULT_CLOCK_SCALE,
  DEFAULT_UI_LOCALE,
  AccountLocaleSchema,
  DEFAULT_TEXT_SIZE,
  DEVICE_SETTINGS_KEY,
  DeviceSettingsSchema,
  PREFS_CHANNEL,
  PrefsMessageSchema,
  TEXT_SIZES,
  mergeAccountLocale,
  prefsMessage,
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

  it('DeviceSettings: uiLocaleAt and textSize are optional and additive (a record stored before them parses unchanged)', () => {
    const full = { uiLocale: 'ko', uiLocaleAt: '2026-10-16T09:30:00.000Z', textSize: 'larger' };
    expect(DeviceSettingsSchema.parse(full)).toEqual(full);
    expect(DeviceSettingsSchema.parse({ uiLocale: 'ko' })).toEqual({ uiLocale: 'ko' });
    expect(DeviceSettingsSchema.parse({ textSize: 'largest' })).toEqual({ textSize: 'largest' });
    expect(DeviceSettingsSchema.parse({ uiLocaleAt: '2026-10-16T09:30:00+09:00' }).uiLocaleAt).toBe('2026-10-16T09:30:00+09:00');
    expect(TEXT_SIZES).toEqual(['standard', 'large', 'larger', 'largest']);
    expect(DEFAULT_TEXT_SIZE).toBe('standard');
  });

  it('DeviceSettings: an unknown text size or a bad timestamp reads as absent and keeps the language', () => {
    const read = DeviceSettingsSchema.parse({ uiLocale: 'es', uiLocaleAt: 'yesterday', textSize: 'huge' });
    expect(read.uiLocale).toBe('es');
    expect(read.uiLocaleAt).toBeUndefined();
    expect(read.textSize).toBeUndefined();
    expect(JSON.parse(JSON.stringify(read))).toEqual({ uiLocale: 'es' });
    expect(DeviceSettingsSchema.parse({ textSize: 3 }).textSize).toBeUndefined();
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

describe('the display record across tabs (owner items 6 and 7)', () => {
  it('one key, one channel, one message shape', () => {
    expect(DEVICE_SETTINGS_KEY).toBe('device:settings');
    expect(PREFS_CHANNEL).toBe('hr-prefs');
    const message = prefsMessage({ uiLocale: 'ko', textSize: 'large' });
    expect(message).toEqual({ v: 1, kind: 'device-settings', value: { uiLocale: 'ko', textSize: 'large' } });
    expect(PrefsMessageSchema.safeParse(message).success).toBe(true);
    expect(PrefsMessageSchema.safeParse({ v: 2, kind: 'device-settings', value: {} }).success).toBe(false);
    expect(PrefsMessageSchema.safeParse({ v: 1, kind: 'other', value: {} }).success).toBe(false);
  });

  it('AccountLocale is lenient: a damaged value reads as no language', () => {
    expect(AccountLocaleSchema.parse({ uiLocale: 'es', uiLocaleAt: '2026-10-16T00:00:00.000Z', adultAffirmedAt: 'x' })).toEqual({
      uiLocale: 'es',
      uiLocaleAt: '2026-10-16T00:00:00.000Z',
    });
    expect(AccountLocaleSchema.parse({ uiLocale: 'fr', uiLocaleAt: 7 })).toEqual({});
  });
});

describe('mergeAccountLocale: newer wins after a sign-in (owner items 6 and 7)', () => {
  const NOW = '2026-10-16T12:00:00.000Z';
  const OLD = '2026-10-01T00:00:00.000Z';
  const NEW = '2026-10-15T00:00:00.000Z';

  it('neither side has a language: nothing to do', () => {
    expect(mergeAccountLocale({}, null, NOW)).toEqual({ device: null, account: null });
    expect(mergeAccountLocale({ textSize: 'large' }, {}, NOW)).toEqual({ device: null, account: null });
  });

  it('only the account: it seeds the device with its timestamp, keeping the text size', () => {
    expect(mergeAccountLocale({ textSize: 'larger' }, { uiLocale: 'ko', uiLocaleAt: OLD }, NOW)).toEqual({
      device: { textSize: 'larger', uiLocale: 'ko', uiLocaleAt: OLD },
      account: null,
    });
    // An account language without a timestamp seeds the device without one.
    expect(mergeAccountLocale({}, { uiLocale: 'es' }, NOW)).toEqual({ device: { uiLocale: 'es' }, account: null });
  });

  it('only the device: the account takes it, stamped now when the device choice has no timestamp', () => {
    expect(mergeAccountLocale({ uiLocale: 'es', uiLocaleAt: OLD }, null, NOW)).toEqual({ device: null, account: { uiLocale: 'es', uiLocaleAt: OLD } });
    expect(mergeAccountLocale({ uiLocale: 'es' }, {}, NOW)).toEqual({ device: null, account: { uiLocale: 'es', uiLocaleAt: NOW } });
  });

  it('both agree: nothing to write, unless the account lacks a timestamp', () => {
    expect(mergeAccountLocale({ uiLocale: 'ko', uiLocaleAt: NEW }, { uiLocale: 'ko', uiLocaleAt: OLD }, NOW)).toEqual({ device: null, account: null });
    expect(mergeAccountLocale({ uiLocale: 'ko', uiLocaleAt: NEW }, { uiLocale: 'ko' }, NOW)).toEqual({ device: null, account: { uiLocale: 'ko', uiLocaleAt: NEW } });
  });

  it('both differ: the newer choice wins on both sides', () => {
    expect(mergeAccountLocale({ uiLocale: 'en', uiLocaleAt: OLD, textSize: 'large' }, { uiLocale: 'ko', uiLocaleAt: NEW }, NOW)).toEqual({
      device: { uiLocale: 'ko', uiLocaleAt: NEW, textSize: 'large' },
      account: null,
    });
    expect(mergeAccountLocale({ uiLocale: 'en', uiLocaleAt: NEW }, { uiLocale: 'ko', uiLocaleAt: OLD }, NOW)).toEqual({
      device: null,
      account: { uiLocale: 'en', uiLocaleAt: NEW },
    });
    // A tie keeps the device.
    expect(mergeAccountLocale({ uiLocale: 'en', uiLocaleAt: NEW }, { uiLocale: 'ko', uiLocaleAt: NEW }, NOW).device).toBeNull();
  });

  it('a missing timestamp means the device wins', () => {
    // A device choice stored before timestamps existed beats a newer account choice.
    expect(mergeAccountLocale({ uiLocale: 'en' }, { uiLocale: 'ko', uiLocaleAt: NEW }, NOW)).toEqual({
      device: null,
      account: { uiLocale: 'en', uiLocaleAt: NOW },
    });
    // An account choice without a timestamp loses to a stamped device choice.
    expect(mergeAccountLocale({ uiLocale: 'en', uiLocaleAt: OLD }, { uiLocale: 'ko' }, NOW)).toEqual({
      device: null,
      account: { uiLocale: 'en', uiLocaleAt: OLD },
    });
  });

  it('an account timestamp that does not parse counts as missing', () => {
    expect(mergeAccountLocale({ uiLocale: 'en', uiLocaleAt: OLD }, { uiLocale: 'ko', uiLocaleAt: 'not a date' }, NOW).device).toBeNull();
  });
});

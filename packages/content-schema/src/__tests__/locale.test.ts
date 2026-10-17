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
  MIGRATED_AT,
  PREFS_CHANNEL,
  PrefsMessageSchema,
  TEXT_SIZES,
  mergeAccountLocale,
  mergeDeviceSettings,
  prefsMessage,
  rawDeviceSettings,
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

  it('DeviceSettings: locale optional (absent = never chosen), an unknown one reads as never chosen', () => {
    expect(DeviceSettingsSchema.parse({})).toEqual({});
    expect(DeviceSettingsSchema.parse({ uiLocale: 'es' })).toEqual({ uiLocale: 'es' });
    expect(DeviceSettingsSchema.parse({ uiLocale: 'de' })).toEqual({});
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

  it('DeviceSettings: a locale this version does not know reads as absent and keeps the text size and time', () => {
    const read = DeviceSettingsSchema.parse({ uiLocale: 'fr', uiLocaleAt: '2026-10-16T09:30:00.000Z', textSize: 'large' });
    expect(read).toEqual({ uiLocaleAt: '2026-10-16T09:30:00.000Z', textSize: 'large' });
    expect(DeviceSettingsSchema.parse({ uiLocale: 7 }).uiLocale).toBeUndefined();
  });

  it('MIGRATED_AT is the epoch: older than any real choice', () => {
    expect(MIGRATED_AT).toBe('1970-01-01T00:00:00.000Z');
    expect(Date.parse(MIGRATED_AT)).toBe(0);
    expect(DeviceSettingsSchema.parse({ uiLocale: 'ko', uiLocaleAt: MIGRATED_AT }).uiLocaleAt).toBe(MIGRATED_AT);
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
  it('one key, one channel, one strict message shape', () => {
    expect(DEVICE_SETTINGS_KEY).toBe('device:settings');
    expect(PREFS_CHANNEL).toBe('hr-prefs');
    const message = prefsMessage({ uiLocale: 'ko', textSize: 'large' });
    expect(message).toEqual({ ns: 'hr-prefs', v: 1, type: 'device-settings', settings: { uiLocale: 'ko', textSize: 'large' } });
    expect(PrefsMessageSchema.safeParse(message).success).toBe(true);
    expect(PrefsMessageSchema.safeParse({ ...message, v: 2 }).success).toBe(false);
    expect(PrefsMessageSchema.safeParse({ ...message, type: 'other' }).success).toBe(false);
    expect(PrefsMessageSchema.safeParse({ ...message, ns: 'hr-tabs' }).success).toBe(false);
    // Strict: an extra key (another channel's message, a later shape) is not this message.
    expect(PrefsMessageSchema.safeParse({ ...message, from: 'tab-1' }).success).toBe(false);
  });

  it('prefsMessage carries only the fields this version knows', () => {
    const message = prefsMessage({ uiLocale: 'es', later: 1 } as never);
    expect(message.settings).toEqual({ uiLocale: 'es' });
  });

  it('AccountLocale is lenient: a damaged value reads as no language', () => {
    expect(AccountLocaleSchema.parse({ uiLocale: 'es', uiLocaleAt: '2026-10-16T00:00:00.000Z', adultAffirmedAt: 'x' })).toEqual({
      uiLocale: 'es',
      uiLocaleAt: '2026-10-16T00:00:00.000Z',
    });
    expect(AccountLocaleSchema.parse({ uiLocale: 'fr', uiLocaleAt: 7 })).toEqual({});
  });
});

describe('mergeDeviceSettings: read-modify-write keeps what this version does not know (section 3.1)', () => {
  it('rawDeviceSettings is the stored object, or {} for anything that is not one', () => {
    expect(rawDeviceSettings({ uiLocale: 'ko', later: true })).toEqual({ uiLocale: 'ko', later: true });
    for (const junk of [null, undefined, 'ko', 3, ['ko']]) expect(rawDeviceSettings(junk)).toEqual({});
  });

  it('changes only the named fields; a later key and a later value survive', () => {
    const stored = { uiLocale: 'fr', uiLocaleAt: '2026-10-16T09:30:00.000Z', textSize: 'huge', later: { a: 1 } };
    expect(mergeDeviceSettings(stored, { textSize: 'large' })).toEqual({ ...stored, textSize: 'large' });
    expect(mergeDeviceSettings(stored, { uiLocale: 'ko', uiLocaleAt: MIGRATED_AT })).toEqual({ ...stored, uiLocale: 'ko', uiLocaleAt: MIGRATED_AT });
    // The input is not changed.
    expect(stored.textSize).toBe('huge');
  });

  it('clearing the language removes the language and its time only (the record is never removed)', () => {
    expect(mergeDeviceSettings({ uiLocale: 'ko', uiLocaleAt: MIGRATED_AT, textSize: 'larger', later: 1 }, { clearLocale: true })).toEqual({ textSize: 'larger', later: 1 });
    expect(mergeDeviceSettings(null, { clearLocale: true })).toEqual({});
  });
});

describe('mergeAccountLocale: newer wins after a sign-in (owner items 6 and 7)', () => {
  const OLD = '2026-10-01T00:00:00.000Z';
  const NEW = '2026-10-15T00:00:00.000Z';

  it('neither side has a language: nothing to do', () => {
    expect(mergeAccountLocale({}, null)).toEqual({ device: null, account: null });
    expect(mergeAccountLocale({ textSize: 'large' }, {})).toEqual({ device: null, account: null });
  });

  it('only the account: it seeds the device with its time (MIGRATED_AT when it has none)', () => {
    expect(mergeAccountLocale({ textSize: 'larger' }, { uiLocale: 'ko', uiLocaleAt: OLD })).toEqual({ device: { uiLocale: 'ko', uiLocaleAt: OLD }, account: null });
    expect(mergeAccountLocale({}, { uiLocale: 'es' })).toEqual({ device: { uiLocale: 'es', uiLocaleAt: MIGRATED_AT }, account: null });
  });

  it('only the device: the account takes it with the device time, never now', () => {
    expect(mergeAccountLocale({ uiLocale: 'es', uiLocaleAt: OLD }, null)).toEqual({ device: null, account: { uiLocale: 'es', uiLocaleAt: OLD } });
    expect(mergeAccountLocale({ uiLocale: 'es' }, {})).toEqual({ device: null, account: { uiLocale: 'es', uiLocaleAt: MIGRATED_AT } });
  });

  it('both agree: nothing to write, unless a real device time fills an account with none', () => {
    expect(mergeAccountLocale({ uiLocale: 'ko', uiLocaleAt: NEW }, { uiLocale: 'ko', uiLocaleAt: OLD })).toEqual({ device: null, account: null });
    expect(mergeAccountLocale({ uiLocale: 'ko', uiLocaleAt: NEW }, { uiLocale: 'ko' })).toEqual({ device: null, account: { uiLocale: 'ko', uiLocaleAt: NEW } });
    expect(mergeAccountLocale({ uiLocale: 'ko' }, { uiLocale: 'ko' })).toEqual({ device: null, account: null });
    expect(mergeAccountLocale({ uiLocale: 'ko', uiLocaleAt: MIGRATED_AT }, { uiLocale: 'ko' })).toEqual({ device: null, account: null });
  });

  it('both differ: the later choice wins on both sides; a tie keeps each side', () => {
    expect(mergeAccountLocale({ uiLocale: 'en', uiLocaleAt: OLD, textSize: 'large' }, { uiLocale: 'ko', uiLocaleAt: NEW })).toEqual({
      device: { uiLocale: 'ko', uiLocaleAt: NEW },
      account: null,
    });
    expect(mergeAccountLocale({ uiLocale: 'en', uiLocaleAt: NEW }, { uiLocale: 'ko', uiLocaleAt: OLD })).toEqual({ device: null, account: { uiLocale: 'en', uiLocaleAt: NEW } });
    expect(mergeAccountLocale({ uiLocale: 'en', uiLocaleAt: NEW }, { uiLocale: 'ko', uiLocaleAt: NEW })).toEqual({ device: null, account: null });
    expect(mergeAccountLocale({ uiLocale: 'en' }, { uiLocale: 'ko' })).toEqual({ device: null, account: null });
  });

  it('a missing time counts as MIGRATED_AT: a device language with no time loses to any stamped account choice', () => {
    expect(mergeAccountLocale({ uiLocale: 'en' }, { uiLocale: 'ko', uiLocaleAt: NEW })).toEqual({ device: { uiLocale: 'ko', uiLocaleAt: NEW }, account: null });
    // An account choice without a time loses to a stamped device choice.
    expect(mergeAccountLocale({ uiLocale: 'en', uiLocaleAt: OLD }, { uiLocale: 'ko' })).toEqual({ device: null, account: { uiLocale: 'en', uiLocaleAt: OLD } });
  });

  it('a migrated or seeded device language (1970) loses to a stamped account choice', () => {
    expect(mergeAccountLocale({ uiLocale: 'en', uiLocaleAt: MIGRATED_AT }, { uiLocale: 'ko', uiLocaleAt: OLD })).toEqual({
      device: { uiLocale: 'ko', uiLocaleAt: OLD },
      account: null,
    });
  });

  it('a time that does not parse counts as missing', () => {
    expect(mergeAccountLocale({ uiLocale: 'en', uiLocaleAt: OLD }, { uiLocale: 'ko', uiLocaleAt: 'not a date' })).toEqual({ device: null, account: { uiLocale: 'en', uiLocaleAt: OLD } });
    expect(mergeAccountLocale({ uiLocale: 'en', uiLocaleAt: 'not a date' }, null)).toEqual({ device: null, account: { uiLocale: 'en', uiLocaleAt: MIGRATED_AT } });
  });

  it('two devices: an unstamped device A takes a newer choice made on device B, and never flips B back', () => {
    // A: a pre-timestamp choice. B: no account yet.
    const deviceA = { uiLocale: 'en' as const };
    const first = mergeAccountLocale(deviceA, null);
    expect(first.account).toEqual({ uiLocale: 'en', uiLocaleAt: MIGRATED_AT });
    // The grown-up picks Korean on B later.
    const account = { uiLocale: 'ko' as const, uiLocaleAt: NEW };
    // A loads next: it takes Korean and writes nothing to the account.
    const onA = mergeAccountLocale(deviceA, account);
    expect(onA).toEqual({ device: { uiLocale: 'ko', uiLocaleAt: NEW }, account: null });
    // B loads again: its choice and the account agree, nothing changes.
    expect(mergeAccountLocale({ uiLocale: 'ko', uiLocaleAt: NEW }, account)).toEqual({ device: null, account: null });
  });
});

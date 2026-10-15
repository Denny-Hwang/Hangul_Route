import { describe, expect, it } from 'vitest';
import {
  DISPLAY_NAME_MAX,
  LEGACY_DISPLAY_NAME_MAX,
  LegacyDisplayNameSchema,
  DisplayNameSchema,
  InboxLearnerSchema,
  LearnerProfilePatchSchema,
  LearnerRegisterSchema,
  SpaceJoinSchema,
  SyncInboxSchema,
} from '../index';

const AT = '2026-10-14T00:00:00.000Z';

describe('DisplayNameSchema — the shared learner name rule', () => {
  it('accepts what a device accepts, trimmed: accents, Hangul, digits, spaces, apostrophes, hyphens', () => {
    for (const name of ['Sungjoo', 'María', 'Zoë', '수니', "O'Neil", 'O’Neil', 'Ann-Marie', 'Min 2', 'A'.repeat(DISPLAY_NAME_MAX)]) {
      expect(DisplayNameSchema.parse(name), name).toBe(name);
    }
    expect(DisplayNameSchema.parse('  Sungjoo  ')).toBe('Sungjoo');
  });

  it('refuses empty, whitespace-only, too long and other characters', () => {
    for (const name of ['', '   ', 'A'.repeat(DISPLAY_NAME_MAX + 1), 'Sung<joo>', 'Sung\u{1F600}', 'Сунджу', 'さくら', 'a\nb', 'a\tb', 'a@b']) {
      expect(DisplayNameSchema.safeParse(name).success, JSON.stringify(name)).toBe(false);
    }
  });

  it('keeps the device limit of 12 characters', () => {
    expect(DISPLAY_NAME_MAX).toBe(12);
  });
});

describe('LegacyDisplayNameSchema — the server rule for incoming names', () => {
  it('trims and takes 1-20 characters, like ProfileSchema on the device', () => {
    expect(LEGACY_DISPLAY_NAME_MAX).toBe(20);
    expect(LegacyDisplayNameSchema.parse(' Alexandria Mae ')).toBe('Alexandria Mae');
    expect(LegacyDisplayNameSchema.parse('Mina_K')).toBe('Mina_K');
    for (const name of ['', '   ', 'A'.repeat(21)]) expect(LegacyDisplayNameSchema.safeParse(name).success, JSON.stringify(name)).toBe(false);
  });
});

describe('LearnerProfilePatchSchema', () => {
  it('takes any of name, level and picture with the edit time', () => {
    expect(LearnerProfilePatchSchema.parse({ displayName: ' Sungjoo ', at: AT })).toEqual({ displayName: 'Sungjoo', at: AT });
    expect(LearnerProfilePatchSchema.parse({ ageGroup: '8-9', avatar: 'hoya-blue', at: '2026-10-14T09:00:00+09:00' })).toEqual({ ageGroup: '8-9', avatar: 'hoya-blue', at: '2026-10-14T09:00:00+09:00' });
  });

  it('needs at least one field and a datetime', () => {
    expect(LearnerProfilePatchSchema.safeParse({ at: AT }).success).toBe(false);
    expect(LearnerProfilePatchSchema.safeParse({ displayName: 'Sungjoo' }).success).toBe(false);
    expect(LearnerProfilePatchSchema.safeParse({ displayName: 'Sungjoo', at: '2026-10-14' }).success).toBe(false);
  });

  it('refuses the fields that stay on the device and unknown values', () => {
    for (const extra of [{ learnerType: 'adult' }, { parentPinHash: 'x' }, { consent: {} }, { role: 'learner' }, { id: 'profile:x' }]) {
      expect(LearnerProfilePatchSchema.safeParse({ displayName: 'Sungjoo', at: AT, ...extra }).success, JSON.stringify(extra)).toBe(false);
    }
    expect(LearnerProfilePatchSchema.safeParse({ ageGroup: '12-99', at: AT }).success).toBe(false);
    expect(LearnerProfilePatchSchema.safeParse({ avatar: 'dragon', at: AT }).success).toBe(false);
    expect(LearnerProfilePatchSchema.safeParse({ displayName: '   ', at: AT }).success).toBe(false);
  });

  it('takes a legacy name (the lenient rule, 1-20) so a re-push of the current name never loops on 422', () => {
    expect(LearnerProfilePatchSchema.parse({ displayName: 'Alexandria Mae', at: AT }).displayName).toBe('Alexandria Mae');
    expect(LearnerProfilePatchSchema.parse({ displayName: 'Mina_K', at: AT }).displayName).toBe('Mina_K');
    expect(LearnerProfilePatchSchema.safeParse({ displayName: 'A'.repeat(LEGACY_DISPLAY_NAME_MAX + 1), at: AT }).success).toBe(false);
  });
});

describe('incoming names on registration and join', () => {
  const register = (displayName: string) => LearnerRegisterSchema.safeParse({ deviceId: 'device-0001', learner: { displayName, ageGroup: '5-7', avatar: 'hoya-orange' } });

  it('registration takes the lenient legacy rule (trim, 1-20): names apps already hold always register', () => {
    expect(register('test').success).toBe(true);
    // legacy names ProfileSchema still allows, sent unchanged by ensureRegistered
    for (const name of ['Alexandria Mae', 'Mina_K', 'A'.repeat(LEGACY_DISPLAY_NAME_MAX)]) {
      expect(register(name).success, name).toBe(true);
    }
    const parsed = LearnerRegisterSchema.parse({ deviceId: 'device-0001', learner: { displayName: '  Mina_K ', ageGroup: '5-7', avatar: 'hoya-orange' } });
    expect(parsed.learner.displayName).toBe('Mina_K');
    expect(register('A'.repeat(LEGACY_DISPLAY_NAME_MAX + 1)).success).toBe(false);
    expect(register('   ').success).toBe(false);
  });

  it('a join body stays lenient (a name never fails the join); the name stays optional', () => {
    expect(SpaceJoinSchema.parse({ code: 'ABCDEF', displayName: ' Sungjoo ' }).displayName).toBe('Sungjoo');
    // what shipped apps send (a free-text field of up to 20): accepted by the body and applied by the Worker
    expect(SpaceJoinSchema.parse({ code: 'ABCDEF', displayName: 'A'.repeat(15) }).displayName).toBe('A'.repeat(15));
    expect(SpaceJoinSchema.parse({ code: 'ABCDEF', displayName: 'Bad<Name' }).displayName).toBe('Bad<Name');
    expect(SpaceJoinSchema.safeParse({ code: 'ABCDEF', displayName: 'A'.repeat(21) }).success).toBe(false);
    expect(SpaceJoinSchema.parse({ code: 'ABCDEF' }).displayName).toBeUndefined();
  });
});

describe('SyncInboxSchema learner block', () => {
  const base = { rev: 0, plans: [], memberships: [], tier: 'free', serverTime: AT };
  const learner = { displayName: 'Sungjoo', ageGroup: '5-7', avatar: 'hoya-orange', profileUpdatedAt: AT };

  it('is optional and lenient', () => {
    expect(SyncInboxSchema.parse(base).learner).toBeUndefined();
    expect(SyncInboxSchema.parse({ ...base, learner }).learner).toEqual(learner);
    // a legacy level or picture never hides the name
    expect(SyncInboxSchema.parse({ ...base, learner: { ...learner, ageGroup: 'old' } }).learner).toEqual({ ...learner, ageGroup: null });
    expect(SyncInboxSchema.parse({ ...base, learner: { ...learner, avatar: 7, profileUpdatedAt: 3 } }).learner).toEqual({ ...learner, avatar: '', profileUpdatedAt: null });
    // only a missing or malformed name drops the block, never the inbox
    expect(SyncInboxSchema.parse({ ...base, learner: { ...learner, displayName: 5 } }).learner).toBeUndefined();
    expect(InboxLearnerSchema.parse({ ...learner, profileUpdatedAt: null }).profileUpdatedAt).toBeNull();
  });
});

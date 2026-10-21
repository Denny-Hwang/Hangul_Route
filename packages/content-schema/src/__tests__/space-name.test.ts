import { describe, expect, it } from 'vitest';
import { LookupSeatSchema, SPACE_NAME_FORBIDDEN, SPACE_NAME_LETTER, SPACE_NAME_MAX, SpaceCreateSchema, SpaceEventKindSchema, SpaceLookupSchema, SpaceNameSchema, SpaceRenameSchema, checkSpaceName } from '../index';

/** [SA] AMENDMENTS-SEATS-ADMINS section 5.2: the one space-name rule of the Worker and the console. */
describe('SpaceNameSchema ([SA] section 5.2)', () => {
  const reason = (raw: string) => {
    const r = checkSpaceName(raw);
    return r.ok ? null : r.reason;
  };

  it('collapses every whitespace run to one space and trims', () => {
    expect(SpaceNameSchema.parse('  Kim   family ')).toBe('Kim family');
    // tabs and new lines are collapsed, then accepted (the control check runs on the collapsed string)
    expect(SpaceNameSchema.parse('Room\t4\nB')).toBe('Room 4 B');
    expect(SpaceNameSchema.parse('Grade 1　A x﻿')).toBe('Grade 1 A x');
  });

  it('accepts 1 and 40 units and refuses 0 and 41', () => {
    expect(SPACE_NAME_MAX).toBe(40);
    expect(SpaceNameSchema.parse('A')).toBe('A');
    expect(SpaceNameSchema.parse('a'.repeat(40))).toHaveLength(40);
    expect(reason('')).toBe('empty');
    expect(reason('   \t\n ')).toBe('empty');
    expect(reason('a'.repeat(41))).toBe('too_long');
  });

  it('normalizes to NFC first: a decomposed Hangul name equals its composed form and counts the same', () => {
    const composed = '한글 반';
    const decomposed = composed.normalize('NFD');
    expect(decomposed).not.toBe(composed);
    expect(decomposed.length).toBeGreaterThan(composed.length);
    expect(SpaceNameSchema.parse(decomposed)).toBe(composed);
    // 40 composed syllables pass even though their decomposed form is 80 units long
    const forty = '가'.repeat(40);
    expect(SpaceNameSchema.parse(forty.normalize('NFD'))).toBe(forty);
  });

  it('refuses control and format characters but keeps ZWJ and ZWNJ', () => {
    expect(reason('Class‮A')).toBe('invalid'); // right-to-left override
    expect(reason('Class⁦A')).toBe('invalid'); // left-to-right isolate
    expect(reason('Class​A')).toBe('invalid'); // zero-width space
    expect(reason('Class­A')).toBe('invalid'); // soft hyphen
    expect(reason('Class\u0000A')).toBe('invalid');
    expect(SpaceNameSchema.parse('می‌خواهم')).toBe('می‌خواهم');
    expect(SpaceNameSchema.parse('क्‍ष')).toBe('क्‍ष');
  });

  it('needs at least one letter or digit', () => {
    expect(reason('!!!')).toBe('invalid');
    expect(reason('- · -')).toBe('invalid');
    expect(SpaceNameSchema.parse('4')).toBe('4');
    expect(SpaceNameSchema.parse('Clase de Begoña')).toBe('Clase de Begoña');
    expect(SpaceNameSchema.parse('김 선생님 반')).toBe('김 선생님 반');
  });

  it('is Hermes-safe: plain BMP ranges, no Unicode property escape and no u flag (the Expo app loads this module)', () => {
    for (const re of [SPACE_NAME_FORBIDDEN, SPACE_NAME_LETTER]) {
      expect(re.source).not.toContain('\\p{');
      expect(re.flags).not.toContain('u');
    }
    // the other refused format characters of the deny-list
    for (const ch of ['\u061c', '\u180e', '\u200e', '\u2061', '\u206a', '\ufff9', '\u009f']) expect(SPACE_NAME_FORBIDDEN.test(`A${ch}B`), ch.codePointAt(0)?.toString(16)).toBe(true);
    for (const name of ['Αθήνα', 'Москва', 'שלום', 'مدرسة', 'こんにちは', '学校', 'ＡＢＣ', 'ไทย', 'Nguyễn']) expect(checkSpaceName(name).ok, name).toBe(true);
  });

  it('puts the reason in the issue params, and the rename body uses it', () => {
    const parsed = SpaceRenameSchema.safeParse({ name: '​' });
    expect(parsed.success).toBe(false);
    if (!parsed.success) expect((parsed.error.issues[0] as { params?: { reason?: string } }).params?.reason).toBe('invalid');
    expect(SpaceRenameSchema.parse({ name: ' Sun  room ' })).toEqual({ name: 'Sun room' });
  });

  it('create uses the same rule (its route keeps answering 422 bad_request)', () => {
    expect(SpaceCreateSchema.parse({ kind: 'class', name: ' Room\t5 ' }).name).toBe('Room 5');
    expect(SpaceCreateSchema.safeParse({ kind: 'class', name: '...' }).success).toBe(false);
    expect(SpaceCreateSchema.safeParse({ kind: 'class', name: 'A‮B' }).success).toBe(false);
  });
});

describe('space events and lookup seat ([SA] sections 3.4 and 6.2)', () => {
  it('SpaceEventKindSchema is the registry and refuses an unknown kind', () => {
    expect(SpaceEventKindSchema.options).toEqual(['renamed', 'class_renamed', 'admin_invite_created', 'admin_invite_revoked', 'admin_joined', 'admin_removed', 'admin_left']);
    expect(SpaceEventKindSchema.safeParse('deleted').success).toBe(false);
  });

  it('lookup takes an optional learner and answers a seat', () => {
    expect(SpaceLookupSchema.parse({ code: 'abcdef' })).toEqual({ code: 'ABCDEF' });
    expect(SpaceLookupSchema.parse({ code: 'ABCDEF', learnerId: 'profile:suni' }).learnerId).toBe('profile:suni');
    expect(SpaceLookupSchema.safeParse({ code: 'ABCDEF', learnerId: 'account:x' }).success).toBe(false);
    expect(LookupSeatSchema.parse({ full: true, reason: 'cap_family', cap: 4 })).toEqual({ full: true, reason: 'cap_family', cap: 4 });
    expect(LookupSeatSchema.safeParse({ full: true, reason: 'cap_learner', cap: 3 }).success).toBe(false);
  });
});

import { getMessages, type UiLocale } from '@hangul-route/i18n';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { assignableTeachers, limitNote, limitState, usageLine, weekLine } from '../school';

describe('school view models (F-SCHOOL-001 §3.3)', () => {
  it('formats usage against limits and classifies how close the school is', () => {
    expect(usageLine({ students: 38, teachers: 4 }, { licensed: true, students: 300, teachers: 10 })).toBe('students 38 / 300 · teachers 4 / 10');
    expect(usageLine({ students: 38, teachers: 4 }, { licensed: true, students: null, teachers: null })).toBe('students 38 · teachers 4');
    expect(limitState({ students: 38, teachers: 4 }, { licensed: false, students: null, teachers: null })).toBe('unlicensed');
    expect(limitState({ students: 38, teachers: 4 }, { licensed: true, students: 300, teachers: 10 })).toBe('ok');
    expect(limitState({ students: 270, teachers: 4 }, { licensed: true, students: 300, teachers: 10 })).toBe('near');
    expect(limitState({ students: 10, teachers: 10 }, { licensed: true, students: 300, teachers: 10 })).toBe('at');
    expect(limitState({ students: 999, teachers: 99 }, { licensed: true, students: null, teachers: null })).toBe('ok');
    expect(limitNote('ok')).toBeNull();
    expect(limitNote('near')).toContain('Close');
    expect(limitNote('at')).toContain('limit');
    expect(limitNote('unlicensed')).toContain('free cap');
  });

  it('writes the week line and lists assignable teachers', () => {
    expect(weekLine({ students: 38, practiced: 31, classes: 4, classesWithPlan: 3 })).toBe('31 of 38 students practiced · 3 of 4 classes have a published plan');
    expect(assignableTeachers([
      { memberKind: 'account', memberId: 'principal', role: 'owner', name: 'Principal', isOwner: true },
      { memberKind: 'account', memberId: 'ms-park', role: 'teacher', name: 'Ms Park', isOwner: false },
      { memberKind: 'account', memberId: 'aunt', role: 'caregiver', name: 'Aunt', isOwner: false },
      { memberKind: 'learner', memberId: 'profile:a', role: 'student', name: 'A', isOwner: false },
    ])).toEqual([{ accountId: 'principal', name: 'Principal' }, { accountId: 'ms-park', name: 'Ms Park' }]);
  });
});

describe('school words per locale (F-I18N-001 PR 10c)', () => {
  const PSEUDO = 'en-XA' as UiLocale;
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('reads the dictionary of the given locale', () => {
    for (const locale of ['en', 'es', 'ko'] as const) {
      const s = getMessages(locale).console;
      expect(usageLine({ students: 38, teachers: 4 }, { licensed: true, students: 300, teachers: 10 }, locale)).toBe(s.school.licence.usage(38, 300, 4, 10));
      expect(usageLine({ students: 38, teachers: 4 }, { licensed: true, students: null, teachers: null }, locale)).toBe(s.school.licence.usage(38, null, 4, null));
      expect(limitNote('unlicensed', locale)).toBe(s.schoolNoLicence);
      expect(limitNote('near', locale)).toBe(s.schoolNearLimit);
      expect(limitNote('at', locale)).toBe(s.schoolAtLimit);
      expect(limitNote('ok', locale)).toBeNull();
      expect(weekLine({ students: 38, practiced: 31, classes: 4, classesWithPlan: 3 }, locale)).toBe(s.school.week.line(31, 38, 3, 4));
    }
  });

  it('reads the pseudo-locale when given it', () => {
    vi.stubEnv('NEXT_PUBLIC_PSEUDO_LOCALE', '1');
    const bracketed = /^\[.*\]$/;
    expect(usageLine({ students: 1, teachers: 1 }, { licensed: true, students: 300, teachers: 10 }, PSEUDO)).toMatch(bracketed);
    for (const state of ['unlicensed', 'near', 'at'] as const) expect(limitNote(state, PSEUDO)).toMatch(bracketed);
    expect(weekLine({ students: 2, practiced: 1, classes: 1, classesWithPlan: 0 }, PSEUDO)).toMatch(bracketed);
  });
});

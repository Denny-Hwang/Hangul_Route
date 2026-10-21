import { FREE_CLASS_STUDENT_CAP, SCHOOL_LEARNER_CAP } from '@hangul-route/content-schema';
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
    expect(limitNote('unlicensed')).toBe('No licence yet. Each class holds up to 20 students, and the school up to 50.');
  });

  it('[SA] every school holds up to 50 students: unlicensed at the cap, covered at the cap, and over it (section 3.4)', () => {
    const unlicensed = { licensed: false, students: SCHOOL_LEARNER_CAP, teachers: null };
    const licensed = { licensed: true, students: 50, teachers: 10 };
    expect(limitState({ students: 18, teachers: 2 }, unlicensed)).toBe('unlicensed');
    expect(limitState({ students: 50, teachers: 2 }, unlicensed)).toBe('unlicensedAt');
    expect(limitState({ students: 62, teachers: 2 }, unlicensed)).toBe('over');
    expect(limitState({ students: 45, teachers: 2 }, licensed)).toBe('near');
    expect(limitState({ students: 50, teachers: 2 }, licensed)).toBe('at');
    expect(limitState({ students: 62, teachers: 2 }, licensed)).toBe('over');
    expect(limitState({ students: 62, teachers: 2 }, { licensed: true, students: null, teachers: null })).toBe('ok');
    // A Worker older than SA-1 sends no cap for an unlicensed school.
    expect(limitState({ students: 62, teachers: 2 }, { licensed: false, students: null, teachers: null })).toBe('unlicensed');
    expect(limitNote('unlicensedAt', 'en', { students: 50, cap: 50 })).toBe('This school has 50 students, the most it holds without a contract. New students can join when a place opens.');
    expect(limitNote('at', 'en', { students: 50, cap: 50 })).toBe('At the licence limit — new students will be asked to check with their teacher.');
    expect(limitNote('over', 'en', { students: 62, cap: 50 })).toBe(
      'This school has 62 students. Everyone keeps their place and everything they learned. New students can join when there are fewer than 50, or write to us for a contract.',
    );
    expect(usageLine({ students: 18, teachers: 2 }, unlicensed)).toBe('students 18 / 50 · teachers 2');
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
      expect(limitNote('unlicensed', locale)).toBe(s.schoolNoLicenceCaps(FREE_CLASS_STUDENT_CAP, SCHOOL_LEARNER_CAP));
      expect(limitNote('unlicensedAt', locale, { students: 50, cap: 50 })).toBe(s.seats.school.at(50));
      expect(limitNote('over', locale, { students: 62, cap: 50 })).toBe(s.seats.school.over(62, 50));
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
    for (const state of ['unlicensed', 'unlicensedAt', 'near', 'at', 'over'] as const) expect(limitNote(state, PSEUDO)).toMatch(bracketed);
    expect(weekLine({ students: 2, practiced: 1, classes: 1, classesWithPlan: 0 }, PSEUDO)).toMatch(bracketed);
  });
});

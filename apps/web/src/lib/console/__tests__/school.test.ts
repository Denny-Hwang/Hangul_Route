import { describe, expect, it } from 'vitest';
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

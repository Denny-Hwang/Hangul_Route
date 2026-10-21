import { FREE_CLASS_STUDENT_CAP, SCHOOL_LEARNER_CAP } from '@hangul-route/content-schema';
import { describe, expect, it } from 'vitest';
import { getMessages } from '../resolve';

// Follow-up to #713 (F-I18N-001 §10, PR 10c console-text items a and b).
// (a) The school admin's week line counts students and classes through plural(), so one student or
// one class reads in the singular, the same way `school.classes.line` and `week.notSynced` do. The
// verb agrees with the numerator; at 0 it follows the total. ko needs no plural.
// (b) `schoolNoLicenceCaps` ([SA] AMENDMENTS-SEATS-ADMINS 9.2, replacing `schoolNoLicence`) takes both caps as arguments.
const line = (locale: 'en' | 'es' | 'ko') => getMessages(locale).console.school.week.line;

describe('console.school.week.line', () => {
  it('reads in the singular for one student and one class (en)', () => {
    expect(line('en')(1, 1, 1, 1)).toBe('1 of 1 student practiced · 1 of 1 class has a published plan');
  });

  it('reads in the plural for more than one (en)', () => {
    expect(line('en')(2, 3, 2, 3)).toBe('2 of 3 students practiced · 2 of 3 classes have a published plan');
  });

  it('agrees the verb with the classes that have a plan, not the total (en)', () => {
    expect(line('en')(0, 5, 1, 4)).toBe('0 of 5 students practiced · 1 of 4 classes has a published plan');
  });

  it('follows the total when no class has a plan yet (en)', () => {
    expect(line('en')(0, 1, 0, 1)).toBe('0 of 1 student practiced · 0 of 1 class has a published plan');
    expect(line('en')(0, 4, 0, 4)).toBe('0 of 4 students practiced · 0 of 4 classes have a published plan');
  });

  it('pins the es rows for n = 0, 1 and 2', () => {
    expect(line('es')(1, 1, 1, 1)).toBe('1 de 1 estudiante practicó · 1 de 1 clase tiene un plan publicado');
    expect(line('es')(2, 3, 2, 3)).toBe('2 de 3 estudiantes practicaron · 2 de 3 clases tienen un plan publicado');
    expect(line('es')(1, 5, 1, 4)).toBe('1 de 5 estudiantes practicó · 1 de 4 clases tiene un plan publicado');
    expect(line('es')(0, 1, 0, 1)).toBe('0 de 1 estudiante practicó · 0 de 1 clase tiene un plan publicado');
    expect(line('es')(0, 4, 0, 4)).toBe('0 de 4 estudiantes practicaron · 0 de 4 clases tienen un plan publicado');
  });

  it('pins the ko rows for n = 1 and 2', () => {
    expect(line('ko')(1, 1, 1, 1)).toBe('학생 1명 중 1명이 연습했어요 · 반 1개 중 1개에 게시된 계획이 있어요');
    expect(line('ko')(2, 3, 2, 3)).toBe('학생 3명 중 2명이 연습했어요 · 반 3개 중 2개에 게시된 계획이 있어요');
  });
});

describe('console.schoolNoLicenceCaps', () => {
  it('renders the class and school caps it is given in every locale', () => {
    expect(getMessages('en').console.schoolNoLicenceCaps(FREE_CLASS_STUDENT_CAP, SCHOOL_LEARNER_CAP)).toBe('No licence yet. Each class holds up to 20 students, and the school up to 50.');
    expect(getMessages('es').console.schoolNoLicenceCaps(FREE_CLASS_STUDENT_CAP, SCHOOL_LEARNER_CAP)).toBe('Aún no hay licencia. Cada clase admite hasta 20 estudiantes, y la escuela hasta 50.');
    expect(getMessages('ko').console.schoolNoLicenceCaps(FREE_CLASS_STUDENT_CAP, SCHOOL_LEARNER_CAP)).toBe('아직 라이선스가 없어요. 반마다 학생 최대 20명, 학교 전체는 최대 50명이에요.');
    expect(getMessages('en').console.schoolNoLicenceCaps(1, 1)).toBe('No licence yet. Each class holds up to 1 student, and the school up to 1.');
  });

  it('follows the constants rather than a typed number', () => {
    for (const locale of ['en', 'es', 'ko'] as const) {
      const text = getMessages(locale).console.schoolNoLicenceCaps(37, 73);
      expect(text).toContain('37');
      expect(text).toContain('73');
      expect(text.split('37').join('').split('73').join('')).not.toMatch(/\d/);
    }
  });

  it('the old key is gone', () => {
    for (const locale of ['en', 'es', 'ko'] as const) expect((getMessages(locale).console as Record<string, unknown>).schoolNoLicence).toBeUndefined();
  });
});

describe('ko learner.story.sequence.title', () => {
  // The quest player's ko `steps.s4.title` overlays are still split (17 read this wording, 21 the
  // older '이야기 순서대로 놓기'); aligning them is a content follow-up (F-I18N-001 §10, "As shipped in #716").
  it('reads 이야기 순서 맞추기 on the story sequence screen', () => {
    expect(getMessages('ko').learner.story.sequence.title).toBe('이야기 순서 맞추기');
  });
});

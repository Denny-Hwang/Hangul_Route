import { describe, expect, it } from 'vitest';
import { getMessages } from '../resolve';

// Follow-up to #713 (console-text item a): the school admin's week line counts students and
// classes through plural(), so one student or one class reads in the singular, the same way
// `school.classes.line` and `week.notSynced` already do. es is pluralised; ko needs no plural.
const line = (locale: 'en' | 'es' | 'ko') => getMessages(locale).console.school.week.line;

describe('console.school.week.line', () => {
  it('reads in the singular for one student and one class (en)', () => {
    const text = line('en')(1, 1, 1, 1);
    expect(text).toBe('1 of 1 student practiced · 1 of 1 class has a published plan');
    expect(text).toContain('1 student');
    expect(text).toContain('1 class has');
  });

  it('reads in the plural for more than one (en)', () => {
    const text = line('en')(2, 3, 2, 3);
    expect(text).toBe('2 of 3 students practiced · 2 of 3 classes have a published plan');
    expect(text).toContain('students');
    expect(text).toContain('classes have');
  });

  it('agrees the verb with the classes that have a plan, not the total (en)', () => {
    expect(line('en')(0, 5, 1, 4)).toBe('0 of 5 students practiced · 1 of 4 classes has a published plan');
  });

  it.each(['es', 'ko'] as const)('returns a line for both cases in %s', (locale) => {
    expect(line(locale)(1, 1, 1, 1).trim()).not.toBe('');
    expect(line(locale)(2, 3, 2, 3).trim()).not.toBe('');
  });
});

describe('ko learner.story.sequence.title', () => {
  it('matches the story quest step title', () => {
    expect(getMessages('ko').learner.story.sequence.title).toBe('이야기 순서 맞추기');
  });
});

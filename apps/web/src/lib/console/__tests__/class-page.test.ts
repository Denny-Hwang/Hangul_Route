import { getMessages } from '@hangul-route/i18n';
import { describe, expect, it } from 'vitest';
import { classActions, practicedLine, type ClassActionsInput } from '../class-page';

/**
 * AMENDMENTS-GROWNUP-UX GX-7 (section 8 T3 to T5): which buttons the class page's action bar keeps in view, which fold
 * under More, and which an empty class leaves out; the roster card's one activity line.
 */
const base: ClassActionsInput = { empty: false, lecture: true, classReport: true, notes: true, moves: true, relinksWaiting: 0, movesWaiting: 0 };

describe('classActions (T3, T5)', () => {
  it('a class with learners: Plan, Term plan, Lecture mode and Class report in the bar; Notes, New devices, Class moves and Settings under More', () => {
    expect(classActions(base)).toEqual({ bar: ['plan', 'termPlan', 'lecture', 'classReport'], more: ['notes', 'relink', 'moves', 'settings'] });
  });

  it('leaves out what this build or role does not offer, and Settings is always under More', () => {
    expect(classActions({ ...base, lecture: false, classReport: false, notes: false, moves: false })).toEqual({ bar: ['plan', 'termPlan'], more: ['relink', 'settings'] });
  });

  it('an empty class hides Re-link, Class moves, Notes and Lecture mode (and the class report, which has no one to show)', () => {
    expect(classActions({ ...base, empty: true })).toEqual({ bar: ['plan', 'termPlan'], more: ['settings'] });
  });

  it('an empty class still shows Class moves while a move into it waits, and the re-link entry while a re-link waits', () => {
    expect(classActions({ ...base, empty: true, movesWaiting: 2 }).more).toEqual(['moves', 'settings']);
    expect(classActions({ ...base, empty: true, relinksWaiting: 1 }).more).toEqual(['relink', 'settings']);
    // Class moves hidden by the build: a waiting count never brings the entry back.
    expect(classActions({ ...base, empty: true, moves: false, movesWaiting: 2 }).more).toEqual(['settings']);
  });
});

describe('practicedLine (T4 line 2)', () => {
  const now = new Date('2026-10-31T12:00:00.000Z');

  it('the day of the last practice and this week\'s minutes in one line, in each locale', () => {
    const summary = { lastActiveAt: '2026-10-31T09:00:00.000Z', minutesLast7d: 14 };
    expect(practicedLine(summary, now, 'en')).toBe(getMessages('en').console.space.learner.practiced('today', 14));
    expect(practicedLine(summary, now, 'en')).toBe('Practiced today · 14 min this week');
    expect(practicedLine(summary, now, 'es')).toBe('Practicó hoy · 14 min esta semana');
    expect(practicedLine(summary, now, 'ko')).toBe('연습: 오늘 · 이번 주 14분');
  });

  it('with no readable day, only the minutes (never "Practiced not yet")', () => {
    expect(practicedLine({ lastActiveAt: null, minutesLast7d: 0 }, now, 'en')).toBe(getMessages('en').console.space.learner.minutesThisWeek(0));
    expect(practicedLine({ lastActiveAt: 'garbage', minutesLast7d: 3 }, now, 'ko')).toBe(getMessages('ko').console.space.learner.minutesThisWeek(3));
  });
});

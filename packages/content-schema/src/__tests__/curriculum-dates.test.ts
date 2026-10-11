import { describe, expect, it } from 'vitest';
import {
  WEEKDAYS,
  addDays,
  dateKey,
  daysBetween,
  isDateKey,
  oneExplicitPerDay,
  spreadDates,
  weekdayOf,
} from '../curriculum/dates';
import * as barrel from '../index';

describe('curriculum date helpers (F-PLAN-002 PR P2-1)', () => {
  it('is exported from the package barrel', () => {
    expect(barrel.addDays).toBe(addDays);
    expect(barrel.dateKey).toBe(dateKey);
    expect(barrel.spreadDates).toBe(spreadDates);
    expect(barrel.oneExplicitPerDay).toBe(oneExplicitPerDay);
  });

  it('formats a date as its UTC date key', () => {
    expect(dateKey(new Date('2026-09-21T00:00:00.000Z'))).toBe('2026-09-21');
    expect(dateKey(new Date('2026-09-21T23:59:59.999Z'))).toBe('2026-09-21');
  });

  it('adds days across month, year and leap boundaries in UTC', () => {
    expect(addDays('2026-02-28', 1)).toBe('2026-03-01');
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
    expect(addDays('2026-09-21', 0)).toBe('2026-09-21');
    expect(addDays('2026-11-01', 7)).toBe('2026-11-08'); // across a US DST change, still 7 calendar days
  });

  it('spreads dates evenly and never twice on one day', () => {
    expect(spreadDates('2026-09-21', 2, 4)).toEqual(['2026-09-21', '2026-09-25', '2026-09-28', '2026-10-02']);
    expect(spreadDates('2026-09-21', 7, 3)).toEqual(['2026-09-21', '2026-09-22', '2026-09-23']);
    expect(spreadDates('2026-09-21', 99, 3)).toEqual(['2026-09-21', '2026-09-22', '2026-09-23']); // clamps to daily
    expect(spreadDates('2026-09-21', 0, 2)).toEqual(['2026-09-21', '2026-09-28']); // clamps to weekly
    expect(spreadDates('2026-12-30', 1, 2)).toEqual(['2026-12-30', '2027-01-06']);
    expect(spreadDates('2026-09-21', 3, 0)).toEqual([]);
    // strictly increasing even when the weekly step does not divide evenly
    const six = spreadDates('2026-09-21', 6, 6);
    expect(new Set(six).size).toBe(6);
    expect([...six].sort()).toEqual(six);
  });

  it('slides colliding items to the next free day in list order', () => {
    const { items, moved } = oneExplicitPerDay([
      { kind: 'quest', id: 'a', targetDate: '2026-09-21' },
      { kind: 'quest', id: 'b', targetDate: '2026-09-21' },
      { kind: 'quest', id: 'c' },
      { kind: 'quest', id: 'd', targetDate: '2026-09-22' },
    ]);
    expect(items.map((i) => i.targetDate)).toEqual(['2026-09-21', '2026-09-22', undefined, '2026-09-23']);
    expect(moved).toBe(2);
    expect(oneExplicitPerDay([{ kind: 'quest', id: 'a', targetDate: '2026-09-21' }]).moved).toBe(0);
    expect(oneExplicitPerDay([])).toEqual({ items: [], moved: 0 });
  });

  it('does not mutate its input and keeps unmoved items by reference', () => {
    const a = { kind: 'quest' as const, id: 'a', targetDate: '2026-09-21' };
    const b = { kind: 'quest' as const, id: 'b', targetDate: '2026-09-21' };
    const input = [a, b];
    const { items } = oneExplicitPerDay(input);
    expect(items[0]).toBe(a);
    expect(items[1]).not.toBe(b);
    expect(b.targetDate).toBe('2026-09-21');
    expect(input).toEqual([a, b]);
  });
});

describe('curriculum calendar helpers (F-PLAN-002 PR P2-3a)', () => {
  it('reads the UTC weekday of a date key', () => {
    expect(WEEKDAYS).toEqual(['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']);
    expect(weekdayOf('2026-10-18')).toBe('sun');
    expect(weekdayOf('2026-10-21')).toBe('wed');
    expect(weekdayOf('2027-02-07')).toBe('sun');
    expect(weekdayOf('2028-02-29')).toBe('tue');
  });

  it('counts whole days between two keys', () => {
    expect(daysBetween('2026-10-18', '2026-10-18')).toBe(0);
    expect(daysBetween('2026-10-18', '2026-10-25')).toBe(7);
    expect(daysBetween('2026-10-25', '2026-10-18')).toBe(-7);
    expect(daysBetween('2026-12-31', '2027-01-01')).toBe(1);
    expect(daysBetween('2028-02-28', '2028-03-01')).toBe(2);
  });

  it('accepts only real calendar days as date keys', () => {
    expect(isDateKey('2026-10-18')).toBe(true);
    expect(isDateKey('2028-02-29')).toBe(true);
    expect(isDateKey('2026-02-29')).toBe(false);
    expect(isDateKey('2026-02-30')).toBe(false);
    expect(isDateKey('2026-13-01')).toBe(false);
    expect(isDateKey('2026-1-01')).toBe(false);
  });
});

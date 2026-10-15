import { describe, expect, it } from 'vitest';
import { seededRandom } from '../../listen-pick';
import {
  BOX_DAYS,
  MAX_BOX,
  MIN_BOX,
  SELF_KNOWN_BOX,
  addDays,
  daysBetween,
  daysOverdue,
  demote,
  isDue,
  onHinted,
  onRight,
  onSelf,
  onWrong,
  promote,
  type Schedule,
} from '../srs';

const at = (box: number, bestBox = box, due: string | null = '2026-10-11'): Schedule => ({ box, bestBox, due });

describe('Leitner constants (F-VOC-005 section 3.4)', () => {
  it('six boxes with intervals 1, 3, 7, 14, 30 days for boxes 1-5', () => {
    expect(BOX_DAYS).toEqual([0, 1, 3, 7, 14, 30]);
    expect(MIN_BOX).toBe(1);
    expect(MAX_BOX).toBe(5);
    expect(SELF_KNOWN_BOX).toBe(2);
  });

  it('promote moves up one box, never above 5; a box-0 word enters box 1', () => {
    expect([0, 1, 2, 3, 4, 5].map(promote)).toEqual([1, 2, 3, 4, 5, 5]);
  });

  it('demote moves down one box, never below 1', () => {
    expect([0, 1, 2, 3, 4, 5].map(demote)).toEqual([1, 1, 1, 2, 3, 4]);
  });
});

describe('day arithmetic', () => {
  it('addDays crosses month, year and leap-day ends', () => {
    expect(addDays('2026-10-10', 1)).toBe('2026-10-11');
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
    expect(addDays('2027-02-28', 1)).toBe('2027-03-01');
    expect(addDays('2026-12-20', 30)).toBe('2027-01-19');
    expect(addDays('2026-01-01', -1)).toBe('2025-12-31');
    expect(addDays('2026-10-10', 0)).toBe('2026-10-10');
  });

  it('addDays stops at 9999-12-31, so an absurd device clock still makes a valid day key', () => {
    expect(addDays('9999-12-31', 1)).toBe('9999-12-31');
    expect(addDays('9999-12-31', 30)).toBe('9999-12-31');
    expect(addDays('9999-12-20', 30)).toBe('9999-12-31');
    expect(addDays('9999-12-30', 1)).toBe('9999-12-31');
    expect(addDays('9999-12-31', -1)).toBe('9999-12-30');
    // At the cap a right answer comes due the same day: the key stays valid, the box still moves.
    expect(onRight({ box: 1, bestBox: 1, due: '9999-12-31' }, '9999-12-31').due).toBe('9999-12-31');
  });

  it('addDays is calendar arithmetic, so a daylight-saving change never shifts the day', () => {
    // US clocks change on 2026-03-08 and 2026-11-01; Europe on 2026-03-29 and 2026-10-25.
    expect(addDays('2026-03-07', 1)).toBe('2026-03-08');
    expect(addDays('2026-03-08', 1)).toBe('2026-03-09');
    expect(addDays('2026-10-31', 3)).toBe('2026-11-03');
    expect(addDays('2026-10-24', 7)).toBe('2026-10-31');
  });

  it('daysBetween counts calendar days, negative when the second day is earlier', () => {
    expect(daysBetween('2026-10-10', '2026-10-14')).toBe(4);
    expect(daysBetween('2026-10-14', '2026-10-10')).toBe(-4);
    expect(daysBetween('2026-12-31', '2027-01-01')).toBe(1);
    expect(daysBetween('2026-03-07', '2026-03-09')).toBe(2);
  });
});

describe('isDue and daysOverdue', () => {
  it('due on or before today; null is never due', () => {
    expect(isDue({ due: '2026-10-11' }, '2026-10-11')).toBe(true);
    expect(isDue({ due: '2026-10-01' }, '2026-10-11')).toBe(true);
    expect(isDue({ due: '2026-10-12' }, '2026-10-11')).toBe(false);
    expect(isDue({ due: null }, '2026-10-11')).toBe(false);
  });

  it('daysOverdue orders words only: 0 for due today or not due, the day count otherwise', () => {
    expect(daysOverdue({ due: '2026-10-11' }, '2026-10-11')).toBe(0);
    expect(daysOverdue({ due: '2026-09-21' }, '2026-10-11')).toBe(20);
    expect(daysOverdue({ due: '2026-10-20' }, '2026-10-11')).toBe(0);
    expect(daysOverdue({ due: null }, '2026-10-11')).toBe(0);
  });
});

describe('schedule transitions (section 3.2 table)', () => {
  const today = '2026-10-11';

  it('a first-try right answer promotes one box and schedules by the new box', () => {
    expect(onRight(at(1), today)).toEqual({ box: 2, bestBox: 2, due: '2026-10-14' });
    expect(onRight(at(2, 3), today)).toEqual({ box: 3, bestBox: 3, due: '2026-10-18' });
    expect(onRight(at(3), today)).toEqual({ box: 4, bestBox: 4, due: '2026-10-25' });
    expect(onRight(at(4), today)).toEqual({ box: 5, bestBox: 5, due: '2026-11-10' });
  });

  it('box 5 stays at 5 (ceiling) and is due again in 30 days', () => {
    expect(onRight(at(5), today)).toEqual({ box: 5, bestBox: 5, due: '2026-11-10' });
  });

  it('a right answer with help keeps the box and reschedules by it', () => {
    expect(onHinted(at(3, 4), today)).toEqual({ box: 3, bestBox: 4, due: '2026-10-18' });
    expect(onHinted(at(1), today)).toEqual({ box: 1, bestBox: 1, due: '2026-10-12' });
  });

  it('a wrong answer moves down one box (floor 1), due tomorrow, bestBox unchanged', () => {
    expect(onWrong(at(3), today)).toEqual({ box: 2, bestBox: 3, due: '2026-10-12' });
    expect(onWrong(at(1), today)).toEqual({ box: 1, bestBox: 1, due: '2026-10-12' });
    expect(onWrong(at(5, 5), today)).toEqual({ box: 4, bestBox: 5, due: '2026-10-12' });
  });

  it('"Got it" seeds box 2 at most and never lowers a higher box', () => {
    expect(onSelf(at(1), true, today)).toEqual({ box: 2, bestBox: 2, due: '2026-10-14' });
    const high = at(4, 4, '2026-10-20');
    expect(onSelf(high, true, today)).toBe(high);
    expect(onSelf(at(2, 4, '2026-10-20'), true, today)).toEqual({ box: 2, bestBox: 4, due: '2026-10-20' });
  });

  it('"Show me again" sets box 1, due tomorrow, bestBox unchanged', () => {
    expect(onSelf(at(4, 4), false, today)).toEqual({ box: 1, bestBox: 4, due: '2026-10-12' });
  });

  it('over 1,000 random events the box stays in 1-5 and bestBox never falls', () => {
    const rand = seededRandom(20261011);
    let s: Schedule = at(1);
    let day = today;
    for (let i = 0; i < 1000; i += 1) {
      const before = s.bestBox;
      const r = rand();
      s =
        r < 0.4
          ? onRight(s, day)
          : r < 0.55
            ? onHinted(s, day)
            : r < 0.8
              ? onWrong(s, day)
              : onSelf(s, rand() < 0.5, day);
      expect(s.box).toBeGreaterThanOrEqual(1);
      expect(s.box).toBeLessThanOrEqual(5);
      expect(s.bestBox).toBeGreaterThanOrEqual(before);
      expect(s.bestBox).toBeGreaterThanOrEqual(s.box);
      expect(s.due).not.toBeNull();
      if (rand() < 0.3) day = addDays(day, 1);
    }
  });
});

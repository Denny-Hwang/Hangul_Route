import { formatDate, getMessages } from '@hangul-route/i18n';
import { describe, expect, it } from 'vitest';
import type { RosterLearner } from '../api';
import { CAP_WARNING_RATIO, capState, classRollup, codeExpiry, familyCountLine, percent, relativeDay, seatLine } from '../rollup';

const now = new Date('2026-09-21T12:00:00.000Z');
// relativeDay counts calendar days in the host time zone (describeRelativeDay reads local
// year, month and day), so its cases are built from local wall-clock times: the expectations
// then hold under any TZ (UTC, America/Los_Angeles, Asia/Seoul). Noon on 21 September 2026, local.
const localNow = new Date(2026, 8, 21, 12);
/** The ISO instant of a local wall-clock time in 2026 (month 8 = September). */
const at = (day: number, hour: number, month = 8): string => new Date(2026, month, day, hour).toISOString();
// codeExpiry measures a duration (milliseconds between two instants), which never depends on
// the zone. Its inputs are offsets from the same clock, never local wall-clock constructors:
// those would shift by an hour across a DST change (Australia/Sydney starts DST on 4 October).
const HOUR_MS = 3_600_000;
const DAY_MS = 24 * HOUR_MS;
const inMs = (ms: number): string => new Date(localNow.getTime() + ms).toISOString();
const learner = (id: string, over: Partial<RosterLearner> = {}, summary: Partial<NonNullable<RosterLearner['summary']>> | null = {}): RosterLearner => ({
  id,
  displayName: id,
  ageGroup: '5-7',
  avatar: 'hoya-orange',
  joinedAt: 't',
  lastActiveAt: '2026-09-21T00:00:00.000Z',
  lastSyncedAt: null,
  summary:
    summary === null
      ? null
      : {
          lastActiveAt: '2026-09-21T00:00:00.000Z',
          streakDays: 0,
          stage1: { questsDone: 3, questsTotal: 11, anchorAccuracy: null },
          cardsUnlocked: 2,
          minutesLast7d: 10,
          jamoRecognized: [],
          needsPractice: [],
          planProgress: {},
          ...summary,
        },
  ...over,
});

describe('class roll-up (F-CONSOLE-001 §3.5)', () => {
  it('counts practice, averages anchor accuracy over known values, ranks revisit jamo, flags stale learners', () => {
    const roll = classRollup(
      [
        learner('a', {}, { stage1: { questsDone: 5, questsTotal: 11, anchorAccuracy: 0.8 }, needsPractice: ['ㅂ', 'ㅅ'] }),
        learner('b', {}, { stage1: { questsDone: 2, questsTotal: 11, anchorAccuracy: 0.6 }, needsPractice: ['ㅂ'], minutesLast7d: 0, lastActiveAt: '2026-09-10T00:00:00.000Z' }),
        learner('c', {}, { needsPractice: ['ㅈ', 'ㅂ'] }),
        learner('d', {}, null),
      ],
      now,
    );
    expect(roll).toEqual({ students: 4, practicedThisWeek: 2, anchorAccuracy: 0.7, revisit: ['ㅂ', 'ㅈ', 'ㅅ'], vocabRevisit: [], notSynced: 2 });
    expect(classRollup([], now)).toEqual({ students: 0, practicedThisWeek: 0, anchorAccuracy: null, revisit: [], vocabRevisit: [], notSynced: 0 });
  });

  // F-REPORT-001 RP-8 (RP-2c review note): ties break in teaching order, as the class report's letters do.
  it('breaks a revisit tie in teaching order, so the roll-up and the class report agree', () => {
    const roll = classRollup([learner('a', {}, { needsPractice: ['ㄱ', 'ㅏ', 'ㅓ'] })], now);
    expect(roll.revisit).toEqual(['ㅏ', 'ㅓ', 'ㄱ']);
  });

  // F-VOC-005 P-4 (section 3.8, P9): the class signal is the words, never an order of students.
  describe('vocabRevisit', () => {
    const words = (needsPractice: string[]) => ({
      vocab: { collected: 10, strong: 2, topicsStarted: 1, topicsPracticed7d: 1, firstTryRate: 0.5, needsPractice },
    });

    it('names the up-to-three words most often on the students\' lists', () => {
      const roll = classRollup(
        [
          learner('a', {}, words(['vocab:sagwa-apple', 'vocab:nun-eye', 'vocab:uyu'])),
          learner('b', {}, words(['vocab:nun-eye', 'vocab:ppang'])),
          learner('c', {}, words(['vocab:nun-eye', 'vocab:sagwa-apple'])),
          learner('d', {}, words(['vocab:banana'])),
        ],
        now,
      );
      expect(roll.vocabRevisit).toEqual(['vocab:nun-eye', 'vocab:sagwa-apple', 'vocab:banana']);
    });

    it('breaks ties by id, so the list never depends on who is listed first', () => {
      const a = learner('a', {}, words(['vocab:uyu', 'vocab:banana']));
      const b = learner('b', {}, words(['vocab:ppang', 'vocab:sagwa-apple']));
      expect(classRollup([a, b], now).vocabRevisit).toEqual(['vocab:banana', 'vocab:ppang', 'vocab:sagwa-apple']);
      expect(classRollup([b, a], now).vocabRevisit).toEqual(['vocab:banana', 'vocab:ppang', 'vocab:sagwa-apple']);
    });

    it('is the same for any order of the roster (no ordering of students)', () => {
      const roster = [
        learner('a', {}, words(['vocab:sagwa-apple', 'vocab:nun-eye'])),
        learner('b', {}, words(['vocab:nun-eye'])),
        learner('c', {}, words(['vocab:uyu', 'vocab:sagwa-apple', 'vocab:nun-eye'])),
        learner('d', {}, words([])),
      ];
      const expected = classRollup(roster, now).vocabRevisit;
      expect(expected).toEqual(['vocab:nun-eye', 'vocab:sagwa-apple', 'vocab:uyu']);
      for (const order of [[3, 2, 1, 0], [1, 3, 0, 2], [2, 0, 3, 1]]) {
        expect(classRollup(order.map((i) => roster[i] as RosterLearner), now).vocabRevisit).toEqual(expected);
      }
    });

    it('counts a word once per student and carries only word ids', () => {
      const roll = classRollup(
        [learner('a', {}, words(['vocab:uyu', 'vocab:uyu'])), learner('b', {}, words(['vocab:banana'])), learner('c', {}, words(['vocab:banana']))],
        now,
      );
      expect(roll.vocabRevisit).toEqual(['vocab:banana', 'vocab:uyu']);
      for (const id of roll.vocabRevisit) expect(id).toMatch(/^vocab:/);
    });

    it('reads slices without firstTryRate, as the roster will carry them once P-4b ships (the rate never reaches the roster)', () => {
      const noRate = (needsPractice: string[]) => ({ vocab: { collected: 10, strong: 2, topicsStarted: 1, topicsPracticed7d: 1, needsPractice } });
      const roll = classRollup([learner('a', {}, noRate(['vocab:uyu', 'vocab:banana'])), learner('b', {}, noRate(['vocab:uyu']))], now);
      expect(roll.vocabRevisit).toEqual(['vocab:uyu', 'vocab:banana']);
    });

    it('is empty while no roster carries summary.vocab (vocab stays on the hidden list)', () => {
      expect(classRollup([learner('a'), learner('b', {}, null), learner('c', {}, { needsPractice: ['ㅂ'] })], now).vocabRevisit).toEqual([]);
    });

    it('ignores a malformed slice instead of failing the roll-up', () => {
      const odd = learner('a', {}, { vocab: { needsPractice: 'vocab:uyu' } } as never);
      const none = learner('b', {}, { vocab: null } as never);
      expect(classRollup([odd, none, learner('c', {}, words(['vocab:banana']))], now).vocabRevisit).toEqual(['vocab:banana']);
    });

    it('reads a slice exactly as the card does: a slice the schema rejects adds no word, even with a word list', () => {
      const valid = words(['vocab:banana']);
      const negative = learner('a', {}, { vocab: { ...valid.vocab, collected: -1, needsPractice: ['vocab:uyu'] } } as never);
      const four = learner('b', {}, { vocab: { ...valid.vocab, needsPractice: ['vocab:uyu', 'vocab:ppang', 'vocab:nun-eye', 'vocab:sagwa-apple'] } } as never);
      const notAWord = learner('c', {}, { vocab: { ...valid.vocab, needsPractice: ['uyu'] } } as never);
      const noCounts = learner('d', {}, { vocab: { needsPractice: ['vocab:uyu'] } } as never);
      expect(classRollup([negative, four, notAWord, noCounts, learner('e', {}, valid)], now).vocabRevisit).toEqual(['vocab:banana']);
    });
  });

  it('caps only apply to classes and warn from 80 %', () => {
    expect(capState('school', 30)).toBeNull();
    expect(capState('class', 15)).toEqual({ used: 15, total: 20, warning: false, reached: false, over: false, free: true });
    expect(capState('class', Math.ceil(20 * CAP_WARNING_RATIO))).toMatchObject({ warning: true, reached: false });
    expect(capState('class', 20)).toMatchObject({ warning: true, reached: true });
  });

  it('formats relative days, code expiry and percentages', () => {
    expect(relativeDay(at(21, 3), localNow)).toBe('today');
    expect(relativeDay(at(20, 23), localNow)).toBe('yesterday');
    expect(relativeDay(at(17, 10), localNow)).toBe('Thu');
    expect(relativeDay(at(3, 10), localNow)).toBe('Sep 3');
    expect(relativeDay(null, localNow)).toBe('not yet');
    expect(relativeDay('garbage', localNow)).toBe('not yet');
    expect(codeExpiry(inMs(18 * DAY_MS), localNow)).toBe('expires in 18 days');
    expect(codeExpiry(inMs(23 * HOUR_MS), localNow)).toBe('expires today');
    expect(codeExpiry(inMs(25 * HOUR_MS), localNow)).toBe('expires in 1 day');
    expect(codeExpiry(inMs(-20 * DAY_MS), localNow)).toBe('expired');
    expect(codeExpiry('garbage', localNow)).toBe('expired');
    expect(codeExpiry(null, localNow)).toBe('no code yet');
    expect(percent(0.714)).toBe('71%');
    expect(percent(null)).toBe('—');
  });

  it('words relative days and code expiry in every locale (F-I18N-001 PR 9)', () => {
    for (const locale of ['en', 'es', 'ko'] as const) {
      const time = getMessages(locale).common.time;
      const expiry = getMessages(locale).console.codeExpiry;
      expect(relativeDay(at(21, 3), localNow, locale)).toBe(time.today);
      expect(relativeDay(at(20, 23), localNow, locale)).toBe(time.yesterday);
      expect(relativeDay(at(17, 10), localNow, locale)).toBe(formatDate(locale, at(17, 10), 'weekday'));
      expect(relativeDay(at(3, 10), localNow, locale)).toBe(formatDate(locale, at(3, 10), 'monthDay'));
      expect(relativeDay(undefined, localNow, locale)).toBe(time.notYet);
      expect(codeExpiry(inMs(18 * DAY_MS), localNow, locale)).toBe(expiry.inDays(18));
      expect(codeExpiry(inMs(25 * HOUR_MS), localNow, locale)).toBe(expiry.inDays(1));
      expect(codeExpiry(inMs(23 * HOUR_MS), localNow, locale)).toBe(expiry.today);
      expect(codeExpiry(inMs(-20 * DAY_MS), localNow, locale)).toBe(expiry.expired);
      expect(codeExpiry(undefined, localNow, locale)).toBe(expiry.none);
    }
    expect(relativeDay(at(17, 10), localNow, 'ko')).not.toBe('Thu');
  });
});

/** [SA] AMENDMENTS-SEATS-ADMINS section 3.4: the count and the line come from the roster's `seats`, not the free cap. */
describe('capState and seatLine from the roster seats (SA-3)', () => {
  const c = getMessages('en').console;
  const seats = (learners: number, cap: number | null) => ({ learners, cap, schoolLearners: null, schoolCap: null });

  it('a free class keeps its nudge and the billing link', () => {
    expect(capState('class', 0, seats(15, 20))).toMatchObject({ used: 15, total: 20, free: true });
    expect(seatLine('class', capState('class', 15, seats(15, 20)))).toBeNull();
    expect(seatLine('class', capState('class', 16, seats(16, 20)))).toEqual({ text: c.capWarning(16, 20), upgrade: true });
    expect(seatLine('class', capState('class', 20, seats(20, 20)))).toEqual({ text: c.capReached, upgrade: true });
  });

  it('a licensed class at 50 and over it: calm lines, no billing link', () => {
    expect(capState('class', 49, seats(49, 50))).toMatchObject({ free: false, reached: false });
    expect(seatLine('class', capState('class', 45, seats(45, 50)))).toBeNull();
    expect(seatLine('class', capState('class', 50, seats(50, 50)))).toEqual({ text: c.seats.class.at(50), upgrade: false });
    expect(seatLine('class', capState('class', 70, seats(70, 50)))).toEqual({ text: c.seats.class.over(70, 50), upgrade: false });
  });

  it('a class its school covers has no cap of its own', () => {
    expect(capState('class', 70, { learners: 70, cap: null, schoolLearners: 70, schoolCap: 50 })).toBeNull();
    expect(seatLine('class', null)).toBeNull();
  });

  it('a family counts n of 4, says when it is full, and when it holds more than 4', () => {
    const three = capState('family', 3, seats(3, 4));
    expect(three).toMatchObject({ used: 3, total: 4, free: false });
    expect(familyCountLine(three as NonNullable<typeof three>)).toBe('3 of 4 learners');
    expect(seatLine('family', three)).toBeNull();
    expect(seatLine('family', capState('family', 4, seats(4, 4)))).toEqual({ text: c.seats.family.at(4), upgrade: false });
    expect(seatLine('family', capState('family', 5, seats(5, 4)))).toEqual({ text: c.seats.family.over(5, 4), upgrade: false });
    for (const locale of ['es', 'ko'] as const) {
      expect(seatLine('family', capState('family', 4, seats(4, 4)), locale)?.text).toBe(getMessages(locale).console.seats.family.at(4));
      expect(familyCountLine(three as NonNullable<typeof three>, locale)).toBe(getMessages(locale).console.billing.usage.learners(3, 4));
    }
  });

  it('a Worker older than SA-1 (no seats): the free cap for a class, the family cap from content-schema', () => {
    expect(capState('class', 20)).toMatchObject({ total: 20, reached: true, free: true });
    expect(capState('family', 4)).toMatchObject({ used: 4, total: 4, reached: true });
  });

  it('a school has no roster cap line (the school page has its own)', () => {
    expect(seatLine('school', { used: 1, total: 1, warning: true, reached: true, over: false, free: false })).toBeNull();
  });
});

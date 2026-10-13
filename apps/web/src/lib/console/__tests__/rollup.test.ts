import { formatDate, getMessages } from '@hangul-route/i18n';
import { describe, expect, it } from 'vitest';
import type { RosterLearner } from '../api';
import { CAP_WARNING_RATIO, capState, classRollup, codeExpiry, percent, relativeDay } from '../rollup';

const now = new Date('2026-09-21T12:00:00.000Z');
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
    expect(capState('family', 30)).toBeNull();
    expect(capState('class', 15)).toEqual({ used: 15, total: 20, warning: false, reached: false });
    expect(capState('class', Math.ceil(20 * CAP_WARNING_RATIO))).toMatchObject({ warning: true, reached: false });
    expect(capState('class', 20)).toMatchObject({ warning: true, reached: true });
  });

  it('formats relative days, code expiry and percentages', () => {
    expect(relativeDay('2026-09-21T03:00:00.000Z', now)).toBe('today');
    expect(relativeDay('2026-09-20T23:00:00.000Z', now)).toBe('yesterday');
    expect(relativeDay('2026-09-17T10:00:00.000Z', now)).toBe('Thu');
    expect(relativeDay('2026-09-03T10:00:00.000Z', now)).toBe('Sep 3');
    expect(relativeDay(null, now)).toBe('not yet');
    expect(relativeDay('garbage', now)).toBe('not yet');
    expect(codeExpiry('2026-10-09T12:00:00.000Z', now)).toBe('expires in 18 days');
    expect(codeExpiry('2026-09-22T11:00:00.000Z', now)).toBe('expires today');
    expect(codeExpiry('2026-09-22T13:00:00.000Z', now)).toBe('expires in 1 day');
    expect(codeExpiry('2026-09-01T00:00:00.000Z', now)).toBe('expired');
    expect(codeExpiry('garbage', now)).toBe('expired');
    expect(codeExpiry(null, now)).toBe('no code yet');
    expect(percent(0.714)).toBe('71%');
    expect(percent(null)).toBe('—');
  });

  it('words relative days and code expiry in every locale (F-I18N-001 PR 9)', () => {
    for (const locale of ['en', 'es', 'ko'] as const) {
      const time = getMessages(locale).common.time;
      const expiry = getMessages(locale).console.codeExpiry;
      expect(relativeDay('2026-09-21T03:00:00.000Z', now, locale)).toBe(time.today);
      expect(relativeDay('2026-09-20T23:00:00.000Z', now, locale)).toBe(time.yesterday);
      expect(relativeDay('2026-09-17T10:00:00.000Z', now, locale)).toBe(formatDate(locale, '2026-09-17T10:00:00.000Z', 'weekday'));
      expect(relativeDay('2026-09-03T10:00:00.000Z', now, locale)).toBe(formatDate(locale, '2026-09-03T10:00:00.000Z', 'monthDay'));
      expect(relativeDay(undefined, now, locale)).toBe(time.notYet);
      expect(codeExpiry('2026-10-09T12:00:00.000Z', now, locale)).toBe(expiry.inDays(18));
      expect(codeExpiry('2026-09-22T13:00:00.000Z', now, locale)).toBe(expiry.inDays(1));
      expect(codeExpiry('2026-09-22T11:00:00.000Z', now, locale)).toBe(expiry.today);
      expect(codeExpiry('2026-09-01T00:00:00.000Z', now, locale)).toBe(expiry.expired);
      expect(codeExpiry(undefined, now, locale)).toBe(expiry.none);
    }
    expect(relativeDay('2026-09-17T10:00:00.000Z', now, 'ko')).not.toBe('Thu');
  });
});

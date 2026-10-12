import {
  ActivitySummarySchema,
  ProgressSummarySchema,
  REPORT_DAYS_MAX,
  REPORT_DAY_LETTERS_MAX,
  REPORT_MILESTONES_MAX,
  REPORT_MONTHS_MAX,
  addDays,
  isDateKey,
  type ActivitySummary,
  type ProgressSnapshot,
  type QuestProgress,
  type SessionLog,
  type VocabItemState,
} from '@hangul-route/content-schema';
import { describe, expect, it } from 'vitest';
import { localDay } from '../../vocab/progress';
import { buildActivity, deviceLocalDay, type ActivityRouteNext, type BuildActivityInput } from '../activity';

/** Thursday 15 October 2026, 12:00 UTC: 21:00 on the same day for a device nine hours east of UTC. */
const NOW = new Date('2026-10-15T12:00:00.000Z');
const HOUR_MS = 3_600_000;

/** A device nine hours east of UTC (Seoul): its calendar day of an instant, as `deviceLocalDay` reads it there. */
const seoulDay = (iso: string): string => {
  const t = Date.parse(iso);
  return Number.isFinite(t) ? new Date(t + 9 * HOUR_MS).toISOString().slice(0, 10) : 'NaN-NaN-NaN';
};

const blank = (over: Partial<ProgressSnapshot> = {}): ProgressSnapshot => ({
  profileId: 'profile:a',
  updatedAt: '2026-10-15T00:00:00.000Z',
  episodes: [],
  quests: [],
  cards: [],
  sessions: [],
  homework: [],
  reviews: [],
  streakDays: 0,
  questDoneAt: {},
  ...over,
});

const session = (startedAt: string, durationSeconds?: number, id = `session:${startedAt}`): SessionLog => ({
  id,
  profileId: 'profile:a',
  startedAt,
  ...(durationSeconds === undefined ? {} : { endedAt: startedAt, durationSeconds }),
  episodesTouched: [],
});

const quest = (questId: string, accuracy: number, completed = true): QuestProgress => ({
  questId,
  episodeId: 'episode:stage1-letters',
  startedAt: '2026-10-01T00:00:00.000Z',
  ...(completed ? { completedAt: '2026-10-01T00:00:00.000Z' } : {}),
  stars: completed ? 3 : 0,
  attempts: 1,
  accuracy,
});

const card = (cardId: string, unlockedAt: string) => ({ cardId, unlockedAt, newSinceLastView: false });

const word = (id: string, first: string): VocabItemState => ({
  id,
  first,
  seen: 1,
  right: 1,
  bestBox: 1,
  last: first,
  box: 1,
  due: null,
  at: `${first}T00:00:00.000Z`,
});

const build = (snapshot: ProgressSnapshot, over: Partial<BuildActivityInput> = {}): ActivitySummary => {
  const out = buildActivity({ snapshot, now: NOW, questJamo: {}, localDay: seoulDay, ...over });
  if (out === undefined) throw new Error('expected an activity summary');
  return out;
};

describe('buildActivity (F-REPORT-001 section 3.3.4, RP-4)', () => {
  it('a learner with nothing yet: no rows, zero totals, no next and no revisit, asOf is the local today', () => {
    const a = build(blank());
    expect(a).toEqual({
      v: 1,
      tz: -NOW.getTimezoneOffset(),
      asOf: '2026-10-15',
      days: [],
      months: [],
      total: { since: null, min: 0, q: 0, c: 0, w: 0, days: 0 },
      milestones: [],
    });
    expect(ActivitySummarySchema.parse(a)).toEqual(a);
  });

  it('asOf is the device-local day of now, not the UTC day', () => {
    // 20:00 UTC on the 15th is already the 16th nine hours east.
    expect(build(blank(), { now: new Date('2026-10-15T20:00:00.000Z') }).asOf).toBe('2026-10-16');
  });

  it('records the time-zone offset of the clock it computed with', () => {
    const now = new Date('2026-01-15T12:00:00.000Z');
    expect(build(blank(), { now }).tz).toBe(-now.getTimezoneOffset());
  });

  it('gives up (undefined) on an invalid clock, so a broken now never sends a malformed summary', () => {
    expect(buildActivity({ snapshot: blank(), now: new Date(Number.NaN), questJamo: {}, localDay: seoulDay })).toBeUndefined();
    expect(buildActivity({ snapshot: blank(), now: NOW, questJamo: {}, localDay: () => 'NaN-NaN-NaN' })).toBeUndefined();
  });

  describe('step 1: minutes and practice days', () => {
    it('sums counted seconds per local day (60-minute cap per session), then rounds to minutes per day', () => {
      const a = build(
        blank({
          sessions: [
            // 20:00 UTC on the 13th is 05:00 on the 14th in Seoul.
            session('2026-10-13T20:00:00.000Z', 600),
            // Three hours counts as one.
            session('2026-10-14T01:00:00.000Z', 3 * 3600),
            session('2026-10-14T03:00:00.000Z', 89),
          ],
        }),
      );
      expect(a.days).toEqual([{ d: '2026-10-14', min: Math.round((600 + 3600 + 89) / 60), q: 0, c: 0, w: 0, j: [] }]);
    });

    it('rounds per day: 29 seconds on one day is 0 minutes and 30 seconds on another is 1', () => {
      const a = build(blank({ sessions: [session('2026-10-10T01:00:00.000Z', 29), session('2026-10-11T01:00:00.000Z', 30)] }));
      expect(a.days.map((d) => [d.d, d.min])).toEqual([
        ['2026-10-10', 0],
        ['2026-10-11', 1],
      ]);
      expect(a.total.min).toBe(1);
    });

    it('a session without a duration (an orphan) still makes a practice day, with 0 minutes', () => {
      const a = build(blank({ sessions: [session('2026-10-12T01:00:00.000Z')] }));
      expect(a.days).toEqual([{ d: '2026-10-12', min: 0, q: 0, c: 0, w: 0, j: [] }]);
      expect(a.total).toMatchObject({ days: 1, min: 0, since: '2026-10-12' });
    });

    it('skips a timestamp the device cannot read as a day', () => {
      const a = build(blank({ sessions: [session('t', 600)], cards: [card('c', 'x')], questDoneAt: { q1: 'never' }, quests: [quest('q1', 1)] }));
      expect(a.days).toEqual([]);
      expect(a.total).toEqual({ since: null, min: 0, q: 0, c: 0, w: 0, days: 0 });
    });
  });

  describe('step 2: quests finished for the first time (the latch)', () => {
    it('counts a latch entry on its local day only while the quest is completed in the snapshot', () => {
      const a = build(
        blank({
          quests: [quest('q1', 0.5), quest('q3', 0, false)],
          questDoneAt: { q1: '2026-10-13T16:00:00.000Z', q2: '2026-10-13T16:00:00.000Z', q3: '2026-10-13T16:00:00.000Z' },
        }),
      );
      expect(a.days).toEqual([{ d: '2026-10-14', min: 0, q: 1, c: 0, w: 0, j: [] }]);
      expect(a.total.q).toBe(1);
    });

    it('a profile reset followed by a sync union: the old latch entries come back but count nothing until the quest is finished again', () => {
      const unioned = { 'quest:a': '2026-10-01T01:00:00.000Z', 'quest:b': '2026-10-02T01:00:00.000Z' };
      const reset = build(blank({ quests: [], questDoneAt: unioned }), { questJamo: { 'quest:a': ['ㄱ'] } });
      expect(reset.days).toEqual([]);
      expect(reset.total).toEqual({ since: null, min: 0, q: 0, c: 0, w: 0, days: 0 });
      // Finished again after the reset: the entry keeps its pre-reset day (known approximation M5).
      const again = build(blank({ quests: [quest('quest:a', 0.9)], questDoneAt: unioned }), { questJamo: { 'quest:a': ['ㄱ'] } });
      expect(again.days).toEqual([{ d: '2026-10-01', min: 0, q: 1, c: 0, w: 0, j: ['ㄱ'] }]);
    });

    it('reads a snapshot from before the latch (no key) as no first finishes', () => {
      const { questDoneAt: _absent, ...old } = blank({ quests: [quest('q1', 1)] });
      expect(build(old).total.q).toBe(0);
    });
  });

  it('step 3: cards collected per local day', () => {
    const a = build(blank({ cards: [card('c1', '2026-10-14T02:00:00.000Z'), card('c2', '2026-10-14T05:00:00.000Z'), card('c3', '2026-10-15T02:00:00.000Z')] }));
    expect(a.days.map((d) => [d.d, d.c])).toEqual([
      ['2026-10-14', 2],
      ['2026-10-15', 1],
    ]);
    expect(a.total.c).toBe(3);
  });

  it('step 4: words met for the first time, on the slice day key as written', () => {
    const vocab = { v: 1 as const, items: [word('vocab:apple', '2026-10-13'), word('vocab:rice', '2026-10-13'), word('vocab:egg', '2026-10-15')], topics: [] };
    const a = build(blank({ vocab }));
    expect(a.days.map((d) => [d.d, d.w])).toEqual([
      ['2026-10-13', 2],
      ['2026-10-15', 1],
    ]);
    expect(a.total.w).toBe(3);
  });

  describe('step 5: letters that became strong', () => {
    const questJamo = { q1: ['ㄱ', 'ㄴ'], q2: ['ㄴ', 'ㄷ'], q3: ['ㄹ'], q4: ['ㅁ'], q5: ['ㄱ'] };
    const snapshot = blank({
      quests: [quest('q1', 0.9), quest('q2', 0.8), quest('q3', 0.5), quest('q4', 1), quest('q5', 1)],
      questDoneAt: { q1: '2026-10-05T01:00:00.000Z', q2: '2026-10-03T01:00:00.000Z', q3: '2026-10-04T01:00:00.000Z', q5: '2026-10-07T01:00:00.000Z' },
    });

    it('each strong letter on the earliest first finish of a quest that teaches it, at most one day per letter', () => {
      const a = build(snapshot, { questJamo });
      expect(a.days.map((d) => [d.d, d.j])).toEqual([
        ['2026-10-03', ['ㄴ', 'ㄷ']],
        ['2026-10-04', []],
        ['2026-10-05', ['ㄱ']],
        // q5 also makes ㄱ strong, later: ㄱ stays on its first day.
        ['2026-10-07', []],
      ]);
      // ㄹ is not strong (0.5) and ㅁ's quest has no latch entry: neither shows.
      expect(a.days.flatMap((d) => d.j)).not.toContain('ㄹ');
      expect(a.days.flatMap((d) => d.j)).not.toContain('ㅁ');
    });

    it('keeps only letter keys the report accepts and at most 12 a day, in code-point order', () => {
      const many = ['ㅎ', 'ㅍ', 'ㅌ', 'ㅋ', 'ㅊ', 'ㅈ', 'ㅇ', 'ㅅ', 'ㅂ', 'ㅁ', 'ㄹ', 'ㄷ', 'ㄴ', 'ㄱ', 'not-a-letter'];
      const a = build(blank({ quests: [quest('q1', 1)], questDoneAt: { q1: '2026-10-05T01:00:00.000Z' } }), { questJamo: { q1: many } });
      const j = a.days[0]?.j ?? [];
      expect(j).toHaveLength(REPORT_DAY_LETTERS_MAX);
      expect(j).toEqual([...j].sort());
      expect(j).not.toContain('not-a-letter');
      expect(j[0]).toBe('ㄱ');
    });
  });

  it('step 6: milestones from the stage latch, ascending by day, valid keys only, the newest 16', () => {
    const a = build(blank({ stageDoneAt: { stage2: '2026-10-10T01:00:00.000Z', stage1: '2026-09-01T01:00:00.000Z', 'Bad Key': '2026-10-01T01:00:00.000Z', stage3: 'never' } }));
    expect(a.milestones).toEqual([
      { stage: 'stage1', on: '2026-09-01' },
      { stage: 'stage2', on: '2026-10-10' },
    ]);
    const many = Object.fromEntries(Array.from({ length: 20 }, (_, i) => [`s${String(i).padStart(2, '0')}`, `2026-09-${String(i + 1).padStart(2, '0')}T01:00:00.000Z`]));
    const capped = build(blank({ stageDoneAt: { ...many, tie: '2026-09-20T05:00:00.000Z' } })).milestones;
    expect(capped).toHaveLength(REPORT_MILESTONES_MAX);
    expect(capped[0]).toEqual({ stage: 's05', on: '2026-09-06' });
    // Same day: by stage key.
    expect(capped.slice(-2)).toEqual([
      { stage: 's19', on: '2026-09-20' },
      { stage: 'tie', on: '2026-09-20' },
    ]);
  });

  describe('step 7: bounded rows', () => {
    it('days are the active days among the 35 local days ending at asOf; months and totals count the older ones', () => {
      const inside = addDays('2026-10-15', -(REPORT_DAYS_MAX - 1));
      const outside = addDays('2026-10-15', -REPORT_DAYS_MAX);
      const a = build(blank({ sessions: [session(`${outside}T01:00:00.000Z`, 60), session(`${inside}T01:00:00.000Z`, 120), session('2026-10-15T01:00:00.000Z', 60)] }));
      expect(a.days.map((d) => d.d)).toEqual([inside, '2026-10-15']);
      expect(a.months).toEqual([
        { m: '2026-09', min: 3, q: 0, c: 0, w: 0, days: 2 },
        { m: '2026-10', min: 1, q: 0, c: 0, w: 0, days: 1 },
      ]);
      expect(a.total).toEqual({ since: outside, min: 4, q: 0, c: 0, w: 0, days: 3 });
    });

    it('a day after asOf (a clock moved back) stays out of the rows but counts in the totals', () => {
      const a = build(blank({ sessions: [session('2026-11-02T01:00:00.000Z', 600), session('2026-10-15T01:00:00.000Z', 60)] }));
      expect(a.days.map((d) => d.d)).toEqual(['2026-10-15']);
      expect(a.months.map((m) => m.m)).toEqual(['2026-10']);
      expect(a.total).toMatchObject({ days: 2, min: 11 });
      expect(ActivitySummarySchema.safeParse(a).success).toBe(true);
    });

    it('months keep the newest 24 with activity, ascending, with their practice days', () => {
      const sessions: SessionLog[] = [];
      for (let i = 0; i < 26; i += 1) {
        const month = new Date(Date.UTC(2024, 8 + i, 10, 1)).toISOString();
        sessions.push(session(month, 60), session(month.replace('-10T', '-11T'), 60));
      }
      const a = build(blank({ sessions }));
      expect(a.months).toHaveLength(REPORT_MONTHS_MAX);
      expect(a.months[0]).toEqual({ m: '2024-11', min: 2, q: 0, c: 0, w: 0, days: 2 });
      expect(a.months[REPORT_MONTHS_MAX - 1]?.m).toBe('2026-10');
      expect(a.total).toMatchObject({ since: '2024-09-10', days: 52, min: 52 });
    });
  });

  it('totals come from the whole snapshot: every session, latched completed quest, card and word', () => {
    const a = build(
      blank({
        sessions: [session('2025-01-01T01:00:00.000Z', 600), session('2026-10-14T01:00:00.000Z', 300)],
        quests: [quest('q1', 1), quest('q2', 1)],
        questDoneAt: { q1: '2025-01-01T02:00:00.000Z', q2: '2026-10-14T02:00:00.000Z' },
        cards: [card('c1', '2025-01-01T03:00:00.000Z')],
        vocab: { v: 1, items: [word('vocab:apple', '2026-10-14')], topics: [] },
      }),
    );
    expect(a.total).toEqual({ since: '2025-01-01', min: 15, q: 2, c: 1, w: 1, days: 2 });
  });

  describe('step 8: next from routeNext', () => {
    const cases: [string, ActivityRouteNext, ActivitySummary['next']][] = [
      ['the default route', { kind: 'quest', questId: 'quest:a', source: 'cursor' }, { q: 'quest:a', plan: false }],
      ['a family plan', { kind: 'quest', questId: 'quest:b', source: 'family' }, { q: 'quest:b', plan: true }],
      ['a class plan', { kind: 'quest', questId: 'quest:c', source: 'class' }, { q: 'quest:c', plan: true }],
      ['the end of the free lessons', { kind: 'free-end' }, { end: true }],
    ];
    it.each(cases)('maps %s', (_name, next, expected) => {
      expect(build(blank(), { routeNext: () => next }).next).toEqual(expected);
    });

    it('rest, an id the report would refuse, and no routeNext (before F-ENT-003 E3-4) leave next absent', () => {
      expect(build(blank(), { routeNext: () => ({ kind: 'rest' }) })).not.toHaveProperty('next');
      expect(build(blank(), { routeNext: () => ({ kind: 'quest', questId: 'x'.repeat(65), source: 'cursor' }) })).not.toHaveProperty('next');
      expect(build(blank())).not.toHaveProperty('next');
    });
  });

  describe('step 9: revisit', () => {
    const questJamo = { 'quest:1': ['ㄱ'], 'quest:2': ['ㄷ', 'ㄴ'], 'quest:3': ['ㄷ'], 'quest:4': ['ㄷ'] };
    // ㄷ needs practice: quest:2 finished with 0.4.
    const snapshot = blank({ quests: [quest('quest:2', 0.4)] });

    it('is the first quest in route order that teaches the first letter to practice', () => {
      expect(build(snapshot, { questJamo }).revisit).toBe('quest:2');
    });

    it('skips the quests isQuestOpen closes', () => {
      expect(build(snapshot, { questJamo, isQuestOpen: (id) => id === 'quest:4' }).revisit).toBe('quest:4');
    });

    it('is absent when no open quest teaches it, or when nothing needs practice', () => {
      expect(build(snapshot, { questJamo, isQuestOpen: () => false })).not.toHaveProperty('revisit');
      expect(build(blank({ quests: [quest('quest:2', 0.9)] }), { questJamo })).not.toHaveProperty('revisit');
    });

    it('never offers an id the report would refuse', () => {
      const long = 'q'.repeat(65);
      expect(build(blank({ quests: [quest(long, 0.4)] }), { questJamo: { [long]: ['ㄷ'] } })).not.toHaveProperty('revisit');
    });
  });

  it('a full learner parses with the activity schema and inside the uploaded summary', () => {
    const a = build(
      blank({
        sessions: [session('2026-09-01T01:00:00.000Z', 600), session('2026-10-14T01:00:00.000Z', 300)],
        quests: [quest('q1', 1), quest('q2', 0.3)],
        questDoneAt: { q1: '2026-10-14T02:00:00.000Z', q2: '2026-10-14T03:00:00.000Z' },
        cards: [card('c1', '2026-10-14T03:00:00.000Z')],
        stageDoneAt: { stage1: '2026-10-14T04:00:00.000Z' },
        vocab: { v: 1, items: [word('vocab:apple', '2026-10-14')], topics: [] },
      }),
      { questJamo: { q1: ['ㄱ'], q2: ['ㄴ'] }, routeNext: () => ({ kind: 'quest', questId: 'q3', source: 'self' }) },
    );
    expect(ActivitySummarySchema.parse(a)).toEqual(a);
    expect(a).toMatchObject({ next: { q: 'q3', plan: true }, revisit: 'q2' });
    const summary = { schemaVersion: 1, lastActiveAt: 't', streakDays: 0, stage1: { questsDone: 0, questsTotal: 0, anchorAccuracy: null }, cardsUnlocked: 0, minutesLast7d: 0, jamoRecognized: [], needsPractice: [], planProgress: {}, activity: a };
    expect(ProgressSummarySchema.parse(summary).activity).toEqual(a);
  });

  it('totals never decrease as activity is added (property, seeded)', () => {
    let seed = 7;
    const rand = (n: number): number => {
      seed = (seed * 1103515245 + 12345) % 2147483648;
      return seed % n;
    };
    let snapshot = blank();
    let before = build(snapshot).total;
    for (let step = 0; step < 60; step += 1) {
      const at = new Date(Date.UTC(2026, 6, 1 + rand(100), rand(24))).toISOString();
      const kind = rand(3);
      if (kind === 0) snapshot = { ...snapshot, sessions: [...snapshot.sessions, session(at, rand(5000), `s${step}`)] };
      else if (kind === 1) snapshot = { ...snapshot, cards: [...snapshot.cards, card(`c${step}`, at)] };
      else snapshot = { ...snapshot, quests: [...snapshot.quests, quest(`q${step}`, 1)], questDoneAt: { ...snapshot.questDoneAt, [`q${step}`]: at } };
      const after = build(snapshot).total;
      for (const key of ['min', 'q', 'c', 'w', 'days'] as const) expect(after[key]).toBeGreaterThanOrEqual(before[key]);
      expect(ActivitySummarySchema.safeParse(build(snapshot)).success).toBe(true);
      before = after;
    }
  });
});

describe('deviceLocalDay', () => {
  it("is the device's calendar day of an instant, from the Date getters", () => {
    const iso = '2026-10-15T23:30:00.000Z';
    expect(deviceLocalDay(iso)).toBe(localDay(new Date(iso)));
    expect(isDateKey(deviceLocalDay(iso))).toBe(true);
  });

  it('is never a day key for an unreadable timestamp', () => {
    expect(isDateKey(deviceLocalDay('not a time'))).toBe(false);
  });
});

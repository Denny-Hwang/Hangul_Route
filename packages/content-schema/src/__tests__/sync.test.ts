import { describe, expect, it } from 'vitest';
import {
  BACKUP_FORMAT,
  BACKUP_VERSION,
  BackupFileSchema,
  JourneySummarySchema,
  LearnerRegisterSchema,
  ProgressSummarySchema,
  RouteGoalSummarySchema,
  SnapshotPutSchema,
  SyncInboxSchema,
} from '../index';

const snapshot = {
  profileId: 'profile:abc',
  updatedAt: '2026-09-21T00:00:00.000Z',
  episodes: [],
  quests: [],
  cards: [],
  sessions: [],
  homework: [],
  reviews: [],
  streakDays: 0,
};
const summary = {
  schemaVersion: 1 as const,
  lastActiveAt: '2026-09-21T00:00:00.000Z',
  streakDays: 0,
  stage1: { questsDone: 0, questsTotal: 11, anchorAccuracy: null },
  cardsUnlocked: 0,
  minutesLast7d: 0,
  jamoRecognized: [],
  needsPractice: [],
  planProgress: {},
};

describe('sync schemas (F-SYNC-001)', () => {
  it('accepts a valid summary and rejects more than 3 practice items', () => {
    expect(ProgressSummarySchema.parse(summary)).toEqual(summary);
    expect(ProgressSummarySchema.safeParse({ ...summary, needsPractice: ['a', 'b', 'c', 'd'] }).success).toBe(false);
    expect(ProgressSummarySchema.safeParse({ ...summary, schemaVersion: 2 }).success).toBe(false);
  });

  it('validates the snapshot PUT body', () => {
    const body = { baseRev: 0, snapshot, summary, schemaVer: 1, contentVer: '2026.09' };
    expect(SnapshotPutSchema.parse(body).baseRev).toBe(0);
    expect(SnapshotPutSchema.safeParse({ ...body, baseRev: -1 }).success).toBe(false);
    expect(SnapshotPutSchema.safeParse({ ...body, contentVer: '' }).success).toBe(false);
  });

  it('accepts and keeps a vocab slice and summary.vocab (F-VOC-005 section 3.1, 3.8); both stay optional', () => {
    const vocab = {
      v: 1 as const,
      items: [{ id: 'vocab:sagwa-apple', first: '2026-10-10', seen: 1, right: 1, bestBox: 2, last: '2026-10-11', box: 2, due: '2026-10-14', at: '2026-10-11T09:00:00.000Z' }],
      topics: [{ topic: 'food', bestStars: 0, sessions: 1, last: '2026-10-11', bestCaught: 0 }],
    };
    const vocabSummary = { collected: 1, strong: 0, topicsStarted: 1, topicsPracticed7d: 1, firstTryRate: 1, needsPractice: [] };
    const body = { baseRev: 0, snapshot: { ...snapshot, vocab }, summary: { ...summary, vocab: vocabSummary }, schemaVer: 1, contentVer: '2026.10' };
    const parsed = SnapshotPutSchema.parse(body);
    expect(parsed.snapshot.vocab).toEqual(vocab);
    expect(parsed.summary.vocab).toEqual(vocabSummary);
    const old = SnapshotPutSchema.parse({ ...body, snapshot, summary });
    expect(old.snapshot).not.toHaveProperty('vocab');
    expect(old.summary).not.toHaveProperty('vocab');
    expect(SnapshotPutSchema.safeParse({ ...body, snapshot: { ...snapshot, vocab: { ...vocab, v: 2 } } }).success).toBe(false);
  });

  it('validates learner registration and the optional client id', () => {
    const ok = LearnerRegisterSchema.parse({
      deviceId: 'device-12345678',
      learner: { id: 'profile:abc', displayName: 'Suni', ageGroup: '5-7', avatar: 'hoya-orange' },
    });
    expect(ok.learner.id).toBe('profile:abc');
    expect(
      LearnerRegisterSchema.safeParse({ deviceId: 'short', learner: { displayName: 'x', ageGroup: '5-7', avatar: 'a' } })
        .success,
    ).toBe(false);
    expect(
      LearnerRegisterSchema.safeParse({
        deviceId: 'device-12345678',
        learner: { id: 'bad id', displayName: 'x', ageGroup: '5-7', avatar: 'a' },
      }).success,
    ).toBe(false);
  });

  it('registers each level id, rejects an unknown one, strips an unknown learnerType (F-LEARN-001 L2)', () => {
    const reg = (ageGroup: string, extra: Record<string, unknown> = {}) =>
      LearnerRegisterSchema.safeParse({
        deviceId: 'device-12345678',
        learner: { displayName: 'Suni', ageGroup, avatar: 'hoya-orange', ...extra },
      });
    for (const id of ['5-7', '8-9', '10-11']) expect(reg(id).success).toBe(true);
    expect(reg('12-14').success).toBe(false);
    const withType = reg('8-9', { learnerType: 'self' });
    expect(withType.success).toBe(true);
    expect(withType.success && 'learnerType' in withType.data.learner).toBe(false);
  });

  it('parses an old backup file and one carrying learnerType', () => {
    const old = {
      format: BACKUP_FORMAT,
      version: BACKUP_VERSION,
      exportedAt: 't',
      profile: { id: 'profile:abc', displayName: 'Suni', ageGroup: '8-9', avatar: 'hoya-orange', createdAt: 't' },
      snapshot,
    };
    expect(BackupFileSchema.parse(old).profile.learnerType).toBeUndefined();
    const withType = { ...old, profile: { ...old.profile, learnerType: 'self' } };
    expect(BackupFileSchema.parse(withType).profile.learnerType).toBe('self');
  });

  it('inbox shape and backup file round-trip', () => {
    expect(
      SyncInboxSchema.parse({ rev: 3, plans: [], memberships: [], tier: 'free', serverTime: 't' }).tier,
    ).toBe('free');
    const file = {
      format: BACKUP_FORMAT,
      version: BACKUP_VERSION,
      exportedAt: 't',
      profile: { id: 'profile:abc', displayName: 'Suni', ageGroup: '5-7', avatar: 'hoya-orange', role: 'learner', createdAt: 't' },
      snapshot,
    };
    expect(BackupFileSchema.parse(file).profile.displayName).toBe('Suni');
    expect(BackupFileSchema.safeParse({ ...file, version: 2 }).success).toBe(false);
    expect(BackupFileSchema.safeParse({ ...file, format: 'other' }).success).toBe(false);
  });
});

describe('summary.journey (F-ROUTE-001 section 3.12, R-8)', () => {
  const journey = {
    v: 1 as const,
    here: 'stage1',
    stages: [
      { stage: 'stage1', state: 'open', done: 4, known: 0, total: 8 },
      { stage: 'stage2', state: 'open', done: 0, known: 0, total: 2 },
      { stage: 'stage3', state: 'later', done: 0, known: 0, total: 0 },
    ],
  };

  it('parses a journey and keeps it on the summary, schemaVersion staying 1', () => {
    expect(JourneySummarySchema.parse(journey)).toEqual(journey);
    expect(ProgressSummarySchema.parse({ ...summary, journey })).toEqual({ ...summary, journey });
    expect(JourneySummarySchema.parse({ ...journey, here: null }).here).toBeNull();
  });

  it('an old summary without journey still parses, with no journey key', () => {
    const parsed = ProgressSummarySchema.parse(summary);
    expect(parsed).toEqual(summary);
    expect(parsed.journey).toBeUndefined();
  });

  it('stage and state are plain strings on the wire (validated in the web strip)', () => {
    const later = { ...journey, here: 'stage9', stages: [{ stage: 'stage9', state: 'someday', done: 0, known: 0, total: 3 }] };
    expect(JourneySummarySchema.parse(later)).toEqual(later);
  });

  it('a malformed journey is dropped, never fatal to the whole summary (assumption g)', () => {
    const bad = [
      'nope',
      null,
      { ...journey, v: 2 },
      { ...journey, here: 3 },
      { ...journey, stages: 'stage1' },
      { ...journey, stages: [{ stage: 'stage1', state: 'open', done: -1, known: 0, total: 8 }] },
      { ...journey, stages: [{ stage: 'stage1', state: 'open', done: 1.5, known: 0, total: 8 }] },
      { ...journey, stages: [{ stage: 'stage1', state: 'open', done: 1, total: 8 }] },
      // Bounded: a tampered client cannot grow every roster (16 stages, 32-character strings, counts up to 10000).
      { ...journey, stages: Array.from({ length: 17 }, () => journey.stages[0]) },
      { ...journey, here: 's'.repeat(33) },
      { ...journey, stages: [{ stage: 's'.repeat(33), state: 'open', done: 1, known: 0, total: 8 }] },
      { ...journey, stages: [{ stage: 'stage1', state: 'o'.repeat(33), done: 1, known: 0, total: 8 }] },
      { ...journey, stages: [{ stage: 'stage1', state: 'open', done: 10001, known: 0, total: 8 }] },
    ];
    for (const value of bad) {
      expect(JourneySummarySchema.safeParse(value).success).toBe(false);
      const parsed = ProgressSummarySchema.safeParse({ ...summary, journey: value });
      expect(parsed.success).toBe(true);
      expect(parsed.success && parsed.data.journey).toBeUndefined();
    }
  });

  it('keeps the seeded marker (R-7a follow-up); a bad marker is dropped, never the journey', () => {
    expect(JourneySummarySchema.parse({ ...journey, seeded: true })).toEqual({ ...journey, seeded: true });
    expect(JourneySummarySchema.parse(journey)).not.toHaveProperty('seeded');
    for (const seeded of [false, 'yes', 1, null]) {
      const parsed = ProgressSummarySchema.parse({ ...summary, journey: { ...journey, seeded } });
      expect(parsed.journey).toEqual(journey);
      expect(parsed.journey?.seeded).toBeUndefined();
    }
  });

  it('strips unknown keys inside the journey and its stages', () => {
    const parsed = JourneySummarySchema.parse({ ...journey, extra: 1, stages: [{ ...journey.stages[0], questIds: ['quest:x'] }] });
    expect(parsed).toEqual({ ...journey, stages: [journey.stages[0]] });
  });

  it('the PUT body keeps a valid journey and drops a malformed one', () => {
    const body = { baseRev: 0, snapshot, schemaVer: 1, contentVer: '2026.09' };
    expect(SnapshotPutSchema.parse({ ...body, summary: { ...summary, journey } }).summary.journey).toEqual(journey);
    const dropped = SnapshotPutSchema.safeParse({ ...body, summary: { ...summary, journey: { v: 1 } } });
    expect(dropped.success && dropped.data.summary.journey).toBeUndefined();
  });
});

describe('summary.routeGoal (Learning Route section 9, LR-W1)', () => {
  const routeGoal = { stage: 'stage2', from: 'class' as const };

  it('parses a route goal and keeps it on the summary, schemaVersion staying 1', () => {
    expect(RouteGoalSummarySchema.parse(routeGoal)).toEqual(routeGoal);
    expect(ProgressSummarySchema.parse({ ...summary, routeGoal })).toEqual({ ...summary, routeGoal });
    for (const from of ['class', 'school', 'family', 'self', 'default'] as const) {
      expect(ProgressSummarySchema.parse({ ...summary, routeGoal: { stage: 'stage1', from } }).routeGoal).toEqual({ stage: 'stage1', from });
    }
  });

  it('an old summary without routeGoal still parses, with no routeGoal key', () => {
    const parsed = ProgressSummarySchema.parse(summary);
    expect(parsed).toEqual(summary);
    expect(parsed).not.toHaveProperty('routeGoal');
  });

  it('the stage is a plain string on the wire (validated as a StageKey by the reader)', () => {
    expect(RouteGoalSummarySchema.parse({ stage: 'stage9', from: 'self' })).toEqual({ stage: 'stage9', from: 'self' });
  });

  it('a malformed route goal is dropped, never fatal to the whole summary', () => {
    const bad = [
      'stage2',
      null,
      42,
      [],
      {},
      { stage: 'stage2' },
      { from: 'class' },
      { stage: 'stage2', from: 'teacher' },
      { stage: 'stage2', from: 'cursor' },
      { stage: 2, from: 'class' },
      { stage: 's'.repeat(33), from: 'class' },
      { stage: 'stage2', from: null },
    ];
    for (const value of bad) {
      expect(RouteGoalSummarySchema.safeParse(value).success).toBe(false);
      const parsed = ProgressSummarySchema.safeParse({ ...summary, routeGoal: value });
      expect(parsed.success).toBe(true);
      expect(parsed.success && parsed.data.routeGoal).toBeUndefined();
      expect(parsed.success && parsed.data.stage1).toEqual(summary.stage1);
    }
  });

  it('strips unknown keys under routeGoal (no plan id, date or name leaves the device through it)', () => {
    const parsed = ProgressSummarySchema.parse({ ...summary, routeGoal: { ...routeGoal, sourceId: 'plan:secret', endsOn: '2026-12-31', learnerName: 'Suni' } });
    expect(parsed.routeGoal).toEqual(routeGoal);
  });

  it('the PUT body keeps a valid route goal and drops a malformed one', () => {
    const body = { baseRev: 0, snapshot, schemaVer: 1, contentVer: '2026.09' };
    expect(SnapshotPutSchema.parse({ ...body, summary: { ...summary, routeGoal } }).summary.routeGoal).toEqual(routeGoal);
    const dropped = SnapshotPutSchema.safeParse({ ...body, summary: { ...summary, routeGoal: { stage: 'stage2', from: 'teacher' } } });
    expect(dropped.success).toBe(true);
    expect(dropped.success && dropped.data.summary.routeGoal).toBeUndefined();
  });
});

describe('rescue code (F-RESTORE-001)', () => {
  it('normalizes spacing and case, rejects other shapes', async () => {
    const { normalizeRescueCode, RescueClaimSchema } = await import('../index');
    expect(normalizeRescueCode(' tiger moon 4821 ')).toBe('TIGER-MOON-4821');
    expect(normalizeRescueCode('Tiger-Moon-4821')).toBe('TIGER-MOON-4821');
    expect(normalizeRescueCode('tiger-4821')).toBeNull();
    expect(normalizeRescueCode('tiger-moon-48')).toBeNull();
    expect(normalizeRescueCode('t1ger-moon-4821')).toBeNull();
    expect(RescueClaimSchema.parse({ code: 'tiger moon 4821', deviceId: 'device-12345678' }).code).toBe('TIGER-MOON-4821');
    expect(RescueClaimSchema.safeParse({ code: 'nope', deviceId: 'device-12345678' }).success).toBe(false);
  });

  it('accepts four words + six digits (SEC-5) and keeps accepting codes already issued as two words + four digits', async () => {
    const { normalizeRescueCode, RescueClaimSchema, RESCUE_CODE_RE, RESCUE_CODE_FORMATS } = await import('../index');
    expect(RESCUE_CODE_FORMATS).toEqual([
      { words: 4, digits: 6 },
      { words: 2, digits: 4 },
    ]);
    expect(normalizeRescueCode('tiger moon river apple 482139')).toBe('TIGER-MOON-RIVER-APPLE-482139');
    // digit groups and a missing last separator are forgiven; any whitespace separates
    expect(normalizeRescueCode(' Tiger-Moon-River-Apple-482 139 ')).toBe('TIGER-MOON-RIVER-APPLE-482139');
    expect(normalizeRescueCode('TIGER\nMOON\tRIVER APPLE482139')).toBe('TIGER-MOON-RIVER-APPLE-482139');
    expect(normalizeRescueCode('tiger moon4821')).toBe('TIGER-MOON-4821');
    for (const bad of [
      '',
      '482139',
      'tiger moon river 482139', // three words
      'tiger moon river apple 4821', // new words, old digit count
      'tiger moon 482139', // old words, new digit count
      'tiger moon river apple 482139 cloud', // a word after the number
      'tiger 4821 moon',
      'ab moon 4821', // too short to be a list word
      'tiger moon river apple seal 482139', // five words
      'tiger-moon-river-apple-48213', // five digits
    ]) {
      expect(normalizeRescueCode(bad)).toBeNull();
    }
    expect(RESCUE_CODE_RE.test('TIGER-MOON-RIVER-APPLE-482139')).toBe(true);
    expect(RESCUE_CODE_RE.test('TIGER-MOON-4821')).toBe(true);
    expect(RESCUE_CODE_RE.test('TIGER-MOON-482139')).toBe(false);
    expect(RescueClaimSchema.parse({ code: 'tiger moon river apple 482139', deviceId: 'device-12345678' }).code).toBe('TIGER-MOON-RIVER-APPLE-482139');
  });
});

describe('summary.activity (F-REPORT-001 section 3.3.3)', () => {
  const activity = {
    v: 1 as const,
    tz: -420,
    asOf: '2026-10-11',
    days: [{ d: '2026-10-11', min: 12, q: 1, c: 0, w: 0, j: ['ㅂ'] }],
    months: [{ m: '2026-10', min: 12, q: 1, c: 0, w: 0, days: 1 }],
    total: { since: '2026-10-11', min: 12, q: 1, c: 0, w: 0, days: 1 },
    milestones: [],
  };

  it('keeps a valid activity, schemaVersion staying 1', () => {
    expect(ProgressSummarySchema.parse({ ...summary, activity })).toEqual({ ...summary, activity });
  });

  it('an old summary without activity parses with no activity key', () => {
    expect(ProgressSummarySchema.parse(summary)).not.toHaveProperty('activity');
  });

  it('a malformed activity is dropped, never fatal to the whole summary', () => {
    for (const bad of ['nope', null, { ...activity, v: 2 }, { ...activity, days: 'x' }]) {
      const parsed = ProgressSummarySchema.parse({ ...summary, activity: bad });
      expect(parsed.activity).toBeUndefined();
      expect(parsed.streakDays).toBe(0);
    }
  });
});

describe('SyncInboxSchema notes additions (F-FEEDBACK-001 section 7.1)', () => {
  const plan = {
    id: 'plan:1',
    spaceId: 'space:a',
    spaceKind: 'class',
    spaceName: 'Sunday Class A',
    title: 'Week 1',
    items: [{ kind: 'quest', id: 'quest:stage1-letters-q1' }],
    publishedAt: 't',
    updatedAt: 't',
  };
  const membership = { spaceId: 'space:a', kind: 'class', name: 'Sunday Class A', role: 'student', joinedAt: 't' };
  const oldWorker = { rev: 4, plans: [plan], memberships: [membership], tier: 'free', serverTime: 't' };
  const note = {
    id: 'note:0b7c2f9e-1d2a',
    spaceId: 'space:a',
    from: { role: 'teacher', label: null },
    presetId: 'progress_reading',
    text: 'Loved your work today',
    textLocale: 'en',
    suggest: null,
    createdAt: '2026-10-11T09:00:00.000Z',
    readAt: null,
    reaction: null,
  };

  it('an inbox from a Worker without notes or notePrefs parses with the defaults', () => {
    const inbox = SyncInboxSchema.parse(oldWorker);
    expect(inbox.notes).toEqual([]);
    expect(inbox.notePrefs).toEqual({ classes: 'all', acknowledged: false });
    expect(inbox.plans).toHaveLength(1);
  });

  it('parses delivered notes and the prefs', () => {
    const inbox = SyncInboxSchema.parse({ ...oldWorker, notes: [note], notePrefs: { classes: 'presets', acknowledged: true } });
    expect(inbox.notes).toEqual([note]);
    expect(inbox.notePrefs).toEqual({ classes: 'presets', acknowledged: true });
  });

  it('one malformed note is dropped; the other notes, the plans and the memberships survive', () => {
    const inbox = SyncInboxSchema.parse({ ...oldWorker, notes: [{ id: 'note:bad' }, note, 'junk', { ...note, id: 'x' }] });
    expect(inbox.notes).toEqual([note]);
    expect(inbox.plans).toHaveLength(1);
    expect(inbox.memberships).toEqual([membership]);
    expect(inbox.tier).toBe('free');
  });

  it('a non-array notes value reads as empty', () => {
    expect(SyncInboxSchema.parse({ ...oldWorker, notes: null }).notes).toEqual([]);
  });

  it('a malformed notePrefs never costs the inbox; it reads as the defaults', () => {
    const inbox = SyncInboxSchema.parse({ ...oldWorker, notes: [note], notePrefs: { classes: 'quiet' } });
    expect(inbox.notePrefs).toEqual({ classes: 'all', acknowledged: false });
    expect(inbox.notes).toEqual([note]);
    expect(inbox.plans).toHaveLength(1);
  });
});

import { describe, expect, it } from 'vitest';
import {
  CURR_TELEMETRY_EVENT_NAMES,
  CURR_TELEMETRY_PAYLOADS,
  LAG_BUCKETS,
  SESSION_END_QUEST_FIELDS,
  CURR_TELEMETRY_NO_PROFILE,
  SessionEndPayloadSchema,
  TELEMETRY_EVENT_NAMES,
  isCurrTelemetryName,
  isTelemetryEventName,
} from '../index';

/**
 * F-CURR-002 section 11.3 (TELEMETRY-NAMES-2 section R, row CM-3): the nineteen names and their
 * payloads. Ids, codes, counts and buckets only; no names, no free text, no learner input, and no
 * profile id inside a payload (it rides in the envelope).
 */
const S = CURR_TELEMETRY_PAYLOADS;

const SECTION_R = [
  'memory.daily',
  'items.seeded',
  'mastery.level_up',
  'stage.card_opened',
  'testout.finished',
  'quest.adapt',
  'goal.set',
  'goal.met',
  'week.goal_met',
  'decode.sprint.finished',
  'stamp.earned',
  'weekly_quest.complete',
  'pack.opened',
  'pack.level_complete',
  'family.goal_met',
  'space.goal.set',
  'space.goal.met',
  'lecture.game.finished',
  'exp.exposure',
] as const;

const hist = [
  { kind: 'lex', rung: 'read', lag: '2-3', right: 4, wrong: 1 },
  { kind: 'sym', rung: 'recognize', lag: '0-1', right: 2, wrong: 0 },
  { kind: 'pat', rung: 'produce', lag: '31+', right: 0, wrong: 2 },
];
const daily = {
  hist,
  lapses: 1,
  items: 9,
  newHeld: 3,
  minutes: 12,
  durableWeekBucket: '10-19',
  dueVolumeBucket: '20+',
  arms: { E1: 'a', E2: 'b' },
};

/** One valid payload per name, as the emitting rows will send it. */
const VALID: Record<(typeof SECTION_R)[number], Record<string, unknown>> = {
  'memory.daily': daily,
  'items.seeded': { countBucket: '500-999', spreadDaysBucket: '31+' },
  'mastery.level_up': { cellId: 'episode:stage2-life', level: 2 },
  'stage.card_opened': { stage: 'stage3' },
  'testout.finished': { cellId: 'episode:stage4-rites', passed: true, items: 10, firstTryCorrect: 9 },
  'quest.adapt': { questId: 'quest:stage2-life-q3', dir: 'compact' },
  'goal.set': { daily: 6, weeklyDays: 5 },
  'goal.met': { points: 7, target: 6 },
  'week.goal_met': { days: 5, target: 5 },
  'decode.sprint.finished': { rateBucket: '20-29', probeRateBucket: '10-19', sprintIndexBucket: '2' },
  'stamp.earned': { stampId: 'stamp:weekly-stories' },
  'weekly_quest.complete': { questKind: 'refresh-items' },
  'pack.opened': { packId: 'pack:numbers-time' },
  'pack.level_complete': { packId: 'pack:numbers-time', stage: 'stage6' },
  'family.goal_met': { weekTarget: 60 },
  'space.goal.set': {},
  'space.goal.met': {},
  'lecture.game.finished': { preset: 'team-relay', rounds: 12, teams: 3 },
  'exp.exposure': { experimentId: 'E3', arm: 'b' },
};

describe('F-CURR-002 section 11.3 telemetry names (TELEMETRY-NAMES-2 section R, CM-3; Worker first)', () => {
  it('lists the nineteen section R names once each, appended in order after the [SA] names', () => {
    expect([...CURR_TELEMETRY_EVENT_NAMES]).toEqual([...SECTION_R]);
    for (const name of SECTION_R) {
      expect(TELEMETRY_EVENT_NAMES.filter((n) => n === name), name).toHaveLength(1);
      expect(isTelemetryEventName(name)).toBe(true);
    }
    const at = TELEMETRY_EVENT_NAMES.indexOf(SECTION_R[0]);
    expect(at).toBeGreaterThan(TELEMETRY_EVENT_NAMES.indexOf('space.admin.left'));
    expect(TELEMETRY_EVENT_NAMES.slice(at, at + SECTION_R.length)).toEqual([...SECTION_R]);
  });

  it('keeps review.start and review.complete as they are (their new kinds come in CM-3b)', () => {
    expect(TELEMETRY_EVENT_NAMES.filter((n) => n === 'review.start' || n === 'review.complete')).toEqual(['review.start', 'review.complete']);
    expect(Object.keys(S)).not.toContain('review.start');
    expect(Object.keys(S)).not.toContain('review.complete');
  });

  it('has a payload schema for every section R name and for no other name', () => {
    expect(Object.keys(S).sort()).toEqual([...SECTION_R].sort());
  });

  it.each(SECTION_R.map((n) => [n]))('%s accepts its documented payload', (name) => {
    expect(S[name].safeParse(VALID[name]).success).toBe(true);
  });

  it.each(SECTION_R.map((n) => [n]))('%s rejects an extra key, a profile id and free text', (name) => {
    for (const extra of [{ profileId: 'profile:suni' }, { name: 'Suni' }, { text: 'my own sentence' }, { note: '' }]) {
      expect(S[name].safeParse({ ...VALID[name], ...extra }).success, JSON.stringify(extra)).toBe(false);
    }
  });

  it.each(SECTION_R.filter((n) => Object.keys(VALID[n]).length > 0).map((n) => [n]))('%s rejects a missing field and a non-object payload', (name) => {
    const [first] = Object.keys(VALID[name]);
    const { [first as string]: _dropped, ...rest } = VALID[name];
    expect(S[name].safeParse(rest).success).toBe(false);
    expect(S[name].safeParse(undefined).success).toBe(false);
    expect(S[name].safeParse('memory').success).toBe(false);
  });

  it('isCurrTelemetryName narrows to the section R names only', () => {
    for (const name of SECTION_R) expect(isCurrTelemetryName(name)).toBe(true);
    for (const name of ['session.end', 'review.start', 'lecture.start', 'space.goal', 'memory.weekly', 42, undefined]) expect(isCurrTelemetryName(name)).toBe(false);
  });

  it('stores family, class-goal and lecture events without a profile id (account level, Worker side, presenter)', () => {
    expect([...CURR_TELEMETRY_NO_PROFILE].sort()).toEqual(['family.goal_met', 'lecture.game.finished', 'space.goal.met', 'space.goal.set']);
  });

  it('space.goal.set and space.goal.met (Worker side) carry no payload keys yet', () => {
    expect(S['space.goal.set'].safeParse({}).success).toBe(true);
    expect(S['space.goal.met'].safeParse({ target: 20 }).success).toBe(false);
  });
});

describe('memory.daily (F-CURR-002 sections 3.1, 11.2 and 11.3)', () => {
  const M = S['memory.daily'];

  it('uses the six lag buckets of section 11.3', () => {
    expect([...LAG_BUCKETS]).toEqual(['0-1', '2-3', '4-7', '8-14', '15-30', '31+']);
    for (const lag of LAG_BUCKETS) expect(M.safeParse({ ...daily, hist: [{ kind: 'lex', rung: 'read', lag, right: 1, wrong: 0 }] }).success, lag).toBe(true);
    expect(M.safeParse({ ...daily, hist: [{ kind: 'lex', rung: 'read', lag: '3-6', right: 1, wrong: 0 }] }).success).toBe(false);
  });

  it('takes counts by item kind, rung and lag bucket only, each cell at most once', () => {
    expect(M.safeParse({ ...daily, hist: [] }).success).toBe(true);
    expect(M.safeParse({ ...daily, hist: [{ kind: 'word', rung: 'read', lag: '0-1', right: 1, wrong: 0 }] }).success).toBe(false);
    expect(M.safeParse({ ...daily, hist: [{ kind: 'lex', rung: 'speak', lag: '0-1', right: 1, wrong: 0 }] }).success).toBe(false);
    expect(M.safeParse({ ...daily, hist: [{ kind: 'lex', rung: 'read', lag: '0-1', right: -1, wrong: 0 }] }).success).toBe(false);
    expect(M.safeParse({ ...daily, hist: [{ kind: 'lex', rung: 'read', lag: '0-1', right: 1.5, wrong: 0 }] }).success).toBe(false);
    // per-item data stays on the device: an item id inside a cell is refused
    expect(M.safeParse({ ...daily, hist: [{ kind: 'lex', rung: 'read', lag: '0-1', right: 1, wrong: 0, itemId: 'lex:sagwa' }] }).success).toBe(false);
    const twice = { kind: 'lex', rung: 'read', lag: '0-1', right: 1, wrong: 0 };
    expect(M.safeParse({ ...daily, hist: [twice, { ...twice, right: 2 }] }).success).toBe(false);
  });

  it('takes calib as exactly 10 bins when present (row CM-72 only) and validates without it', () => {
    const bin = { right: 3, wrong: 1 };
    expect(M.safeParse(daily).success).toBe(true);
    expect(M.safeParse({ ...daily, calib: Array.from({ length: 10 }, () => bin) }).success).toBe(true);
    expect(M.safeParse({ ...daily, calib: Array.from({ length: 9 }, () => bin) }).success).toBe(false);
    expect(M.safeParse({ ...daily, calib: Array.from({ length: 10 }, () => ({ ...bin, p: 0.4 })) }).success).toBe(false);
  });

  it('takes buckets as bucket codes, never free text or a raw number', () => {
    for (const bucket of ['0', '1-4', '10-19', '31+']) expect(M.safeParse({ ...daily, durableWeekBucket: bucket }).success, bucket).toBe(true);
    for (const bucket of ['', 'many', 'Suni', '1 to 4', '-1', 12, '1-4-9', '123456']) {
      expect(M.safeParse({ ...daily, durableWeekBucket: bucket }).success, String(bucket)).toBe(false);
      expect(M.safeParse({ ...daily, dueVolumeBucket: bucket }).success, String(bucket)).toBe(false);
    }
  });

  it('takes arms as experiment ids to arm codes, and an empty object before any experiment runs', () => {
    expect(M.safeParse({ ...daily, arms: {} }).success).toBe(true);
    expect(M.safeParse({ ...daily, arms: { E5: 'a' } }).success).toBe(false);
    expect(M.safeParse({ ...daily, arms: { E1: 'treatment' } }).success).toBe(false);
    expect(M.safeParse({ ...daily, arms: { E1: 37 } }).success).toBe(false);
  });

  it('bounds minutes to one day and counts to whole numbers', () => {
    expect(M.safeParse({ ...daily, minutes: 1440 }).success).toBe(true);
    expect(M.safeParse({ ...daily, minutes: 1441 }).success).toBe(false);
    expect(M.safeParse({ ...daily, items: 2.5 }).success).toBe(false);
    expect(M.safeParse({ ...daily, lapses: -1 }).success).toBe(false);
  });
});

describe('id, code and count fields of the other section R payloads', () => {
  it('takes a grid cell or pack level id for mastery, and a grid cell id for a test-out', () => {
    for (const cellId of ['episode:stage1-letters', 'episode:stage7-crafts', 'episode:pack-numbers-time-s3']) {
      expect(S['mastery.level_up'].safeParse({ cellId, level: 3 }).success, cellId).toBe(true);
    }
    for (const cellId of ['episode:stage8-life', 'episode:stage2-food', 'stage2-life', 'Suni', 'episode:stage2-life-v2']) {
      expect(S['mastery.level_up'].safeParse({ cellId, level: 1 }).success, cellId).toBe(false);
    }
    expect(S['testout.finished'].safeParse({ ...VALID['testout.finished'], cellId: 'episode:pack-numbers-time-s3' }).success).toBe(false);
  });

  it('takes mastery levels 1 to 3 only (level 0 is never an event)', () => {
    for (const level of [0, 4, 1.5, '2']) expect(S['mastery.level_up'].safeParse({ cellId: 'episode:stage2-life', level }).success, String(level)).toBe(false);
  });

  it('never lets first-try right answers exceed the items asked in a test-out', () => {
    expect(S['testout.finished'].safeParse({ cellId: 'episode:stage2-life', passed: false, items: 8, firstTryCorrect: 9 }).success).toBe(false);
    expect(S['testout.finished'].safeParse({ cellId: 'episode:stage2-life', passed: 'yes', items: 8, firstTryCorrect: 7 }).success).toBe(false);
  });

  it('takes the goal choices of section 7.4 only', () => {
    for (const d of [3, 6, 10]) for (const w of [3, 5, 7]) expect(S['goal.set'].safeParse({ daily: d, weeklyDays: w }).success).toBe(true);
    expect(S['goal.set'].safeParse({ daily: 5, weeklyDays: 3 }).success).toBe(false);
    expect(S['goal.set'].safeParse({ daily: 3, weeklyDays: 4 }).success).toBe(false);
    expect(S['goal.met'].safeParse({ points: 7, target: 7 }).success).toBe(false);
    expect(S['week.goal_met'].safeParse({ days: 8, target: 7 }).success).toBe(false);
  });

  it('takes quest, pack and stamp ids in their id formats and codes as short codes', () => {
    expect(S['quest.adapt'].safeParse({ questId: 'quest:pack-numbers-time-s1-q2', dir: 'scaffold' }).success).toBe(true);
    expect(S['quest.adapt'].safeParse({ questId: 'quest:x', dir: 'faster' }).success).toBe(false);
    expect(S['quest.adapt'].safeParse({ questId: 'Suni', dir: 'compact' }).success).toBe(false);
    expect(S['pack.opened'].safeParse({ packId: 'numbers-time' }).success).toBe(false);
    expect(S['pack.level_complete'].safeParse({ packId: 'pack:numbers-time', stage: 'stage9' }).success).toBe(false);
    expect(S['stamp.earned'].safeParse({ stampId: 'Great job, Suni!' }).success).toBe(false);
    expect(S['weekly_quest.complete'].safeParse({ questKind: 'Finish 2 stories' }).success).toBe(false);
    expect(S['stage.card_opened'].safeParse({ stage: 'Stage 3' }).success).toBe(false);
  });

  it('takes the four lecture game presets and at most 4 teams', () => {
    for (const preset of ['team-relay', 'yut-race', 'hidden-heritage-big', 'bingo']) {
      expect(S['lecture.game.finished'].safeParse({ preset, rounds: 5, teams: 0 }).success, preset).toBe(true);
    }
    expect(S['lecture.game.finished'].safeParse({ preset: 'quiz-show', rounds: 5, teams: 2 }).success).toBe(false);
    expect(S['lecture.game.finished'].safeParse({ preset: 'bingo', rounds: 5, teams: 5 }).success).toBe(false);
  });

  it('takes experiment ids E1 to E4 and their arm codes', () => {
    expect(S['exp.exposure'].safeParse({ experimentId: 'E5', arm: 'a' }).success).toBe(false);
    expect(S['exp.exposure'].safeParse({ experimentId: 'E1', arm: 61 }).success).toBe(false);
    expect(S['family.goal_met'].safeParse({ weekTarget: 0 }).success).toBe(false);
  });
});

describe('session.end payload (TELEMETRY-NAMES-2 section A, three optional fields added by CM-3)', () => {
  const older = { durationSeconds: 420, streakDays: 3 };

  it('validates an older client that sends none of the new fields', () => {
    expect(SessionEndPayloadSchema.parse(older)).toEqual(older);
  });

  it('validates the three new fields with their documented values', () => {
    for (const questLeft of [0, 1]) {
      for (const afterWrongStreak of [0, 1, 2]) {
        const payload = { ...older, questLeft, leftAtKind: 'type-hangul', afterWrongStreak };
        expect(SessionEndPayloadSchema.parse(payload)).toEqual(payload);
      }
    }
    expect(SessionEndPayloadSchema.safeParse({ ...older, questLeft: 1 }).success).toBe(true);
    expect(SessionEndPayloadSchema.safeParse({ ...older, leftAtKind: 'listen-pick' }).success).toBe(true);
  });

  it('rejects values off the documented codes', () => {
    for (const bad of [{ questLeft: 2 }, { questLeft: true }, { afterWrongStreak: 3 }, { afterWrongStreak: '2' }, { leftAtKind: 'Suni' }, { leftAtKind: 'speak-aloud' }]) {
      expect(SessionEndPayloadSchema.safeParse({ ...older, ...bad }).success, JSON.stringify(bad)).toBe(false);
    }
  });

  it('rejects an extra key and a profile id inside the payload', () => {
    expect(SessionEndPayloadSchema.safeParse({ ...older, profileId: 'profile:suni' }).success).toBe(false);
    expect(SessionEndPayloadSchema.safeParse({ ...older, note: 'left early' }).success).toBe(false);
  });

  it('exposes the three new fields on their own for the Worker', () => {
    expect(Object.keys(SESSION_END_QUEST_FIELDS).sort()).toEqual(['afterWrongStreak', 'leftAtKind', 'questLeft']);
  });
});

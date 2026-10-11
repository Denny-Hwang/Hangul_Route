import { describe, expect, it } from 'vitest';
import {
  AssessmentResponseSchema,
  BackupFileSchema,
  GateResultSchema,
  SnapshotPutSchema,
  MotivationSchema,
  OutcomeSchema,
  PLACEMENT_GATES,
  PLACEMENT_KEEP,
  PlacementFormSchema,
  PlacementGateSchema,
  PlacementLevelSchema,
  PlacementResultSchema,
  PlacementSourceSchema,
  PlacementStrandSchema,
  PlacementSummarySchema,
  ProgressSnapshotSchema,
  ProgressSummarySchema,
  StopReasonSchema,
  StrandStatusSchema,
} from '../index';

const response = { questionId: 'pitem:recog-g1', outcome: 'correct', chosenOptionId: 'a', assisted: false, ms: 1800 } as const;
const gate = { gate: 'recog', form: 'decode', asked: 3, correct: 3, assisted: 0, result: 'pass' } as const;
const strands = {
  'hangul-recognition': 'secure',
  'sound-letter': 'getting-there',
  'syllable-reading': 'not-yet',
  vocabulary: 'not-tested',
  sentences: 'not-tested',
} as const;
const result = {
  id: 'placement:2026-10-10-a',
  startedAt: '2026-10-10T10:00:00.000Z',
  completedAt: '2026-10-10T10:05:00.000Z',
  source: 'onboarding',
  testLocale: 'en',
  length: 'full',
  revealMode: 'tap',
  bankVersion: 1,
  contentVer: '2026.10',
  responses: [response],
  gates: [gate],
  strands,
  level: { stage: 'stage1', band: 1 },
  oralStage: null,
  beyondContent: false,
  startQuestId: 'quest:stage1-03',
  placedOutQuestIds: ['quest:stage1-01', 'quest:stage1-02'],
  priorityTokens: ['sym:ㅓ'],
  needsStage: null,
  stopReason: 'complete',
} as const;
const snapshot = {
  profileId: 'profile:one',
  updatedAt: '2026-10-10T00:00:00.000Z',
  episodes: [],
  quests: [],
  cards: [],
  sessions: [],
  homework: [],
  reviews: [],
  streakDays: 0,
};
const summary = {
  schemaVersion: 1,
  lastActiveAt: '2026-10-10T00:00:00.000Z',
  streakDays: 0,
  stage1: { questsDone: 0, questsTotal: 8, anchorAccuracy: null },
  cardsUnlocked: 0,
  minutesLast7d: 0,
  jamoRecognized: [],
  needsPractice: [],
  planProgress: {},
};
const placementSummary = {
  takenAt: '2026-10-10T10:05:00.000Z',
  level: { stage: 'stage1', band: 1 },
  oralStage: null,
  strands,
  beyondContent: false,
  overridden: false,
};

describe('placement enums (F-PLC-001 section 3.4 and 3.8)', () => {
  it('lists the seven gates in rung order', () => {
    expect([...PLACEMENT_GATES]).toEqual(['recog', 'sound-basic', 'syl-cv', 'sound-rest', 'syl-cvc', 'vocab', 'sentence']);
    expect(PlacementGateSchema.safeParse('vocab').success).toBe(true);
    expect(PlacementGateSchema.safeParse('quiz').success).toBe(false);
  });

  it('accepts the documented strands, forms, statuses, sources, reasons and motivations only', () => {
    expect(PlacementStrandSchema.options).toEqual(['hangul-recognition', 'sound-letter', 'syllable-reading', 'vocabulary', 'sentences']);
    expect(PlacementFormSchema.options).toEqual(['decode', 'read', 'oral']);
    expect(StrandStatusSchema.options).toEqual(['secure', 'getting-there', 'not-yet', 'not-tested']);
    expect(PlacementSourceSchema.options).toEqual(['onboarding', 'home', 'profile', 'parent']);
    expect(StopReasonSchema.options).toEqual(['complete', 'cap', 'time', 'quit', 'grown-up', 'not-sure']);
    expect(MotivationSchema.options).toEqual(['heritage', 'kculture', 'curious', 'friends']);
    expect(StrandStatusSchema.safeParse('failed').success).toBe(false);
  });

  it('keeps the ten newest results', () => {
    expect(PLACEMENT_KEEP).toBe(10);
  });
});

describe('AssessmentResponseSchema (the response the placement result stores)', () => {
  it('has the three outcomes and never a wrong-by-default for unanswered questions', () => {
    expect(OutcomeSchema.options).toEqual(['correct', 'wrong', 'skipped']);
  });

  it('defaults assisted to false and bounds ms', () => {
    const { assisted: _a, ...bare } = response;
    expect(AssessmentResponseSchema.parse(bare).assisted).toBe(false);
    expect(AssessmentResponseSchema.safeParse({ ...response, ms: -1 }).success).toBe(false);
    expect(AssessmentResponseSchema.safeParse({ ...response, ms: 600_001 }).success).toBe(false);
    expect(AssessmentResponseSchema.safeParse({ ...response, ms: 1.5 }).success).toBe(false);
    expect(AssessmentResponseSchema.safeParse({ ...response, outcome: 'skipped', chosenOptionId: null }).success).toBe(true);
  });
});

describe('GateResultSchema', () => {
  it('accepts a pass and a not-run gate with a reason', () => {
    expect(GateResultSchema.safeParse(gate).success).toBe(true);
    expect(GateResultSchema.safeParse({ ...gate, asked: 0, correct: 0, result: 'not-run', reason: 'unavailable' }).success).toBe(true);
    expect(GateResultSchema.safeParse({ ...gate, reason: 'stopped' }).success).toBe(true);
  });

  it('bounds the counts to 0..3 and rejects unknown results and reasons', () => {
    expect(GateResultSchema.safeParse({ ...gate, asked: 4 }).success).toBe(false);
    expect(GateResultSchema.safeParse({ ...gate, correct: -1 }).success).toBe(false);
    expect(GateResultSchema.safeParse({ ...gate, assisted: 4 }).success).toBe(false);
    expect(GateResultSchema.safeParse({ ...gate, result: 'wrong' }).success).toBe(false);
    expect(GateResultSchema.safeParse({ ...gate, reason: 'timeout' }).success).toBe(false);
  });
});

describe('PlacementLevelSchema', () => {
  it('is a stage key and a band of 0 to 3', () => {
    expect(PlacementLevelSchema.safeParse({ stage: 'stage7', band: 3 }).success).toBe(true);
    expect(PlacementLevelSchema.safeParse({ stage: 'stage8', band: 0 }).success).toBe(false);
    expect(PlacementLevelSchema.safeParse({ stage: 'stage1', band: 4 }).success).toBe(false);
    expect(PlacementLevelSchema.safeParse({ stage: 'stage1', band: 0.5 }).success).toBe(false);
  });
});

describe('PlacementResultSchema', () => {
  it('accepts a complete result and an override', () => {
    expect(PlacementResultSchema.safeParse(result).success).toBe(true);
    const full = {
      ...result,
      motivation: 'heritage',
      oralStage: 'stage2',
      needsStage: 'stage2',
      override: { by: 'parent', at: '2026-10-11T00:00:00.000Z', startQuestId: 'quest:stage1-02' },
    };
    expect(PlacementResultSchema.parse(full)).toEqual(expect.objectContaining({ motivation: 'heritage', oralStage: 'stage2' }));
  });

  it('requires a placement: id', () => {
    expect(PlacementResultSchema.safeParse({ ...result, id: 'review:x' }).success).toBe(false);
    expect(PlacementResultSchema.safeParse({ ...result, id: 'placement:Bad' }).success).toBe(false);
  });

  it('bounds the arrays (24 responses, 9 gates, 40 placed-out quests, 3 priority tokens)', () => {
    expect(PlacementResultSchema.safeParse({ ...result, responses: Array(24).fill(response) }).success).toBe(true);
    expect(PlacementResultSchema.safeParse({ ...result, responses: Array(25).fill(response) }).success).toBe(false);
    expect(PlacementResultSchema.safeParse({ ...result, gates: Array(10).fill(gate) }).success).toBe(false);
    expect(PlacementResultSchema.safeParse({ ...result, placedOutQuestIds: Array(41).fill('q') }).success).toBe(false);
    expect(PlacementResultSchema.safeParse({ ...result, priorityTokens: ['a', 'b', 'c', 'd'] }).success).toBe(false);
  });

  it('rejects an unknown source, a bad bank version and an override by anyone but a parent', () => {
    expect(PlacementResultSchema.safeParse({ ...result, source: 'school' }).success).toBe(false);
    expect(PlacementResultSchema.safeParse({ ...result, bankVersion: 0 }).success).toBe(false);
    expect(PlacementResultSchema.safeParse({ ...result, override: { by: 'teacher', at: 'x', startQuestId: 'q' } }).success).toBe(false);
  });

  it('requires all five strands', () => {
    const { vocabulary: _v, ...four } = strands;
    expect(PlacementResultSchema.safeParse({ ...result, strands: four }).success).toBe(false);
  });
});

describe('ProgressSnapshotSchema.placements (additive)', () => {
  it('parses an old snapshot without the key to an empty list', () => {
    expect(ProgressSnapshotSchema.parse(snapshot).placements).toEqual([]);
  });

  it('round-trips results and rejects a malformed one', () => {
    expect(ProgressSnapshotSchema.parse({ ...snapshot, placements: [result] }).placements).toHaveLength(1);
    expect(ProgressSnapshotSchema.safeParse({ ...snapshot, placements: [{ id: 'placement:x' }] }).success).toBe(false);
  });
});

describe('ProgressSummarySchema.placement (additive, optional)', () => {
  it('parses a summary without the key and leaves schemaVersion at 1', () => {
    const parsed = ProgressSummarySchema.parse(summary);
    expect(parsed).not.toHaveProperty('placement');
    expect(parsed.schemaVersion).toBe(1);
  });

  it('carries statuses and the level only, nothing per question and no counts', () => {
    const parsed = ProgressSummarySchema.parse({
      ...summary,
      placement: { ...placementSummary, responses: [response], asked: 12, gates: [gate] },
    });
    expect(parsed.placement).toEqual(placementSummary);
  });

  it('validates the block', () => {
    expect(PlacementSummarySchema.safeParse(placementSummary).success).toBe(true);
    expect(PlacementSummarySchema.safeParse({ ...placementSummary, overridden: 'no' }).success).toBe(false);
    expect(PlacementSummarySchema.safeParse({ ...placementSummary, level: { stage: 'stage1', band: 9 } }).success).toBe(false);
    expect(PlacementSummarySchema.safeParse({ ...placementSummary, oralStage: 'stage3' }).success).toBe(true);
    expect(ProgressSummarySchema.safeParse({ ...summary, placement: { ...placementSummary, strands: {} } }).success).toBe(false);
  });
});

describe('old payloads without the new fields still parse', () => {
  it('a backup file written before placements restores with an empty list', () => {
    const file = {
      format: 'hangul-route-backup',
      version: 1,
      exportedAt: '2026-10-10T00:00:00.000Z',
      profile: { id: 'profile:one', displayName: 'Suni', ageGroup: '5-7', avatar: 'hoya-orange', createdAt: '2026-09-01T00:00:00.000Z' },
      snapshot,
    };
    const parsed = BackupFileSchema.safeParse(file);
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.snapshot.placements).toEqual([]);
  });

  it('an old upload body parses and gets the empty list the Worker then preserves against', () => {
    const body = SnapshotPutSchema.parse({ baseRev: 0, snapshot, summary, schemaVer: 1, contentVer: '2026.10' });
    expect(body.snapshot.placements).toEqual([]);
    expect(body.summary).not.toHaveProperty('placement');
  });
});

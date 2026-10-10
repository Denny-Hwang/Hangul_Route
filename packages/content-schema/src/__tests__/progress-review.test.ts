import { describe, expect, it } from 'vitest';
import {
  JamoSchema,
  ProgressSummarySchema,
  ReviewEntrySchema,
  SnapshotPutSchema,
  TELEMETRY_EVENT_NAMES,
  isTelemetryEventName,
} from '../index';

const summary = {
  schemaVersion: 1 as const,
  lastActiveAt: '2026-10-10T00:00:00.000Z',
  streakDays: 2,
  stage1: { questsDone: 3, questsTotal: 15, anchorAccuracy: 0.8 },
  cardsUnlocked: 3,
  minutesLast7d: 20,
  jamoRecognized: ['ㄱ'],
  needsPractice: [],
  planProgress: {},
};

describe('ReviewEntrySchema.missedItemIds (F-QUEST-002 §3.9)', () => {
  const entry = {
    id: 'review:stage1:2026-10-10T00:00:00.000Z',
    kind: 'stage-certificate' as const,
    generatedAt: '2026-10-10T00:00:00.000Z',
    scope: 'stage1',
    itemIds: ['jamo:giyeok'],
    resultStars: 3 as const,
  };

  it('parses an old entry that has no missedItemIds', () => {
    const parsed = ReviewEntrySchema.parse(entry);
    expect(parsed.missedItemIds).toBeUndefined();
  });

  it('parses and keeps missedItemIds', () => {
    expect(ReviewEntrySchema.parse({ ...entry, missedItemIds: ['jamo:tieut'] }).missedItemIds).toEqual(['jamo:tieut']);
    expect(ReviewEntrySchema.parse({ ...entry, missedItemIds: [] }).missedItemIds).toEqual([]);
  });

  it('rejects non-string ids', () => {
    expect(ReviewEntrySchema.safeParse({ ...entry, missedItemIds: [1] }).success).toBe(false);
  });
});

describe('ProgressSummarySchema.stage1Anchor', () => {
  it('is optional: an old summary still parses', () => {
    const parsed = ProgressSummarySchema.parse(summary);
    expect(parsed.stage1Anchor).toBeUndefined();
  });

  it('parses the verdict of the Hangul Check', () => {
    const stage1Anchor = { met: true, checkedAt: '2026-10-10T00:00:00.000Z', tricky: ['ㅌ', 'ㄴ/final'] };
    expect(ProgressSummarySchema.parse({ ...summary, stage1Anchor }).stage1Anchor).toEqual(stage1Anchor);
  });

  it('rejects a malformed verdict', () => {
    expect(ProgressSummarySchema.safeParse({ ...summary, stage1Anchor: { met: 'yes', checkedAt: 'x', tricky: [] } }).success).toBe(false);
    expect(ProgressSummarySchema.safeParse({ ...summary, stage1Anchor: { met: true, tricky: [] } }).success).toBe(false);
    expect(ProgressSummarySchema.safeParse({ ...summary, stage1Anchor: { met: true, checkedAt: 'x' } }).success).toBe(false);
  });

  it('rides through a snapshot PUT body', () => {
    const stage1Anchor = { met: false, checkedAt: '2026-10-10T00:00:00.000Z', tricky: [] };
    const body = {
      baseRev: 0,
      snapshot: {
        profileId: 'profile:a',
        updatedAt: '2026-10-10T00:00:00.000Z',
        episodes: [],
        quests: [],
        cards: [],
        sessions: [],
        homework: [],
        reviews: [],
        streakDays: 0,
      },
      summary: { ...summary, stage1Anchor },
      schemaVer: 1,
      contentVer: '1',
    };
    expect(SnapshotPutSchema.parse(body).summary.stage1Anchor).toEqual(stage1Anchor);
  });
});

describe('JamoSchema.soundHint', () => {
  const jamo = { id: 'jamo:giyeok', char: 'ㄱ', romanization: 'g/k', nameEn: 'giyeok', kind: 'consonant' as const, order: 1 };

  it('is optional and capped at 60 characters', () => {
    expect(JamoSchema.parse(jamo).soundHint).toBeUndefined();
    expect(JamoSchema.safeParse({ ...jamo, soundHint: 'soft, light g, like go' }).success).toBe(true);
    expect(JamoSchema.safeParse({ ...jamo, soundHint: 'x'.repeat(60) }).success).toBe(true);
    expect(JamoSchema.safeParse({ ...jamo, soundHint: 'x'.repeat(61) }).success).toBe(false);
  });
});

describe('telemetry names owned by F-QUEST-002 (§3.13)', () => {
  it.each([
    'quest.discover_completed',
    'quest.check_completed',
    'quest.teaser_tapped',
    'stage.complete',
    'review.start',
    'review.complete',
  ])('%s is in the shared whitelist', (name) => {
    expect(isTelemetryEventName(name)).toBe(true);
    expect(TELEMETRY_EVENT_NAMES).toContain(name);
  });
});

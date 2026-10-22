import { describe, expect, it } from 'vitest';
import {
  ROLLUP_ITEM_COUNT_EDGES,
  ROLLUP_SEEDED_COUNT_EDGES,
  ROLLUP_SPREAD_DAYS_EDGES,
  ROLLUP_STUDY_MINUTES_EDGES,
  TelemetryBucketSchema,
  rollupBucketCode,
  rollupBucketCodes,
} from '../index';

/**
 * F-CURR-002 section 11.2 (row CM-70a): the fixed bucket edges shared by the emitting rows and
 * the Worker, so only these codes can land in `learning_rollups`.
 */
const ALL = [ROLLUP_ITEM_COUNT_EDGES, ROLLUP_SEEDED_COUNT_EDGES, ROLLUP_SPREAD_DAYS_EDGES, ROLLUP_STUDY_MINUTES_EDGES];

describe('rollup bucket edges', () => {
  it('start at 0 and rise', () => {
    for (const edges of ALL) {
      expect(edges[0]).toBe(0);
      for (let i = 1; i < edges.length; i += 1) expect(edges[i] as number).toBeGreaterThan(edges[i - 1] as number);
    }
  });

  it('give one code per edge, each a valid bucket code', () => {
    for (const edges of ALL) {
      const codes = rollupBucketCodes(edges);
      expect(codes).toHaveLength(edges.length);
      expect(new Set(codes).size).toBe(codes.length);
      for (const code of codes) expect(TelemetryBucketSchema.safeParse(code).success).toBe(true);
    }
  });

  it('names a single value, a range and an open top', () => {
    expect(rollupBucketCodes(ROLLUP_SPREAD_DAYS_EDGES)).toEqual(['0', '1', '2-3', '4-7', '8-14', '15-30', '31+']);
    expect([0, 1, 2, 3, 4, 9, 10, 499, 500, 9999].map((v) => rollupBucketCode(v, ROLLUP_ITEM_COUNT_EDGES))).toEqual([
      '0',
      '1',
      '2',
      '3-4',
      '3-4',
      '5-9',
      '10-19',
      '300-499',
      '500+',
      '500+',
    ]);
    expect([0, 59, 60, 1440].map((v) => rollupBucketCode(v, ROLLUP_STUDY_MINUTES_EDGES))).toEqual(['0', '45-59', '60-89', '120+']);
    expect(rollupBucketCode(1500, ROLLUP_SEEDED_COUNT_EDGES)).toBe('1000-1999');
  });
});

import { placementStageNumber, type PlacementLevel, type PlacementResult } from '@hangul-route/content-schema';

/**
 * The dashboard's Starting spot row (F-PLC-001 section 3.9, wireframe placement/report, W-8). Its own module so the
 * grown-up home reads it without the report page, which only the reports chunk draws (AMENDMENTS-START-BUNDLE-2026-11
 * SB-4c). Pure.
 */

/** A stored result as the row and the report read it (`mode` is missing on an older one). */
export type StoredResult = Omit<PlacementResult, 'mode'> & { mode?: PlacementResult['mode'] };

export const byCompletedAt = (a: StoredResult, b: StoredResult): number =>
  a.completedAt < b.completedAt ? -1 : a.completedAt > b.completedAt ? 1 : 0;
const rank = (level: PlacementLevel): number => placementStageNumber(level.stage) * 10 + level.band;

export interface StartingSpotRow {
  /** The highest level reached (results combine by the maximum, section 3.7). */
  level: PlacementLevel;
  /** When the newest check was taken. */
  takenAt: string;
  /** A parent override is in force ("Changed by a grown-up"). */
  overridden: boolean;
}

/** The dashboard's Starting spot row; null without a result. */
export function startingSpotRow(placements: readonly StoredResult[] | undefined): StartingSpotRow | null {
  if (placements === undefined || placements.length === 0) return null;
  const sorted = [...placements].sort(byCompletedAt);
  const level = sorted.map((r) => r.level).reduce((a, b) => (rank(b) > rank(a) ? b : a));
  return {
    level,
    takenAt: (sorted[sorted.length - 1] as StoredResult).completedAt,
    overridden: placements.some((r) => r.override !== undefined),
  };
}

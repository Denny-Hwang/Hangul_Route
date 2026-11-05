import type { DeriveSource } from '../homework/plan-derivation';
import { leadingBlended } from './layer';

/**
 * Refresh on a practice day (AMENDMENTS-ROUTE-CLASS-BLEND sections 6.4 and 7, row BL-6). Pure.
 *
 * Reads `meta.refresh` of the leading class plan with practice days (`leadingBlended`: the newest in force). On a
 * date with an entry, Refresh opens the Cell Check of the first listed cell (earliest first) whose Check the learner
 * can open now, else Daily Review with Keep going, which draws on everything due. A cell the learner cannot open
 * (outside the unlocked stages, F-ENT-003; or its first volume not done, its Check off) is skipped. Refresh is
 * optional: never a to-do, never homework, never counted in `planProgress`.
 */
export type RefreshStep = { kind: 'cell-check'; cellId: string } | { kind: 'daily-review' };

export interface RefreshOptions {
  /** May the learner open this cell's Cell Check now (entitlement, first volume done, `cellCheck` on)? */
  isCellCheckOpen: (cellId: string) => boolean;
}

/** Today's Refresh, or null when today has none (no class plan with practice days, or no entry for the date). */
export function refreshFor(sources: readonly DeriveSource[], today: string, opts: RefreshOptions): RefreshStep | null {
  const lead = leadingBlended(sources, today);
  const entry = lead?.meta?.refresh?.find((e) => e.date === today);
  if (entry === undefined) return null;
  const cellId = entry.cellIds.find((id) => opts.isCellCheckOpen(id));
  return cellId === undefined ? { kind: 'daily-review' } : { kind: 'cell-check', cellId };
}

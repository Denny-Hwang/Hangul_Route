import { mergeLatchRecord, type Episode, type ProgressSnapshot, type StageKey } from '@hangul-route/content-schema';
import { completeStages } from '../my-route/latch';
import { UPPER_PRIZE_STAGES } from '../stage1/stage-complete';

/**
 * The `stageCeremonyAt` latch (F-CURR-002 sections 4.8 step 7 and 7.3, row CM-22; design/wireframes/reviews/
 * stage-check.md A and G). Pure; the start bundle carries it, because Results and Home write the latch.
 *
 * - **Results** writes the key of the stage a run finished when it offers that stage's ceremony (A), so a stage
 *   finished on this build is never in the summary.
 * - **The one retroactive summary** (G) lists every finished stage from 2 to 7 with no key (finished before this build,
 *   or on a device still on an older one), once, and writes a key for each. The keys merge as a union with the
 *   earliest time per stage, on every device and in the Worker, so no stage is summed up twice.
 */

/** The finished Stages 2-7 with no `stageCeremonyAt` key, in stage order: what the retroactive summary lists. */
export function recapStages(snapshot: Pick<ProgressSnapshot, 'quests' | 'stageDoneAt' | 'stageCeremonyAt'>, episodes: readonly Episode[]): StageKey[] {
  const done = completeStages(snapshot, episodes);
  const held = snapshot.stageCeremonyAt ?? {};
  return UPPER_PRIZE_STAGES.filter((stage) => done.has(stage) && !Object.prototype.hasOwnProperty.call(held, stage));
}

/**
 * The snapshot with a `stageCeremonyAt` key for each stage (earliest wins, so a key never moves later); null when
 * every stage already holds one, so nothing is saved or synced again.
 */
export function withStageCeremony(snapshot: ProgressSnapshot, stages: readonly StageKey[], at: string): ProgressSnapshot | null {
  const fresh = stages.filter((stage) => UPPER_PRIZE_STAGES.includes(stage) && snapshot.stageCeremonyAt?.[stage] === undefined);
  if (fresh.length === 0) return null;
  const merged = mergeLatchRecord(snapshot.stageCeremonyAt, Object.fromEntries(fresh.map((stage) => [stage, at]))) ?? {};
  return { ...snapshot, stageCeremonyAt: merged };
}

import { mergeLatchRecord, type Episode, type ProgressSnapshot, type StageKey } from '@hangul-route/content-schema';
import { completeStages } from '../my-route/latch';
import { PRIZE_STAGES } from '../stage1/stage-complete';

/**
 * The `stageCeremonyAt` latch (F-CURR-002 sections 4.8 step 7 and 7.3, row CM-22; design/wireframes/reviews/
 * stage-check.md A and G). Pure; the Stage Check's chunk reads it (Results and Home reach its writer through the chunk), so
 * the start bundle carries none of it.
 *
 * - **Results** writes the key of the stage a run finished when it offers that stage's ceremony (A), so a stage
 *   finished on this build is never in the summary.
 * - **The one retroactive summary** (G) lists every finished stage from 2 to 7 with no key (finished before this build,
 *   or on a device still on an older one), once, and writes a key for each. The keys merge as a union with the
 *   earliest time per stage, on every device and in the Worker, so no stage is summed up twice.
 */

/** The stages whose prize is the stage ceremony (Stages 2-7), in stage order. */
export const UPPER_PRIZE_STAGES: readonly StageKey[] = (Object.keys(PRIZE_STAGES) as StageKey[]).filter((s) => PRIZE_STAGES[s].ceremony === 'stage');

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

/** How long Home waits, with no sync running, before a learner whose sync has not settled counts as settled. */
export const RECAP_SYNC_GRACE_MS = 4000;

/**
 * Whether the summary may open now (section 4.8 step 7, "shown ONCE"): only once this app session's sync of the learner
 * has settled, so a key another device latched is pulled first. `synced` (a sync finished in this session), `error`
 * (offline: the local copy is all there is) and `off` (no server) are settled; while `syncing`, never; `idle` or no
 * record yet only after `graceOver` (no sync started within the grace).
 */
export function recapSyncSettled(status: 'off' | 'idle' | 'syncing' | 'synced' | 'error' | undefined, graceOver: boolean): boolean {
  if (status === 'syncing') return false;
  return status === 'off' || status === 'synced' || status === 'error' || graceOver;
}

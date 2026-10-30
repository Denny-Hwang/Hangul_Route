import {
  CURR_TELEMETRY_PAYLOADS,
  ROLLUP_DECODE_RATE_EDGES,
  ROLLUP_SPRINT_INDEX_EDGES,
  rollupBucketCode,
  type BlockParts,
} from '@hangul-route/content-schema';
import type { TelemetryEvent } from '../../platform/telemetry';
import { blockOptions } from './fallback';
import { DRILL_BLOCKS, heardFinal, isProbeBlock, partsOf, PROBE_FORMS, romanizationOf } from './pool';
import { shuffled, tilesFor, tilesSound, type TileRows } from './tiles';

/**
 * The Decoding Sprint (F-CURR-002 section 7.1 F9, OD-8, section 3.2 G9, section 11.3, row CM-32): an optional 60-second
 * bonus after Stage 1, like the vocab Speed Round. Pure: the plan, the clock and the result; the screen draws them.
 *
 * - **Drill.** One clock for the whole drill, 60 seconds of play: it stops while a round shows its answer and while
 *   paused, and when it runs out the round on screen is simply dropped (never a miss). Rounds hear a real block and
 *   pick it (Listen & Pick on the block) or, while `game.syllable-build` is on, build it (every other round). Real
 *   blocks only: the Stage 1 table and the allowlist, never a held-out probe block, as answer or as option.
 * - **Probe.** Then a short held-out probe with no clock on screen: `PROBE_ROUNDS` pick rounds of one matched form of
 *   blocks no sprint ever drills (`PROBE_FORMS`, the n-th sprint form (n - 1 + the learner's offset) mod 4), always picks, so the format is
 *   the same in every sprint and G9 compares like with like. Its options are drill blocks, never another probe block.
 *   It only measures: a tap moves on with no right or miss shown and no answer, so a probe block is never practised.
 *   Its rate is the right first tries per minute of answer time; a sprint whose probe was read (no sound) sends none.
 * - **Result.** A count of blocks read (right first tries in the drill) and the learner's own best, kept on this device
 *   only (`DecodeSprintRecord`) and never compared with anyone. `decode.sprint.finished` carries buckets only: the drill
 *   rate, the probe rate and the sprint index, each a code of its shared edges, parsed before it is sent.
 */

export const SPRINT_MS = 60_000;
export const PROBE_ROUNDS = 6;
/** Drill rounds planned: more than a learner can play in a minute, so the drill never runs out before the clock. */
export const DRILL_ROUNDS = 60;
/** A probe answered faster than this a round is read at this pace, so a stray double tap cannot make a rate soar. */
export const PROBE_MIN_MS_PER_ROUND = 800;

export interface PickRoundPlan {
  kind: 'pick';
  target: string;
  romanization: string;
  /** The block options, the target among them, in a seeded order. */
  options: string[];
}

export interface BuildRoundPlan {
  kind: 'build';
  target: string;
  romanization: string;
  parts: BlockParts;
  tiles: TileRows;
}

export type SprintRound = PickRoundPlan | BuildRoundPlan;

export interface SprintPlan {
  drill: SprintRound[];
  probe: PickRoundPlan[];
}

const DRILL: ReadonlySet<string> = new Set(DRILL_BLOCKS);
const inDrill = (ko: string): boolean => DRILL.has(ko);

function pick(target: string, seed: number, allowed: (ko: string) => boolean): PickRoundPlan {
  const parts = partsOf(target) as BlockParts;
  const tiles = tilesFor(parts, seed);
  return { kind: 'pick', target, romanization: romanizationOf(target), options: shuffled(blockOptions(target, tiles, seed, allowed), seed + 3) };
}

/**
 * The probe form of a learner's n-th sprint (n from 1): the four forms in turn, from the learner's own first form
 * (`formOffset`, a hash of the profile; 0 when absent). Learners start on different forms, so a sprint index's cohort
 * spreads over all four and G9's sprint-1-to-sprint-4 change is not a difference between two fixed forms.
 */
export function probeFormOf(sprintIndex: number, formOffset = 0): number {
  const n = PROBE_FORMS.length;
  const offset = Number.isSafeInteger(formOffset) ? ((formOffset % n) + n) % n : 0;
  return (((Math.max(1, Math.floor(sprintIndex)) - 1 + offset) % n) + n) % n;
}

/**
 * The sprint's rounds for a seed (the profile and the sprint index): the drill from the drill blocks in a seeded order,
 * builds every other round while `build` is on; the probe from the held-out form of the sprint index and the learner's
 * form offset (`probeFormOf`).
 */
export function planSprint(seed: number, build: boolean, sprintIndex = 1, formOffset = 0): SprintPlan {
  const targets = shuffled(
    DRILL_BLOCKS.filter((ko) => heardFinal(partsOf(ko) as BlockParts)),
    seed,
  );
  const drill: SprintRound[] = [];
  for (let i = 0; i < DRILL_ROUNDS; i += 1) {
    const target = targets[i % targets.length] as string;
    const s = seed + 101 * (i + 1);
    const parts = partsOf(target) as BlockParts;
    const tiles = tilesFor(parts, s);
    if (build && i % 2 === 1 && tilesSound({ ko: target }, tiles)) {
      drill.push({ kind: 'build', target, romanization: romanizationOf(target), parts, tiles });
    } else {
      drill.push(pick(target, s, inDrill));
    }
  }
  const form = PROBE_FORMS[probeFormOf(sprintIndex, formOffset)] ?? [];
  const probe = shuffled(form, seed + 7)
    .slice(0, PROBE_ROUNDS)
    .map((target, i) => pick(target, seed + 997 * (i + 1), inDrill));
  return { drill, probe };
}

/** Every block a drill round shows (its answer and its options): never a probe block (a test reads this). */
export function drillBlocksShown(plan: SprintPlan): string[] {
  return plan.drill.flatMap((r) => (r.kind === 'pick' ? r.options : [r.target]));
}

export const isHeldOut = isProbeBlock;

// ---- the clock ----------------------------------------------------------------------------------------------

/**
 * The drill clock: active play time only. `run` starts it (a round is up), `hold` stops it (a round shows its answer,
 * the sprint is paused, the app is in the background). Times are a monotonic clock in ms.
 */
export interface SprintClock {
  activeMs: number;
  /** When the clock last started running, or null while it is held. */
  runningSince: number | null;
}

export const CLOCK_START: SprintClock = { activeMs: 0, runningSince: null };

export function runClock(clock: SprintClock, now: number): SprintClock {
  return clock.runningSince === null ? { ...clock, runningSince: now } : clock;
}

export function holdClock(clock: SprintClock, now: number): SprintClock {
  if (clock.runningSince === null) return clock;
  return { activeMs: clock.activeMs + Math.max(0, now - clock.runningSince), runningSince: null };
}

export function elapsedMs(clock: SprintClock, now: number): number {
  return Math.min(SPRINT_MS, clock.activeMs + (clock.runningSince === null ? 0 : Math.max(0, now - clock.runningSince)));
}

/** Whole seconds left, rounded up (the bar moves in one-second steps). */
export function secondsLeft(clock: SprintClock, now: number): number {
  return Math.ceil((SPRINT_MS - elapsedMs(clock, now)) / 1000);
}

export const timeUp = (clock: SprintClock, now: number): boolean => elapsedMs(clock, now) >= SPRINT_MS;

/** The time left on the drill clock in ms (what the vocab Challenge clock's view draws: the bar, m:ss and its label). */
export function remainingMs(clock: SprintClock, now: number): number {
  return SPRINT_MS - elapsedMs(clock, now);
}

// ---- the result -----------------------------------------------------------------------------------------------

export interface SprintTally {
  /** Drill rounds right on the first try. */
  drillRight: number;
  /** The drill's active time (60 s once the clock ran out). */
  drillMs: number;
  probeRight: number;
  /** The probe's answer time: from each round being up to its first tap, summed. */
  probeMs: number;
  probeRounds: number;
  /**
   * Every probe round was heard (the sound on and a device voice). False when one was read from its romanization: a
   * different task, so that sprint's rates are not sent (G9 reads decoding by ear). Absent counts as heard.
   */
  probeHeard?: boolean;
}

/** Right first tries per minute of `ms` (whole, rounded down). */
export function perMinute(right: number, ms: number): number {
  if (right <= 0 || ms <= 0) return 0;
  return Math.floor((right * 60_000) / ms);
}

export function drillRate(t: SprintTally): number {
  return perMinute(t.drillRight, Math.max(t.drillMs, 1000));
}

export function probeRate(t: SprintTally): number {
  return perMinute(t.probeRight, Math.max(t.probeMs, PROBE_MIN_MS_PER_ROUND * Math.max(1, t.probeRounds)));
}

/** What this device keeps for a learner (`decode-sprint:<profileId>`): sprints finished and the best count. Never synced, never sent. */
export interface DecodeSprintRecord {
  v: 1;
  sprints: number;
  best: number;
}

export const EMPTY_RECORD: DecodeSprintRecord = { v: 1, sprints: 0, best: 0 };

/** A stored record read back; anything else is no record yet. */
export function parseRecord(raw: unknown): DecodeSprintRecord {
  if (typeof raw !== 'object' || raw === null) return EMPTY_RECORD;
  const r = raw as Record<string, unknown>;
  const whole = (v: unknown): number | null => (typeof v === 'number' && Number.isSafeInteger(v) && v >= 0 ? v : null);
  const sprints = whole(r.sprints);
  const best = whole(r.best);
  return r.v === 1 && sprints !== null && best !== null ? { v: 1, sprints, best } : EMPTY_RECORD;
}

export interface SprintOutcome {
  /** The count the result screen shows: blocks read in the drill. */
  read: number;
  record: DecodeSprintRecord;
  /** Above the learner's own earlier best (never on a first sprint: there is nothing to beat). */
  newBest: boolean;
  /** The best to show beside the count, from the second sprint on. */
  best: number | null;
  event: TelemetryEvent | null;
}

/**
 * The finished sprint against the learner's own record; the event carries buckets only, parsed before it is sent, and
 * none when the probe was read rather than heard (`probeHeard`). The best is kept either way.
 */
export function finishSprint(tally: SprintTally, before: DecodeSprintRecord, profileId: string | undefined): SprintOutcome {
  const read = tally.drillRight;
  const index = before.sprints + 1;
  const record: DecodeSprintRecord = { v: 1, sprints: index, best: Math.max(before.best, read) };
  const payload = {
    rateBucket: rollupBucketCode(drillRate(tally), ROLLUP_DECODE_RATE_EDGES),
    probeRateBucket: rollupBucketCode(probeRate(tally), ROLLUP_DECODE_RATE_EDGES),
    sprintIndexBucket: rollupBucketCode(index, ROLLUP_SPRINT_INDEX_EDGES),
  };
  const parsed = CURR_TELEMETRY_PAYLOADS['decode.sprint.finished'].safeParse(payload);
  return {
    read,
    record,
    newBest: before.sprints > 0 && read > before.best,
    best: before.sprints > 0 ? record.best : null,
    event: parsed.success && tally.probeHeard !== false ? { name: 'decode.sprint.finished', profileId, payload: parsed.data } : null,
  };
}

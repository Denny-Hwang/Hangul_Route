import { CLASS_MOVE_PURGE_AFTER_MS } from '@hangul-route/content-schema';
import { NOTE_HOLD_RETENTION_DAYS, NOTE_REPORT_RETENTION_DAYS, NOTE_RETENTION_DAYS, type Db } from '../db';

/**
 * The bounded notes purge — F-FEEDBACK-001 section 8.7 (PR FB-3b). It runs in
 * two ways, so "kept until" holds even when nobody sends:
 *
 * 1. lazily, once per `POST /:id/notes` and per family oversight read
 *    (`purgeNotesLazily`, one bounded step of four statements);
 * 2. daily, from the Worker's Cron Trigger (`runScheduledPurge`): the note
 *    purge, the existing `purgeRateHits` and ([TV] AMENDMENTS-TEACHER-VISIBILITY-TRANSFER
 *    4.1) the class-move records 90 days after they ended, executed or expired,
 *    at most five rounds of 200 rows.
 *
 * Every list already filters by the same cut-offs, so purge lag is never
 * visible; the purge only keeps the tables small.
 */

const DAY_MS = 24 * 60 * 60 * 1000;
/** Rows per purge step (each of the note purge's four statements, and the counter purge). */
export const NOTE_PURGE_LIMIT = 200;
/** Rounds of the daily purge: at most 5 x 200 rows per statement per run, well under the per-invocation query limit. */
export const SCHEDULED_PURGE_ROUNDS = 5;
/** Counter rows are read over the rolling 24 hours (section 7.3, and the transfer limits); older rows are dead. */
const RATE_HIT_WINDOW_MS = DAY_MS;

/** One bounded note purge step as of `now`: live, hidden and withdrawn notes past 180 days, reported past 90 days after the newest report, lifted holds past 365 days. */
export function purgeNotesLazily(db: Db, now: Date): Promise<number> {
  const t = now.getTime();
  return db.purgeNotes(new Date(t - NOTE_RETENTION_DAYS * DAY_MS), new Date(t - NOTE_REPORT_RETENTION_DAYS * DAY_MS), new Date(t - NOTE_HOLD_RETENTION_DAYS * DAY_MS), NOTE_PURGE_LIMIT);
}

/** What one daily run removed, and in how many rounds. */
export interface ScheduledPurgeResult {
  rounds: number;
  notes: number;
  rateHits: number;
  classMoves: number;
}

/**
 * One bounded class-move purge step ([TV] 4.1): ended rows 90 days after `ended_at`, executed rows 90 days after
 * `executed_at`, and asks that expired unopened 90 days after `expires_at`. A failure (for example a Worker that runs
 * before migration 0009) removes nothing and never stops the note purge; tomorrow's run retries.
 */
export async function purgeClassMovesStep(db: Db, now: Date): Promise<number> {
  const before = new Date(now.getTime() - CLASS_MOVE_PURGE_AFTER_MS);
  try {
    return await db.purgeClassMoves(before, before, NOTE_PURGE_LIMIT);
  } catch {
    return 0;
  }
}

/**
 * The daily purge: rounds of one note step and one counter step, until a round removes fewer rows than a
 * full step of each (nothing left) or after `SCHEDULED_PURGE_ROUNDS` rounds; tomorrow's run continues.
 */
export async function runScheduledPurge(db: Db, now: Date): Promise<ScheduledPurgeResult> {
  const out: ScheduledPurgeResult = { rounds: 0, notes: 0, rateHits: 0, classMoves: 0 };
  const hitsBefore = new Date(now.getTime() - RATE_HIT_WINDOW_MS);
  while (out.rounds < SCHEDULED_PURGE_ROUNDS) {
    out.rounds += 1;
    const notes = await purgeNotesLazily(db, now);
    const rateHits = await db.purgeRateHits(hitsBefore, NOTE_PURGE_LIMIT);
    const classMoves = await purgeClassMovesStep(db, now);
    out.notes += notes;
    out.rateHits += rateHits;
    out.classMoves += classMoves;
    // The note step's four statements each remove at most a full step, so a total under one step means all four are done.
    if (notes < NOTE_PURGE_LIMIT && rateHits < NOTE_PURGE_LIMIT && classMoves < NOTE_PURGE_LIMIT) break;
  }
  return out;
}

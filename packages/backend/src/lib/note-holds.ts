import type { NoteReportReason } from '@hangul-route/content-schema';
import type { Db, NoteActVia, NoteHoldReason, StoredNoteReport } from '../db';

/**
 * Reports and the automatic hold — F-FEEDBACK-001 section 8.4 (PR
 * FB-4b-device; the family report route of FB-4b-family uses the same rules).
 *
 * After every report the Worker counts reports against the sender's account in
 * the last 30 days from distinct reporting families (`reporter_key`), so one
 * parent with two children, or two profiles on one family tablet, counts once.
 * A hold is placed at 2 families (OD-10), or at once on an `unsafe` report from
 * a family account or from a device whose grown-up opened the gate
 * (`attest = 'grown_up_pin'`). An unattested `unsafe` device report (a class
 * tablet) only hides the note and goes to the top of the owner's review queue.
 * A hold never hides earlier notes; only the owner lifts it.
 */

/** Distinct reporting families in the window that hold a sender (OD-10). */
export const NOTE_HOLD_REPORTERS = 2;
/** The window the distinct families are counted over. */
export const NOTE_HOLD_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;

/** Whether one report holds the sender at once: `unsafe` from a family account or a PIN-attested device. */
export function holdsAtOnce(reason: NoteReportReason, via: NoteActVia, attest: StoredNoteReport['attest']): boolean {
  return reason === 'unsafe' && (via === 'family' || attest === 'grown_up_pin');
}

/**
 * The hold check after a recorded report: places a hold when a rule of section 8.4 is met and none is
 * active. Answers the reason of a hold this call placed, or null (no rule met, or a hold already active).
 */
export async function holdAfterReport(db: Db, report: Pick<StoredNoteReport, 'senderAccountId' | 'reason' | 'via' | 'attest'>, now: Date): Promise<NoteHoldReason | null> {
  let reason: NoteHoldReason | null = holdsAtOnce(report.reason, report.via, report.attest) ? 'unsafe' : null;
  if (reason === null && (await db.countReportersAgainst(report.senderAccountId, new Date(now.getTime() - NOTE_HOLD_WINDOW_MS))) >= NOTE_HOLD_REPORTERS) reason = 'reports';
  if (reason === null) return null;
  return (await db.putSenderHold({ accountId: report.senderAccountId, reason, createdAt: now.toISOString(), liftedAt: null })) ? reason : null;
}

/**
 * `reporter_key` of a device report (section 8.4): `family:<id>` of the learner's family membership (the
 * oldest, when there were ever several), or `device:<deviceId>` when the learner has no family.
 */
export async function deviceReporterKey(db: Db, learnerId: string, deviceId: string): Promise<string> {
  const memberships = await db.membershipsOf('learner', learnerId);
  const spaces = new Map((await db.getSpaces(memberships.map((m) => m.spaceId))).map((s) => [s.id, s]));
  const family = memberships.find((m) => spaces.get(m.spaceId)?.kind === 'family');
  return family ? `family:${family.spaceId}` : `device:${deviceId}`;
}

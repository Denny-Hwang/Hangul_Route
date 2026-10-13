import { LearnerRegisterSchema, NoteDevicePrefsPutSchema, NoteReportSchema, NoteStatePutSchema, SnapshotPutSchema, TIER_GRACE_MS } from '@hangul-route/content-schema';
import { Hono } from 'hono';
import { dbFor, NOTE_INBOX_LIMIT, noteRateKey, noteRetentionCuts, type Db, type NoteDeviceScope, type StoredNote } from '../db';
import { fail, ok } from '../envelope';
import { authorizeDevice, hashSecret, newDeviceSecret } from '../lib/device-auth';
import { preserveAdditiveFields } from '../lib/additive-fields';
import { tierForLearner } from '../lib/entitlement';
import { deviceReporterKey, holdAfterReport } from '../lib/note-holds';
import { NOTE_LIMIT_DEVICE_REPORTS_PER_LEARNER_PER_DAY, NOTE_LIMIT_WINDOW_MS } from '../lib/note-limits';
import { inboxNoteView, notePrefsView } from '../lib/note-views';
import type { TransferEnv } from '../lib/transfer';
import { id, type Learner, type SnapshotRecord } from '../store';
import { inboxPlansFor } from './plans';
import { inboxTransfers } from './transfer-device';
import { learnerMembershipRows } from './spaces';

/**
 * /api/sync — F-SYNC-001 §3.2. One snapshot row per learner with
 * optimistic concurrency (`rev`); the client merges on 409.
 */
export const syncRoutes = new Hono();

syncRoutes.post('/learners', async (c) => {
  const parsed = LearnerRegisterSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return fail(c, 'bad_request', 'Invalid registration body', 422, { issues: parsed.error.issues });
  const { deviceId, learner: input } = parsed.data;
  const db = dbFor(c);

  if (input.id && (await db.getLearner(input.id))) {
    return fail(c, 'conflict', 'Learner id already registered — restore instead', 409);
  }
  const now = new Date().toISOString();
  const learner: Learner = {
    id: input.id ?? id('profile'),
    displayName: input.displayName,
    ageGroup: input.ageGroup,
    avatar: input.avatar,
    recoveryHash: null,
    createdAt: now,
    lastActiveAt: now,
  };
  await db.putLearner(learner);

  const secret = newDeviceSecret();
  await db.putDevice({ learnerId: learner.id, deviceId, secretHash: await hashSecret(secret), scope: 'full', createdAt: now, lastSeenAt: now });
  return ok(c, { learner, device: { deviceId, secret } }, 201);
});

syncRoutes.put('/learners/:id/snapshot', async (c) => {
  const learnerId = c.req.param('id');
  const auth = await authorizeDevice(c, learnerId);
  if (typeof auth !== 'string') return auth;
  const db = dbFor(c);

  const parsed = SnapshotPutSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return fail(c, 'bad_request', 'Invalid snapshot body', 422, { issues: parsed.error.issues });
  const body = parsed.data;
  if (body.snapshot.profileId !== learnerId) {
    return fail(c, 'bad_request', 'snapshot.profileId must match the learner', 422);
  }

  const conflict = (current: SnapshotRecord | null): Response =>
    c.json(
      {
        ok: false,
        error: { code: 'conflict', message: 'Snapshot changed on the server — merge and retry' },
        data: { rev: current?.rev ?? 0, snapshot: current?.payload ?? null, summary: current?.summary ?? null },
      },
      409,
    );

  const current = await db.getSnapshot(learnerId);
  const currentRev = current?.rev ?? 0;
  if (body.baseRev !== currentRev) return conflict(current);

  // An older app build re-uploads without the newer additive fields: keep what is stored (lib/additive-fields.ts).
  const kept = preserveAdditiveFields({ payload: body.snapshot, summary: body.summary }, current && { payload: current.payload, summary: current.summary });
  const record: SnapshotRecord = {
    learnerId,
    rev: currentRev + 1,
    schemaVer: body.schemaVer,
    contentVer: body.contentVer,
    deviceId: auth,
    summary: kept.summary,
    payload: kept.payload,
    updatedAt: new Date().toISOString(),
  };
  // Compare-and-set: another device may have written between the read above and here (SYNC-1).
  if (!(await db.putSnapshot(record, currentRev))) return conflict(await db.getSnapshot(learnerId));
  const learner = await db.getLearner(learnerId);
  if (learner) await db.putLearner({ ...learner, lastActiveAt: record.updatedAt });
  return ok(c, { rev: record.rev, updatedAt: record.updatedAt });
});

syncRoutes.get('/learners/:id/snapshot', async (c) => {
  const learnerId = c.req.param('id');
  const auth = await authorizeDevice(c, learnerId);
  if (typeof auth !== 'string') return auth;
  const record = await dbFor(c).getSnapshot(learnerId);
  if (!record) return fail(c, 'no_snapshot', 'No snapshot uploaded yet', 404);
  return ok(c, {
    rev: record.rev,
    snapshot: record.payload,
    summary: record.summary,
    updatedAt: record.updatedAt,
    schemaVer: record.schemaVer,
    contentVer: record.contentVer,
  });
});

/** Capabilities an app declares on the inbox read: `?cap=a,b` or `?cap=a&cap=b`. */
export function acceptsCurriculum(caps: readonly string[] | undefined): boolean {
  return (caps ?? []).some((value) => value.split(',').some((cap) => cap.trim() === 'curriculum'));
}

syncRoutes.get('/learners/:id/inbox', async (c) => {
  const learnerId = c.req.param('id');
  const auth = await authorizeDevice(c, learnerId, { allowClassScope: true });
  if (typeof auth !== 'string') return auth;
  const db = dbFor(c);
  const now = new Date();
  // A class-approved device sees class and school spaces only — family plans stay with the family (SEC-4).
  const classScoped = (await db.getDevice(learnerId, auth))?.scope === 'class';
  // Class moves (F-SPACE-002 section 4.4, T15): the lock is read before any transfer table; locked, all off and empty.
  // Read first: settling can perform a due move (section 4.6), so the tier, plans and memberships below already
  // reflect it and an `executed` row never arrives next to the old class (sections 4.10, 4.12).
  const transfers = await inboxTransfers(db, learnerId, classScoped ? 'class' : 'full', c.env as TransferEnv | undefined, now);
  const { tier, source } = await tierForLearner(db, learnerId, now);
  // F-PLAN-002 section 3.5: a curriculum reaches only an app that derives with a horizon (`?cap=curriculum`).
  const plans = (await inboxPlansFor(db, learnerId)).filter((p) => p.meta === null || acceptsCurriculum(c.req.queries('cap')));
  const memberships = await learnerMembershipRows(db, learnerId);
  // Notes from grown-ups (F-FEEDBACK-001 section 6.8): delivery rules 1-7 and the prefs row in one query.
  const notes = await db.notesForLearner(learnerId, classScoped ? 'class' : 'full', now, NOTE_INBOX_LIMIT);
  return ok(c, {
    rev: (await db.getSnapshot(learnerId))?.rev ?? 0,
    plans: classScoped ? plans.filter((p) => p.spaceKind !== 'family') : plans,
    memberships: classScoped ? memberships.filter((m) => m.kind !== 'family') : memberships,
    tier,
    tierSource: source,
    tierValidUntil: tier === 'premium' ? new Date(now.getTime() + TIER_GRACE_MS).toISOString() : null,
    serverTime: now.toISOString(),
    notes: notes.notes.map(inboxNoteView),
    notePrefs: notePrefsView(notes.prefs),
    ...transfers,
  });
});

/**
 * The learner's read state and reaction on one note (F-FEEDBACK-001 section 7.6). Any device of the learner,
 * a class-scoped one included, but only for a note this device is delivered (the inbox rules): anything else,
 * hidden, withdrawn, another learner's or a family note on a class device, is 404. "Delivered" includes rule 7:
 * a note past the 30 newest is 404 too, and the device drops its queued write (section 6.9), as the next inbox
 * drops the note. Idempotent: `readAt` is set once, the last reaction wins.
 */
syncRoutes.put('/learners/:id/notes/:noteId/state', async (c) => {
  const learnerId = c.req.param('id');
  const noteId = c.req.param('noteId');
  const auth = await authorizeDevice(c, learnerId, { allowClassScope: true });
  if (typeof auth !== 'string') return auth;
  const parsed = NoteStatePutSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return fail(c, 'bad_request', 'Invalid note state body', 422, { issues: parsed.error.issues });
  const db = dbFor(c);
  const now = new Date();
  const scope = (await db.getDevice(learnerId, auth))?.scope === 'class' ? 'class' : 'full';
  const delivered = (await db.notesForLearner(learnerId, scope, now, NOTE_INBOX_LIMIT)).notes.some((n) => n.id === noteId);
  if (!delivered) return fail(c, 'not_found', 'Note not found', 404);
  if (parsed.data.read) await db.setNoteRead(noteId, now);
  if (parsed.data.reaction) await db.setNoteReaction(noteId, parsed.data.reaction, now);
  const note = await db.getNote(noteId);
  return ok(c, { readAt: note?.readAt ?? null, reaction: note?.reaction ?? null });
});

/** The device's scope as the notes rules read it: a class re-link sees class notes only (SEC-4). */
async function noteScope(db: Db, learnerId: string, deviceId: string): Promise<NoteDeviceScope> {
  return (await db.getDevice(learnerId, deviceId))?.scope === 'class' ? 'class' : 'full';
}

/** Whether this device is delivered the note now (the inbox rules of section 6.8, rule 7 included). */
async function isDelivered(db: Db, learnerId: string, scope: NoteDeviceScope, noteId: string, now: Date): Promise<boolean> {
  return (await db.notesForLearner(learnerId, scope, now, NOTE_INBOX_LIMIT)).notes.some((n) => n.id === noteId);
}

/**
 * Hide one note on every device (F-FEEDBACK-001 section 7.6; the grown-up zone and the report sheet's "Just
 * hide it", sent after the gate). Full-scope devices only: a class tablet cannot act for the family. Only a
 * note this device is delivered; a note already hidden answers 200 again (idempotent); anything else is 404.
 * A hide is not a report and counts toward no hold (decision D8).
 */
syncRoutes.post('/learners/:id/notes/:noteId/hide', async (c) => {
  const learnerId = c.req.param('id');
  const noteId = c.req.param('noteId');
  const auth = await authorizeDevice(c, learnerId);
  if (typeof auth !== 'string') return auth;
  const db = dbFor(c);
  const now = new Date();
  if (await isDelivered(db, learnerId, 'full', noteId, now)) {
    await db.hideNote(noteId, 'device', now);
    return ok(c, { hidden: true });
  }
  const note = await db.getNote(noteId);
  if (note && note.learnerId === learnerId && note.status === 'hidden' && note.createdAt >= noteRetentionCuts(now).notesSince) return ok(c, { hidden: true });
  return fail(c, 'not_found', 'Note not found', 404);
});

/**
 * Whether a device may report this note: any note to this learner that the device's scope may see (a full
 * device: any space; a class-scoped one: class spaces only), whatever its status and whether it is still
 * delivered. A note leaves the inbox for many reasons the learner cannot see (taken back, hidden, the class
 * mode set to off, a block, the sender removed from the class, the class archived, the 30-note window), and
 * a report queued offline must never be lost to any of them (section 6.9); note ids are random and reach a
 * device only through an earlier delivery, so this widens nothing. Retention is applied by `insertNoteReport`.
 */
function reportable(note: StoredNote | null, learnerId: string, scope: NoteDeviceScope, spaceKind: string | undefined): note is StoredNote {
  if (!note || note.learnerId !== learnerId) return false;
  return scope === 'full' || spaceKind === 'class';
}

/**
 * Report a note from the learner's device (F-FEEDBACK-001 sections 7.6 and 8.4): any device of the learner, a
 * class-scoped one included, so a learner on a class tablet can always get a note away. The note becomes
 * `reported` (it leaves every device at the next inbox), a report row records `via = 'device'`, the device id
 * as evidence and the reporting family as `reporter_key`, and the hold check runs. Ten device reports per
 * learner per day; past that, `429 too_many { scope: 'learner' }` (the app keeps the note put away).
 */
syncRoutes.post('/learners/:id/notes/:noteId/report', async (c) => {
  const learnerId = c.req.param('id');
  const noteId = c.req.param('noteId');
  const auth = await authorizeDevice(c, learnerId, { allowClassScope: true });
  if (typeof auth !== 'string') return auth;
  const parsed = NoteReportSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return fail(c, 'bad_request', 'Invalid report body', 422, { issues: parsed.error.issues });
  const db = dbFor(c);
  const now = new Date();
  const scope = await noteScope(db, learnerId, auth);
  const note = await db.getNote(noteId);
  const space = note && note.learnerId === learnerId && scope === 'class' ? await db.getSpace(note.spaceId) : null;
  if (!reportable(note, learnerId, scope, space?.kind)) return fail(c, 'not_found', 'Note not found', 404);

  const counterKey = noteRateKey.reportLearner(learnerId);
  if ((await db.countRateHits(counterKey, new Date(now.getTime() - NOTE_LIMIT_WINDOW_MS))) >= NOTE_LIMIT_DEVICE_REPORTS_PER_LEARNER_PER_DAY) {
    return fail(c, 'too_many', 'Too many reports today, try again tomorrow', 429, { scope: 'learner', retryAfter: NOTE_LIMIT_WINDOW_MS / 1000 });
  }
  const report = {
    id: `notereport:${crypto.randomUUID()}`,
    noteId: note.id,
    learnerId,
    senderAccountId: note.senderAccountId,
    reason: parsed.data.reason,
    via: 'device' as const,
    evidence: auth,
    reporterKey: await deviceReporterKey(db, learnerId, auth),
    // A class tablet has no grown-up zone, so a PIN attestation from a class-scoped device is a bare client
    // claim: it is not stored, and an unsafe report from there hides the note and goes to review, never an
    // immediate hold (section 8.4).
    attest: scope === 'class' ? null : (parsed.data.attest ?? null),
    createdAt: now.toISOString(),
    reviewedAt: null,
    outcome: null,
  };
  // Refused only for a note past the retention cut-offs (section 8.7), which every list already hides.
  if (!(await db.insertNoteReport(report))) return fail(c, 'not_found', 'Note not found', 404);
  // The daily limit and the hold check are best-effort steps after the insert: parallel reports can pass ten
  // by a few, and a hold check a stopped Worker missed runs again with the next report against the sender.
  await db.addRateHits([{ key: counterKey, at: report.createdAt }]);
  await holdAfterReport(db, report, now);
  return ok(c, { reported: true }, 201);
});

/**
 * The learner's class-notes setting from the grown-up zone (F-FEEDBACK-001 sections 6.10 and 7.6). Full-scope
 * devices only (a class tablet cannot change a family choice: 403). `acknowledge: true` records that the
 * family answered the one-time class-notes card; an acknowledgement is never cleared. `attest` is a client
 * claim the prefs row has no column for: accepted and not stored.
 */
syncRoutes.put('/learners/:id/note-prefs', async (c) => {
  const learnerId = c.req.param('id');
  const auth = await authorizeDevice(c, learnerId);
  if (typeof auth !== 'string') return auth;
  const parsed = NoteDevicePrefsPutSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return fail(c, 'bad_request', 'Invalid note prefs body', 422, { issues: parsed.error.issues });
  const db = dbFor(c);
  const at = new Date().toISOString();
  await db.putNotePrefs({ learnerId, classes: parsed.data.classes, acknowledgedAt: parsed.data.acknowledge ? at : null, updatedAt: at, updatedVia: 'device', updatedByAccount: null });
  return ok(c, notePrefsView(await db.getNotePrefs(learnerId)));
});

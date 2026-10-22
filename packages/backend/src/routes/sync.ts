import { LearnerProfilePatchSchema, LearnerRegisterSchema, NoteDevicePrefsPutSchema, NoteReportSchema, NoteStatePutSchema, SnapshotPutSchema, TIER_GRACE_MS, boundToNow } from '@hangul-route/content-schema';
import {
  MEMORY_PUSH_MAX_BYTES,
  MEMORY_PUSH_MAX_SHARDS,
  MEMORY_PUSH_MAX_STATES,
  MemoryCursorSchema,
  countPushedShards,
  countPushedStates,
  parseMemoryPush,
} from '@hangul-route/content-schema/memory';
import { Hono } from 'hono';
import { dbFor, NOTE_INBOX_LIMIT, noteRateKey, noteRetentionCuts, type Db, type NoteDeviceScope, type StoredMemoryShard, type StoredNote } from '../db';
import { fail, meta, ok } from '../envelope';
import { authorizeDevice, hashSecret, newDeviceSecret } from '../lib/device-auth';
import { preserveAdditiveFields } from '../lib/additive-fields';
import { MemoryWriteConflict, pushMemory } from '../lib/memory-shards';
import { tierForLearner } from '../lib/entitlement';
import { publicLearner } from '../lib/learners';
import { deviceReporterKey, holdAfterReport } from '../lib/note-holds';
import { NOTE_LIMIT_DEVICE_REPORTS_PER_LEARNER_PER_DAY, NOTE_LIMIT_WINDOW_MS } from '../lib/note-limits';
import { inboxNoteView, notePrefsView } from '../lib/note-views';
import type { TransferEnv } from '../lib/transfer';
import { id, type Learner, type SnapshotRecord } from '../store';
import { inboxPlansFor } from './plans';
import { inboxClassFields } from './class-moves';
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
    profileUpdatedAt: null,
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

  // A wrong device clock never writes a day or a time that would win every later merge (F-CURR-002 section 4.8).
  const sent = boundToNow(body.snapshot, new Date(), current?.payload);
  // An older app build re-uploads without the newer additive fields: keep what is stored (lib/additive-fields.ts).
  const kept = preserveAdditiveFields({ payload: sent, summary: body.summary }, current && { payload: current.payload, summary: current.summary });
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
  // Column-only: a whole-row write here would undo a rename or a Rescue Code stored since the read.
  await db.touchLearner(learnerId, record.updatedAt);
  return ok(c, { rev: record.rev, updatedAt: record.updatedAt });
});

/**
 * The learner's name, level or picture, changed on the learner's own device (F-PROF-001, F-LEARN-001 L2).
 * Full-scope devices only: a class tablet cannot rename the learner (403 `scope_limited`, SEC-4). Only the
 * sent columns are written, and only while the stored edit is not newer than `at` (an `at` in the future is
 * read as now), so a late queued edit answers 200 `applied: false` and changes nothing. The name travels in
 * the body only: it is never logged, put in a URL, a server event or telemetry.
 */
syncRoutes.patch('/learners/:id', async (c) => {
  const learnerId = c.req.param('id');
  const auth = await authorizeDevice(c, learnerId);
  if (typeof auth !== 'string') return auth;
  const parsed = LearnerProfilePatchSchema.safeParse(await c.req.json().catch(() => null));
  // Issue paths and codes only: an issue's message or received value could echo the name back into a log.
  if (!parsed.success) return fail(c, 'bad_request', 'Invalid learner profile body', 422, { issues: parsed.error.issues.map((i) => ({ path: i.path, code: i.code })) });
  const { at, ...fields } = parsed.data;
  const now = new Date();
  const sent = new Date(at);
  const when = (sent.getTime() > now.getTime() ? now : sent).toISOString();
  const db = dbFor(c);
  const applied = await db.updateLearnerProfile(learnerId, fields, when);
  const learner = await db.getLearner(learnerId);
  if (!learner) return fail(c, 'not_found', 'Learner not found', 404);
  // `profileUpdatedAt`: the edit time stored (a device clock ahead of the server's is capped at now), so the device
  // orders later inbox rows against the server's clock, not its own.
  return ok(c, { learner: publicLearner(learner), applied, profileUpdatedAt: learner.profileUpdatedAt ?? null });
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

/** The inbox `learner` block: name, level, picture and the last edit time. Empty when the row is gone. */
async function inboxLearner(db: Db, learnerId: string): Promise<{ learner?: { displayName: string; ageGroup: string; avatar: string; profileUpdatedAt: string | null } }> {
  const row = await db.getLearner(learnerId);
  return row ? { learner: { displayName: row.displayName, ageGroup: row.ageGroup, avatar: row.avatar, profileUpdatedAt: row.profileUpdatedAt ?? null } } : {};
}

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
  // [TV] the class-scope update and the one-time move notices (AMENDMENTS-TEACHER-VISIBILITY-TRANSFER section 4.3); never on a class tablet.
  const classFields = await inboxClassFields(db, learnerId, classScoped ? 'class' : 'full', memberships.some((m) => m.kind === 'class'), c.env as TransferEnv | undefined, now);
  c.header('Cache-Control', 'no-store');
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
    ...classFields,
    // The server's learner row, so the learner's own device can see a name the server holds (never a class tablet).
    ...(classScoped ? {} : await inboxLearner(db, learnerId)),
    // The calling device's own scope (F-SPACE-002 section 4.12): a tablet a class relinked before the app kept a
    // marker learns it here, locked or not (no extra read).
    deviceScope: classScoped ? 'class' : 'full',
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

/** The 413 both memory caps answer, with the caps, so a device can split its queue. */
function memoryTooLarge(c: Parameters<typeof fail>[0], message: string): Response {
  return fail(c, 'payload_too_large', message, 413, { maxStates: MEMORY_PUSH_MAX_STATES, maxBytes: MEMORY_PUSH_MAX_BYTES, maxShards: MEMORY_PUSH_MAX_SHARDS });
}

/**
 * The request body, read until it passes `max` bytes and no further: null when it is larger. A body
 * sent without a Content-Length (chunked) is never buffered past the cap.
 */
async function readBodyUpTo(request: Request, max: number): Promise<Uint8Array | null> {
  if (request.body === null) return new Uint8Array(0);
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > max) {
      await reader.cancel().catch(() => undefined);
      return null;
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}

/** A Worker that runs before migration 0016 (or a D1 outage) answers the memory routes 503; every other route is unchanged. */
function memoryUnavailable(c: Parameters<typeof fail>[0]): Response {
  return fail(c, 'memory_unavailable', 'The memory store is not available, try again later', 503);
}

/**
 * The memory store's changed item states (F-CURR-002 section 4.8, row CM-11), Worker first. Full-scope
 * devices only, like the snapshot routes: a class-scoped device gets `403 scope_limited` (SEC-4) and keeps
 * its memory on the device. At most 500 states in a body of 64 KB or less, else 413. Seeded states
 * (`n` = 0) are not stored, and an `at` ahead of the Worker's clock is bounded first (section 13,
 * `boundMemoryStateToNow`). The Worker reads only the shards the call touches, merges per item and
 * writes the changed ones in one D1 batch, each at the learner's highest `seq` + 1. The path carries only
 * the opaque learner id; nothing here is logged.
 */
syncRoutes.post('/learners/:id/memory', async (c) => {
  const learnerId = c.req.param('id');
  const auth = await authorizeDevice(c, learnerId);
  if (typeof auth !== 'string') return auth;
  if (Number(c.req.header('content-length') ?? 0) > MEMORY_PUSH_MAX_BYTES) return memoryTooLarge(c, 'Memory body is over 64 KB');
  const bytes = await readBodyUpTo(c.req.raw, MEMORY_PUSH_MAX_BYTES).catch(() => new Uint8Array(0));
  if (bytes === null) return memoryTooLarge(c, 'Memory body is over 64 KB');
  let raw: unknown = null;
  try {
    raw = JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    raw = null;
  }
  if (countPushedStates(raw) > MEMORY_PUSH_MAX_STATES) return memoryTooLarge(c, 'Over 500 item states in one call');
  if (countPushedShards(raw) > MEMORY_PUSH_MAX_SHARDS) return memoryTooLarge(c, 'Too many shards in one call');
  // `MemoryPushSchema`'s rules, checked by hand so a 500-state call fits the free-tier CPU limit.
  const parsed = parseMemoryPush(raw);
  if (!parsed.success) return fail(c, 'bad_request', 'Invalid memory body', 422, { issues: parsed.issues });
  try {
    return ok(c, await pushMemory(dbFor(c), learnerId, parsed.data.shards, new Date()));
  } catch (error) {
    if (error instanceof MemoryWriteConflict) return fail(c, 'conflict', 'Memory changed on the server, send it again', 409);
    return memoryUnavailable(c);
  }
});

/**
 * Every shard written after the cursor, whole, with the new cursor (F-CURR-002 section 4.8). Paging uses
 * the server's `seq`, never a device's `at`, so a late offline upload with an old `at` still reaches every
 * other device. A cursor past the learner's highest `seq` (the server copy was restored to an older one)
 * reads from the start, which the idempotent merge makes harmless. Full-scope devices only, as the push.
 * The stored shard text is passed on without being parsed again, so a pull costs no merge CPU.
 */
syncRoutes.get('/learners/:id/memory', async (c) => {
  const learnerId = c.req.param('id');
  const auth = await authorizeDevice(c, learnerId);
  if (typeof auth !== 'string') return auth;
  const since = MemoryCursorSchema.safeParse(c.req.query('since') ?? '0');
  if (!since.success) return fail(c, 'bad_request', 'since must be a whole number of 0 or more', 422);
  const db = dbFor(c);
  let rows: StoredMemoryShard[];
  let cursor = since.data;
  try {
    rows = await db.memoryShardsSince(learnerId, cursor);
    if (rows.length === 0 && cursor > 0) {
      const highest = await db.memoryHighestSeq(learnerId);
      if (cursor > highest) {
        rows = await db.memoryShardsSince(learnerId, 0);
        cursor = highest;
      }
    }
  } catch {
    return memoryUnavailable(c);
  }
  for (const row of rows) cursor = Math.max(cursor, row.seq);
  const shards = rows.map((row) => `{"shard":${JSON.stringify(row.shard)},"seq":${row.seq},"states":${row.states}}`).join(',');
  c.header('Cache-Control', 'no-store');
  return c.body(`{"ok":true,"data":{"cursor":${cursor},"shards":[${shards}]},"meta":${JSON.stringify(meta())}}`, 200, { 'Content-Type': 'application/json; charset=UTF-8' });
});

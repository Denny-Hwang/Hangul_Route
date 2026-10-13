import { CATALOG, NOTE_LEARNER_ID_MAX, NOTE_PRESET_AUDIENCE, NOTE_PRESETS_NEED_SUGGEST, NOTE_SEND_MAX_LEARNERS, NoteAccountReportSchema, NoteIdSchema, NotePrefsPutSchema, NoteSendSchema, type NotesMode, type Space } from '@hangul-route/content-schema';
import { checkNoteText } from '@hangul-route/i18n/note-text';
import { Hono, type Context } from 'hono';
import { dbFor, noteRateKey, noteRetentionCuts, type Db, type NewNote, type NoteCursor, type SpaceNoteListRow, type StoredNote } from '../db';
import { fail, ok } from '../envelope';
import { requireAccount } from '../lib/access';
import { allowedOnSpace, can, type AccountActor } from '../lib/can';
import { holdAfterReport } from '../lib/note-holds';
import { accountOverLimit, learnersOverLimit, NOTE_LIMIT_FAMILY_REPORTS_PER_ACCOUNT_PER_DAY, NOTE_LIMIT_SENDS_PER_MINUTE, NOTE_LIMIT_WINDOW_MS, sendCounterHits, sendCounterKeys } from '../lib/note-limits';
import { accountLabel, batchStatus, DEVICE_ACTOR, encodeNoteCursor, notePrefsView, oversightStatus, parseNoteCursor, senderRefFor, sentNoteReaction, sentNoteStatus, type SentNoteFacts } from '../lib/note-views';
import { purgeNotesLazily } from '../lib/note-retention';
import { notesSendEnabled, type NotesEnv } from '../lib/notes-switch';
import { createRateLimiter } from '../lib/rate-limit';
import type { Account } from '../store';
import { rosterName } from './spaces';

/**
 * Notes from grown-ups, the account routes — F-FEEDBACK-001 section 7.2: the
 * composer's recipient list and the send (PR FB-3a), the sent list and take
 * back (PR FB-3b). Mounted at /api/spaces.
 *
 * Both routes sit behind the Worker switch `NOTES_SEND` (section 7.8): while it
 * is off they answer 404 before reading a header, a body or the database. A
 * send is set-based (section 7.4): its statement count does not grow with the
 * number of learners. A family's notes mode and blocks are applied here and
 * again at delivery (section 6.8); a block always reads like `off`, so it is
 * never revealed to the sender. Note text is never logged or echoed in an error.
 *
 * The sent list and take back are not switched (decision D7): they keep
 * working while sending is off. Take back is soft (decision D9): the row stays
 * for the family's view with status `withdrawn`.
 */
export const notesRoutes = new Hono<{ Bindings: NotesEnv }>();

type Ctx = Context<{ Bindings: NotesEnv }>;

/** Sends (batches) per account per minute, per isolate (section 7.3); the durable daily limits back it. */
export const notesSendLimiter = createRateLimiter(NOTE_LIMIT_SENDS_PER_MINUTE, 60_000);

const QUEST_IDS: ReadonlySet<string> = new Set(CATALOG.quests.map((q) => q.id));

const notFound = (c: Ctx): Response => fail(c, 'not_found', 'Not found', 404);

/** What the recipient list says about a learner for this sender: a block reads exactly like `off`. */
function recipientMode(space: Space, classes: NotesMode, blocked: boolean): NotesMode {
  if (blocked) return 'off';
  return space.kind === 'class' ? classes : 'all';
}

/**
 * The acting account, its space and the right to send there (section 6.1): 404 for a missing space, 403
 * `not_allowed` without `feedback.send` (a caregiver without the owner's grant too), 409 for an archived
 * space. The grant row is read only for a family caregiver, and passed to `can()` with the membership.
 */
async function sender(c: Ctx, db: Db, spaceId: string): Promise<Response | { account: Account; space: Space }> {
  const account = await requireAccount(c);
  if (!('id' in account)) return account;
  const space = await db.getSpace(spaceId);
  if (!space) return notFound(c);
  const memberships = await db.membershipsOf('account', account.id);
  const actor: AccountActor = { kind: 'account', accountId: account.id, memberships };
  const role = memberships.find((m) => m.spaceId === space.id)?.role ?? null;
  const sendGrant = space.kind === 'family' && role === 'caregiver' ? (await db.getSendGrant(space.id, account.id)) !== null : false;
  // `feedback.send` is never cascaded from a school, so the parent space is not needed here.
  if (!can(actor, 'feedback.send', { kind: 'space', ctx: { space, parent: null, sendGrant } })) return fail(c, 'not_allowed', 'You cannot send notes here', 403);
  if (space.archivedAt) return fail(c, 'space_archived', 'This space is archived', 409);
  return { account, space };
}

notesRoutes.get('/:id/notes/recipients', async (c) => {
  if (!notesSendEnabled(c.env)) return notFound(c);
  const db = dbFor(c);
  const who = await sender(c, db, c.req.param('id'));
  if (who instanceof Response) return who;
  const { account, space } = who;
  const now = new Date();
  const rows = await db.noteRecipients(space.id, account.id);
  // `today`: notes this account sent each learner in the last 24 hours, from one grouped query.
  const counts = await db.countRateHitsByKeys(
    rows.map((r) => noteRateKey.pair(r.learnerId, account.id)),
    new Date(now.getTime() - NOTE_LIMIT_WINDOW_MS),
  );
  return ok(c, {
    learners: rows.map((r) => ({
      id: r.learnerId,
      displayName: rosterName(space, r.displayName),
      notes: recipientMode(space, r.classes, r.blocked),
      today: counts.get(noteRateKey.pair(r.learnerId, account.id)) ?? 0,
    })),
  });
});

notesRoutes.post('/:id/notes', async (c) => {
  if (!notesSendEnabled(c.env)) return notFound(c);
  const db = dbFor(c);
  const who = await sender(c, db, c.req.param('id'));
  if (who instanceof Response) return who;
  const { account, space } = who;

  const parsed = NoteSendSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return fail(c, 'bad_request', 'Invalid note', 422, { issues: parsed.error.issues.map((i) => ({ path: i.path, code: i.code })) });
  const body = parsed.data;
  const role = space.kind === 'class' ? 'teacher' : 'family';

  // The note itself (sections 6.2-6.4): preset audience and suggestion, label, text.
  const audience = NOTE_PRESET_AUDIENCE[body.presetId];
  if (audience !== 'all' && audience !== role) return fail(c, 'bad_preset', 'This encouragement is not available here', 422);
  if (NOTE_PRESETS_NEED_SUGGEST.has(body.presetId) && !body.suggest) return fail(c, 'bad_preset', 'This encouragement needs a suggested quest', 422);
  if (body.suggest && !QUEST_IDS.has(body.suggest.id)) return fail(c, 'bad_suggest', 'Unknown quest', 422);
  if (body.label !== undefined && role !== 'family') return fail(c, 'label_not_allowed', 'A class note has no family label', 422);
  let text: string | null = null;
  if (body.text !== undefined) {
    const checked = checkNoteText(body.text);
    if (!checked.ok) return fail(c, 'note_text', 'The note text cannot be sent', 422, checked.word === undefined ? { problem: checked.problem } : { problem: checked.problem, word: checked.word });
    text = checked.text;
  }

  // Holds and the per-minute brake (sections 7.3, 8.4).
  const hold = await db.getSenderHold(account.id);
  if (hold && hold.liftedAt === null) return fail(c, 'sending_paused', 'Sending notes is paused for this account', 403);
  const brake = notesSendLimiter.check(account.id);
  // A short wait, answered like the other per-minute limiters (never a daily `scope`, so the console never words it as "tomorrow").
  if (!brake.allowed) return fail(c, 'too_many_attempts', 'Too many notes in a minute, try again soon', 429, { retryAfterSeconds: brake.retryAfterSeconds });

  // Who receives it: the space's current students only (section 6.1 item 2).
  let learnerIds: string[];
  if (body.to.kind === 'everyone') {
    learnerIds = (await db.membersOf(space.id)).filter((m) => m.memberKind === 'learner' && m.role === 'student').map((m) => m.memberId);
    // The 300-learner cap of one send (section 7.3) holds for `everyone` too, answered like the schema's own cap on `ids`.
    if (learnerIds.length > NOTE_SEND_MAX_LEARNERS) return fail(c, 'bad_request', 'Invalid note', 422, { issues: [{ path: ['to'], code: 'too_big' }] });
  } else {
    const students = new Set(await db.studentsOf(space.id, body.to.ids));
    if (body.to.ids.some((learnerId) => !students.has(learnerId))) return fail(c, 'not_in_space', 'A learner is not a student here', 422);
    learnerIds = body.to.ids;
  }

  // The family's choices (section 6.1 item 4): class notes follow the mode; a block reads like `off`.
  const modes = new Map<string, NotesMode>();
  if (role === 'teacher') for (const p of await db.notePrefsFor(learnerIds)) modes.set(p.learnerId, p.classes);
  const blocked = new Set(await db.blocksFor(learnerIds, account.id));
  const skipped: Array<{ learnerId: string; reason: 'notes_off' | 'limit' }> = [];
  const presetsOnly: string[] = [];
  const open: string[] = [];
  for (const learnerId of learnerIds) {
    const mode = recipientMode(space, modes.get(learnerId) ?? 'all', blocked.has(learnerId));
    if (mode === 'off') skipped.push({ learnerId, reason: 'notes_off' });
    else open.push(learnerId);
  }

  // The daily limits (section 7.3), from one grouped count.
  const now = new Date();
  const counts = await db.countRateHitsByKeys(sendCounterKeys(account.id, open), new Date(now.getTime() - NOTE_LIMIT_WINDOW_MS));
  const over = learnersOverLimit(account.id, open, counts);
  const to = open.filter((learnerId) => !over.has(learnerId));
  for (const learnerId of open) if (over.has(learnerId)) skipped.push({ learnerId, reason: 'limit' });
  if (accountOverLimit(account.id, to.length, counts)) return fail(c, 'too_many', 'Too many notes today, try again tomorrow', 429, { scope: 'account', retryAfter: NOTE_LIMIT_WINDOW_MS / 1000 });
  if (role === 'teacher') for (const learnerId of to) if ((modes.get(learnerId) ?? 'all') === 'presets') presetsOnly.push(learnerId);

  // The lazy retention step (section 8.7): one bounded purge per send, so old notes go even between daily runs.
  // Housekeeping never fails a send: a failed step is retried by the next send and by the daily run.
  await purgeNotesLazily(db, now).catch(() => 0);

  const at = now.toISOString();
  const batchId = `notebatch:${crypto.randomUUID()}`;
  const rows: NewNote[] = to.map((learnerId) => ({
    id: `note:${crypto.randomUUID()}`,
    learnerId,
    spaceId: space.id,
    senderAccountId: account.id,
    senderRole: role,
    senderLabel: role === 'family' ? (body.label ?? 'family') : null,
    batchId,
    batchKind: body.to.kind,
    presetId: body.presetId,
    body: text,
    bodyLocale: text === null ? null : (body.textLocale ?? null),
    suggest: body.suggest ?? null,
    createdAt: at,
  }));
  // Notes and counters in one transaction, re-checking the hold: a hold placed since the check above writes nothing.
  const written = await db.insertNotes(rows, sendCounterHits(account.id, to, at));
  if (rows.length > 0 && written === 0) return fail(c, 'sending_paused', 'Sending notes is paused for this account', 403);
  return ok(c, { batchId, sent: written, skipped, presetsOnly }, 201);
});

/** Rows per page of the sent list (section 7.2). */
export const SENT_LIST_PAGE = 50;
const LEARNER_ID = /^profile:[a-z0-9-]+$/;
/** `POST …/withdraw` body: `{}` (or none) takes back one note, `{ batch: true }` every live note of its batch; anything else is refused. */
function withdrawBody(raw: unknown): { batch: boolean } | null {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return null;
  const keys = Object.keys(raw);
  if (keys.some((k) => k !== 'batch')) return null;
  const batch = (raw as { batch?: unknown }).batch;
  if (batch !== undefined && batch !== true) return null;
  return { batch: batch === true };
}

/**
 * The facts the status mapping needs for the listed notes to chosen learners, with a fixed number of
 * statements: the space's adults (one), the grants of family caregivers who sent (one each), the learners'
 * modes (one, class only), blocks (one per sender) and names (one per 90 learners).
 */
async function listFacts(db: Db, space: Space, notes: readonly StoredNote[]): Promise<{ facts: (n: StoredNote) => SentNoteFacts; names: Map<string, string> }> {
  const learnerIds = [...new Set(notes.map((n) => n.learnerId))];
  const senders = [...new Set(notes.map((n) => n.senderAccountId))];
  const members = await db.membersOf(space.id);
  const roles = new Map(members.filter((m) => m.memberKind === 'account').map((m) => [m.memberId, m.role]));
  const students = new Set(members.filter((m) => m.memberKind === 'learner' && m.role === 'student').map((m) => m.memberId));
  const maySend = new Set<string>();
  for (const accountId of senders) {
    const role = roles.get(accountId);
    if (space.kind === 'class' && (role === 'teacher' || role === 'owner')) maySend.add(accountId);
    if (space.kind === 'family' && (role === 'owner' || (role === 'caregiver' && (await db.getSendGrant(space.id, accountId)) !== null))) maySend.add(accountId);
  }
  const modes = new Map<string, NotesMode>();
  if (space.kind === 'class' && learnerIds.length > 0) for (const p of await db.notePrefsFor(learnerIds)) modes.set(p.learnerId, p.classes);
  const blocked = new Set<string>();
  for (const accountId of senders) {
    const ids = [...new Set(notes.filter((n) => n.senderAccountId === accountId).map((n) => n.learnerId))];
    for (const learnerId of await db.blocksFor(ids, accountId)) blocked.add(`${learnerId}\n${accountId}`);
  }
  const names = new Map((await db.getLearners(learnerIds)).map((l) => [l.id, rosterName(space, l.displayName)]));
  return {
    names,
    facts: (n) => ({
      spaceKind: space.kind,
      mode: modes.get(n.learnerId) ?? 'all',
      blocked: blocked.has(`${n.learnerId}\n${n.senderAccountId}`),
      learnerInSpace: students.has(n.learnerId),
      senderMaySend: maySend.has(n.senderAccountId) && n.senderRole === (space.kind === 'class' ? 'teacher' : 'family'),
    }),
  };
}

notesRoutes.get('/:id/notes', async (c) => {
  const db = dbFor(c);
  const account = await requireAccount(c);
  if (!('id' in account)) return account;
  const space = await db.getSpace(c.req.param('id'));
  if (!space) return notFound(c);
  // `feedback.send`, or in a family `feedback.oversee` (a caregiver without the grant still reads the family's notes).
  const actor: AccountActor = { kind: 'account', accountId: account.id, memberships: await db.membershipsOf('account', account.id) };
  const rights = allowedOnSpace(actor, { space, parent: null });
  if (!rights.has('feedback.send') && !rights.has('feedback.oversee')) return fail(c, 'not_allowed', 'You cannot see notes here', 403);

  const rawBefore = c.req.query('before');
  let before: NoteCursor | null = null;
  if (rawBefore !== undefined && rawBefore !== '') {
    before = parseNoteCursor(rawBefore);
    if (!before) return fail(c, 'bad_request', 'Invalid before', 422);
  }
  const learnerId = c.req.query('learner');
  if (learnerId !== undefined && (learnerId.length > NOTE_LEARNER_ID_MAX || !LEARNER_ID.test(learnerId))) return fail(c, 'bad_request', 'Invalid learner', 422);

  const now = new Date();
  // With `learner`, every note is its own row; without it, an `everyone` batch collapses to one row (no counts of opens or answers).
  const page: SpaceNoteListRow[] =
    learnerId === undefined
      ? await db.sentListOfSpace(space.id, { before, limit: SENT_LIST_PAGE, now })
      : (await db.notesForSpace(space.id, { before, limit: SENT_LIST_PAGE, now, learnerId })).map((note) => ({ note, batch: null }));
  const { facts, names } = await listFacts(db, space, page.filter((r) => r.batch === null).map((r) => r.note));
  const rows = page.map(({ note: n, batch }) => {
    const common = { id: n.id, batchId: n.batchId, presetId: n.presetId, text: n.body, suggest: n.suggest, label: n.senderLabel, createdAt: n.createdAt, mine: n.senderAccountId === account.id };
    if (batch) return { ...common, to: 'everyone' as const, size: batch.size, status: batchStatus(batch) };
    const f = facts(n);
    const status = sentNoteStatus(n, f);
    return { ...common, to: 'learner' as const, learnerId: n.learnerId, displayName: names.get(n.learnerId) ?? '', status, reaction: sentNoteReaction(n, status, f) };
  });
  const last = page[page.length - 1];
  return ok(c, { rows, next: page.length === SENT_LIST_PAGE && last ? encodeNoteCursor(last.note) : null });
});

notesRoutes.post('/:id/notes/:noteId/withdraw', async (c) => {
  const db = dbFor(c);
  const account = await requireAccount(c);
  if (!('id' in account)) return account;
  const space = await db.getSpace(c.req.param('id'));
  if (!space) return notFound(c);
  // Taking a note back only lowers exposure, so it needs no current `feedback.send`: an adult member of the space
  // takes back its own notes even after its grant or teacher role went, and an archived space allows it too.
  if (!(await db.membership(space.id, 'account', account.id))) return fail(c, 'not_allowed', 'You cannot take back notes here', 403);
  // No body reads as `{}`; a body that is not JSON is refused like any other bad body.
  const text = await c.req.text().catch(() => '');
  let raw: unknown = {};
  if (text.trim() !== '') {
    try {
      raw = JSON.parse(text);
    } catch {
      raw = null;
    }
  }
  const body = withdrawBody(raw);
  if (!body) return fail(c, 'bad_request', 'Invalid body', 422);

  const now = new Date();
  const note = await db.getNote(c.req.param('noteId'));
  // Another space's note, a missing one, or one past retention: the same 404, never which.
  if (!note || note.spaceId !== space.id || (note.status !== 'reported' && note.createdAt < noteRetentionCuts(now).notesSince)) return notFound(c);
  if (note.senderAccountId !== account.id) return fail(c, 'not_allowed', 'You can take back only your own notes', 403);
  // A batch take back skips reported notes (they stay for review); one reported note is refused.
  if (body.batch) return ok(c, { withdrawn: await db.withdrawBatch(note.batchId, account.id, now) });
  if (note.status === 'reported') return fail(c, 'note_reported', 'This note is under review', 409);
  return ok(c, { withdrawn: await db.withdrawNote(note.id, now) });
});

/*
 * The family's oversight of every note to its learner — F-FEEDBACK-001
 * sections 6.1, 7.2, 8.2 and 8.5 (PR FB-4b-family): the family view, hide,
 * report, stop a sender, the class-notes setting, and the owner's "Can send
 * notes" switches. `feedback.oversee` is every family caregiver, granted or
 * not; none of these routes is switched (decision D7).
 */

/** The viewer, the family and the learner: 404 unless the space is a family, 403 without `feedback.oversee`, 404 unless the learner is its student. */
async function overseer(c: Ctx, db: Db, familyId: string, learnerId: string): Promise<Response | { account: Account; space: Space }> {
  const account = await requireAccount(c);
  if (!('id' in account)) return account;
  const space = await db.getSpace(familyId);
  if (!space || space.kind !== 'family') return notFound(c);
  const actor: AccountActor = { kind: 'account', accountId: account.id, memberships: await db.membershipsOf('account', account.id) };
  if (!allowedOnSpace(actor, { space, parent: null }).has('feedback.oversee')) return fail(c, 'not_allowed', 'You cannot see these notes', 403);
  if ((await db.membership(space.id, 'learner', learnerId))?.role !== 'student') return notFound(c);
  return { account, space };
}

/** A note to this learner (from any space) that every list still shows; null otherwise (the route answers 404). */
async function noteOfLearner(db: Db, learnerId: string, noteId: string, now: Date): Promise<StoredNote | null> {
  const note = await db.getNote(noteId);
  if (!note || note.learnerId !== learnerId) return null;
  if (note.status !== 'reported' && note.createdAt < noteRetentionCuts(now).notesSince) return null;
  return note;
}

/** Account names by id, one read per distinct account (a family has a handful of adults). */
async function accountNames(db: Db, ids: Iterable<string>): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  for (const accountId of new Set(ids)) out.set(accountId, accountLabel(await db.getAccount(accountId)));
  return out;
}

notesRoutes.get('/:familyId/learners/:learnerId/notes', async (c) => {
  const db = dbFor(c);
  const learnerId = c.req.param('learnerId');
  const who = await overseer(c, db, c.req.param('familyId'), learnerId);
  if (who instanceof Response) return who;
  const { account } = who;
  const rawBefore = c.req.query('before');
  let before: NoteCursor | null = null;
  if (rawBefore !== undefined && rawBefore !== '') {
    before = parseNoteCursor(rawBefore);
    if (!before) return fail(c, 'bad_request', 'Invalid before', 422);
  }

  const now = new Date();
  // The lazy retention step on every oversight read (section 8.7 item 1).
  await purgeNotesLazily(db, now);
  const notes = await db.notesForOversight(learnerId, { before, limit: SENT_LIST_PAGE, now });

  // What delivery would do now (section 6.8 rules 2, 4, 5, 6), for `not_shown`.
  const spaces = new Map((await db.getSpaces(notes.map((n) => n.spaceId))).map((s) => [s.id, s]));
  const studentOf = new Set((await db.membershipsOf('learner', learnerId)).filter((m) => m.role === 'student').map((m) => m.spaceId));
  const mode = (await db.getNotePrefs(learnerId))?.classes ?? 'all';
  const blocked = new Set((await db.listBlocks(learnerId)).map((b) => b.senderAccountId));
  const roles = new Map<string, Map<string, string>>();
  for (const spaceId of spaces.keys()) roles.set(spaceId, new Map((await db.membersOf(spaceId)).filter((m) => m.memberKind === 'account').map((m) => [m.memberId, m.role])));
  // One grant read per family caregiver who sent, whatever the number of their notes on the page.
  const granted = new Set<string>();
  const checked = new Set<string>();
  for (const n of notes) {
    const key = `${n.spaceId}\n${n.senderAccountId}`;
    if (checked.has(key) || spaces.get(n.spaceId)?.kind !== 'family' || roles.get(n.spaceId)?.get(n.senderAccountId) !== 'caregiver') continue;
    checked.add(key);
    if (await db.getSendGrant(n.spaceId, n.senderAccountId)) granted.add(key);
  }
  const maySend = (n: StoredNote): boolean => {
    const role = roles.get(n.spaceId)?.get(n.senderAccountId);
    const kind = spaces.get(n.spaceId)?.kind;
    if (kind === 'class') return n.senderRole === 'teacher' && (role === 'teacher' || role === 'owner');
    if (kind === 'family') return n.senderRole === 'family' && (role === 'owner' || (role === 'caregiver' && granted.has(`${n.spaceId}\n${n.senderAccountId}`)));
    return false;
  };
  const delivered = (n: StoredNote): boolean => {
    const space = spaces.get(n.spaceId);
    if (!space || space.archivedAt !== null || !studentOf.has(n.spaceId)) return false;
    if (n.senderRole !== 'family' && mode === 'off') return false;
    return !blocked.has(n.senderAccountId) && maySend(n);
  };

  // Who acted: the first report, the hiding account. Only family accounts are ever named (section 8.2-a).
  const reports = await db.reportsForNotes(notes.filter((n) => n.status === 'reported').map((n) => n.id));
  const firstReport = new Map<string, (typeof reports)[number]>();
  const onDevice = new Set<string>();
  for (const r of reports) {
    if (!firstReport.has(r.noteId)) firstReport.set(r.noteId, r);
    if (r.via === 'device') onDevice.add(r.noteId);
  }
  const names = await accountNames(db, [
    ...notes.filter((n) => n.senderRole === 'family').map((n) => n.senderAccountId),
    ...notes.flatMap((n) => (n.status === 'hidden' && n.hiddenVia === 'family' && n.actedByAccountId ? [n.actedByAccountId] : [])),
    ...[...firstReport.values()].flatMap((r) => (r.via === 'family' ? [r.evidence] : [])),
  ]);

  const rows = notes.map((n) => {
    const space = spaces.get(n.spaceId);
    const mine = n.senderAccountId === account.id;
    const status = oversightStatus(n, { delivered: delivered(n), viewerIsSender: mine, reportedOnDevice: onDevice.has(n.id) });
    const first = firstReport.get(n.id);
    return {
      id: n.id,
      spaceId: n.spaceId,
      spaceKind: space?.kind ?? 'class',
      spaceName: space?.name ?? '',
      from: { role: n.senderRole, label: n.senderRole === 'family' ? (n.senderLabel ?? 'family') : null },
      senderName: n.senderRole === 'family' ? (names.get(n.senderAccountId) ?? '') : null,
      mine,
      presetId: n.presetId,
      text: n.body,
      suggest: n.suggest,
      createdAt: n.createdAt,
      status,
      reaction: n.reaction,
      hiddenBy: status === 'hidden' ? (n.hiddenVia === 'device' ? DEVICE_ACTOR : (names.get(n.actedByAccountId ?? '') ?? '')) : null,
      reportedBy: status === 'reported' && first ? (first.via === 'device' ? DEVICE_ACTOR : (names.get(first.evidence) ?? '')) : null,
    };
  });
  const last = notes[notes.length - 1];
  return ok(c, { rows, next: notes.length === SENT_LIST_PAGE && last ? encodeNoteCursor(last) : null });
});

notesRoutes.post('/:familyId/learners/:learnerId/notes/:noteId/hide', async (c) => {
  const db = dbFor(c);
  const learnerId = c.req.param('learnerId');
  const who = await overseer(c, db, c.req.param('familyId'), learnerId);
  if (who instanceof Response) return who;
  const now = new Date();
  const note = await noteOfLearner(db, learnerId, c.req.param('noteId'), now);
  if (!note) return notFound(c);
  // A hide is not a report and counts toward no hold (decision D8); hiding a hidden note is done already.
  if (note.status === 'hidden') return ok(c, { hidden: true });
  if (note.status !== 'live' || (await db.hideNote(note.id, 'family', now, who.account.id)) === 0) return fail(c, 'not_live', 'This note is not shown', 409);
  return ok(c, { hidden: true });
});

notesRoutes.post('/:familyId/learners/:learnerId/notes/:noteId/report', async (c) => {
  const db = dbFor(c);
  const learnerId = c.req.param('learnerId');
  const who = await overseer(c, db, c.req.param('familyId'), learnerId);
  if (who instanceof Response) return who;
  const { account, space } = who;
  const parsed = NoteAccountReportSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return fail(c, 'bad_request', 'Invalid report body', 422, { issues: parsed.error.issues.map((i) => ({ path: i.path, code: i.code })) });
  const now = new Date();
  // Any note to the learner, a family note and a taken-back note included (section 8.3 item 3).
  const note = await noteOfLearner(db, learnerId, c.req.param('noteId'), now);
  if (!note) return notFound(c);
  if (note.senderAccountId === account.id) return fail(c, 'own_note', 'Take back your own note instead', 422);
  const counterKey = noteRateKey.reportAccount(account.id);
  if ((await db.countRateHits(counterKey, new Date(now.getTime() - NOTE_LIMIT_WINDOW_MS))) >= NOTE_LIMIT_FAMILY_REPORTS_PER_ACCOUNT_PER_DAY) {
    return fail(c, 'too_many', 'Too many reports today, try again tomorrow', 429, { scope: 'account', retryAfter: NOTE_LIMIT_WINDOW_MS / 1000 });
  }
  const report = {
    id: `notereport:${crypto.randomUUID()}`,
    noteId: note.id,
    learnerId,
    senderAccountId: note.senderAccountId,
    reason: parsed.data.reason,
    via: 'family' as const,
    evidence: account.id,
    reporterKey: `family:${space.id}`,
    attest: null,
    createdAt: now.toISOString(),
    reviewedAt: null,
    outcome: null,
  };
  if (!(await db.insertNoteReport(report))) return notFound(c);
  await db.addRateHits([{ key: counterKey, at: report.createdAt }]);
  await holdAfterReport(db, report, now);
  return ok(c, { reported: true }, 201);
});

/** A blocked sender as the family's settings list names it: a teacher by the class it teaches the learner in, a family adult by its account. */
async function blockLabel(db: Db, learnerId: string, familyId: string, senderAccountId: string): Promise<{ role: 'teacher' | 'family'; name: string }> {
  const senderSpaces = await db.membershipsOf('account', senderAccountId);
  if (senderSpaces.some((m) => m.spaceId === familyId)) return { role: 'family', name: accountLabel(await db.getAccount(senderAccountId)) };
  const learnerSpaces = new Set((await db.membershipsOf('learner', learnerId)).map((m) => m.spaceId));
  const shared = senderSpaces.filter((m) => learnerSpaces.has(m.spaceId) && (m.role === 'teacher' || m.role === 'owner')).map((m) => m.spaceId);
  const classSpace = (await db.getSpaces(shared)).find((s) => s.kind === 'class');
  return { role: 'teacher', name: classSpace?.name ?? '' };
}

notesRoutes.get('/:familyId/learners/:learnerId/blocks', async (c) => {
  const db = dbFor(c);
  const learnerId = c.req.param('learnerId');
  const who = await overseer(c, db, c.req.param('familyId'), learnerId);
  if (who instanceof Response) return who;
  const blocks = [];
  for (const b of await db.listBlocks(learnerId)) {
    const { role, name } = await blockLabel(db, learnerId, who.space.id, b.senderAccountId);
    // `label` is the section 7.2 line; `role` and `name` let the console word it in the viewer's UI language.
    blocks.push({ senderRef: await senderRefFor(who.space.id, b.senderAccountId), label: role === 'teacher' ? `Your teacher · ${name}` : name, role, name, createdAt: b.createdAt });
  }
  return ok(c, { blocks });
});

notesRoutes.post('/:familyId/learners/:learnerId/blocks', async (c) => {
  const db = dbFor(c);
  const learnerId = c.req.param('learnerId');
  const who = await overseer(c, db, c.req.param('familyId'), learnerId);
  if (who instanceof Response) return who;
  const raw = (await c.req.json().catch(() => null)) as unknown;
  const noteId = typeof raw === 'object' && raw !== null && !Array.isArray(raw) && Object.keys(raw).every((k) => k === 'noteId') ? (raw as { noteId?: unknown }).noteId : undefined;
  if (!NoteIdSchema.safeParse(noteId).success) return fail(c, 'bad_request', 'Invalid block body', 422);
  const now = new Date();
  // The block names the sender of that note; the account id never travels to the console (section 8.5).
  const note = await noteOfLearner(db, learnerId, String(noteId), now);
  if (!note) return notFound(c);
  if (note.senderAccountId === who.account.id) return fail(c, 'own_note', 'You cannot stop your own notes', 422);
  await db.putBlock({ learnerId, senderAccountId: note.senderAccountId, familySpaceId: who.space.id, createdByAccount: who.account.id, createdAt: now.toISOString() });
  return ok(c, { senderRef: await senderRefFor(who.space.id, note.senderAccountId) }, 201);
});

notesRoutes.delete('/:familyId/learners/:learnerId/blocks/:senderRef', async (c) => {
  const db = dbFor(c);
  const learnerId = c.req.param('learnerId');
  const who = await overseer(c, db, c.req.param('familyId'), learnerId);
  if (who instanceof Response) return who;
  const ref = c.req.param('senderRef');
  for (const b of await db.listBlocks(learnerId)) {
    if ((await senderRefFor(who.space.id, b.senderAccountId)) === ref) {
      await db.deleteBlock(learnerId, b.senderAccountId);
      return ok(c, { removed: true });
    }
  }
  return notFound(c);
});

/** The class-notes setting as the family reads it: who changed it last is an account name, `"device"`, or null when never changed. */
async function familyPrefsView(db: Db, learnerId: string): Promise<{ classes: NotesMode; acknowledged: boolean; updatedBy: string | null }> {
  const prefs = await db.getNotePrefs(learnerId);
  const view = notePrefsView(prefs);
  const updatedBy = !prefs ? null : prefs.updatedVia === 'device' ? DEVICE_ACTOR : accountLabel(prefs.updatedByAccount ? await db.getAccount(prefs.updatedByAccount) : null);
  return { classes: view.classes ?? 'all', acknowledged: view.acknowledged, updatedBy };
}

notesRoutes.get('/:familyId/learners/:learnerId/note-prefs', async (c) => {
  const db = dbFor(c);
  const learnerId = c.req.param('learnerId');
  const who = await overseer(c, db, c.req.param('familyId'), learnerId);
  if (who instanceof Response) return who;
  return ok(c, await familyPrefsView(db, learnerId));
});

notesRoutes.put('/:familyId/learners/:learnerId/note-prefs', async (c) => {
  const db = dbFor(c);
  const learnerId = c.req.param('learnerId');
  const who = await overseer(c, db, c.req.param('familyId'), learnerId);
  if (who instanceof Response) return who;
  const parsed = NotePrefsPutSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return fail(c, 'bad_request', 'Invalid note prefs body', 422, { issues: parsed.error.issues.map((i) => ({ path: i.path, code: i.code })) });
  const at = new Date().toISOString();
  // `acknowledge: true` answers the one-time class-notes card on every device and in the console; never cleared.
  await db.putNotePrefs({ learnerId, classes: parsed.data.classes, acknowledgedAt: parsed.data.acknowledge ? at : null, updatedAt: at, updatedVia: 'family', updatedByAccount: who.account.id });
  return ok(c, await familyPrefsView(db, learnerId));
});

/** The family owner (`space.manage`) of a family space; 404 for any other space, 403 for anyone else. */
async function familyOwner(c: Ctx, db: Db, familyId: string): Promise<Response | { account: Account; space: Space }> {
  const account = await requireAccount(c);
  if (!('id' in account)) return account;
  const space = await db.getSpace(familyId);
  if (!space || space.kind !== 'family') return notFound(c);
  const actor: AccountActor = { kind: 'account', accountId: account.id, memberships: await db.membershipsOf('account', account.id) };
  if (!allowedOnSpace(actor, { space, parent: null }).has('space.manage')) return fail(c, 'not_allowed', 'Only the family owner can change who sends notes', 403);
  return { account, space };
}

notesRoutes.get('/:familyId/note-senders', async (c) => {
  const db = dbFor(c);
  const who = await familyOwner(c, db, c.req.param('familyId'));
  if (who instanceof Response) return who;
  const adults = (await db.membersOf(who.space.id)).filter((m) => m.memberKind === 'account');
  adults.sort((a, b) => (a.role === 'owner' ? -1 : b.role === 'owner' ? 1 : a.joinedAt.localeCompare(b.joinedAt) || a.memberId.localeCompare(b.memberId)));
  const senders = [];
  for (const m of adults) {
    const isOwner = m.role === 'owner';
    senders.push({ accountId: m.memberId, name: accountLabel(await db.getAccount(m.memberId)), isOwner, canSend: isOwner || (await db.getSendGrant(who.space.id, m.memberId)) !== null });
  }
  return ok(c, { senders });
});

notesRoutes.put('/:familyId/note-senders/:accountId', async (c) => {
  const db = dbFor(c);
  const who = await familyOwner(c, db, c.req.param('familyId'));
  if (who instanceof Response) return who;
  const raw = (await c.req.json().catch(() => null)) as unknown;
  const valid = typeof raw === 'object' && raw !== null && !Array.isArray(raw) && Object.keys(raw).length === 1 && typeof (raw as { canSend?: unknown }).canSend === 'boolean';
  if (!valid) return fail(c, 'bad_request', 'Invalid body', 422);
  const canSend = (raw as { canSend: boolean }).canSend;
  const target = await db.membership(who.space.id, 'account', c.req.param('accountId'));
  if (!target) return notFound(c);
  if (target.role === 'owner') return canSend ? ok(c, { canSend: true }) : fail(c, 'owner', 'The family owner can always send notes', 409);
  if (canSend) await db.putSendGrant({ spaceId: who.space.id, accountId: target.memberId, grantedBy: who.account.id, grantedAt: new Date().toISOString() });
  else await db.deleteSendGrant(who.space.id, target.memberId);
  return ok(c, { canSend });
});

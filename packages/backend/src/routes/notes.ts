import { CATALOG, NOTE_LEARNER_ID_MAX, NOTE_PRESET_AUDIENCE, NOTE_PRESETS_NEED_SUGGEST, NOTE_SEND_MAX_LEARNERS, NoteSendSchema, type NotesMode, type Space } from '@hangul-route/content-schema';
import { checkNoteText } from '@hangul-route/i18n/note-text';
import { Hono, type Context } from 'hono';
import { dbFor, noteRateKey, noteRetentionCuts, type Db, type NewNote, type NoteCursor, type SpaceNoteListRow, type StoredNote } from '../db';
import { fail, ok } from '../envelope';
import { requireAccount } from '../lib/access';
import { allowedOnSpace, can, type AccountActor } from '../lib/can';
import { accountOverLimit, learnersOverLimit, NOTE_LIMIT_SENDS_PER_MINUTE, NOTE_LIMIT_WINDOW_MS, sendCounterHits, sendCounterKeys } from '../lib/note-limits';
import { batchStatus, encodeNoteCursor, parseNoteCursor, sentNoteReaction, sentNoteStatus, type SentNoteFacts } from '../lib/note-views';
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
async function sender(c: Ctx, db: Db, spaceId: string, options: { allowArchived?: boolean } = {}): Promise<Response | { account: Account; space: Space }> {
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
  if (space.archivedAt && options.allowArchived !== true) return fail(c, 'space_archived', 'This space is archived', 409);
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
  await purgeNotesLazily(db, now);

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
  const roles = new Map((await db.membersOf(space.id)).filter((m) => m.memberKind === 'account').map((m) => [m.memberId, m.role]));
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
    if (batch) return { ...common, to: 'everyone' as const, size: batch.size, status: batchStatus(n, batch) };
    const f = facts(n);
    const status = sentNoteStatus(n, f);
    return { ...common, to: 'learner' as const, learnerId: n.learnerId, displayName: names.get(n.learnerId) ?? '', status, reaction: sentNoteReaction(n, status, f) };
  });
  const last = page[page.length - 1];
  return ok(c, { rows, next: page.length === SENT_LIST_PAGE && last ? encodeNoteCursor(last.note) : null });
});

notesRoutes.post('/:id/notes/:noteId/withdraw', async (c) => {
  const db = dbFor(c);
  // Taking a note back only lowers exposure, so an archived space allows it.
  const who = await sender(c, db, c.req.param('id'), { allowArchived: true });
  if (who instanceof Response) return who;
  const { account, space } = who;
  const body = withdrawBody(await c.req.json().catch(() => ({})));
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

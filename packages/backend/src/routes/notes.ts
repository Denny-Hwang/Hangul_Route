import { CATALOG, NOTE_PRESET_AUDIENCE, NOTE_PRESETS_NEED_SUGGEST, NOTE_SEND_MAX_LEARNERS, NoteSendSchema, type NotesMode, type Space } from '@hangul-route/content-schema';
import { checkNoteText } from '@hangul-route/i18n/note-text';
import { Hono, type Context } from 'hono';
import { dbFor, noteRateKey, type Db, type NewNote } from '../db';
import { fail, ok } from '../envelope';
import { requireAccount } from '../lib/access';
import { can, type AccountActor } from '../lib/can';
import { accountOverLimit, learnersOverLimit, NOTE_LIMIT_SENDS_PER_MINUTE, NOTE_LIMIT_WINDOW_MS, sendCounterHits, sendCounterKeys } from '../lib/note-limits';
import { notesSendEnabled, type NotesEnv } from '../lib/notes-switch';
import { createRateLimiter } from '../lib/rate-limit';
import type { Account } from '../store';
import { rosterName } from './spaces';

/**
 * Notes from grown-ups, the account routes — F-FEEDBACK-001 section 7.2 (PR
 * FB-3a): the composer's recipient list and the send. Mounted at /api/spaces.
 *
 * Both routes sit behind the Worker switch `NOTES_SEND` (section 7.8): while it
 * is off they answer 404 before reading a header, a body or the database. A
 * send is set-based (section 7.4): its statement count does not grow with the
 * number of learners. A family's notes mode and blocks are applied here and
 * again at delivery (section 6.8); a block always reads like `off`, so it is
 * never revealed to the sender. Note text is never logged or echoed in an error.
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

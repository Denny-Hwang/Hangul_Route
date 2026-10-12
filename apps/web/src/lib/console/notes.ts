import {
  CATALOG,
  NOTE_PRESET_AUDIENCE,
  NOTE_PRESET_IDS,
  NOTE_PRESETS_NEED_SUGGEST,
  NOTE_REACTION_IDS,
  NoteSendSchema,
  freeRouteQuestIds,
  gridLessonIds,
  type Catalog,
  type FamilyLabelId,
  type NoteAccountReport,
  type NotePresetId,
  type NotePrefsPut,
  type NoteSend,
  type NoteSuggest,
  type NotesMode,
  type SpaceKind,
} from '@hangul-route/content-schema';
import { DEFAULT_LOCALE, formatDate, getMessages, type UiLocale } from '@hangul-route/i18n';
import { NOTE_TEXT_MAX, checkNoteText, normalizeNoteText, type NoteTextProblem, type NoteTextResult } from '@hangul-route/i18n/note-text';
import type { ConsoleApiOptions } from './api';
import type { SpaceCoverage } from './curriculum';

/**
 * Notes from grown-ups in the console (F-FEEDBACK-001 FB-10, sections 6.13, 7.2, 8.2 and 9;
 * wireframes console/note-composer.md, console/notes-sent.md, console/family-notes.md): the API
 * client of the account routes, and the pure view models the notes pages (FB-11a, FB-12) render.
 * Every word comes from `console.notes` / `common.notes` in the console locale. Nothing here sorts
 * or filters by status, opens or answers (section 9), and a class sender never reads "Opened".
 */

// ---------------------------------------------------------------------------------------------
// Transport (section 7.2)

/** A learner the composer can pick: the name follows the roster's anonymize setting. */
export interface NoteRecipient {
  id: string;
  displayName: string;
  /** `off` also when this sender is stopped for the learner: the two look the same (section 6.1 item 4). */
  notes: NotesMode;
  /** Notes this account sent the learner in the last 24 hours. */
  today: number;
}

export interface NoteSendResult {
  batchId: string;
  sent: number;
  skipped: Array<{ learnerId: string; reason: 'notes_off' | 'limit' }>;
  presetsOnly: string[];
}

/** Status of a sent note as the sending space sees it; `opened` only in a family space (OD-8). */
export type SentNoteStatus = 'sent' | 'opened' | 'not_shown' | 'withdrawn';

/**
 * One row of the sent list. A send to everyone is one row without counts of opens or answers;
 * `id` is one live note of that batch, which the take-back route names together with `batch: true`
 * (section 7.2). A row without it cannot be taken back from here.
 */
export type SentNoteRow =
  | {
      id?: string;
      batchId: string;
      to: 'everyone';
      size: number;
      presetId: string;
      text: string | null;
      suggest: NoteSuggest | null;
      label: FamilyLabelId | null;
      createdAt: string;
      status: 'sent' | 'withdrawn';
      mine: boolean;
    }
  | {
      id: string;
      batchId: string;
      to: 'learner';
      learnerId: string;
      displayName: string;
      presetId: string;
      text: string | null;
      suggest: NoteSuggest | null;
      label: FamilyLabelId | null;
      createdAt: string;
      status: SentNoteStatus;
      reaction: string | null;
      mine: boolean;
    };

export type OversightStatus = 'live' | 'opened' | 'hidden' | 'reported' | 'withdrawn' | 'not_shown';

/**
 * One note to a learner of the family, from any space (family oversight, section 7.2). `senderName`
 * is the sending account's name or email for a family note and null for a class note (section
 * 8.2-a). `hiddenBy` / `reportedBy` name the acting account, or read `"device"` for a device action.
 */
export interface OversightNote {
  id: string;
  spaceId: string;
  spaceKind: SpaceKind;
  spaceName: string;
  from: { role: 'teacher' | 'family'; label: FamilyLabelId | null };
  senderName: string | null;
  mine: boolean;
  presetId: string;
  text: string | null;
  suggest: NoteSuggest | null;
  createdAt: string;
  status: OversightStatus;
  reaction: string | null;
  hiddenBy: string | null;
  reportedBy: string | null;
}

export interface NoteBlock {
  /** Opaque per family; never the account id. */
  senderRef: string;
  label: string;
  createdAt: string;
}

export interface FamilyNotePrefs {
  classes: NotesMode;
  acknowledged: boolean;
  /** The account that changed it last, `"device"`, or null when never changed. */
  updatedBy: string | null;
}

export interface NoteSender {
  accountId: string;
  name: string;
  isOwner: boolean;
  canSend: boolean;
}

export interface NotesFailure {
  /** HTTP status; -1 when the request never reached the Worker. */
  status: number;
  code: string | null;
  details: Record<string, unknown> | null;
}

export type NotesResult<T> = { ok: true; data: T } | { ok: false; failure: NotesFailure };

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

/** The account note routes on `/api/spaces`, with the console session's bearer. Typed results, never throws. */
export function createNotesApi(opts: ConsoleApiOptions) {
  const fetchImpl = opts.fetchImpl ?? globalThis.fetch;
  const base = `${opts.endpoint}/api/spaces`;
  const resolveToken = async (): Promise<string | null> => (typeof opts.token === 'string' ? opts.token : opts.token().catch(() => null));

  async function call<T>(url: string, init: RequestInit, okStatus: readonly number[]): Promise<NotesResult<T>> {
    try {
      const token = await resolveToken();
      if (!token) return { ok: false, failure: { status: 401, code: null, details: null } };
      const res = await fetchImpl(url, { ...init, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` } });
      const body: unknown = await res.json().catch(() => ({}));
      const record = isRecord(body) ? body : {};
      if (okStatus.includes(res.status) && record.data !== undefined) return { ok: true, data: record.data as T };
      const error = isRecord(record.error) ? record.error : {};
      return {
        ok: false,
        failure: { status: res.status, code: typeof error.code === 'string' ? error.code : null, details: isRecord(error.details) ? error.details : null },
      };
    } catch {
      return { ok: false, failure: { status: -1, code: null, details: null } };
    }
  }

  const space = (id: string): string => `${base}/${encodeURIComponent(id)}`;
  const learner = (familyId: string, learnerId: string): string => `${space(familyId)}/learners/${encodeURIComponent(learnerId)}`;
  const query = (params: Record<string, string | undefined>): string => {
    const entries = Object.entries(params).filter((e): e is [string, string] => e[1] !== undefined && e[1] !== '');
    return entries.length === 0 ? '' : `?${entries.map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&')}`;
  };
  const map = <A, B>(r: NotesResult<A>, f: (a: A) => B): NotesResult<B> => (r.ok ? { ok: true, data: f(r.data) } : r);

  return {
    recipients: async (spaceId: string) =>
      map(await call<{ learners: NoteRecipient[] }>(`${space(spaceId)}/notes/recipients`, { method: 'GET' }, [200]), (d) => d.learners),
    send: (spaceId: string, body: NoteSend) => call<NoteSendResult>(`${space(spaceId)}/notes`, { method: 'POST', body: JSON.stringify(body) }, [201]),
    sent: (spaceId: string, opts: { before?: string; learner?: string } = {}) =>
      call<{ rows: SentNoteRow[]; next: string | null }>(`${space(spaceId)}/notes${query({ before: opts.before, learner: opts.learner })}`, { method: 'GET' }, [200]),
    withdraw: (spaceId: string, noteId: string, batch = false) =>
      call<{ withdrawn: number }>(`${space(spaceId)}/notes/${encodeURIComponent(noteId)}/withdraw`, { method: 'POST', body: JSON.stringify(batch ? { batch: true } : {}) }, [200]),
    oversight: (familyId: string, learnerId: string, before?: string) =>
      call<{ rows: OversightNote[]; next: string | null }>(`${learner(familyId, learnerId)}/notes${query({ before })}`, { method: 'GET' }, [200]),
    hide: (familyId: string, learnerId: string, noteId: string) =>
      call<Record<string, unknown>>(`${learner(familyId, learnerId)}/notes/${encodeURIComponent(noteId)}/hide`, { method: 'POST' }, [200]),
    report: (familyId: string, learnerId: string, noteId: string, body: NoteAccountReport) =>
      call<Record<string, unknown>>(`${learner(familyId, learnerId)}/notes/${encodeURIComponent(noteId)}/report`, { method: 'POST', body: JSON.stringify(body) }, [201]),
    block: (familyId: string, learnerId: string, noteId: string) =>
      call<Record<string, unknown>>(`${learner(familyId, learnerId)}/blocks`, { method: 'POST', body: JSON.stringify({ noteId }) }, [201]),
    unblock: (familyId: string, learnerId: string, senderRef: string) =>
      call<Record<string, unknown>>(`${learner(familyId, learnerId)}/blocks/${encodeURIComponent(senderRef)}`, { method: 'DELETE' }, [200]),
    blocks: async (familyId: string, learnerId: string) =>
      map(await call<{ blocks: NoteBlock[] }>(`${learner(familyId, learnerId)}/blocks`, { method: 'GET' }, [200]), (d) => d.blocks),
    prefs: (familyId: string, learnerId: string) => call<FamilyNotePrefs>(`${learner(familyId, learnerId)}/note-prefs`, { method: 'GET' }, [200]),
    putPrefs: (familyId: string, learnerId: string, body: NotePrefsPut) =>
      call<FamilyNotePrefs>(`${learner(familyId, learnerId)}/note-prefs`, { method: 'PUT', body: JSON.stringify(body) }, [200]),
    noteSenders: async (familyId: string) => map(await call<{ senders: NoteSender[] }>(`${space(familyId)}/note-senders`, { method: 'GET' }, [200]), (d) => d.senders),
    setNoteSender: (familyId: string, accountId: string, canSend: boolean) =>
      call<Record<string, unknown>>(`${space(familyId)}/note-senders/${encodeURIComponent(accountId)}`, { method: 'PUT', body: JSON.stringify({ canSend }) }, [200]),
  };
}

export type NotesApi = ReturnType<typeof createNotesApi>;

// ---------------------------------------------------------------------------------------------
// Words shared by the views

const PRESETS: ReadonlySet<string> = new Set(NOTE_PRESET_IDS);
const REACTIONS: ReadonlySet<string> = new Set(NOTE_REACTION_IDS);

/** Notes this account may send one learner per day (section 7.3, OD-14); the Worker is the authority. */
export const NOTE_PAIR_DAILY_LIMIT = 3;

/** The sender's side of a space: a family signs with a label, any other space as "Your teacher". */
type Side = 'family' | 'class';
const sideOf = (kind: SpaceKind): Side => (kind === 'family' ? 'family' : 'class');

function presetLine(presetId: string, locale: UiLocale): string {
  const notes = getMessages(locale).common.notes;
  return PRESETS.has(presetId) ? notes.presets[presetId as NotePresetId] : notes.presetFallback;
}

function reactionLine(reaction: string | null, locale: UiLocale): string | null {
  return reaction !== null && REACTIONS.has(reaction) ? getMessages(locale).common.notes.reactions[reaction as (typeof NOTE_REACTION_IDS)[number]] : null;
}

function labelLine(label: FamilyLabelId | null | undefined, locale: UiLocale): string {
  const labels = getMessages(locale).common.notes.familyLabels;
  // A label id this build does not know (a newer Worker) signs "Your family", never "undefined".
  return label !== null && label !== undefined && Object.prototype.hasOwnProperty.call(labels, label) ? labels[label] : labels.family;
}

function questTitle(questId: string | null | undefined, catalog: Catalog): string | null {
  if (!questId) return null;
  return catalog.quests.find((q) => q.id === questId)?.title ?? null;
}

// ---------------------------------------------------------------------------------------------
// Composer (wireframe console/note-composer.md)

export interface PresetChoice {
  id: NotePresetId;
  text: string;
  /** "Try this quest next" keeps Send off until a quest is picked. */
  needsQuest: boolean;
}

export interface PresetGroup {
  id: 'effort' | 'progress' | 'next' | 'warm';
  title: string;
  presets: PresetChoice[];
}

const GROUPS: readonly PresetGroup['id'][] = ['effort', 'progress', 'next', 'warm'];
const allowedFor = (id: NotePresetId, role: 'teacher' | 'family'): boolean => NOTE_PRESET_AUDIENCE[id] === 'all' || NOTE_PRESET_AUDIENCE[id] === role;

/** The presets a sender may pick, in the four groups and in catalogue order; never ordered by a learner's progress (section 9). */
export function presetGroups(role: 'teacher' | 'family', locale: UiLocale = DEFAULT_LOCALE): PresetGroup[] {
  const m = getMessages(locale);
  return GROUPS.map((group) => ({
    id: group,
    title: m.console.notes.composer.groups[group],
    presets: NOTE_PRESET_IDS.filter((id) => id.startsWith(`${group}_`) && allowedFor(id, role)).map((id) => ({
      id,
      text: m.common.notes.presets[id],
      needsQuest: NOTE_PRESETS_NEED_SUGGEST.has(id),
    })),
  }));
}

export type ComposerText = { ok: true; text: string | null } | { ok: false; problem: NoteTextProblem; message: string };

/** The friendly line for a text-guard problem; link and tone quote the token as typed. */
export function noteTextMessage(problem: NoteTextProblem, word: string | undefined, locale: UiLocale = DEFAULT_LOCALE): string {
  const problems = getMessages(locale).console.notes.composer.problems;
  switch (problem) {
    case 'link':
      return problems.link(word ?? '');
    case 'tone':
      return problems.tone(word ?? '');
    case 'too_long':
      return problems.too_long(NOTE_TEXT_MAX);
    default:
      return problems[problem];
  }
}

/**
 * The composer's check of the optional words, the same guard the Worker runs (`checkNoteText`,
 * section 6.4): an empty box is no text; anything else must pass. `check` is a test seam.
 */
export function textProblem(raw: string, locale: UiLocale = DEFAULT_LOCALE, check: (raw: string) => NoteTextResult = checkNoteText): ComposerText {
  if (raw === '') return { ok: true, text: null };
  const result = check(raw);
  return result.ok ? { ok: true, text: result.text } : { ok: false, problem: result.problem, message: noteTextMessage(result.problem, result.word, locale) };
}

/** "37 of 120": code points of the normalised text, so Hangul and accents count as one each. */
export function textCounter(raw: string, locale: UiLocale = DEFAULT_LOCALE): { count: number; line: string } {
  const count = Array.from(normalizeNoteText(raw)).length;
  return { count, line: getMessages(locale).console.notes.composer.text.counter(count, NOTE_TEXT_MAX) };
}

const ANNOUNCE_AT: readonly number[] = [100, NOTE_TEXT_MAX];

/** The polite announcement when the count reaches 100 or the limit (section 6.12); null otherwise. */
export function counterAnnouncement(previous: number, count: number, locale: UiLocale = DEFAULT_LOCALE): string | null {
  return ANNOUNCE_AT.some((at) => previous < at && count >= at) ? getMessages(locale).console.notes.composer.text.counterA11y(count, NOTE_TEXT_MAX) : null;
}

/**
 * The quest picker's closed-quest marks (section 6.2, wireframe console/note-composer.md step 4):
 * the grid lessons past the free route (F-ENT-003 E3-1a `freeRouteQuestIds`), only while the
 * console's free-plan switch is on (E3-9 `contentGatingEnabled()`) and this viewer knows no plan
 * covers the space (`spaceCoverage` is "uncovered"; "unknown" never claims a limit). Stories are
 * never marked: their access is not the route's. The learner's device stays the authority.
 */
export function closedQuestIds(opts: { gating: boolean; coverage: SpaceCoverage }, catalog: Catalog = CATALOG): ReadonlySet<string> {
  if (!opts.gating || opts.coverage !== 'uncovered') return new Set();
  const free = freeRouteQuestIds(catalog);
  return new Set([...gridLessonIds(catalog)].filter((id) => !free.has(id)));
}

/** The line under a picked quest: "Some learners can open this lesson only with the full route." or null. Never a price or a link. */
export function questClosedLine(questId: string, opts: { gating: boolean; coverage: SpaceCoverage }, locale: UiLocale = DEFAULT_LOCALE, catalog: Catalog = CATALOG): string | null {
  return closedQuestIds(opts, catalog).has(questId) ? getMessages(locale).console.notes.composer.closedMark : null;
}

export interface RecipientRow {
  id: string;
  name: string;
  /** False when notes are off (or this sender is stopped) or today's limit is reached. */
  selectable: boolean;
  line: string | null;
  /** The learner gets the encouragement without the words (class notes in `presets` mode). */
  presetsOnly: boolean;
}

/** The learner picker, in the API order (never a ranking). */
export function recipientRows(learners: readonly NoteRecipient[], kind: SpaceKind, locale: UiLocale = DEFAULT_LOCALE): RecipientRow[] {
  const c = getMessages(locale).console.notes.composer;
  return learners.map((l) => {
    const base = { id: l.id, name: l.displayName };
    if (l.notes === 'off') return { ...base, selectable: false, line: c.notesOff[sideOf(kind)], presetsOnly: false };
    if (l.today >= NOTE_PAIR_DAILY_LIMIT) return { ...base, selectable: false, line: c.limit(l.today), presetsOnly: false };
    if (l.notes === 'presets') return { ...base, selectable: true, line: c.presetsOnlyShort, presetsOnly: true };
    return { ...base, selectable: true, line: null, presetsOnly: false };
  });
}

export interface ComposerInput {
  spaceKind: SpaceKind;
  to: { kind: 'everyone' } | { kind: 'learners'; ids: readonly string[] };
  presetId: NotePresetId | null;
  text: string;
  questId: string | null;
  /** Family spaces only; null signs "Your family". */
  label: FamilyLabelId | null;
}

export interface ComposerCheck {
  canSend: boolean;
  /** The preset needs a quest and none is picked ("Needed for this encouragement"). */
  questNeeded: boolean;
  textProblem: string | null;
  /** The picked list cannot be sent as it is (more than a send takes, or an id the form cannot send). */
  recipientsProblem: string | null;
  /** The `NoteSendSchema` body, or null while Send is off. */
  body: NoteSend | null;
}

/** Whether Send is on, and the strict body it sends (`textLocale` = the console locale). */
export function composerCheck(input: ComposerInput, locale: UiLocale = DEFAULT_LOCALE, catalog: Catalog = CATALOG): ComposerCheck {
  const side = sideOf(input.spaceKind);
  const text = textProblem(input.text, locale);
  const textError = text.ok ? null : text.message;
  const questNeeded = input.presetId !== null && NOTE_PRESETS_NEED_SUGGEST.has(input.presetId) && input.questId === null;
  const questOk = input.questId === null || questTitle(input.questId, catalog) !== null;
  const presetOk = input.presetId !== null && allowedFor(input.presetId, side === 'family' ? 'family' : 'teacher');
  const hasTarget = input.to.kind === 'everyone' || input.to.ids.length > 0;
  if (!text.ok || questNeeded || !questOk || !presetOk || !hasTarget || input.presetId === null) {
    return { canSend: false, questNeeded, textProblem: textError, recipientsProblem: null, body: null };
  }
  // A learner picked twice is sent once; the Worker refuses duplicates (`NoteSendSchema`).
  const ids = input.to.kind === 'learners' ? [...new Set(input.to.ids)] : [];
  const body: NoteSend = {
    to: input.to.kind === 'everyone' ? { kind: 'everyone' } : { kind: 'learners', ids },
    presetId: input.presetId,
    ...(text.text !== null ? { text: text.text, textLocale: locale } : {}),
    ...(input.questId !== null ? { suggest: { kind: 'quest' as const, id: input.questId } } : {}),
    ...(side === 'family' ? { label: input.label ?? 'family' } : {}),
  };
  const parsed = NoteSendSchema.safeParse(body);
  if (parsed.success) return { canSend: true, questNeeded: false, textProblem: null, recipientsProblem: null, body: parsed.data };
  // Text, preset, quest and label were checked above, so what is left is the learner list.
  return { canSend: false, questNeeded: false, textProblem: null, recipientsProblem: getMessages(locale).console.notes.composer.recipientsProblem, body: null };
}

export interface NotePreview {
  preset: string | null;
  text: string | null;
  from: string;
  quest: string | null;
}

/** What the learner reads, previewed in the console language (the learner reads the preset in theirs). */
export function notePreview(
  input: { spaceKind: SpaceKind; spaceName: string; presetId: NotePresetId | null; text: string; questId: string | null; label: FamilyLabelId | null },
  locale: UiLocale = DEFAULT_LOCALE,
  catalog: Catalog = CATALOG,
): NotePreview {
  const m = getMessages(locale);
  const sender = sideOf(input.spaceKind) === 'family' ? labelLine(input.label, locale) : m.common.notes.teacherLabel(input.spaceName);
  const words = normalizeNoteText(input.text);
  const title = questTitle(input.questId, catalog);
  return {
    preset: input.presetId === null ? null : m.common.notes.presets[input.presetId],
    text: words === '' ? null : words,
    from: m.console.notes.composer.preview.from(sender),
    quest: title === null ? null : m.console.notes.composer.preview.quest(title),
  };
}

/** The result line after Send: counts only, never names (wireframe B). */
export function sendResultLines(result: NoteSendResult, kind: SpaceKind, locale: UiLocale = DEFAULT_LOCALE): string[] {
  const r = getMessages(locale).console.notes.composer.result;
  const side = sideOf(kind);
  if (result.sent === 0) return [r.nothing[side]];
  const off = result.skipped.filter((s) => s.reason === 'notes_off').length;
  const limited = result.skipped.filter((s) => s.reason === 'limit').length;
  return [
    r.sent[side](result.sent),
    ...(off > 0 ? [r.notesOff[side](off)] : []),
    ...(result.presetsOnly.length > 0 ? [r.presetsOnly(result.presetsOnly.length)] : []),
    ...(limited > 0 ? [r.limit[side](limited)] : []),
  ];
}

const TEXT_PROBLEMS: ReadonlySet<string> = new Set<NoteTextProblem>(['empty', 'too_long', 'line_break', 'link', 'contact', 'emoji', 'tone', 'invalid']);

/** The words for a refused send or recipients read (section 7.2 errors); the form keeps its content. */
export function sendProblem(failure: NotesFailure, kind: SpaceKind, locale: UiLocale = DEFAULT_LOCALE): string {
  const e = getMessages(locale).console.notes.composer.errors;
  if (failure.status === -1) return e.network;
  if (failure.status === 404) return e.sendingOff;
  if (failure.code === 'sending_paused') return e.paused;
  if (failure.code === 'not_allowed') return sideOf(kind) === 'family' ? e.notAllowed : e.notAllowedClass;
  if (failure.code === 'space_archived') return e.archived[sideOf(kind)];
  if (failure.code === 'note_text') {
    const problem = failure.details?.problem;
    const word = failure.details?.word;
    return typeof problem === 'string' && TEXT_PROBLEMS.has(problem)
      ? noteTextMessage(problem as NoteTextProblem, typeof word === 'string' ? word : undefined, locale)
      : e.generic;
  }
  if (failure.code === 'bad_preset') return e.badPreset;
  if (failure.code === 'bad_suggest') return e.badSuggest;
  if (failure.code === 'not_in_space') return e.notInSpace;
  if (failure.status === 429) return isDailyLimit(failure) ? e.tooMany : e.wait;
  return e.generic;
}

/**
 * The daily limits answer `429 too_many { scope: 'account' | 'learner' }` (section 7.3); the
 * per-minute limiter (`lib/rate-limit.ts`, `too_many_attempts`) and any other 429 are short waits.
 */
function isDailyLimit(failure: NotesFailure): boolean {
  const scope = failure.details?.scope;
  return failure.code === 'too_many' && (scope === 'account' || scope === 'learner');
}

/** The words for a refused take back: a reported note can no longer be changed. */
export function withdrawProblem(failure: NotesFailure, locale: UiLocale = DEFAULT_LOCALE): string {
  const t = getMessages(locale).console.notes.sent.takeBack;
  return failure.code === 'note_reported' ? t.locked : t.failed;
}

/** The family actions that can be refused; only `report` has a daily limit of its own (section 7.3). */
export type FamilyAction = 'hide' | 'report' | 'block' | 'unblock' | 'prefs' | 'senders';

/** The words for a refused family action (hide, report, stop, allow again, a setting). */
export function familyActionProblem(failure: NotesFailure, action: FamilyAction, locale: UiLocale = DEFAULT_LOCALE): string {
  const f = getMessages(locale).console.notes.family;
  if (failure.status === 429) return action === 'report' && failure.code === 'too_many' ? f.report.tooMany : f.wait;
  if (failure.code === 'own_note') return f.report.ownNote;
  return f.saveFailed;
}

// ---------------------------------------------------------------------------------------------
// Lists (wireframes console/notes-sent.md, console/family-notes.md)

/** A status word for the sending space; a class sender never reads "Opened" (OD-8). */
export function statusText(status: SentNoteStatus, viewer: Side, locale: UiLocale = DEFAULT_LOCALE): string {
  const words = getMessages(locale).console.notes.status;
  return status === 'opened' && viewer === 'class' ? words.sent : words[status];
}

export interface SentRowView {
  /** The batch id for a send to everyone, the note id otherwise. */
  key: string;
  /** The note the take-back route names (with `batch: true` for a batch row); null when the row carries none. */
  noteId: string | null;
  batch: boolean;
  to: string;
  preset: string;
  text: string | null;
  quest: string | null;
  status: string;
  /** The learner's answer, as the Worker returns it (only while their mode is "All notes"). */
  reaction: string | null;
  signed: string | null;
  /** A note of another grown-up of this space: no Take back. */
  byOther: string | null;
  canTakeBack: boolean;
}

export function sentRowView(row: SentNoteRow, kind: SpaceKind, locale: UiLocale = DEFAULT_LOCALE, catalog: Catalog = CATALOG): SentRowView {
  const notes = getMessages(locale).console.notes;
  const side = sideOf(kind);
  const batch = row.to === 'everyone';
  const noteId = typeof row.id === 'string' && row.id !== '' ? row.id : null;
  return {
    key: batch ? row.batchId : row.id,
    noteId,
    batch,
    to: row.to === 'everyone' ? notes.sent.to.everyone[side](row.size) : notes.sent.to.learner(row.displayName),
    preset: presetLine(row.presetId, locale),
    text: row.text,
    quest: questTitle(row.suggest?.id, catalog),
    status: statusText(row.status, side, locale),
    reaction: row.to === 'learner' ? reactionLine(row.reaction, locale) : null,
    signed: side === 'family' && row.label !== null ? notes.sent.signed(labelLine(row.label, locale)) : null,
    byOther: row.mine ? null : notes.sent.otherAdult,
    canTakeBack: noteId !== null && row.mine && (row.status === 'sent' || row.status === 'opened'),
  };
}

export interface ReceivedRowView {
  id: string;
  /** "From class <name> (teacher)" or "From home · signed <label>": never a teacher's account (section 8.2-a). */
  from: string;
  /** The sending account of a family note (adult to adult inside the family), or "You sent this". */
  sentBy: string | null;
  preset: string;
  text: string | null;
  quest: string | null;
  status: string;
  reaction: string | null;
  canHide: boolean;
  canReport: boolean;
  canBlock: boolean;
}

const DEVICE = 'device';

/** One received note in the family view, with only the actions that still apply. */
export function receivedRowView(row: OversightNote, locale: UiLocale = DEFAULT_LOCALE, catalog: Catalog = CATALOG): ReceivedRowView {
  const m = getMessages(locale);
  const f = m.console.notes.family;
  // A row without a readable sender is read as a class note: it never names an account (section 8.2-a).
  const fromFamily = isRecord(row.from) && row.from.role === 'family';
  const from = fromFamily ? `${f.from.home} · ${f.from.signed(labelLine(row.from.label, locale))}` : f.from.class(row.spaceName);
  const sentBy = !fromFamily ? null : row.mine ? f.youSent : row.senderName ? f.sentBy(row.senderName) : null;
  const live = row.status === 'live' || row.status === 'opened';
  return {
    id: row.id,
    from,
    sentBy,
    preset: presetLine(row.presetId, locale),
    text: row.text,
    quest: questTitle(row.suggest?.id, catalog),
    status: receivedStatus(row, locale),
    reaction: reactionLine(row.reaction, locale),
    canHide: live,
    canReport: !row.mine && row.status !== 'reported',
    canBlock: !row.mine,
  };
}

function receivedStatus(row: OversightNote, locale: UiLocale): string {
  const notes = getMessages(locale).console.notes;
  const f = notes.family;
  switch (row.status) {
    case 'live':
      return notes.status.sent;
    case 'opened':
      return notes.status.opened;
    case 'hidden':
      return row.hiddenBy === null || row.hiddenBy === DEVICE ? f.hiddenOnDevice : f.hiddenBy(row.hiddenBy);
    case 'reported':
      return row.reportedBy === null || row.reportedBy === DEVICE ? f.reportedOnDevice : f.reportedBy(row.reportedBy);
    case 'withdrawn':
      return f.withdrawn;
    default:
      return notes.status.not_shown;
  }
}

const DAY_MS = 86_400_000;

/**
 * Rows grouped under "Today", "Yesterday" or a short date, in the order the API gives them (send
 * time, newest first). Nothing is sorted or filtered by status, opens or answers (section 9).
 */
export function groupByDay<T extends { createdAt: string }>(rows: readonly T[], now: Date, locale: UiLocale = DEFAULT_LOCALE): Array<{ day: string; rows: T[] }> {
  const words = getMessages(locale).common.notes.date;
  const startOf = (d: Date): number => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const dayOf = (iso: string): string => {
    const then = new Date(iso);
    if (Number.isNaN(then.getTime())) return '';
    const days = Math.round((startOf(now) - startOf(then)) / DAY_MS);
    if (days <= 0) return words.today;
    if (days === 1) return words.yesterday;
    return formatDate(locale, then, 'monthDay');
  };
  const groups: Array<{ day: string; rows: T[] }> = [];
  for (const row of rows) {
    const day = dayOf(row.createdAt);
    const last = groups[groups.length - 1];
    if (last !== undefined && last.day === day) last.rows.push(row);
    else groups.push({ day, rows: [row] });
  }
  return groups;
}

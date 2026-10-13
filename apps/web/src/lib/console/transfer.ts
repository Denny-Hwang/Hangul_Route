import type { TransferSlot } from '@hangul-route/content-schema';
import { DEFAULT_LOCALE, formatDate, getMessages, type UiLocale } from '@hangul-route/i18n';
import type { ApiResult, TransferDestinationView, TransferLearnerSideView, TransferSourceView, TransferView } from './api';
import { memberNounSingular } from './routing';

/**
 * Class-move helpers (F-SPACE-002 section 4.8, PR T-6a), pure, for the requests page (T-6b), the start sheet (T-6c)
 * and the family page (T-6d); states and words follow the T-0b mockups (`design/screens/transfer/`).
 * Anti-shame (CLAUDE.md section 1): no line names who said no or why (every ending is "This request ended."), the
 * destination never learns the source's answer (D3, D23), and only the source teacher's card carries days left.
 * Every string comes from `console.transfer` in `@hangul-route/i18n`, worded in the caller's locale.
 */

export const TRANSFER_REFRESH_MS = 30_000;

const DAY_MS = 24 * 60 * 60 * 1000;

const words = (locale: UiLocale) => getMessages(locale).console.transfer;

export function isOpenTransfer(view: Pick<TransferView, 'status'>): boolean {
  return view.status === 'requested' || view.status === 'approved';
}

/** The date a card shows ("Oct 14"), local time; null for a missing or unreadable date. */
function shortDate(iso: string | null, locale: UiLocale): string | null {
  if (!iso) return null;
  const text = formatDate(locale, iso, 'monthDay');
  return text === '' ? null : text;
}

/**
 * A step's name: a class page says Family / This class / New class; the family page names the two classes (D3).
 * The destination page draws no steps (it never learns the source's answer), so it is not a caller.
 */
export function slotLabel(slot: TransferSlot, view: TransferSourceView | TransferLearnerSideView, locale: UiLocale = DEFAULT_LOCALE): string {
  const steps = words(locale).steps;
  if (slot === 'learner') return steps.family;
  if (view.role === 'learner_side') return slot === 'source' ? view.from.name : view.to.name;
  return slot === 'source' ? steps.thisClass : steps.newClass;
}

function stepState(slot: TransferSlot, view: TransferSourceView | TransferLearnerSideView): 'yes' | 'waiting' {
  if (view.role === 'learner_side') {
    if (slot === 'learner') return view.learnerState === 'consented' ? 'yes' : 'waiting';
    return slot === 'source' ? view.sourceState : view.destinationState;
  }
  return view.steps?.[slot] ?? 'waiting';
}

/** A step's state word ("said yes", "waiting"); a class's own yes reads "you said yes". Never colour alone. */
export function stepWord(slot: TransferSlot, view: TransferSourceView | TransferLearnerSideView, locale: UiLocale = DEFAULT_LOCALE): string {
  const steps = words(locale).steps;
  if (stepState(slot, view) === 'waiting') return steps.waiting;
  return view.role === 'source' && slot === 'source' ? steps.youSaidYes : steps.saidYes;
}

/** The room block of an agreed move that waits (`approved` with a block reason); only the destination reads "full" (D6). */
export function blockedCopy(view: TransferView, locale: UiLocale = DEFAULT_LOCALE): string | null {
  if (view.status !== 'approved' || !view.blockReason) return null;
  const lines = words(locale).lines;
  if (view.role === 'destination') {
    if (view.blockReason === 'cap_class') return lines.fullClass;
    if (view.blockReason === 'cap_school') return lines.fullSchool;
    return lines.moveWaiting;
  }
  if (view.role === 'learner_side' && view.blockReason === 'cap_learner') return lines.learnerCap(view.learner.name);
  return lines.waitingRoom;
}

/** "Everyone agreed. The move happens on Oct 14." (classes) or "A move is planned for Oct 14." (family); null without a date. */
export function scheduledLine(view: TransferView, locale: UiLocale = DEFAULT_LOCALE): string | null {
  const lines = words(locale).lines;
  if (view.role === 'learner_side') {
    const date = shortDate(view.executeAfter, locale);
    return date === null ? null : lines.planned(date);
  }
  const date = shortDate(view.scheduledFor, locale);
  return date === null ? null : lines.scheduled(date);
}

function sourceLine(view: TransferSourceView, locale: UiLocale): string | null {
  const t = words(locale);
  if (view.status === 'executed') return t.history.movedOut(memberNounSingular('class', locale));
  if (view.status === 'approved') return blockedCopy(view, locale) ?? scheduledLine(view, locale);
  const name = view.learner?.name ?? '';
  if (view.steps?.source === 'waiting') return view.destination ? t.lines.familyAskedTo(name, view.destination.name) : t.lines.familyAsked(name);
  if (view.initiator === 'source' && view.steps?.learner === 'waiting') return t.lines.waitingFamily;
  return t.lines.waitingAll;
}

function destinationLine(view: TransferDestinationView, locale: UiLocale): string | null {
  const t = words(locale);
  if (view.status === 'executed') return t.history.joined(memberNounSingular('class', locale));
  if (view.status === 'approved') return blockedCopy(view, locale) ?? scheduledLine(view, locale);
  // After its own yes the line never says what it waits for: the source's answer, or a family yes that was reset (D23).
  return view.steps?.destination === 'yes' ? t.lines.youSaidYes : t.lines.familySaidYes;
}

function familyLine(view: TransferLearnerSideView, locale: UiLocale): string | null {
  const t = words(locale);
  if (view.status === 'executed') return t.lines.moved(view.learner.name, view.to.name);
  if (view.status === 'approved') return blockedCopy(view, locale) ?? scheduledLine(view, locale);
  if (view.learnerState !== 'consented') {
    // A teacher asked: the card's meta and steps say it. A learner-side request whose yes was reset: ask again.
    return view.initiator === 'source' ? null : t.lines.checkAgain;
  }
  const date = shortDate(view.executeAfter, locale) ?? '';
  const waiting = [view.sourceState, view.destinationState].filter((s) => s === 'waiting').length;
  return waiting >= 2 ? t.lines.waitingBoth(date) : t.lines.waitingOne(date);
}

/** The card's one line for this page's view of a request (wireframe screens 2 and 3), or null when the card needs none. */
export function statusLine(view: TransferView, _now: Date, locale: UiLocale = DEFAULT_LOCALE): string | null {
  if (view.status === 'ended') return words(locale).history.ended;
  if (view.role === 'source') return sourceLine(view, locale);
  if (view.role === 'destination') return destinationLine(view, locale);
  return familyLine(view, locale);
}

/**
 * Whether this page may cancel (spec 4.4 cancel row, D22): a source card only a request this class started, while it
 * is open; a guardian any open request on their learner; the destination never (it never starts one).
 */
export function canCancel(view: TransferView): boolean {
  if (!isOpenTransfer(view)) return false;
  if (view.role === 'source') return view.initiator === 'source';
  return view.role === 'learner_side';
}

/** Whether this page's own step still waits on an open request. */
function ownStepWaits(view: TransferView): boolean {
  if (view.status !== 'requested') return false;
  if (view.role === 'learner_side') return view.learnerState === 'pending';
  return view.steps?.[view.role] === 'waiting';
}

/** "N class moves waiting" on every entry point: the requests whose own step (this space's) is `waiting` (T-0b review, T-5d). */
export function pendingCount(views: readonly TransferView[]): number {
  return views.filter(ownStepWaits).length;
}

/** Whole days until `expiresAt`, rounded up, never below 0 (source teacher's meta only). */
export function daysLeft(expiresAt: string, now: Date): number {
  const ms = Date.parse(expiresAt) - now.getTime();
  return Number.isNaN(ms) ? 0 : Math.max(0, Math.ceil(ms / DAY_MS));
}

/** Whole days since `createdAt`, rounded down, never below 0 ("asked 2 days ago"). */
export function daysSince(createdAt: string, now: Date): number {
  const ms = now.getTime() - Date.parse(createdAt);
  return Number.isNaN(ms) ? 0 : Math.max(0, Math.floor(ms / DAY_MS));
}

// ---------------------------------------------------------------------------
// Start a move: the answers of preview / create (start-sheet.md, family-page.md). Kept as data and worded at render
// time, so a line follows the header's language select.

export type StartErrorKey =
  | 'codeNotFound'
  | 'codeExpired'
  | 'full'
  | 'alreadyMember'
  | 'tooManyAttempts'
  | 'cannotSend'
  | 'familyNeeded'
  | 'sameSpace'
  | 'alreadyOpen'
  | 'alreadyOpenClass'
  | 'alreadyOpenFamily'
  | 'destinationBusy'
  | 'tooManyRequests'
  | 'notTransferable'
  | 'cooldown'
  | 'manageOwn'
  | 'localeUnavailable'
  | 'familyTooNew'
  | 'conflicted'
  | 'offline'
  | 'failed';

/**
 * What a failed preview or create means for the sheet: one line under the code field; `refind` (the code now opens
 * another class, or the terms the guardian saw changed: run Find class again, nothing is sent); or a page state.
 */
export type StartError = { kind: 'line'; key: StartErrorKey } | { kind: 'refind' } | { kind: 'locked' } | { kind: 'signIn' } | { kind: 'forbidden' };

const LINE_CODES: Readonly<Record<string, StartErrorKey>> = {
  code_not_found: 'codeNotFound',
  invalid_code: 'codeNotFound',
  code_expired: 'codeExpired',
  cap_class: 'full',
  cap_school: 'full',
  cap_learner: 'full',
  already_member: 'alreadyMember',
  too_many_attempts: 'tooManyAttempts',
  cannot_send: 'cannotSend',
  family_needed: 'familyNeeded',
  same_space: 'sameSpace',
  destination_busy: 'destinationBusy',
  too_many_requests: 'tooManyRequests',
  not_transferable: 'notTransferable',
  cooldown: 'cooldown',
  learner_manages_own: 'manageOwn',
  consent_locale_unavailable: 'localeUnavailable',
  family_too_new: 'familyTooNew',
  conflicted_guardian: 'conflicted',
};

/**
 * Maps a preview / create answer. `side` is who starts the move: a teacher's `already_open` never says who started
 * the open one; the family's says which side did (`details.startedBy`, never a name).
 */
export function startError(result: ApiResult<unknown>, side: 'class' | 'family'): StartError | null {
  if (result.ok) return null;
  if (result.error === 'network') return { kind: 'line', key: 'offline' };
  if (result.status === 401) return { kind: 'signIn' };
  const code = result.code ?? '';
  if (code === 'transfers_locked') return { kind: 'locked' };
  if (code === 'destination_changed' || code === 'terms_changed') return { kind: 'refind' };
  if (code === 'not_found' || result.status === 403) return { kind: 'forbidden' };
  if (code === 'already_open') {
    if (side === 'class') return { kind: 'line', key: 'alreadyOpen' };
    return { kind: 'line', key: result.details?.startedBy === 'class' ? 'alreadyOpenClass' : 'alreadyOpenFamily' };
  }
  return { kind: 'line', key: LINE_CODES[code] ?? 'failed' };
}

/** The words of a start line; `name` is the learner's roster name. */
export function startErrorText(err: { kind: 'line'; key: StartErrorKey }, name: string, locale: UiLocale = DEFAULT_LOCALE): string {
  const t = words(locale);
  switch (err.key) {
    case 'alreadyMember':
    case 'sameSpace':
    case 'alreadyOpen':
    case 'alreadyOpenClass':
    case 'alreadyOpenFamily':
      return t.errors[err.key](name);
    case 'manageOwn':
      return t.lines.manageOwn(name);
    case 'familyTooNew':
    case 'conflicted':
    case 'offline':
    case 'failed':
      return t.states[err.key];
    default:
      return t.errors[err.key];
  }
}

import type { InboxTransfer } from '@hangul-route/content-schema';
import type { Messages } from '@hangul-route/i18n';
import { deviceAudience } from '../profiles/learner-type';
import { initiatorOf, isOpenRequest, learnerRouteOf, moveRule, openRequestOf, requestAction, type DeviceFacts, type RequestAction } from './consent-gate';

/**
 * What the Classes card, the Home line and the read-only sheet draw for a class move — F-SPACE-002
 * section 4.12, T-7b and T-7c (`design/screens/transfer/classes-card.md`, `app-sheets.md`). Pure: every
 * line comes from `caregiver.transfer`, and the route is decided from the inbox before any tap
 * (`consent-gate.ts`), so a PIN is never asked for a yes this device cannot give.
 */

type TransferCopy = Messages['caregiver']['transfer'];
/** Formats an ISO instant as a short date in the UI locale. */
export type DateFormat = (iso: string) => string;

/** The inbox's transfer fields for one learner (`membership-store` `LearnerTransfers`). */
export interface TransfersFacts {
  enabled: boolean;
  deviceConsent: boolean;
  selfManaged: boolean;
  scope: 'full' | 'class';
  requests: readonly InboxTransfer[];
}

export interface CardInput {
  /** Null until the first inbox of this session: nothing new is drawn. */
  transfers: TransfersFacts | null;
  memberships: readonly { kind: string }[];
  device: DeviceFacts;
  online: boolean;
}

export interface PendingRowView {
  transferId: string;
  text: string;
  /** The room block ("Waiting for room in the new class."), drawn in the amber nudge tone. */
  room: string | null;
  /** `review` opens the request's sheet; `cancel` opens the planned sheet. Both are the same screen. */
  button: 'review' | 'cancel';
  /** This device is asked to answer (a primary Review); otherwise the read-only veto (ghost). */
  primary: boolean;
  gated: boolean;
}

export interface CardView {
  /** Move on every class row (variant c); null otherwise. Disabled offline. */
  move: { gated: boolean; disabled: boolean } | null;
  pending: PendingRowView | null;
  /** One quiet line under the rows. */
  line: string | null;
  /** (d) Set up PIN, into the existing PIN setup. */
  setUpPin: boolean;
}

const NOTHING: CardView = { move: null, pending: null, line: null, setUpPin: false };

const sentence = (...parts: string[]): string => parts.join(' ');

/** "Waiting for the other class" while one class step waits, "the classes" while both do. */
function waitingLine(r: InboxTransfer, t: TransferCopy): string {
  const waiting = [r.sourceState, r.destinationState].filter((s) => s === 'waiting').length;
  return waiting >= 2 ? t.lines.waitingClasses : t.lines.waitingOther;
}

/** The pending row's first line: teacher-started names the source, any other value the destination. */
const askedLine = (r: InboxTransfer, t: TransferCopy): string => (initiatorOf(r.initiator) === 'source' ? t.card.sourceAsked(r.from.name) : t.card.learnerAsked(r.to.name));

/** Why a reset learner request cannot get its yes here, as the card and the read-only sheet say it. */
function needsLine(a: RequestAction, t: TransferCopy): string | null {
  if (a.needs === 'pin') return t.card.needsPin;
  if (a.needs === 'pin_age') return t.card.pinTooNew;
  return null;
}

/** The pending row and the line under it, for an open request. */
function pendingCard(r: InboxTransfer, a: RequestAction, t: TransferCopy, date: DateFormat): CardView {
  const row = { transferId: r.id, room: null, button: 'review' as const, primary: false, gated: a.gated };
  if (a.sheet === 'planned') return { ...NOTHING, pending: { ...row, button: 'cancel', text: t.lines.planned(date(r.executeAfter ?? r.expiresAt)) } };
  // Approved and waiting for room reads "Asked: a move to {Destination}." whoever started it (app-sheets.md).
  if (r.status === 'approved') return { ...NOTHING, pending: { ...row, text: t.card.learnerAsked(r.to.name), room: t.lines.waitingRoom } };
  const first = askedLine(r, t);
  if (r.learnerState !== 'pending') return { ...NOTHING, pending: { ...row, text: sentence(first, waitingLine(r, t)) } };
  if (a.answerHere) return { ...NOTHING, pending: { ...row, primary: true, text: sentence(first, t.lines.checkAgain) } };
  if (a.cannotAnswerHere) return { ...NOTHING, pending: { ...row, text: sentence(first, t.lines.cannotAnswer) } };
  const learnerSide = initiatorOf(r.initiator) === 'learner_side';
  const text = learnerSide ? sentence(first, t.lines.checkAgain) : first;
  const route = learnerRouteOf(r.learnerRoute);
  const line = needsLine(a, t) ?? (route === 'caregiver' ? t.card.askConsole : null);
  return { move: null, pending: { ...row, text }, line, setUpPin: a.needs === 'pin' };
}

/** The Classes card's move parts (classes-card.md, "Variants and states"). */
export function classesCardView(i: CardInput, t: TransferCopy, date: DateFormat): CardView {
  const x = i.transfers;
  if (!x) return NOTHING;
  const rule = moveRule({
    scope: x.scope,
    transfersEnabled: x.enabled,
    transferDeviceConsent: x.deviceConsent,
    hasFamily: i.memberships.some((m) => m.kind === 'family'),
    selfManaged: x.selfManaged,
    transfers: x.requests,
    device: i.device,
  });
  if (rule.variant === 'class_scope') return { ...NOTHING, line: t.card.classScope };
  const open = openRequestOf(x.requests);
  if (rule.variant === 'request' && open) {
    const action = requestAction(open, i.device);
    if (action) return pendingCard(open, action, t, date);
  }
  if (!x.enabled) return NOTHING;
  const ended = x.requests.some((r) => !isOpenRequest(r)) ? t.lines.ended : null;
  if (rule.variant === 'move') return { ...NOTHING, move: { gated: rule.gated, disabled: !i.online }, line: ended };
  // An ended request still listed keeps its own line, before the PIN line of (d) or (d').
  const withEnded = (line: string): string => (ended ? sentence(ended, line) : line);
  if (rule.variant === 'needs_pin') return { ...NOTHING, line: withEnded(t.card.needsPin), setUpPin: true };
  if (rule.variant === 'pin_too_new') return { ...NOTHING, line: withEnded(t.card.pinTooNew) };
  return { ...NOTHING, line: ended };
}

export interface HomeLineView {
  transferId: string;
  text: string;
  button: 'review' | 'cancel';
  gated: boolean;
}

/**
 * One calm line under the Hoya tip, only when the learner side must answer or a move is planned
 * (app-sheets.md, "Home line"): no number, no timer, no red. Review opens the sheet, never a yes on Home.
 */
export function homeLineView(i: { transfers: TransfersFacts | null; device: DeviceFacts; learnerName: string }, t: TransferCopy, date: DateFormat): HomeLineView | null {
  const x = i.transfers;
  if (!x || !x.enabled || x.scope !== 'full') return null;
  const r = openRequestOf(x.requests);
  if (!r) return null;
  const a = requestAction(r, i.device);
  if (!a) return null;
  const base = { transferId: r.id, gated: a.gated };
  if (a.sheet === 'planned') return { ...base, button: 'cancel', text: t.lines.planned(date(r.executeAfter ?? r.expiresAt)) };
  if (r.status !== 'requested' || r.learnerState !== 'pending') return null;
  if (initiatorOf(r.initiator) === 'source') return { ...base, button: 'review', text: t.lines.askedMoving(r.from.name, i.learnerName, r.to.name) };
  const self = a.answerHere && deviceAudience(i.device.profiles) === 'self';
  return { ...base, button: 'review', text: self ? t.home.selfWaiting : t.home.learnerWaiting(r.to.name) };
}

export interface ReadOnlySheetView {
  lines: string[];
  room: string | null;
  /** `decline` (Not now) on a teacher-started request, `cancel` (Cancel the request) otherwise. */
  veto: 'decline' | 'cancel';
  /** Not now's description on a teacher-started request. */
  vetoNote: string | null;
}

/** The read-only sheet (guard 11): the request, where the yes happens when not here, and only the veto. */
export function readOnlySheetView(r: InboxTransfer, device: DeviceFacts, learnerName: string, t: TransferCopy): ReadOnlySheetView {
  const source = initiatorOf(r.initiator) === 'source';
  const a = requestAction(r, device);
  const veto = source && r.status === 'requested' ? 'decline' : 'cancel';
  const out = (lines: string[], room: string | null = null): ReadOnlySheetView => ({ lines, room, veto, vetoNote: veto === 'decline' ? t.lines.notNowEnds : null });
  const first = source ? t.lines.askedMoving(r.from.name, learnerName, r.to.name) : t.card.learnerAsked(r.to.name);
  if (r.status === 'approved') return out([t.card.learnerAsked(r.to.name)], r.blockReason === null ? null : t.lines.waitingRoom);
  if (r.learnerState !== 'pending') return out([first, waitingLine(r, t)]);
  const head = source ? first : sentence(first, t.lines.checkAgain);
  if (a?.cannotAnswerHere) return out([head, t.lines.cannotAnswer]);
  const why = a ? needsLine(a, t) : null;
  if (why) return out([head, why]);
  return out(learnerRouteOf(r.learnerRoute) === 'caregiver' ? [head, t.lines.consoleAnswers] : [head]);
}

/** A failed preview or create, as one line under the code field (app-sheets.md, MoveClass answers). */
export function moveErrorLine(f: { ok: false; error: string; startedBy?: 'class' | 'learner_side' }, learnerName: string, c: Messages['caregiver']): string {
  const e = c.transfer.errors;
  switch (f.error) {
    case 'code_not_found':
    case 'invalid_code':
      return e.codeNotFound;
    case 'code_expired':
      return e.codeExpired;
    case 'already_member':
      return e.alreadyMember(learnerName);
    case 'too_many_attempts':
      return e.tooManyAttempts;
    case 'cooldown':
      return e.cooldown;
    case 'caregiver_required':
      return e.caregiverRequired;
    case 'device_consent_locked':
    case 'transfers_locked':
      return e.deviceConsentLocked;
    case 'already_open':
      return f.startedBy === 'class' ? e.alreadyOpenClass(learnerName) : e.alreadyOpenLearner(learnerName);
    case 'same_space':
      return e.sameSpace(learnerName);
    case 'not_transferable':
      return e.notTransferable;
    case 'destination_busy':
      return e.destinationBusy;
    case 'too_many_requests':
      return e.tooManyRequests;
    case 'consent_locale_unavailable':
      return e.localeUnavailable;
    case 'consent_text_stale':
      // The sheet's text is bundled with the app: reading it again cannot help, only an update can.
      return e.updateApp;
    case 'network':
    case 'off':
      return c.retry.offline;
    default:
      return f.error.startsWith('cap_') ? e.full : c.retry.unknown;
  }
}

/**
 * MoveClass answers that mean the sheet shown is no longer the one the server would record: it reloads with
 * "This text was updated. Please read it again." `consent_text_stale` is not one of them: the text is
 * bundled, so a reload would draw the same text and loop; it gets `errors.updateApp` instead (spec 4 item 7).
 */
export const MOVE_RELOAD: ReadonlySet<string> = new Set(['terms_changed', 'destination_changed']);
/** The same for a yes again on ApproveTransfer (the request is read again from the inbox). */
export const REQUEST_RELOAD: ReadonlySet<string> = new Set(['terms_changed', 'request_changed']);

/**
 * Whether a move screen opens directly or through the PIN screen. The Classes card and the Home line are
 * learner surfaces, so on a managed device (`gated`) the PIN is asked every time: a grown-up session left
 * open for something else never carries a consent yes, a decline or a cancel (the screens end the session
 * when they close). A self-only device with no PIN opens directly.
 */
export function moveEntry(i: { gateOpen: boolean; gated: boolean }): 'direct' | 'pin' {
  return !i.gated && i.gateOpen ? 'direct' : 'pin';
}

import type { DeviceAttestKind, InboxTransfer, LearnerType, ProfileRole, TransferInitiator, TransferLearnerRoute } from '@hangul-route/content-schema';
import { effectiveLearnerType, gateRequired } from '../profiles/learner-type';

/**
 * What this device may do about a class move — F-SPACE-002 sections 4.11
 * (device rules) and 4.12 (row variants), T-0b D8, D13, D16 and D24
 * (`design/screens/transfer/classes-card.md`). Pure: no storage, no React.
 *
 * The server cannot verify any of this. It records the claim (`attest`) as
 * `device_attested`, never as a guardian, and the device route stays off
 * until counsel signs off (decision A4, flip gate G6). These rules only keep
 * the app from offering a button that dead-ends, and a PIN from being asked
 * for a yes the device cannot give.
 */

/** A PIN must be at least a day old before it can attest a move (section 4.11). */
export const PIN_MIN_AGE_MS = 24 * 60 * 60 * 1000;

interface ProfileLike {
  role: ProfileRole;
  learnerType?: LearnerType;
}

/** What the device knows about the learner and its grown-up gate. */
export interface DeviceFacts {
  /** The learner whose classes are shown. */
  profile: ProfileLike;
  /** Every profile on the device (the gate depends on all of them, F-LEARN-001 L7). */
  profiles: readonly ProfileLike[];
  selfConsentAcceptedAt: string | null;
  parentPinHash: string | null;
  /** `account:pinCreatedAt` (epoch ms); null for a PIN set before this feature, which counts as old enough. */
  pinCreatedAt: number | null;
  now: number;
}

export type AttestOutcome = { kind: 'attest'; attest: DeviceAttestKind } | { kind: 'needs_pin' } | { kind: 'pin_too_new' } | { kind: 'none' };

/**
 * The claim this device may make for its learner (section 4.11): `self` for a
 * self learner with a self consent; `grown_up_pin` for a managed learner
 * (learner type absent or `child`: a relinked or restored profile included)
 * whose PIN is at least a day old. Opening the gate itself is the screen's job.
 */
export function deviceAttest(d: DeviceFacts): AttestOutcome {
  if (effectiveLearnerType(d.profile) === 'self') return d.selfConsentAcceptedAt !== null ? { kind: 'attest', attest: 'self' } : { kind: 'none' };
  if (d.parentPinHash === null) return { kind: 'needs_pin' };
  if (d.pinCreatedAt !== null && d.now - d.pinCreatedAt < PIN_MIN_AGE_MS) return { kind: 'pin_too_new' };
  return { kind: 'attest', attest: 'grown_up_pin' };
}

/** Whether a move action goes through the grown-up PIN screen (F-LEARN-001 L7, `gate-route.ts`). */
const gatedOn = (d: DeviceFacts): boolean => gateRequired({ profiles: d.profiles, parentPinHash: d.parentPinHash });

// ---------------------------------------------------------------------------
// Lenient inbox values (an older app, a newer server)

const ROUTES: readonly TransferLearnerRoute[] = ['caregiver', 'device', 'none'];
const AGE_BUCKETS = ['days', 'weeks', 'months', 'years'] as const;
export type AgeBucket = (typeof AGE_BUCKETS)[number];

/** An unknown `learnerRoute` reads as `none`, so an older app never falls through to Move or a yes. */
export const learnerRouteOf = (value: string): TransferLearnerRoute => (ROUTES as readonly string[]).includes(value) ? (value as TransferLearnerRoute) : 'none';
/** An unknown `initiator` reads learner-side: its wording and the Cancel veto. */
export const initiatorOf = (value: string): TransferInitiator => (value === 'source' ? 'source' : 'learner_side');
/** An unknown `ageBucket` leaves the age out. */
export const ageBucketOf = (value: string | null): AgeBucket | null => ((AGE_BUCKETS as readonly string[]).includes(value ?? '') ? (value as AgeBucket) : null);

/** Requested or approved: the learner side can still act on it. Any other status, known or not, is not open. */
export const isOpenRequest = (t: Pick<InboxTransfer, 'status'>): boolean => t.status === 'requested' || t.status === 'approved';

/** The learner's open request (one at most, section 4.9), or null. */
export function openRequestOf(transfers: readonly InboxTransfer[]): InboxTransfer | null {
  return transfers.find(isOpenRequest) ?? null;
}

// ---------------------------------------------------------------------------
// The Classes card with no open request (D16)

/** Inbox and device facts for the Move rule. */
export interface MoveFacts {
  scope: 'full' | 'class';
  transfersEnabled: boolean;
  transferDeviceConsent: boolean;
  /** The inbox memberships hold a family (the server decides the same from caregiver accounts). */
  hasFamily: boolean;
  selfManaged: boolean;
  transfers: readonly InboxTransfer[];
  device: DeviceFacts;
}

export type MoveRule =
  /** Nothing new on the card. */
  | { variant: 'hidden' }
  /** (a) "Use your grown-up's rescue code first." */
  | { variant: 'class_scope' }
  /** An open request: its pending row is the only action (`requestAction`). */
  | { variant: 'request' }
  /** (c) Move on every class row, through the gate unless it opens directly. */
  | { variant: 'move'; attest: DeviceAttestKind; gated: boolean }
  /** (d) "A grown-up needs to set up a PIN first." with Set up PIN. */
  | { variant: 'needs_pin' }
  /** (d') "Moves open one day after the PIN is set." */
  | { variant: 'pin_too_new' };

/**
 * Which Classes card variant shows (classes-card.md, "Choosing the
 * variant"): nothing while transfers are off; (a) on a class-scoped device;
 * the pending row while a request is open; nothing while device consent is
 * off or a caregiver account answers for the learner; then the device rules.
 */
export function moveRule(f: MoveFacts): MoveRule {
  if (!f.transfersEnabled) return { variant: 'hidden' };
  if (f.scope === 'class') return { variant: 'class_scope' };
  if (openRequestOf(f.transfers)) return { variant: 'request' };
  if (!f.transferDeviceConsent) return { variant: 'hidden' };
  if (f.hasFamily && !f.selfManaged) return { variant: 'hidden' };
  const claim = deviceAttest(f.device);
  if (claim.kind === 'attest') return { variant: 'move', attest: claim.attest, gated: gatedOn(f.device) };
  if (claim.kind === 'none') return { variant: 'hidden' };
  return { variant: claim.kind };
}

// ---------------------------------------------------------------------------
// An open request (classes-card.md table 1, app-sheets.md)

export interface RequestAction {
  /** `approve`: ApproveTransfer (a yes again); `planned`: the cooling-off sheet; `read_only`: the veto only. */
  sheet: 'approve' | 'planned' | 'read_only';
  /** On `approve` only: the claim the yes carries. */
  attest?: DeviceAttestKind;
  /** The device's no: `decline` (Not now) on a teacher request or ApproveTransfer, `cancel` otherwise. */
  veto: 'decline' | 'cancel';
  /** The primary Review: this device is asked to answer. */
  answerHere: boolean;
  /** "This move can't be answered here.": nobody can say yes for the learner side right now. */
  cannotAnswerHere: boolean;
  /** Review goes through the grown-up gate. */
  gated: boolean;
  /** A managed device with no PIN runs the existing PIN setup first, then the sheet (D24): the PIN guards the veto, never a yes. */
  pinSetupFirst: boolean;
}

/**
 * What Review on an open request opens. Only a learner-started request whose
 * learner consent was reset, on route `device`, asks this device for a yes,
 * and only when the device can still make its claim; everything else is the
 * read-only sheet whose only action is the veto (guard 11). Null for a
 * request that is no longer open.
 */
export function requestAction(t: InboxTransfer, d: DeviceFacts): RequestAction | null {
  if (!isOpenRequest(t)) return null;
  const route = learnerRouteOf(t.learnerRoute);
  const initiator = initiatorOf(t.initiator);
  const learnerWaiting = t.learnerState === 'pending';
  const gated = gatedOn(d);
  const common = { gated, pinSetupFirst: gated && d.parentPinHash === null, cannotAnswerHere: route === 'none' && learnerWaiting };
  if (t.status === 'approved') return { sheet: t.blockReason === null ? 'planned' : 'read_only', veto: 'cancel', answerHere: false, ...common };
  const claim = deviceAttest(d);
  if (route === 'device' && learnerWaiting && claim.kind === 'attest') return { sheet: 'approve', attest: claim.attest, veto: 'decline', answerHere: true, ...common };
  return { sheet: 'read_only', veto: initiator === 'source' ? 'decline' : 'cancel', answerHere: false, ...common };
}

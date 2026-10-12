import {
  LEARNER_CLASS_CAP,
  TRANSFER_BLOCKED_VALID_MS,
  TRANSFER_COOLDOWN_MS,
  TRANSFER_COOLING_OFF_MS,
  TRANSFER_GUARDIAN_MIN_AGE_MS,
  TRANSFER_REFUSAL_COOLDOWN_MS,
  TRANSFER_WINDOW_MS,
  type ConsentResetReason,
  type Space,
  type TransferBlockReason,
  type TransferInitiator,
  type TransferPremiumChange,
} from '@hangul-route/content-schema';
import type {
  Db,
  LearnerConsentRecord,
  StoredTransfer,
  TransferConsentTerms,
  TransferGuardianRole,
  TransferSlotConsent,
  TransferVia,
} from '../db';
import { allSlotsIn, consentedLearnerSlot, finiteCap, isOpenTransfer } from '../db/transfer-rules';
import { learnerContexts, spaceContext } from './access';
import { can, type AccountActor, type SpaceContext } from './can';
import { hashSecret } from './device-auth';
import { classCap, schoolIsFull, tierAfterMove, tierForLearner } from './entitlement';
import { classSeatCheck } from './seats';

export { tierAfterMove };

/*
 * Class transfer rules — F-SPACE-002 §4.1, §4.2, §4.6, §4.9 (PR T-4b). Pure
 * over `Db`: no handler state, no whole-row writes. The request row changes
 * only through the single-statement compare-and-set methods of `Db`, and
 * every step re-reads after its CAS, so a decision is never taken on a copy
 * another isolate has already changed. Nothing here is mounted yet (T-5).
 */

// ---------------------------------------------------------------------------
// Release locks (T15)

/** The Worker vars of the two locks; only the exact value `enabled` opens one. */
export interface TransferEnv {
  CLASS_TRANSFER?: string;
  CLASS_TRANSFER_DEVICE_CONSENT?: string;
}

/** Every transfer route and `settle` check this first; unset = locked (the rollback). */
export function classTransferEnabled(env: TransferEnv | undefined): boolean {
  return env?.CLASS_TRANSFER === 'enabled';
}

/** The separate lock on every route that lets a learner's device fill the consent slot (decision A4, gate G6). */
export function transferDeviceConsentEnabled(env: TransferEnv | undefined): boolean {
  return env?.CLASS_TRANSFER_DEVICE_CONSENT === 'enabled';
}

// ---------------------------------------------------------------------------
// New requests (§4.1)

/** `transfer:<crypto.randomUUID()>`; never the Math.random `id()` of store.ts. */
export function newTransferId(): string {
  return `transfer:${crypto.randomUUID()}`;
}

interface NewRequestBase {
  id: string;
  learnerId: string;
  sourceSpaceId: string;
  destSpaceId: string;
  introduce: boolean;
  now: Date;
}

/** Who starts the request decides the starting slots (the initiator table of §4.1). */
export type NewRequestInput = NewRequestBase &
  (
    | {
        initiator: 'learner_side';
        /** The guardian's account; null when the learner's device started it. */
        initiatorAccountId: string | null;
        /** The learner side consents in the same call. */
        consent: LearnerConsentRecord;
      }
    | { initiator: 'source'; initiatorAccountId: string; via: TransferVia }
  );

const EMPTY_TEACHER_SLOT = { state: 'pending' as const, at: null, accountId: null, via: null };

/**
 * The row `Db.createTransfer` inserts, with the starting slots set in this one
 * place:
 *
 * | initiator      | learner   | source    | destination |
 * | `learner_side` | consented | pending   | pending     |
 * | `source`       | pending   | consented | pending     |
 *
 * The destination slot is never pre-filled. `expiresAt` is now + 14 days;
 * `executeAfter` is the learner consent + 48 h, and null while the learner
 * slot is pending. Every timestamp is `toISOString()` (the SQL compares text).
 */
export function newRequest(input: NewRequestInput): StoredTransfer {
  const at = input.now.toISOString();
  const learnerSide = input.initiator === 'learner_side';
  return {
    id: input.id,
    learnerId: input.learnerId,
    sourceSpaceId: input.sourceSpaceId,
    destSpaceId: input.destSpaceId,
    initiator: input.initiator,
    initiatorAccountId: input.initiatorAccountId,
    status: 'requested',
    endReason: null,
    endActor: null,
    blockReason: null,
    introduce: input.introduce,
    rev: 0,
    learner:
      input.initiator === 'learner_side'
        ? consentedLearnerSlot(input.consent, at)
        : { state: 'pending', at: null, basis: null, attest: null, evidence: null, role: null, textVersion: null, locale: null, shown: null, terms: null },
    source: input.initiator === 'source' ? { state: 'consented', at, accountId: input.initiatorAccountId, via: input.via } : { ...EMPTY_TEACHER_SLOT },
    destination: { ...EMPTY_TEACHER_SLOT },
    createdAt: at,
    updatedAt: at,
    expiresAt: new Date(input.now.getTime() + TRANSFER_WINDOW_MS).toISOString(),
    approvedAt: null,
    executeAfter: learnerSide ? new Date(input.now.getTime() + TRANSFER_COOLING_OFF_MS).toISOString() : null,
    endedAt: null,
    executedAt: null,
  };
}

// ---------------------------------------------------------------------------
// Consent-time terms (§4.11)

/** SHA-256 hex of a name: a later rename is detectable without storing the name. */
export function nameHash(name: string): Promise<string> {
  return hashSecret(name);
}

/** `may_change` only when the tier computed after the move differs from today's (T6b, T7). */
export async function premiumChangeFor(db: Db, learnerId: string, fromSpaceId: string, toSpaceId: string, now: Date): Promise<TransferPremiumChange> {
  const [today, after] = await Promise.all([tierForLearner(db, learnerId, now), tierAfterMove(db, learnerId, fromSpaceId, toSpaceId, now)]);
  return today.tier === after.tier ? 'none' : 'may_change';
}

/**
 * The terms a learner-side consent covers, from live values: ids and hashes only, never a name. A caller that
 * has already computed `premiumChange` for the same sheet passes it, so the terms and the shown flags can
 * never disagree.
 */
export async function consentTermsFor(db: Db, learnerId: string, source: Space, dest: Space, now: Date, knownPremiumChange?: TransferPremiumChange): Promise<TransferConsentTerms> {
  const [destNameHash, sourceNameHash, premiumChange] = await Promise.all([
    nameHash(dest.name),
    nameHash(source.name),
    knownPremiumChange ?? premiumChangeFor(db, learnerId, source.id, dest.id, now),
  ]);
  return {
    destNameHash,
    destConsentMode: dest.settings.consentMode,
    destAnonymize: dest.settings.anonymizeRoster,
    destOwnerId: dest.ownerAccountId,
    sourceNameHash,
    premiumChange,
  };
}

/** The conditional flags of the consent sheet (which conditional lines it shows). */
export interface ConsentSheetFlags {
  premiumChange: TransferPremiumChange;
  destinationConsentMode: Space['settings']['consentMode'];
  relinkAffected: boolean;
  sourcePlansAffected: boolean;
}

/**
 * SHA-256 hex over what a guardian is shown and agrees to (§4.11): the
 * consent-time terms and the sheet's conditional flags. The preview returns
 * it; a create that carries it is refused (`409 terms_changed`) when the live
 * value differs, so the record never says the guardian agreed to a sheet they
 * were not shown (a renamed class, a new consent mode, a new conditional line).
 */
export function consentTermsDigest(terms: TransferConsentTerms, flags: ConsentSheetFlags): Promise<string> {
  return hashSecret(
    JSON.stringify([
      terms.destNameHash,
      terms.destOwnerId,
      terms.destConsentMode,
      terms.destAnonymize,
      terms.sourceNameHash,
      terms.premiumChange,
      flags.premiumChange,
      flags.destinationConsentMode,
      flags.relinkAffected,
      flags.sourcePlansAffected,
    ]),
  );
}

/**
 * Whether the terms a consent was given on still cover the live ones. Every
 * term must be equal, except that a premium warning the guardian saw and that
 * no longer applies (`may_change` then, `none` now: the learner joined a pro
 * destination meanwhile, behaviour 25) is no reason to ask again. A warning
 * the guardian never saw (`none` then, `may_change` now) is.
 */
function termsStillCovered(consented: TransferConsentTerms, live: TransferConsentTerms): boolean {
  return (
    consented.destNameHash === live.destNameHash &&
    consented.destConsentMode === live.destConsentMode &&
    consented.destAnonymize === live.destAnonymize &&
    consented.destOwnerId === live.destOwnerId &&
    consented.sourceNameHash === live.sourceNameHash &&
    (consented.premiumChange === live.premiumChange || (consented.premiumChange === 'may_change' && live.premiumChange === 'none'))
  );
}

// ---------------------------------------------------------------------------
// Teacher slots (T10, T11)

function directRole(actor: AccountActor, spaceId: string): string | null {
  return actor.memberships.find((m) => m.spaceId === spaceId && m.memberKind === 'account' && m.memberId === actor.accountId)?.role ?? null;
}

/**
 * How an account may fill a class slot: `owner` / `teacher` of the class
 * directly, `school_admin` through the school cascade, or null when it holds
 * no `learner.transfer` on that class.
 */
export function teacherVia(actor: AccountActor, ctx: SpaceContext): TransferVia | null {
  if (ctx.space.kind !== 'class' || !can(actor, 'learner.transfer', { kind: 'space', ctx })) return null;
  const role = directRole(actor, ctx.space.id);
  if (role === 'owner') return 'owner';
  if (role === 'teacher') return 'teacher';
  return 'school_admin';
}

export type TeacherConsentPlan =
  | { kind: 'consent'; consent: Extract<TransferSlotConsent, { kind: 'teacher' }> }
  /** Every named slot is already in: approve answers 200 with the row as it is. */
  | { kind: 'unchanged' }
  | { kind: 'refused'; error: 'not_found' | 'not_open' | 'awaiting_learner' | 'one_slot_per_action' };

/**
 * Turns an approve of teacher slots into the one `consentSlot` call to make.
 * `ctx` must be this request's own source and destination contexts; any other
 * context answers `not_found` (the ownership rule of §4.4), so a route that
 * passes the wrong context never authorizes a manager of an unrelated class.
 * Repeated slot names count once and slots already in are left out (approve
 * is idempotent). Both slots in one call only for an account that is the
 * direct owner/teacher of both classes (T11); a school admin acting through
 * the cascade fills one slot per action (`one_slot_per_action` when two are
 * still pending). The single UPDATE records one `via`, taken from the slots it
 * writes: `owner` when the account owns every one of them, `teacher` otherwise
 * (an owner acts as the class teacher, can.ts `OWNER_AS`). The destination
 * slot waits for the learner slot (`awaiting_learner`).
 */
export function planTeacherConsent(
  actor: AccountActor,
  request: StoredTransfer,
  slots: ReadonlyArray<'source' | 'destination'>,
  ctx: { source: SpaceContext; destination: SpaceContext },
): TeacherConsentPlan {
  if (ctx.source.space.id !== request.sourceSpaceId || ctx.destination.space.id !== request.destSpaceId) return { kind: 'refused', error: 'not_found' };
  const named = (['source', 'destination'] as const).filter((slot) => slots.includes(slot));
  if (named.length === 0) return { kind: 'refused', error: 'not_found' };
  const vias = new Map(named.map((slot) => [slot, teacherVia(actor, ctx[slot])]));
  if ([...vias.values()].some((via) => via === null)) return { kind: 'refused', error: 'not_found' };
  if (!isOpenTransfer(request)) return { kind: 'refused', error: 'not_open' };
  const pending = named.filter((slot) => request[slot].state === 'pending');
  if (pending.length === 0) return { kind: 'unchanged' };
  const written = pending.map((slot) => vias.get(slot) as TransferVia);
  if (written.length === 2 && written.includes('school_admin')) return { kind: 'refused', error: 'one_slot_per_action' };
  if (pending.includes('destination') && request.learner.state !== 'consented') return { kind: 'refused', error: 'awaiting_learner' };
  const via: TransferVia = written.length === 1 ? (written[0] as TransferVia) : written.every((v) => v === 'owner') ? 'owner' : 'teacher';
  return { kind: 'consent', consent: { kind: 'teacher', slots: pending, accountId: actor.accountId, via } };
}

// ---------------------------------------------------------------------------
// Guardian predicate (§4.2 guard 9)

/** The other parties of a request: separation of duties keeps the guardian apart from all of them. */
export interface GuardianParties {
  sourceSpaceId: string;
  destSpaceId: string;
  initiator?: TransferInitiator;
  initiatorAccountId?: string | null;
  sourceAccountId?: string | null;
  destAccountId?: string | null;
}

export function partiesOf(t: StoredTransfer): Required<GuardianParties> {
  return {
    sourceSpaceId: t.sourceSpaceId,
    destSpaceId: t.destSpaceId,
    initiator: t.initiator,
    initiatorAccountId: t.initiatorAccountId,
    sourceAccountId: t.source.accountId,
    destAccountId: t.destination.accountId,
  };
}

export type GuardianCheck = { ok: true; role: TransferGuardianRole; familyId: string } | { ok: false; error: 'not_guardian' | 'family_too_new' | 'conflicted_guardian' };

interface FamilyLink {
  familyId: string;
  role: TransferGuardianRole;
  accountJoinedAt: string;
  learnerJoinedAt: string;
}

/** Guard 9a: the account's owner/caregiver memberships in live family spaces the learner is in. */
async function familyLinks(db: Db, accountId: string, learnerId: string, familyId?: string): Promise<{ actor: AccountActor; links: FamilyLink[] }> {
  const [accountRows, learnerRows] = await Promise.all([db.membershipsOf('account', accountId), db.membershipsOf('learner', learnerId)]);
  const actor: AccountActor = { kind: 'account', accountId, memberships: accountRows };
  const learnerJoined = new Map(learnerRows.map((m) => [m.spaceId, m.joinedAt]));
  const shared = accountRows.filter((m) => m.memberId === accountId && m.memberKind === 'account' && learnerJoined.has(m.spaceId) && (familyId === undefined || m.spaceId === familyId));
  const spaces = new Map((await db.getSpaces(shared.map((m) => m.spaceId))).map((s) => [s.id, s]));
  const links: FamilyLink[] = [];
  for (const m of shared) {
    const space = spaces.get(m.spaceId);
    if (!space || space.kind !== 'family' || space.archivedAt) continue;
    if (!can(actor, 'snapshot.read', { kind: 'space', ctx: { space, parent: null } })) continue;
    links.push({ familyId: space.id, role: m.role === 'owner' ? 'owner' : 'caregiver', accountJoinedAt: m.joinedAt, learnerJoinedAt: learnerJoined.get(space.id) as string });
  }
  return { actor, links };
}

/**
 * The safe direction (cancel, decline): guard 9a only. Any owner/caregiver of
 * a live family the learner is in may veto, aged or not, conflicted or not.
 */
export async function familyGuardianRole(db: Db, accountId: string, learnerId: string, familyId?: string): Promise<TransferGuardianRole | null> {
  return (await familyLinks(db, accountId, learnerId, familyId)).links[0]?.role ?? null;
}

/**
 * Guard 9, for the learner slot over the caregiver route; checked at consent
 * and again before execution (`settle` step 5):
 *
 * a. an `owner` / `caregiver` membership in a live family space the learner
 *    is in (`snapshot.read` on it), restricted to `familyId` when given;
 * b. both that membership and the learner's in the same family are at least
 *    24 hours old (`family_too_new`) — friction, not proof of parenthood;
 * c. separation of duties (`conflicted_guardian`): no account membership in
 *    either class or the school above either, not the owner of any of them,
 *    and not a class consenter or the teacher who started the request. A
 *    guardian who started a learner-side request is its learner side, not a
 *    second party, so that initiator never conflicts.
 *
 * Without `familyId` any family that qualifies counts: the re-check before
 * execution asks whether the consenting account is still a guardian of the
 * learner, not whether it is one through the family it consented from.
 *
 * (b) is checked before (c), so a family built around a child on the day of
 * the request answers `family_too_new` (behaviour 5).
 */
export async function guardianOf(db: Db, accountId: string, learnerId: string, parties: GuardianParties, now: Date, opts: { familyId?: string } = {}): Promise<GuardianCheck> {
  return guardianCheck(db, accountId, learnerId, [parties.sourceSpaceId, parties.destSpaceId], parties, now, opts.familyId);
}

/**
 * Guard 9 (a-c) with every class the learner is in as the other parties, for
 * a guardian act that is not tied to one request: turning `blockTeacherRequests`
 * off (§4.2 guard 13), which lets teacher requests in again. A learner in no
 * class needs (a) and (b) only.
 */
export async function guardianOfLearner(db: Db, accountId: string, learnerId: string, now: Date, opts: { familyId?: string } = {}): Promise<GuardianCheck> {
  const spaces = await db.getSpaces((await db.membershipsOf('learner', learnerId)).map((m) => m.spaceId));
  return guardianCheck(
    db,
    accountId,
    learnerId,
    spaces.filter((s) => s.kind === 'class').map((s) => s.id),
    {},
    now,
    opts.familyId,
  );
}

async function guardianCheck(db: Db, accountId: string, learnerId: string, classIds: readonly string[], parties: Omit<GuardianParties, 'sourceSpaceId' | 'destSpaceId'>, now: Date, familyId: string | undefined): Promise<GuardianCheck> {
  const { actor, links } = await familyLinks(db, accountId, learnerId, familyId);
  if (links.length === 0) return { ok: false, error: 'not_guardian' };
  const oldEnough = now.getTime() - TRANSFER_GUARDIAN_MIN_AGE_MS;
  const aged = links.find((l) => Date.parse(l.accountJoinedAt) <= oldEnough && Date.parse(l.learnerJoinedAt) <= oldEnough);
  if (!aged) return { ok: false, error: 'family_too_new' };

  const classes = await db.getSpaces(classIds);
  const schoolIds = classes.map((s) => s.parentSpaceId).filter((id): id is string => id !== null);
  const schools = await db.getSpaces(schoolIds);
  const related = [...classes, ...schools];
  const relatedIds = new Set([...classIds, ...schoolIds]);
  const conflicted =
    actor.memberships.some((m) => m.memberKind === 'account' && m.memberId === accountId && relatedIds.has(m.spaceId)) ||
    related.some((s) => s.ownerAccountId === accountId) ||
    (parties.initiator === 'source' && parties.initiatorAccountId === accountId) ||
    parties.sourceAccountId === accountId ||
    parties.destAccountId === accountId;
  if (conflicted) return { ok: false, error: 'conflicted_guardian' };
  return { ok: true, role: aged.role, familyId: aged.familyId };
}

// ---------------------------------------------------------------------------
// Cooldowns and refusals (§4.9)

/**
 * The 7-day rule for a learner-side request: seconds until the learner side
 * may ask this destination again after another side declined its request, or
 * null when it may ask now. The initiator's own cancel, the learner side's
 * withdrawal and an expiry never start a cooldown (`Db.lastCooldownDecline`).
 */
export async function learnerSideCooldown(db: Db, learnerId: string, destSpaceId: string, now: Date): Promise<number | null> {
  const declined = await db.lastCooldownDecline(learnerId, destSpaceId, new Date(now.getTime() - TRANSFER_COOLDOWN_MS));
  if (!declined?.endedAt) return null;
  const remaining = Date.parse(declined.endedAt) + TRANSFER_COOLDOWN_MS - now.getTime();
  return remaining > 0 ? Math.ceil(remaining / 1000) : null;
}

/**
 * Whether a new source-started request is refused with the neutral
 * `cannot_send`: the learner has `blockTeacherRequests` or `selfManaged`, or
 * the learner side refused a teacher's request in the last 30 days (for any
 * destination). One answer for every reason, so nothing hints that anyone said no.
 */
export async function sourceRequestRefused(db: Db, learnerId: string, now: Date): Promise<boolean> {
  const prefs = await db.getTransferPrefs(learnerId);
  if (prefs.blockTeacherRequests || prefs.selfManaged) return true;
  return (await db.lastLearnerRefusal(learnerId, new Date(now.getTime() - TRANSFER_REFUSAL_COOLDOWN_MS))) !== null;
}

// ---------------------------------------------------------------------------
// Settle and execution (§4.6)

/**
 * Whether the learner consent still covers what would happen (`settle` step
 * 5): `terms_changed` when a consent-time term no longer covers its live value
 * (destination consent mode, anonymity, owner, destination or source name, a
 * new premium warning: `termsStillCovered`); `guardian_changed` when guard 9
 * no longer holds for the consenting account (caregiver basis) or the
 * consenting device is no longer bound with full scope (device basis). Null
 * when the consent is fresh, or there is no consent to check. The 72-hour
 * `lapsed` rule is not decided here but after a fresh attempt still blocks
 * (`settle` step 6), so a seat that came free always gets its chance first.
 */
export async function consentFreshness(db: Db, request: StoredTransfer, now: Date): Promise<ConsentResetReason | null> {
  const consent = request.learner;
  if (consent.state !== 'consented') return null;
  const spaces = new Map((await db.getSpaces([request.sourceSpaceId, request.destSpaceId])).map((s) => [s.id, s]));
  const source = spaces.get(request.sourceSpaceId);
  const dest = spaces.get(request.destSpaceId);
  if (!consent.terms || !source || !dest || !termsStillCovered(consent.terms, await consentTermsFor(db, request.learnerId, source, dest, now))) return 'terms_changed';

  if (consent.basis === 'caregiver') {
    const guardian = consent.evidence ? await guardianOf(db, consent.evidence, request.learnerId, partiesOf(request), now) : null;
    if (!guardian?.ok) return 'guardian_changed';
  } else {
    const device = consent.evidence ? await db.getDevice(request.learnerId, consent.evidence) : null;
    if (device?.scope !== 'full') return 'guardian_changed';
  }
  return null;
}

/**
 * When the current block started: the first `blocked` event since this
 * approval (`approvedAt`; a reset clears it and a new promotion sets it
 * again, so an earlier cycle never counts). Null when no block is recorded.
 * Measured from the block, not from when the move fell due: with no scheduler
 * a block is first seen at the first read, which may come days later.
 */
async function blockedSince(db: Db, request: StoredTransfer): Promise<number | null> {
  const approvedAt = request.approvedAt;
  if (approvedAt === null) return null;
  const first = (await db.transferEvents(request.id)).find((e) => e.event === 'blocked' && e.at >= approvedAt);
  return first ? Date.parse(first.at) : null;
}

export interface ExecuteOutcome {
  /** The gate changed the row: the move happened. */
  executed: boolean;
  /** The row as stored after the attempt; null when it is gone (the learner was erased). */
  request: StoredTransfer | null;
  /** Why an `approved`, due request is waiting for room; null otherwise. */
  blockReason: TransferBlockReason | null;
  devicesRevoked: number;
  relinksClosed: number;
}

/**
 * Accounts that held `learner.transfer` on the source and can still read the
 * learner's snapshot through another space (a family): counts only, for the
 * `old_space_still_has_access` audit event (§4.6, §4.10). Set-based: `can()`
 * looks only at memberships in a target space and its parent, so the members
 * of the source, its school and the learner's own spaces (with their parents)
 * are all it needs, one read per space, however many teachers the school has.
 */
async function oldSpaceAccessCount(db: Db, sourceSpaceId: string, learnerId: string): Promise<number> {
  const source = await db.getSpace(sourceSpaceId);
  if (!source) return 0;
  const ctx = await spaceContext(db, source);
  const contexts = await learnerContexts(db, learnerId);
  const sourceIds = [ctx.space.id, ...(ctx.parent ? [ctx.parent.id] : [])];
  const spaceIds = new Set([...sourceIds, ...contexts.flatMap((c) => [c.space.id, ...(c.parent ? [c.parent.id] : [])])]);
  const rows = (await Promise.all([...spaceIds].map((id) => db.membersOf(id)))).flat().filter((m) => m.memberKind === 'account');
  const byAccount = new Map<string, typeof rows>();
  for (const m of rows) byAccount.set(m.memberId, [...(byAccount.get(m.memberId) ?? []), m]);
  const candidates = new Set([source.ownerAccountId, ...rows.filter((m) => sourceIds.includes(m.spaceId)).map((m) => m.memberId)]);
  let count = 0;
  for (const accountId of candidates) {
    const actor: AccountActor = { kind: 'account', accountId, memberships: byAccount.get(accountId) ?? [] };
    if (can(actor, 'learner.transfer', { kind: 'space', ctx }) && can(actor, 'snapshot.read', { kind: 'learner', learnerId, spaces: contexts })) count += 1;
  }
  return count;
}

const systemEvent = (transferId: string, now: Date) => ({ transferId, at: now.toISOString(), actorKind: 'system' as const, actorRef: null, slot: null });

/**
 * The move (§4.6). Computes in JS what the SQL cannot — the destination's cap
 * (unlimited as 1e9) and the advisory school-seat check (`cap_school`, the one
 * residual check-then-act, as in /join) — then runs `Db.executeTransfer`: one
 * batch whose first statement is the gate carrying every precondition, the
 * rest guarded by it. Executed: the revocation counts and the
 * old-space-access check are audited afterwards, best effort, outside the
 * transaction. Not executed: the row is re-read and its real state reported;
 * an `approved` request that is due records why it waits for room
 * (`blockTransfer` and a `blocked` event, only when the reason changes, so a
 * read every 30 seconds does not fill the audit; the CAS itself refuses a
 * reason already recorded, so two racing reads write one event).
 *
 * Internal to `settle`: it checks neither the `CLASS_TRANSFER` lock nor the
 * freshness of the learner consent (step 5), which the SQL gate does not
 * cover either. Every route, retry included, calls `settle`, never this.
 * Exported for the unit tests.
 */
export async function executeTransfer(db: Db, request: StoredTransfer, now: Date): Promise<ExecuteOutcome> {
  const { id, learnerId, sourceSpaceId, destSpaceId } = request;
  const dest = await db.getSpace(destSpaceId);
  const alreadyIn = (await db.membership(destSpaceId, 'learner', learnerId)) !== null;
  const schoolFull = !!dest && !alreadyIn && (await schoolIsFull(db, dest, now, learnerId));
  if (dest && !schoolFull) {
    const result = await db.executeTransfer({ id, learnerId, sourceSpaceId, destSpaceId, now, destCap: finiteCap(await classCap(db, dest, now)), learnerCap: LEARNER_CLASS_CAP });
    if (result.executed) {
      await auditAfterMove(db, request, now, result.devicesRevoked, result.relinksClosed);
      return { executed: true, request: await db.getTransfer(id), blockReason: null, devicesRevoked: result.devicesRevoked, relinksClosed: result.relinksClosed };
    }
  }

  let row = await db.getTransfer(id);
  const due = row?.status === 'approved' && row.executeAfter !== null && row.executeAfter <= now.toISOString() && row.expiresAt > now.toISOString();
  if (!row || !due || !dest) return { executed: false, request: row, blockReason: null, devicesRevoked: 0, relinksClosed: 0 };
  const reason: TransferBlockReason | null = schoolFull ? 'cap_school' : await classSeatCheck(db, dest, learnerId, now, { excludeSpaceId: sourceSpaceId });
  if (reason && row.blockReason !== reason) {
    if ((await db.blockTransfer(id, reason, now)) === 1) await db.addTransferEvent({ ...systemEvent(id, now), event: 'blocked', detail: { reason } });
    row = await db.getTransfer(id);
  }
  return { executed: false, request: row, blockReason: reason ?? row?.blockReason ?? null, devicesRevoked: 0, relinksClosed: 0 };
}

/**
 * Audit rows written after a committed move. Best effort by design (§4.6):
 * the move is already done, so a failure here must not report it as failed;
 * the events are an audit aid, the `executed` event inside the batch is the record.
 */
async function auditAfterMove(db: Db, request: StoredTransfer, now: Date, devicesRevoked: number, relinksClosed: number): Promise<void> {
  try {
    if (devicesRevoked > 0) await db.addTransferEvent({ ...systemEvent(request.id, now), event: 'devices_revoked', detail: { count: devicesRevoked } });
    if (relinksClosed > 0) await db.addTransferEvent({ ...systemEvent(request.id, now), event: 'relinks_closed', detail: { count: relinksClosed } });
    const stillSees = await oldSpaceAccessCount(db, request.sourceSpaceId, request.learnerId);
    if (stillSees > 0) await db.addTransferEvent({ ...systemEvent(request.id, now), event: 'old_space_still_has_access', detail: { count: stillSees } });
  } catch {
    // Deliberately swallowed: see the doc comment.
  }
}

export interface SettleResult {
  /** The row as stored after settling; null when it is gone. With the lock off, the row as given. */
  request: StoredTransfer | null;
  /** Set when this call reset the learner consent (step 5); `retry` answers 409 `consent_outdated`. */
  reset: ConsentResetReason | null;
  /** Set when this call attempted the move (step 6). */
  execution: ExecuteOutcome | null;
}

/**
 * Brings a non-terminal request up to date (§4.6). Every list, get, inbox,
 * approve and retry calls it, so a read can perform the move once it is due
 * (there is no scheduler). Each step is a CAS that is a no-op when it no
 * longer applies, and the row is re-read after each one:
 *
 * 1. lock: with `CLASS_TRANSFER` off, return the row unchanged (instant rollback);
 * 2. expire at `expiresAt`;
 * 3. cancel when the destination is archived or the learner left the source;
 *    an archived source turns a pending source slot into `not_required`;
 * 4. promote to `approved` when every slot is in;
 * 5. before promoting or executing, check the learner consent is still fresh
 *    (`consentFreshness`) and reset it when not; the reset carries the `rev`
 *    it was decided on, so it never wipes a consent given since. A
 *    `device_attested` consent while `CLASS_TRANSFER_DEVICE_CONSENT` is off
 *    is held here (neither promoted nor executed) until the lock opens again;
 * 6. execute when `approved` and the cooling-off has passed. When the move is
 *    still blocked 72 hours after the first recorded block, the learner
 *    consent lapses (`lapsed`).
 *
 * The caller's `request` only names the row (and answers for a closed lock):
 * every decision is taken on a fresh read, never on the caller's copy.
 */
export async function settle(db: Db, request: StoredTransfer, now: Date, env: TransferEnv | undefined): Promise<SettleResult> {
  const unchanged = (row: StoredTransfer | null): SettleResult => ({ request: row, reset: null, execution: null });
  if (!classTransferEnabled(env) || !isOpenTransfer(request)) return unchanged(request);
  const at = now.toISOString();
  const { id } = request;
  let row = await db.getTransfer(id);
  if (!row || !isOpenTransfer(row)) return unchanged(row);

  if (at >= row.expiresAt) {
    await db.expireTransfer(id, now, { ...systemEvent(id, now), event: 'expired', detail: null });
    return unchanged(await db.getTransfer(id));
  }

  const spaces = new Map((await db.getSpaces([row.sourceSpaceId, row.destSpaceId])).map((s) => [s.id, s]));
  const dest = spaces.get(row.destSpaceId);
  if (!dest || dest.archivedAt) {
    await db.cancelTransfer(id, 'destination_archived', 'system', now, { ...systemEvent(id, now), event: 'cancelled', detail: { reason: 'destination_archived' } });
    return unchanged(await db.getTransfer(id));
  }
  if (!(await db.membership(row.sourceSpaceId, 'learner', row.learnerId))) {
    await db.cancelTransfer(id, 'learner_left_source', 'system', now, { ...systemEvent(id, now), event: 'cancelled', detail: { reason: 'learner_left_source' } });
    return unchanged(await db.getTransfer(id));
  }
  if (spaces.get(row.sourceSpaceId)?.archivedAt && row.source.state === 'pending') {
    await db.markSourceNotRequired(id, now);
    row = await db.getTransfer(id);
    if (!row || !isOpenTransfer(row)) return unchanged(row);
  }

  const isDue = (t: StoredTransfer): boolean => t.status === 'approved' && t.executeAfter !== null && at >= t.executeAfter;
  const aboutToPromote = row.status === 'requested' && allSlotsIn(row);
  if (!aboutToPromote && !isDue(row)) return unchanged(row);
  if (row.learner.basis === 'device_attested' && !transferDeviceConsentEnabled(env)) return unchanged(row);

  const why = await consentFreshness(db, row, now);
  if (why) {
    const changed = await db.resetLearnerConsent(id, why, now, row.rev);
    return { request: await db.getTransfer(id), reset: changed === 1 ? why : null, execution: null };
  }

  if (aboutToPromote) {
    await db.promoteTransfer(id, now);
    row = await db.getTransfer(id);
    if (!row || !isDue(row)) return unchanged(row);
  }

  const execution = await executeTransfer(db, row, now);
  const blocked = execution.request;
  if (!execution.executed && execution.blockReason !== null && blocked?.status === 'approved') {
    const since = await blockedSince(db, blocked);
    if (since !== null && now.getTime() >= since + TRANSFER_BLOCKED_VALID_MS) {
      const changed = await db.resetLearnerConsent(id, 'lapsed', now, blocked.rev);
      return { request: await db.getTransfer(id), reset: changed === 1 ? 'lapsed' : null, execution };
    }
  }
  return { request: execution.request, reset: null, execution };
}

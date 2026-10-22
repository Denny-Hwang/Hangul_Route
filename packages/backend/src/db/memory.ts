import { TRANSFER_COOLING_OFF_MS, type BillingEvent, type ClassMoveEndReason, type BillingEventKind, type Entitlement, type EntitlementApply, type MemberKind, type Membership, type Plan, type Space, type SpaceEvent, type TransferBlockReason, type TransferEndReason, type TransferSlot, SpaceEventKindSchema } from '@hangul-route/content-schema';
import { id, type Account, type Learner, type LearnerDevice, type LearnerProfileFields, type SnapshotRecord } from '../store';
import { assertBillingLimit, billingEventFields, newestBillingEvent, REFUNDABLE_BILLING_KINDS } from './billing-rules';
import { assertNoteChecks, assertOneSender } from './feedback-rules';
import {
  noteRetentionCuts,
  notePairPrefix,
  type DeliveredNote,
  type LearnerNotesInbox,
  type NewNote,
  type NoteActVia,
  type NoteDeviceScope,
  type NoteRecipientRow,
  type RateHitRow,
  type SpaceNoteListRow,
  type StoredNote,
  type StoredNotePrefs,
  type StoredNoteReport,
  type StoredSendGrant,
  type StoredSenderBlock,
  type StoredSenderHold,
} from './feedback-types';
import type { AcceptAdminInviteInput, CreateAdminInviteInput, EndAdminRoleInput, EndAdminRoleResult, RevokeAdminInviteInput, StoredAdminInvite } from './admin-types';
import type { RemoteConfigRow } from './remote-config-types';
import { rollupCellKey, uniqueRollupKeys, type RollupKey, type RollupRow } from './rollup-types';
import { assertNewClassMove, type ClassMoveDecider, type ClassMoveEndStatus, type ExecuteClassMoveInput, type ExecuteClassMoveResult, type StoredClassMove, type StoredClassScopeAck } from './class-move-types';
import { allSlotsIn, assertNewTransfer, assertTransferChecks, assertTransferEventChecks, assertTransferPrefKey, assertTransferSlot, consentedLearnerSlot, finiteCap, isEndedTransfer, isOpenTransfer, teacherSlotsOf } from './transfer-rules';
import {
  learnerRateKeys,
  mergeEntitlement,
  type AddLearnerWithinCapsInput,
  type BillingEventInput,
  type EntitlementMerge,
  type ConsentResetReason,
  type Db,
  type ExecuteTransferInput,
  type ExecuteTransferResult,
  type NewTransferEvent,
  type StoredRelink,
  type StoredSummary,
  type StoredTransfer,
  type TransferEndActor,
  type TransferEvent,
  type TransferPrefKey,
  type TransferPrefs,
  type TransferSlotConsent,
  type NoteCursor,
  type WaitlistEntry,
} from './types';

const deviceKey = (learnerId: string, deviceId: string): string => `${learnerId}|${deviceId}`;
const membershipKey = (spaceId: string, kind: MemberKind, memberId: string): string => `${spaceId}|${kind}|${memberId}`;
const entitlementKey = (kind: string, subjectId: string, planKey: string): string => `${kind}|${subjectId}|${planKey}`;
const billingEventKey = (provider: string, providerRef: string, kind: string): string => `${provider}|${providerRef}|${kind}`;

function clone<T>(value: T): T {
  return structuredClone(value);
}

/** Newest first, ties by id descending (`ORDER BY created_at DESC, id DESC`). */
const newestFirst = (a: StoredTransfer, b: StoredTransfer): number => (a.createdAt === b.createdAt ? (a.id < b.id ? 1 : a.id > b.id ? -1 : 0) : a.createdAt < b.createdAt ? 1 : -1);
/** Latest `endedAt` first, ties by id descending. */
const latestEnded = (a: StoredTransfer, b: StoredTransfer): number => {
  const x = a.endedAt ?? '';
  const y = b.endedAt ?? '';
  return x === y ? (a.id < b.id ? 1 : a.id > b.id ? -1 : 0) : x < y ? 1 : -1;
};
/** Newest first, ties by id descending (`ORDER BY created_at DESC, id DESC`). */
const newestNoteFirst = (a: StoredNote, b: StoredNote): number => (a.createdAt === b.createdAt ? (a.id < b.id ? 1 : a.id > b.id ? -1 : 0) : a.createdAt < b.createdAt ? 1 : -1);
/** Oldest first, ties by id ascending (the purge order). */
const oldestNoteFirst = (a: StoredNote, b: StoredNote): number => -newestNoteFirst(a, b);
const beforeCursor = (n: StoredNote, c: NoteCursor | null): boolean => c === null || n.createdAt < c.createdAt || (n.createdAt === c.createdAt && n.id < c.id);
const pairKey = (a: string, b: string): string => `${a}|${b}`;
/** Newest first, ties by id descending (`ORDER BY created_at DESC, id DESC`). */
const newestMoveFirst = (a: StoredClassMove, b: StoredClassMove): number => (a.createdAt === b.createdAt ? (a.id < b.id ? 1 : a.id > b.id ? -1 : 0) : a.createdAt < b.createdAt ? 1 : -1);
const EMPTY_LEARNER_SLOT: StoredTransfer['learner'] = { state: 'pending', at: null, basis: null, attest: null, evidence: null, role: null, textVersion: null, locale: null, shown: null, terms: null };

/**
 * In-memory `Db` — tests and `wrangler dev` without a D1 binding. Hands out
 * clones so a route that mutates without `put` fails here exactly as on D1.
 */
export class MemoryDb implements Db {
  private accounts = new Map<string, Account>();
  private learners = new Map<string, Learner>();
  private devices = new Map<string, LearnerDevice>();
  private snapshots = new Map<string, SnapshotRecord>();
  private spaces = new Map<string, Space>();
  private memberships = new Map<string, Membership>();
  private plans = new Map<string, Plan>();
  private relinks = new Map<string, StoredRelink>();
  private entitlements = new Map<string, Entitlement>();
  private waitlist = new Map<string, WaitlistEntry>();
  private remoteConfigRows = new Map<string, RemoteConfigRow>();
  private transfers = new Map<string, StoredTransfer>();
  private transferEventRows: TransferEvent[] = [];
  private transferEventSeq = 0;
  private transferPrefs = new Map<string, TransferPrefs>();
  private rateHits: Array<{ id: number; key: string; at: string }> = [];
  private rateHitSeq = 0;
  private billingEvents = new Map<string, BillingEvent>();
  private notes = new Map<string, StoredNote>();
  private noteReports = new Map<string, StoredNoteReport>();
  private senderHolds = new Map<string, StoredSenderHold>();
  private notePrefs = new Map<string, StoredNotePrefs>();
  /** Keyed `learnerId|senderAccountId`. */
  private senderBlocks = new Map<string, StoredSenderBlock>();
  /** Keyed `spaceId|accountId`. */
  private sendGrants = new Map<string, StoredSendGrant>();
  /** [TV] migration 0009. */
  private classScopeAcks = new Map<string, StoredClassScopeAck>();
  private classMoves = new Map<string, StoredClassMove>();
  /** [SA] migration 0011. */
  private spaceEvents = new Map<string, SpaceEvent>();
  /** [SA] migration 0012: the invites, and the membership keys whose row holds `promoted_from = 'teacher'`. */
  private adminInvites = new Map<string, StoredAdminInvite>();
  private promotedFromTeacher = new Set<string>();
  /** F-CURR-002 row CM-70a: `day` then `rollupCellKey`, as `learning_rollups` keys its rows. */
  private rollups = new Map<string, Map<string, RollupRow>>();

  async getAccount(accountId: string): Promise<Account | null> {
    return clone(this.accounts.get(accountId) ?? null);
  }
  async putAccount(account: Account): Promise<void> {
    this.accounts.set(account.id, clone(account));
  }

  async getLearner(learnerId: string): Promise<Learner | null> {
    return clone(this.learners.get(learnerId) ?? null);
  }
  async putLearner(learner: Learner): Promise<void> {
    // learners.recovery_hash is UNIQUE on D1; mirror it so collisions surface here too.
    const holder = learner.recoveryHash === null ? undefined : [...this.learners.values()].find((l) => l.recoveryHash === learner.recoveryHash && l.id !== learner.id);
    if (holder) throw new Error('UNIQUE constraint failed: learners.recovery_hash');
    // The column is nullable on D1 (migration 0010): a row read back always carries it. Like D1's upsert, a
    // re-save never resets an applied edit time.
    const profileUpdatedAt = learner.profileUpdatedAt ?? this.learners.get(learner.id)?.profileUpdatedAt ?? null;
    this.learners.set(learner.id, clone({ ...learner, profileUpdatedAt }));
  }
  async touchLearner(learnerId: string, lastActiveAt: string): Promise<void> {
    const learner = this.learners.get(learnerId);
    if (learner) learner.lastActiveAt = lastActiveAt;
  }
  async updateLearnerProfile(learnerId: string, fields: LearnerProfileFields, at: string): Promise<boolean> {
    const learner = this.learners.get(learnerId);
    const given = (['displayName', 'ageGroup', 'avatar'] as const).filter((k) => fields[k] !== undefined);
    if (!learner || given.length === 0) return false;
    if (learner.profileUpdatedAt && learner.profileUpdatedAt > at) return false;
    if (fields.displayName !== undefined) learner.displayName = fields.displayName;
    if (fields.ageGroup !== undefined) learner.ageGroup = fields.ageGroup;
    if (fields.avatar !== undefined) learner.avatar = fields.avatar;
    learner.profileUpdatedAt = at;
    return true;
  }
  async setDisplayNameIfUnedited(learnerId: string, displayName: string): Promise<boolean> {
    const learner = this.learners.get(learnerId);
    if (!learner || learner.profileUpdatedAt) return false;
    learner.displayName = displayName;
    return true;
  }
  async setRecoveryHash(learnerId: string, hash: string): Promise<void> {
    const holder = [...this.learners.values()].find((l) => l.recoveryHash === hash && l.id !== learnerId);
    if (holder) throw new Error('UNIQUE constraint failed: learners.recovery_hash');
    const learner = this.learners.get(learnerId);
    if (learner) learner.recoveryHash = hash;
  }
  async learnerByRecoveryHash(hash: string): Promise<Learner | null> {
    return clone([...this.learners.values()].find((l) => l.recoveryHash === hash) ?? null);
  }
  async deleteLearner(learnerId: string): Promise<boolean> {
    const existed = this.learners.delete(learnerId);
    const transferIds = new Set([...this.transfers.values()].filter((t) => t.learnerId === learnerId).map((t) => t.id));
    this.transferEventRows = this.transferEventRows.filter((e) => !transferIds.has(e.transferId));
    for (const transferId of transferIds) this.transfers.delete(transferId);
    this.transferPrefs.delete(learnerId);
    this.classScopeAcks.delete(learnerId);
    for (const [k, m] of this.classMoves) if (m.learnerId === learnerId) this.classMoves.delete(k);
    for (const [k, r] of this.noteReports) if (r.learnerId === learnerId) this.noteReports.delete(k);
    for (const [k, n] of this.notes) if (n.learnerId === learnerId) this.deleteNoteRow(k);
    this.notePrefs.delete(learnerId);
    for (const [k, b] of this.senderBlocks) if (b.learnerId === learnerId) this.senderBlocks.delete(k);
    const rateKeys = new Set(learnerRateKeys(learnerId));
    const pairPrefix = notePairPrefix(learnerId);
    this.rateHits = this.rateHits.filter((h) => !rateKeys.has(h.key) && !h.key.startsWith(pairPrefix));
    for (const [k, d] of this.devices) if (d.learnerId === learnerId) this.devices.delete(k);
    this.snapshots.delete(learnerId);
    for (const [k, m] of this.memberships) if (m.memberKind === 'learner' && m.memberId === learnerId) this.memberships.delete(k);
    for (const [k, r] of this.relinks) if (r.learnerId === learnerId) this.relinks.delete(k);
    return existed;
  }
  async getDevice(learnerId: string, deviceId: string): Promise<LearnerDevice | null> {
    return clone(this.devices.get(deviceKey(learnerId, deviceId)) ?? null);
  }
  async putDevice(device: LearnerDevice): Promise<void> {
    this.devices.set(deviceKey(device.learnerId, device.deviceId), clone(device));
  }
  async deviceExists(deviceId: string): Promise<boolean> {
    return [...this.devices.values()].some((d) => d.deviceId === deviceId);
  }

  async getSnapshot(learnerId: string): Promise<SnapshotRecord | null> {
    return clone(this.snapshots.get(learnerId) ?? null);
  }
  async putSnapshot(record: SnapshotRecord, baseRev: number): Promise<boolean> {
    // No await between the check and the write: atomic on the single JS thread.
    if ((this.snapshots.get(record.learnerId)?.rev ?? 0) !== baseRev) return false;
    this.snapshots.set(record.learnerId, clone(record));
    return true;
  }
  async summaryOf(learnerId: string): Promise<StoredSummary | null> {
    const row = this.snapshots.get(learnerId);
    return row ? clone({ learnerId: row.learnerId, summary: row.summary, updatedAt: row.updatedAt }) : null;
  }

  async summariesOf(learnerIds: readonly string[]): Promise<StoredSummary[]> {
    return clone([...new Set(learnerIds)].flatMap((learnerId) => {
      const row = this.snapshots.get(learnerId);
      return row ? [{ learnerId: row.learnerId, summary: row.summary, updatedAt: row.updatedAt }] : [];
    }));
  }
  async learnersOf(learnerIds: readonly string[]): Promise<string[]> {
    return [...new Set(learnerIds)].filter((learnerId) => this.learners.has(learnerId));
  }

  async getSpace(spaceId: string): Promise<Space | null> {
    return clone(this.spaces.get(spaceId) ?? null);
  }
  async putSpace(space: Space): Promise<void> {
    // [SA] section 5.2: as on D1, an update keeps the stored name (written at insert and by `renameSpace` only).
    const stored = this.spaces.get(space.id);
    this.spaces.set(space.id, clone(stored ? { ...space, name: stored.name } : space));
  }
  async spaceByCode(code: string): Promise<Space | null> {
    return clone([...this.spaces.values()].find((s) => s.joinCode === code) ?? null);
  }
  async childSpaces(parentSpaceId: string): Promise<Space[]> {
    return clone([...this.spaces.values()].filter((s) => s.parentSpaceId === parentSpaceId));
  }
  async spacesOwnedBy(accountId: string): Promise<Space[]> {
    return clone([...this.spaces.values()].filter((s) => s.ownerAccountId === accountId));
  }
  async membership(spaceId: string, kind: MemberKind, memberId: string): Promise<Membership | null> {
    return clone(this.memberships.get(membershipKey(spaceId, kind, memberId)) ?? null);
  }
  async addMembership(m: Membership): Promise<void> {
    this.memberships.set(membershipKey(m.spaceId, m.memberKind, m.memberId), clone(m));
  }
  async removeMembership(spaceId: string, kind: MemberKind, memberId: string): Promise<boolean> {
    this.promotedFromTeacher.delete(membershipKey(spaceId, kind, memberId));
    return this.memberships.delete(membershipKey(spaceId, kind, memberId));
  }
  async removeMembershipIfRole(spaceId: string, kind: MemberKind, memberId: string, role: Membership['role']): Promise<boolean> {
    if (this.memberships.get(membershipKey(spaceId, kind, memberId))?.role !== role) return false;
    return this.removeMembership(spaceId, kind, memberId);
  }
  async membershipsOf(kind: MemberKind, memberId: string): Promise<Membership[]> {
    return clone([...this.memberships.values()].filter((m) => m.memberKind === kind && m.memberId === memberId));
  }
  async addLearnerWithinCaps(input: AddLearnerWithinCapsInput): Promise<'added' | 'already' | 'refused'> {
    // The rules of the D1 statement (section 3.3), in one synchronous step: no await between the counts and the write.
    const { spaceId, learnerId } = input;
    if (this.memberships.has(membershipKey(spaceId, 'learner', learnerId))) return 'already';
    const rows = [...this.memberships.values()];
    const liveClass = (id: string): Space | undefined => {
      const s = this.spaces.get(id);
      return s && s.kind === 'class' && s.archivedAt === null ? s : undefined;
    };
    const inSpace = rows.filter((m) => m.spaceId === spaceId && m.memberKind === 'learner').length;
    const classes = rows.filter((m) => m.memberKind === 'learner' && m.memberId === learnerId && liveClass(m.spaceId)).length;
    const fits =
      (input.spaceCap === null || inSpace < input.spaceCap) &&
      (input.learnerClassCap === null || classes < input.learnerClassCap) &&
      this.schoolSeatFree(input.schoolId, input.schoolCap, learnerId);
    if (!fits) return 'refused';
    this.memberships.set(membershipKey(spaceId, 'learner', learnerId), { spaceId, memberKind: 'learner', memberId: learnerId, role: 'student', joinedAt: input.joinedAt });
    return 'added';
  }
  /** [SA] The school seat test of the D1 `schoolSeatCondition`, on the live maps. */
  private schoolSeatFree(schoolId: string | null | undefined, schoolCap: number | null | undefined, learnerId: string): boolean {
    if (schoolId === null || schoolId === undefined || schoolCap === null || schoolCap === undefined) return true;
    const learners = new Set<string>();
    for (const m of this.memberships.values()) {
      const s = this.spaces.get(m.spaceId);
      if (m.memberKind !== 'learner' || !s || s.kind !== 'class' || s.archivedAt !== null || s.parentSpaceId !== schoolId) continue;
      if (m.memberId === learnerId) return true;
      learners.add(m.memberId);
    }
    return learners.size < schoolCap;
  }
  async renameSpace(spaceId: string, name: string): Promise<number> {
    const space = this.spaces.get(spaceId);
    if (!space || space.archivedAt !== null) return 0;
    this.spaces.set(spaceId, { ...space, name });
    return 1;
  }
  async addSpaceEvent(event: SpaceEvent): Promise<void> {
    if (!this.spaces.has(event.spaceId)) throw new Error('FOREIGN KEY constraint failed');
    this.spaceEvents.set(event.id, clone({ ...event, kind: SpaceEventKindSchema.parse(event.kind) }));
  }
  async spaceEventsOf(spaceId: string, limit: number): Promise<SpaceEvent[]> {
    return clone(
      [...this.spaceEvents.values()]
        .filter((e) => e.spaceId === spaceId && this.spaces.has(e.spaceId))
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id))
        .slice(0, limit)
        // as D1: a kind this build does not know (written by a newer Worker) is skipped, never thrown
        .filter((e) => SpaceEventKindSchema.safeParse(e.kind).success),
    );
  }
  async purgeSpaceEvents(before: Date, limit: number): Promise<number> {
    const cut = before.toISOString();
    let removed = 0;
    for (const [key, e] of this.spaceEvents) {
      if (removed >= limit) break;
      if (e.createdAt < cut) {
        this.spaceEvents.delete(key);
        removed += 1;
      }
    }
    return removed;
  }
  async membersOf(spaceId: string): Promise<Membership[]> {
    return clone([...this.memberships.values()].filter((m) => m.spaceId === spaceId));
  }
  async latestSpaceEvent(spaceId: string, kind: SpaceEvent['kind'], subjectAccountId: string): Promise<SpaceEvent | null> {
    const rows = [...this.spaceEvents.values()].filter((e) => e.spaceId === spaceId && e.kind === kind && e.subjectAccountId === subjectAccountId);
    rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id));
    return clone(rows[0] ?? null);
  }
  async addMembershipIfAbsent(m: Membership): Promise<boolean> {
    const key = membershipKey(m.spaceId, m.memberKind, m.memberId);
    if (this.memberships.has(key)) return false;
    this.memberships.set(key, clone(m));
    return true;
  }

  // ---- school administrators ([SA] migration 0012): the rules of the D1 statements, each in one synchronous step ----

  /** The account's role in the space, or null. */
  private accountRole(spaceId: string, accountId: string): Membership['role'] | null {
    return this.memberships.get(membershipKey(spaceId, 'account', accountId))?.role ?? null;
  }
  private adminCount(spaceId: string): number {
    return [...this.memberships.values()].filter((m) => m.spaceId === spaceId && m.memberKind === 'account' && m.role === 'admin').length;
  }
  private isOpenInvite(i: StoredAdminInvite, at: string): boolean {
    return i.acceptedAt === null && i.revokedAt === null && i.expiresAt > at;
  }
  private liveSchool(spaceId: string): Space | null {
    const s = this.spaces.get(spaceId);
    return s && s.kind === 'school' && s.archivedAt === null ? s : null;
  }
  private pushSpaceEvent(e: SpaceEvent): void {
    this.spaceEvents.set(e.id, clone({ ...e, kind: SpaceEventKindSchema.parse(e.kind) }));
  }
  /** The `TEACHES_LIVE_CLASS` test of D1, on the live maps. */
  private teachesLiveClass(schoolId: string, accountId: string): boolean {
    for (const s of this.spaces.values()) {
      if (s.parentSpaceId !== schoolId || s.kind !== 'class' || s.archivedAt !== null) continue;
      const role = this.accountRole(s.id, accountId);
      if (s.ownerAccountId === accountId || role === 'owner' || role === 'teacher') return true;
    }
    return false;
  }
  async createAdminInvite({ invite: i, cap, eventId }: CreateAdminInviteInput): Promise<boolean> {
    const open = [...this.adminInvites.values()].filter((x) => x.spaceId === i.spaceId && this.isOpenInvite(x, i.createdAt)).length;
    if (!this.liveSchool(i.spaceId) || this.adminCount(i.spaceId) + open >= cap) return false;
    if ([...this.adminInvites.values()].some((x) => x.tokenHash === i.tokenHash) || this.adminInvites.has(i.id)) throw new Error('UNIQUE constraint failed: admin_invites');
    this.adminInvites.set(i.id, { ...i, acceptedBy: null, acceptedAt: null, revokedAt: null });
    this.pushSpaceEvent({ id: eventId, spaceId: i.spaceId, kind: 'admin_invite_created', actorAccountId: i.createdBy, subjectAccountId: null, subjectSpaceId: null, inviteId: i.id, createdAt: i.createdAt });
    return true;
  }
  async getAdminInvite(inviteId: string): Promise<StoredAdminInvite | null> {
    return clone(this.adminInvites.get(inviteId) ?? null);
  }
  async adminInviteByHash(tokenHash: string): Promise<StoredAdminInvite | null> {
    return clone([...this.adminInvites.values()].find((i) => i.tokenHash === tokenHash) ?? null);
  }
  async openAdminInvites(spaceId: string, now: Date): Promise<StoredAdminInvite[]> {
    const at = now.toISOString();
    return clone([...this.adminInvites.values()].filter((i) => i.spaceId === spaceId && this.isOpenInvite(i, at)).sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id)));
  }
  async revokeAdminInvite({ inviteId, spaceId, actorAccountId, now, eventId }: RevokeAdminInviteInput): Promise<number> {
    const row = this.adminInvites.get(inviteId);
    if (!row || row.spaceId !== spaceId || row.acceptedAt !== null || row.revokedAt !== null) return 0;
    const at = now.toISOString();
    this.adminInvites.set(inviteId, { ...row, revokedAt: at });
    this.pushSpaceEvent({ id: eventId, spaceId, kind: 'admin_invite_revoked', actorAccountId, subjectAccountId: null, subjectSpaceId: null, inviteId, createdAt: at });
    return 1;
  }
  async acceptAdminInvite({ inviteId, spaceId, accountId, now, cap, eventId }: AcceptAdminInviteInput): Promise<boolean> {
    const at = now.toISOString();
    const row = this.adminInvites.get(inviteId);
    const school = this.liveSchool(spaceId);
    const role = this.accountRole(spaceId, accountId);
    const gate = !!row && row.spaceId === spaceId && this.isOpenInvite(row, at) && !!school && school.ownerAccountId !== accountId && (role === null || role === 'teacher') && this.adminCount(spaceId) < cap;
    if (!gate || !row) return false;
    this.adminInvites.set(inviteId, { ...row, acceptedBy: accountId, acceptedAt: at });
    const key = membershipKey(spaceId, 'account', accountId);
    const existing = this.memberships.get(key);
    if (!existing) {
      this.memberships.set(key, { spaceId, memberKind: 'account', memberId: accountId, role: 'admin', joinedAt: at });
    } else if (existing.role === 'teacher') {
      this.memberships.set(key, { ...existing, role: 'admin' });
      this.promotedFromTeacher.add(key);
    }
    this.pushSpaceEvent({ id: eventId, spaceId, kind: 'admin_joined', actorAccountId: accountId, subjectAccountId: accountId, subjectSpaceId: null, inviteId, createdAt: at });
    return true;
  }
  async endAdminRole({ spaceId, accountId, actorAccountId, kind, now, eventId }: EndAdminRoleInput): Promise<EndAdminRoleResult> {
    const key = membershipKey(spaceId, 'account', accountId);
    const row = this.memberships.get(key);
    if (!row || row.role !== 'admin') return null;
    this.pushSpaceEvent({ id: eventId, spaceId, kind, actorAccountId, subjectAccountId: accountId, subjectSpaceId: null, inviteId: null, createdAt: now.toISOString() });
    if (this.promotedFromTeacher.has(key) || this.teachesLiveClass(spaceId, accountId)) {
      this.memberships.set(key, { ...row, role: 'teacher' });
      this.promotedFromTeacher.delete(key);
      return 'teacher';
    }
    this.memberships.delete(key);
    return 'none';
  }
  async adminStaysTeacher(spaceId: string, accountId: string): Promise<boolean> {
    const key = membershipKey(spaceId, 'account', accountId);
    return this.memberships.get(key)?.role === 'admin' && (this.promotedFromTeacher.has(key) || this.teachesLiveClass(spaceId, accountId));
  }
  async purgeAdminInvites(before: Date, limit: number): Promise<number> {
    const cut = before.toISOString();
    let removed = 0;
    for (const [key, i] of this.adminInvites) {
      if (removed >= limit) break;
      if (i.expiresAt < cut || (i.acceptedAt !== null && i.acceptedAt < cut) || (i.revokedAt !== null && i.revokedAt < cut)) {
        this.adminInvites.delete(key);
        removed += 1;
      }
    }
    return removed;
  }

  async getPlan(planId: string): Promise<Plan | null> {
    return clone(this.plans.get(planId) ?? null);
  }
  async putPlan(plan: Plan): Promise<void> {
    this.plans.set(plan.id, clone(plan));
  }
  async plansOf(spaceId: string): Promise<Plan[]> {
    return clone([...this.plans.values()].filter((p) => p.spaceId === spaceId));
  }

  async getRelink(relinkId: string): Promise<StoredRelink | null> {
    return clone(this.relinks.get(relinkId) ?? null);
  }
  async putRelink(request: StoredRelink): Promise<void> {
    this.relinks.set(request.id, clone(request));
  }
  async relinksOf(spaceId: string): Promise<StoredRelink[]> {
    return clone([...this.relinks.values()].filter((r) => r.spaceId === spaceId));
  }

  async entitlementsFor(subjectKind: Entitlement['subjectKind'], subjectId: string): Promise<Entitlement[]> {
    return clone([...this.entitlements.values()].filter((e) => e.subjectKind === subjectKind && e.subjectId === subjectId));
  }
  async applyEntitlement(input: EntitlementApply, now: Date, merge: EntitlementMerge = 'set'): Promise<Entitlement> {
    const k = entitlementKey(input.subjectKind, input.subjectId, input.planKey);
    const next = mergeEntitlement(this.entitlements.get(k) ?? null, input, now, () => id('ent'), merge);
    this.entitlements.set(k, next);
    return clone(next);
  }

  async addWaitlist(entry: Omit<WaitlistEntry, 'unsubscribedAt'>): Promise<void> {
    if (!this.waitlist.has(entry.email)) this.waitlist.set(entry.email, clone({ ...entry, unsubscribedAt: null }));
  }
  async waitlistEntries(): Promise<WaitlistEntry[]> {
    return clone([...this.waitlist.values()].sort((a, b) => a.createdAt.localeCompare(b.createdAt)));
  }
  async unsubscribeWaitlist(email: string, now: Date): Promise<boolean> {
    const row = this.waitlist.get(email);
    if (!row) return false;
    this.waitlist.set(email, { ...row, unsubscribedAt: now.toISOString() });
    return true;
  }

  // ---- class transfer (F-SPACE-002 section 4.7) ----
  // Every method checks and writes with no await in between (the putSnapshot
  // pattern), so each is atomic on the single JS thread, like one SQL statement.

  /** Compare-and-set on one row: `guard` must hold, `change` returns the next row; rev +1, CHECKs enforced. */
  private casTransfer(transferId: string, guard: (t: StoredTransfer) => boolean, change: (t: StoredTransfer) => StoredTransfer): number {
    const row = this.transfers.get(transferId);
    if (!row || !guard(row)) return 0;
    const next = { ...change(clone(row)), rev: row.rev + 1 };
    assertTransferChecks(next);
    this.transfers.set(transferId, next);
    return 1;
  }
  private pushTransferEvent(e: NewTransferEvent): void {
    this.transferEventSeq += 1;
    this.transferEventRows.push(clone({ ...e, id: this.transferEventSeq }));
  }

  async createTransfer(row: StoredTransfer, event: Omit<NewTransferEvent, 'transferId'>): Promise<'created' | 'already_open'> {
    assertNewTransfer(row);
    if ([...this.transfers.values()].some((t) => t.learnerId === row.learnerId && isOpenTransfer(t))) return 'already_open';
    if (this.transfers.has(row.id)) throw new Error('UNIQUE constraint failed: transfer_requests.id');
    if (!this.learners.has(row.learnerId) || !this.spaces.has(row.sourceSpaceId) || !this.spaces.has(row.destSpaceId)) throw new Error('FOREIGN KEY constraint failed: transfer_requests');
    assertTransferChecks(row);
    this.transfers.set(row.id, clone(row));
    this.pushTransferEvent({ ...event, transferId: row.id });
    return 'created';
  }

  async consentSlot(transferId: string, consent: TransferSlotConsent, now: Date, events: ReadonlyArray<Omit<NewTransferEvent, 'transferId'>> = []): Promise<number> {
    const at = now.toISOString();
    // The events are checked first (the CHECK of migration 0005), so a bad one changes nothing; they are
    // written only by the call whose CAS changed the row (one transaction on D1).
    for (const e of events) assertTransferEventChecks(e);
    let changed: number;
    if (consent.kind === 'learner') {
      const executeAfter = new Date(now.getTime() + TRANSFER_COOLING_OFF_MS).toISOString();
      changed = this.casTransfer(
        transferId,
        (t) => isOpenTransfer(t) && t.learner.state === 'pending',
        (t) => ({ ...t, learner: consentedLearnerSlot(consent.record, at), introduce: consent.introduce ?? t.introduce, executeAfter, updatedAt: at }),
      );
    } else {
      const slots = teacherSlotsOf(consent);
      const filled = { state: 'consented' as const, at, accountId: consent.accountId, via: consent.via };
      changed = this.casTransfer(
        transferId,
        (t) => isOpenTransfer(t) && (!slots.source || t.source.state === 'pending') && (!slots.destination || (t.destination.state === 'pending' && t.learner.state === 'consented')),
        (t) => ({ ...t, source: slots.source ? { ...filled } : t.source, destination: slots.destination ? { ...filled } : t.destination, updatedAt: at }),
      );
    }
    if (changed === 1) for (const e of events) this.pushTransferEvent({ ...e, transferId });
    return changed;
  }

  async declineSlot(transferId: string, slot: TransferSlot, endReason: TransferEndReason, endActor: TransferEndActor, now: Date, event?: Omit<NewTransferEvent, 'transferId'>): Promise<number> {
    assertTransferSlot(slot);
    const at = now.toISOString();
    return this.endTransfer(transferId, event, () =>
      this.casTransfer(transferId, isOpenTransfer, (t) => {
        const next: StoredTransfer = { ...t, status: 'declined', endReason, endActor, endedAt: at, updatedAt: at };
        if (slot === 'learner') next.learner = { ...t.learner, state: 'declined' };
        else if (slot === 'source') next.source = { ...t.source, state: 'declined' };
        else if (slot === 'destination') next.destination = { ...t.destination, state: 'declined' };
        return next;
      }),
    );
  }

  async cancelTransfer(transferId: string, endReason: TransferEndReason, endActor: TransferEndActor, now: Date, event?: Omit<NewTransferEvent, 'transferId'>): Promise<number> {
    const at = now.toISOString();
    return this.endTransfer(transferId, event, () => this.casTransfer(transferId, isOpenTransfer, (t) => ({ ...t, status: 'cancelled', endReason, endActor, endedAt: at, updatedAt: at })));
  }

  /** The ending CAS and its event as one step: the event is checked first (the CHECK of migration 0005), so a bad one changes nothing. */
  private endTransfer(transferId: string, event: Omit<NewTransferEvent, 'transferId'> | undefined, cas: () => number): number {
    if (event) assertTransferEventChecks(event);
    const changed = cas();
    if (changed === 1 && event) this.pushTransferEvent({ ...event, transferId });
    return changed;
  }

  async expireTransfer(transferId: string, now: Date, event?: Omit<NewTransferEvent, 'transferId'>): Promise<number> {
    const at = now.toISOString();
    return this.endTransfer(transferId, event, () =>
      this.casTransfer(
        transferId,
        (t) => isOpenTransfer(t) && t.expiresAt <= at,
        (t) => ({ ...t, status: 'expired', endReason: 'expired', endActor: 'system', endedAt: at, updatedAt: at }),
      ),
    );
  }

  async markSourceNotRequired(transferId: string, now: Date): Promise<number> {
    return this.casTransfer(
      transferId,
      (t) => isOpenTransfer(t) && t.source.state === 'pending',
      (t) => ({ ...t, source: { ...t.source, state: 'not_required' }, updatedAt: now.toISOString() }),
    );
  }

  async promoteTransfer(transferId: string, now: Date): Promise<number> {
    const at = now.toISOString();
    return this.casTransfer(transferId, (t) => t.status === 'requested' && allSlotsIn(t), (t) => ({ ...t, status: 'approved', approvedAt: at, updatedAt: at }));
  }

  async blockTransfer(transferId: string, reason: TransferBlockReason, now: Date): Promise<number> {
    return this.casTransfer(transferId, (t) => t.status === 'approved' && t.blockReason !== reason, (t) => ({ ...t, blockReason: reason, updatedAt: now.toISOString() }));
  }

  async resetLearnerConsent(transferId: string, why: ConsentResetReason, now: Date, expectedRev?: number): Promise<number> {
    const at = now.toISOString();
    const changed = this.casTransfer(
      transferId,
      (t) => isOpenTransfer(t) && t.learner.state === 'consented' && (expectedRev === undefined || t.rev === expectedRev),
      (t) => ({ ...t, learner: { ...EMPTY_LEARNER_SLOT }, status: 'requested', approvedAt: null, executeAfter: null, blockReason: null, updatedAt: at }),
    );
    if (changed === 1) this.pushTransferEvent({ transferId, at, actorKind: 'system', actorRef: null, event: 'consent_reset', slot: 'learner', detail: { why } });
    return changed;
  }

  async executeTransfer(input: ExecuteTransferInput): Promise<ExecuteTransferResult> {
    const at = input.now.toISOString();
    const { id: transferId, learnerId, sourceSpaceId: source, destSpaceId: dest } = input;
    const row = this.transfers.get(transferId);
    const sourceSpace = this.spaces.get(source);
    const destSpace = this.spaces.get(dest);
    const isMember = (spaceId: string): boolean => this.memberships.has(membershipKey(spaceId, 'learner', learnerId));
    const learnersIn = (spaceId: string): number => [...this.memberships.values()].filter((m) => m.spaceId === spaceId && m.memberKind === 'learner').length;
    const otherLiveClasses = [...this.memberships.values()].filter((m) => {
      const s = this.spaces.get(m.spaceId);
      return m.memberKind === 'learner' && m.memberId === learnerId && s?.kind === 'class' && s.archivedAt === null && m.spaceId !== source;
    }).length;
    // The gate of section 4.6, evaluated on the live maps; nothing is written unless all of it holds.
    const gate =
      !!row &&
      row.learnerId === learnerId &&
      row.sourceSpaceId === source &&
      row.destSpaceId === dest &&
      source !== dest &&
      row.status === 'approved' &&
      row.expiresAt > at &&
      row.executeAfter !== null &&
      row.executeAfter <= at &&
      allSlotsIn(row) &&
      this.learners.has(learnerId) &&
      isMember(source) &&
      sourceSpace?.kind === 'class' &&
      destSpace?.kind === 'class' &&
      destSpace.archivedAt === null &&
      (isMember(dest) || (learnersIn(dest) < finiteCap(input.destCap) && otherLiveClasses < finiteCap(input.learnerCap) && this.schoolSeatFree(input.destSchoolId, input.destSchoolCap, learnerId)));
    if (!gate || !row) return { executed: false, devicesRevoked: 0, relinksClosed: 0 };

    this.transfers.set(transferId, { ...row, status: 'executed', executedAt: at, blockReason: null, updatedAt: at, rev: row.rev + 1 });
    const swapped = this.swapClassMembership(learnerId, source, dest, at);
    this.pushTransferEvent({ transferId, at, actorKind: 'system', actorRef: null, event: 'executed', slot: null, detail: null });
    return { executed: true, ...swapped };
  }

  /**
   * The writes of a class swap after its gate (F-SPACE-002 section 4.6, shared by [TV] teacher moves): the destination
   * membership, the source membership, the source's re-links and class devices, and the source's notes.
   */
  private swapClassMembership(learnerId: string, source: string, dest: string, at: string): { devicesRevoked: number; relinksClosed: number } {
    const isMember = (spaceId: string): boolean => this.memberships.has(membershipKey(spaceId, 'learner', learnerId));
    if (!isMember(dest)) this.memberships.set(membershipKey(dest, 'learner', learnerId), { spaceId: dest, memberKind: 'learner', memberId: learnerId, role: 'student', joinedAt: at });
    this.memberships.delete(membershipKey(source, 'learner', learnerId));
    let relinksClosed = 0;
    for (const [k, r] of this.relinks) {
      if (r.spaceId === source && r.learnerId === learnerId && r.status === 'pending') {
        this.relinks.set(k, { ...r, status: 'denied', decidedAt: at });
        relinksClosed += 1;
      }
    }
    const approved = [...this.relinks.values()].filter((r) => r.learnerId === learnerId && r.status === 'approved');
    const viaSource = new Set(approved.filter((r) => r.spaceId === source).map((r) => r.deviceId));
    const viaOtherClass = new Set(approved.filter((r) => r.spaceId !== source && isMember(r.spaceId)).map((r) => r.deviceId));
    let devicesRevoked = 0;
    for (const [k, d] of this.devices) {
      if (d.learnerId === learnerId && d.scope === 'class' && viaSource.has(d.deviceId) && !viaOtherClass.has(d.deviceId)) {
        this.devices.delete(k);
        devicesRevoked += 1;
      }
    }
    // F-FEEDBACK-001 section 7.5: the source membership ended, so its live, hidden and withdrawn notes go (not one a report row names).
    for (const n of [...this.notes.values()]) if (n.learnerId === learnerId && n.spaceId === source && n.status !== 'reported' && !this.hasReportRow(n.id)) this.deleteNoteRow(n.id);
    return { devicesRevoked, relinksClosed };
  }

  async getTransfer(transferId: string): Promise<StoredTransfer | null> {
    return clone(this.transfers.get(transferId) ?? null);
  }
  async transfersOfSpace(spaceId: string, role: 'source' | 'destination', limit: number): Promise<StoredTransfer[]> {
    const rows = [...this.transfers.values()].filter((t) => (role === 'source' ? t.sourceSpaceId : t.destSpaceId) === spaceId);
    return clone(rows.sort(newestFirst).slice(0, limit));
  }
  async openTransfersOfSpaces(spaceIds: readonly string[], role: 'source' | 'destination'): Promise<StoredTransfer[]> {
    const ids = new Set(spaceIds);
    return clone([...this.transfers.values()].filter((t) => ids.has(role === 'source' ? t.sourceSpaceId : t.destSpaceId) && isOpenTransfer(t)).sort(newestFirst));
  }
  async transfersOfLearner(learnerId: string): Promise<StoredTransfer[]> {
    return clone([...this.transfers.values()].filter((t) => t.learnerId === learnerId).sort(newestFirst));
  }
  async openTransferOf(learnerId: string): Promise<StoredTransfer | null> {
    return clone([...this.transfers.values()].find((t) => t.learnerId === learnerId && isOpenTransfer(t)) ?? null);
  }
  async lastLearnerRefusal(learnerId: string, since: Date): Promise<StoredTransfer | null> {
    const from = since.toISOString();
    const rows = [...this.transfers.values()].filter((t) => t.learnerId === learnerId && t.initiator === 'source' && (t.endReason === 'declined_learner' || t.endReason === 'withdrawn_learner') && t.endedAt !== null && t.endedAt >= from);
    return clone(rows.sort(latestEnded)[0] ?? null);
  }
  async lastCooldownDecline(learnerId: string, destSpaceId: string, since: Date): Promise<StoredTransfer | null> {
    const from = since.toISOString();
    const rows = [...this.transfers.values()].filter(
      (t) => t.learnerId === learnerId && t.destSpaceId === destSpaceId && t.initiator === 'learner_side' && (t.endReason === 'declined_source' || t.endReason === 'declined_destination') && t.endedAt !== null && t.endedAt >= from,
    );
    return clone(rows.sort(latestEnded)[0] ?? null);
  }
  async countTransfersCreatedBy(accountId: string, since: Date): Promise<number> {
    const from = since.toISOString();
    return [...this.transfers.values()].filter((t) => t.initiatorAccountId === accountId && t.createdAt >= from).length;
  }
  async countTransfersCreatedForLearner(learnerId: string, since: Date): Promise<number> {
    const from = since.toISOString();
    return [...this.transfers.values()].filter((t) => t.learnerId === learnerId && t.createdAt >= from).length;
  }
  async countOpenTransfersTo(spaceId: string, now?: Date): Promise<number> {
    const at = now?.toISOString();
    return [...this.transfers.values()].filter((t) => t.destSpaceId === spaceId && isOpenTransfer(t) && (at === undefined || t.expiresAt > at)).length;
  }
  async transferEvents(transferId: string): Promise<TransferEvent[]> {
    return clone(this.transferEventRows.filter((e) => e.transferId === transferId));
  }
  async addTransferEvent(event: NewTransferEvent): Promise<void> {
    if (!this.transfers.has(event.transferId)) throw new Error('FOREIGN KEY constraint failed: transfer_events.transfer_id');
    this.pushTransferEvent(event);
  }
  async getLearners(ids: readonly string[]): Promise<Learner[]> {
    return clone([...new Set(ids)].flatMap((learnerId) => this.learners.get(learnerId) ?? []));
  }
  async getSpaces(ids: readonly string[]): Promise<Space[]> {
    return clone([...new Set(ids)].flatMap((spaceId) => this.spaces.get(spaceId) ?? []));
  }
  async getAccounts(ids: readonly string[]): Promise<Account[]> {
    return clone([...new Set(ids)].flatMap((accountId) => this.accounts.get(accountId) ?? []));
  }
  async purgeTransfers(endedBefore: Date, executedBefore: Date, limit: number): Promise<number> {
    const ended = endedBefore.toISOString();
    const executed = executedBefore.toISOString();
    const doomed = [...this.transfers.values()]
      .filter(
        (t) =>
          (isEndedTransfer(t) && t.endedAt !== null && t.endedAt < ended) ||
          (t.status === 'executed' && t.executedAt !== null && t.executedAt < executed && !this.memberships.has(membershipKey(t.destSpaceId, 'learner', t.learnerId))),
      )
      .map((t) => t.id)
      .sort()
      .slice(0, limit);
    const gone = new Set(doomed);
    this.transferEventRows = this.transferEventRows.filter((e) => !gone.has(e.transferId));
    for (const transferId of doomed) this.transfers.delete(transferId);
    return doomed.length;
  }
  async recordRateHit(key: string, at: Date): Promise<void> {
    this.rateHitSeq += 1;
    this.rateHits.push({ id: this.rateHitSeq, key, at: at.toISOString() });
  }
  async countRateHits(key: string, since: Date): Promise<number> {
    const from = since.toISOString();
    return this.rateHits.filter((h) => h.key === key && h.at >= from).length;
  }
  async purgeRateHits(before: Date, limit: number): Promise<number> {
    const cutoff = before.toISOString();
    const doomed = new Set(this.rateHits.filter((h) => h.at < cutoff).slice(0, limit).map((h) => h.id));
    this.rateHits = this.rateHits.filter((h) => !doomed.has(h.id));
    return doomed.size;
  }
  async getTransferPrefs(learnerId: string): Promise<TransferPrefs> {
    return clone(this.transferPrefs.get(learnerId) ?? { selfManaged: false, blockTeacherRequests: false, updatedAt: null });
  }
  async setTransferPref(learnerId: string, which: TransferPrefKey, value: boolean, now: Date): Promise<void> {
    assertTransferPrefKey(which);
    if (!this.learners.has(learnerId)) throw new Error('FOREIGN KEY constraint failed: learner_transfer_prefs.learner_id');
    const current = this.transferPrefs.get(learnerId) ?? { selfManaged: false, blockTeacherRequests: false, updatedAt: null };
    this.transferPrefs.set(learnerId, { ...current, [which]: value, updatedAt: now.toISOString() });
  }

  async recordBillingEvent(input: BillingEventInput, now: Date): Promise<BillingEvent> {
    const row = billingEventFields(input);
    const k = billingEventKey(row.provider, row.providerRef, row.kind);
    const stored = this.billingEvents.get(k) ?? { ...row, id: id('bev'), createdAt: now.toISOString() };
    const next = stored.paymentRef === null && row.paymentRef !== null ? { ...stored, paymentRef: row.paymentRef } : stored;
    this.billingEvents.set(k, next);
    return clone(next);
  }
  async billingEventsFor(subjectKind: BillingEvent['subjectKind'], subjectId: string, limit: number): Promise<BillingEvent[]> {
    assertBillingLimit(limit);
    return clone([...this.billingEvents.values()].filter((e) => e.subjectKind === subjectKind && e.subjectId === subjectId).sort(newestBillingEvent).slice(0, limit));
  }
  async billingEventById(eventId: string): Promise<BillingEvent | null> {
    return clone([...this.billingEvents.values()].find((e) => e.id === eventId) ?? null);
  }
  async billingEventByRef(provider: BillingEvent['provider'], providerRef: string, kind?: BillingEventKind): Promise<BillingEvent | null> {
    const rows = [...this.billingEvents.values()].filter((e) => e.provider === provider && e.providerRef === providerRef && (kind === undefined || e.kind === kind));
    return clone(rows.sort(newestBillingEvent)[0] ?? null);
  }
  async billingEventByPaymentRef(paymentRef: string): Promise<BillingEvent | null> {
    return clone([...this.billingEvents.values()].filter((e) => e.paymentRef === paymentRef && REFUNDABLE_BILLING_KINDS.includes(e.kind)).sort(newestBillingEvent)[0] ?? null);
  }
  async entitlementByProviderRef(provider: Entitlement['provider'], providerRef: string): Promise<Entitlement | null> {
    const rows = [...this.entitlements.values()].filter((e) => e.provider === provider && e.providerRef === providerRef);
    rows.sort((a, b) => (a.updatedAt === b.updatedAt ? (a.id < b.id ? 1 : a.id > b.id ? -1 : 0) : a.updatedAt < b.updatedAt ? 1 : -1));
    return clone(rows[0] ?? null);
  }
  async entitlementsForSpaces(spaceIds: readonly string[]): Promise<Entitlement[]> {
    const ids = new Set(spaceIds);
    return clone([...this.entitlements.values()].filter((e) => e.subjectKind === 'space' && ids.has(e.subjectId)));
  }
  async membersOfSpaces(spaceIds: readonly string[]): Promise<Membership[]> {
    const ids = new Set(spaceIds);
    return clone([...this.memberships.values()].filter((m) => ids.has(m.spaceId)));
  }
  async childSpacesOfSpaces(parentSpaceIds: readonly string[]): Promise<Space[]> {
    const ids = new Set(parentSpaceIds);
    return clone([...this.spaces.values()].filter((s) => s.parentSpaceId !== null && ids.has(s.parentSpaceId)));
  }
  async billingEventsForSpaces(spaceIds: readonly string[], limitPerSpace: number): Promise<BillingEvent[]> {
    assertBillingLimit(limitPerSpace);
    const ids = new Set(spaceIds);
    const bySpace = new Map<string, BillingEvent[]>();
    for (const e of this.billingEvents.values()) {
      if (e.subjectKind !== 'space' || !ids.has(e.subjectId)) continue;
      bySpace.set(e.subjectId, [...(bySpace.get(e.subjectId) ?? []), e]);
    }
    return clone([...bySpace.values()].flatMap((rows) => rows.sort(newestBillingEvent).slice(0, limitPerSpace)));
  }

  // ---- notes from grown-ups (F-FEEDBACK-001 section 7.4) ----
  // Mirrors the SQL of D1Db: each method checks and writes with no await in between.

  /** Deletes a note and its reports (ON DELETE CASCADE). */
  private deleteNoteRow(noteId: string): void {
    this.notes.delete(noteId);
    for (const [k, r] of this.noteReports) if (r.noteId === noteId) this.noteReports.delete(k);
  }
  /** Whether any report row names this note (a reviewed note keeps its reports when a membership ends, section 7.5). */
  private hasReportRow(noteId: string): boolean {
    return [...this.noteReports.values()].some((r) => r.noteId === noteId);
  }
  private activeHold(accountId: string): boolean {
    const hold = this.senderHolds.get(accountId);
    return !!hold && hold.liftedAt === null;
  }
  private isVisible(n: StoredNote, now: Date): boolean {
    const cuts = noteRetentionCuts(now);
    if (n.status !== 'reported') return n.createdAt >= cuts.notesSince;
    return [...this.noteReports.values()].some((r) => r.noteId === n.id && r.createdAt >= cuts.reportsSince);
  }
  private roleOf(spaceId: string, accountId: string): Membership['role'] | null {
    return this.memberships.get(membershipKey(spaceId, 'account', accountId))?.role ?? null;
  }
  /** Rule 6 of section 6.8: the sender still holds `feedback.send` in the note's space. */
  private senderMaySend(n: StoredNote, space: Space): boolean {
    const role = this.roleOf(n.spaceId, n.senderAccountId);
    if (space.kind === 'class') return n.senderRole === 'teacher' && (role === 'teacher' || role === 'owner');
    if (space.kind === 'family') return n.senderRole === 'family' && (role === 'owner' || (role === 'caregiver' && this.sendGrants.has(pairKey(n.spaceId, n.senderAccountId))));
    return false;
  }

  async studentsOf(spaceId: string, learnerIds: readonly string[]): Promise<string[]> {
    return [...new Set(learnerIds)].filter((learnerId) => this.memberships.get(membershipKey(spaceId, 'learner', learnerId))?.role === 'student');
  }
  async notePrefsFor(learnerIds: readonly string[]): Promise<StoredNotePrefs[]> {
    return clone([...new Set(learnerIds)].flatMap((learnerId) => this.notePrefs.get(learnerId) ?? []));
  }
  async noteRecipients(spaceId: string, senderAccountId: string): Promise<NoteRecipientRow[]> {
    const rows = [...this.memberships.values()]
      .filter((m) => m.spaceId === spaceId && m.memberKind === 'learner' && m.role === 'student' && this.learners.has(m.memberId))
      .sort((a, b) => (a.joinedAt === b.joinedAt ? (a.memberId < b.memberId ? -1 : 1) : a.joinedAt < b.joinedAt ? -1 : 1));
    return rows.map((m) => ({
      learnerId: m.memberId,
      displayName: this.learners.get(m.memberId)?.displayName ?? '',
      classes: this.notePrefs.get(m.memberId)?.classes ?? 'all',
      blocked: this.senderBlocks.has(pairKey(m.memberId, senderAccountId)),
    }));
  }
  async blocksFor(learnerIds: readonly string[], senderAccountId: string): Promise<string[]> {
    return [...new Set(learnerIds)].filter((learnerId) => this.senderBlocks.has(pairKey(learnerId, senderAccountId)));
  }
  async countRateHitsByKeys(keys: readonly string[], since: Date): Promise<Map<string, number>> {
    const wanted = new Set(keys);
    const from = since.toISOString();
    const out = new Map<string, number>();
    for (const h of this.rateHits) if (wanted.has(h.key) && h.at >= from) out.set(h.key, (out.get(h.key) ?? 0) + 1);
    return out;
  }
  async addRateHits(rows: readonly RateHitRow[]): Promise<void> {
    for (const r of rows) {
      this.rateHitSeq += 1;
      this.rateHits.push({ id: this.rateHitSeq, key: r.key, at: r.at });
    }
  }
  async insertNotes(rows: readonly NewNote[], rateHits: readonly RateHitRow[]): Promise<number> {
    const sender = assertOneSender(rows);
    if (sender === null || this.activeHold(sender)) return 0;
    // Every row is checked before any is written: one transaction on D1.
    const next = rows.map((n): StoredNote => ({ ...clone(n), status: 'live', hiddenVia: null, actedByAccountId: null, readAt: null, reaction: null, reactionAt: null, hiddenAt: null, withdrawnAt: null }));
    const seen = new Set<string>();
    for (const n of next) {
      if (this.notes.has(n.id) || seen.has(n.id)) throw new Error('UNIQUE constraint failed: feedback_notes.id');
      seen.add(n.id);
      if (!this.learners.has(n.learnerId) || !this.spaces.has(n.spaceId)) throw new Error('FOREIGN KEY constraint failed: feedback_notes');
      assertNoteChecks(n);
    }
    for (const n of next) this.notes.set(n.id, n);
    await this.addRateHits(rateHits);
    return next.length;
  }
  async notesForLearner(learnerId: string, scope: NoteDeviceScope, now: Date, limit: number): Promise<LearnerNotesInbox> {
    const { notesSince } = noteRetentionCuts(now);
    const prefs = this.notePrefs.get(learnerId) ?? null;
    const mode = prefs?.classes ?? 'all';
    const delivered = [...this.notes.values()].filter((n) => {
      const space = this.spaces.get(n.spaceId);
      if (n.learnerId !== learnerId || n.status !== 'live' || n.createdAt < notesSince || !space) return false;
      if (this.memberships.get(membershipKey(n.spaceId, 'learner', learnerId))?.role !== 'student' || space.archivedAt !== null) return false;
      if (scope !== 'full' && space.kind !== 'class') return false;
      if (n.senderRole !== 'family' && mode === 'off') return false;
      if (this.senderBlocks.has(pairKey(learnerId, n.senderAccountId))) return false;
      return this.senderMaySend(n, space);
    });
    const notes = delivered
      .sort(newestNoteFirst)
      .slice(0, limit)
      .map(
        (n): DeliveredNote => ({
          id: n.id,
          spaceId: n.spaceId,
          senderRole: n.senderRole,
          senderLabel: n.senderLabel,
          presetId: n.presetId,
          body: n.senderRole === 'teacher' && mode === 'presets' ? null : n.body,
          bodyLocale: n.bodyLocale,
          suggest: n.suggest,
          createdAt: n.createdAt,
          readAt: n.readAt,
          reaction: n.reaction,
        }),
      );
    return { notes: clone(notes), prefs: clone(prefs) };
  }
  async notesForSpace(spaceId: string, options: { before: NoteCursor | null; limit: number; now: Date; learnerId?: string }): Promise<StoredNote[]> {
    const rows = [...this.notes.values()].filter(
      (n) => n.spaceId === spaceId && (options.learnerId === undefined || n.learnerId === options.learnerId) && beforeCursor(n, options.before) && this.isVisible(n, options.now),
    );
    return clone(rows.sort(newestNoteFirst).slice(0, options.limit));
  }
  async sentListOfSpace(spaceId: string, options: { before: NoteCursor | null; limit: number; now: Date }): Promise<SpaceNoteListRow[]> {
    // Map order is insertion order, the rowid order of D1: a batch's first note is its first visible one.
    const visible = [...this.notes.values()].filter((n) => n.spaceId === spaceId && this.isVisible(n, options.now));
    const batches = new Map<string, StoredNote[]>();
    for (const n of visible) if (n.batchKind === 'everyone') batches.set(n.batchId, [...(batches.get(n.batchId) ?? []), n]);
    const rows: SpaceNoteListRow[] = [];
    for (const n of visible) {
      if (n.batchKind !== 'everyone') {
        rows.push({ note: n, batch: null });
        continue;
      }
      const all = batches.get(n.batchId) ?? [];
      if (all[0]?.id === n.id) rows.push({ note: n, batch: { size: all.length, live: all.filter((x) => x.status === 'live').length, withdrawn: all.filter((x) => x.withdrawnAt !== null).length } });
    }
    const page = rows.filter((r) => beforeCursor(r.note, options.before)).sort((a, b) => newestNoteFirst(a.note, b.note)).slice(0, options.limit);
    return clone(page);
  }
  async notesForOversight(learnerId: string, options: { before: NoteCursor | null; limit: number; now: Date }): Promise<StoredNote[]> {
    const rows = [...this.notes.values()].filter((n) => n.learnerId === learnerId && beforeCursor(n, options.before) && this.isVisible(n, options.now));
    return clone(rows.sort(newestNoteFirst).slice(0, options.limit));
  }
  async getNote(noteId: string): Promise<StoredNote | null> {
    return clone(this.notes.get(noteId) ?? null);
  }
  /** One-row compare-and-set: `guard` must hold; answers rows changed. */
  private casNote(noteId: string, guard: (n: StoredNote) => boolean, change: (n: StoredNote) => StoredNote): number {
    const row = this.notes.get(noteId);
    if (!row || !guard(row)) return 0;
    const next = change(clone(row));
    assertNoteChecks(next);
    this.notes.set(noteId, next);
    return 1;
  }
  async setNoteRead(noteId: string, at: Date): Promise<number> {
    return this.casNote(noteId, (n) => n.status === 'live' && n.readAt === null, (n) => ({ ...n, readAt: at.toISOString() }));
  }
  async setNoteReaction(noteId: string, reaction: string, at: Date): Promise<number> {
    return this.casNote(noteId, (n) => n.status === 'live', (n) => ({ ...n, reaction, reactionAt: at.toISOString() }));
  }
  async hideNote(noteId: string, via: NoteActVia, at: Date, actedBy?: string): Promise<number> {
    return this.casNote(
      noteId,
      (n) => n.status === 'live',
      (n) => ({ ...n, status: 'hidden', hiddenVia: via, hiddenAt: at.toISOString(), actedByAccountId: via === 'family' ? (actedBy ?? null) : null }),
    );
  }
  async withdrawNote(noteId: string, at: Date): Promise<number> {
    return this.casNote(noteId, (n) => n.status === 'live', (n) => ({ ...n, status: 'withdrawn', withdrawnAt: at.toISOString() }));
  }
  async withdrawBatch(batchId: string, senderAccountId: string, at: Date): Promise<number> {
    let changed = 0;
    for (const n of [...this.notes.values()]) {
      if (n.batchId === batchId && n.senderAccountId === senderAccountId) changed += this.casNote(n.id, (x) => x.status === 'live', (x) => ({ ...x, status: 'withdrawn', withdrawnAt: at.toISOString() }));
    }
    return changed;
  }
  async insertNoteReport(r: StoredNoteReport): Promise<boolean> {
    const note = this.notes.get(r.noteId);
    // within retention at the report time (section 8.7), or nothing is written
    if (!note || !this.isVisible(note, new Date(r.createdAt))) return false;
    if (this.noteReports.has(r.id)) throw new Error('UNIQUE constraint failed: feedback_reports.id');
    if (!this.learners.has(r.learnerId)) throw new Error('FOREIGN KEY constraint failed: feedback_reports');
    this.noteReports.set(r.id, clone(r));
    this.casNote(r.noteId, () => true, (n) => ({ ...n, status: 'reported' }));
    return true;
  }
  async reportsForNotes(noteIds: readonly string[]): Promise<StoredNoteReport[]> {
    const wanted = new Set(noteIds);
    const rows = [...this.noteReports.values()].filter((r) => wanted.has(r.noteId));
    rows.sort((a, b) => (a.createdAt === b.createdAt ? (a.id < b.id ? -1 : 1) : a.createdAt < b.createdAt ? -1 : 1));
    return clone(rows);
  }
  async countReportersAgainst(accountId: string, since: Date): Promise<number> {
    const from = since.toISOString();
    return new Set([...this.noteReports.values()].filter((r) => r.senderAccountId === accountId && r.createdAt >= from && r.outcome !== 'restored').map((r) => r.reporterKey)).size;
  }
  async getSenderHold(accountId: string): Promise<StoredSenderHold | null> {
    return clone(this.senderHolds.get(accountId) ?? null);
  }
  async putSenderHold(h: StoredSenderHold): Promise<boolean> {
    if (this.activeHold(h.accountId)) return false;
    this.senderHolds.set(h.accountId, clone(h));
    return true;
  }
  async getNotePrefs(learnerId: string): Promise<StoredNotePrefs | null> {
    return clone(this.notePrefs.get(learnerId) ?? null);
  }
  async putNotePrefs(p: StoredNotePrefs): Promise<void> {
    if (!this.learners.has(p.learnerId)) throw new Error('FOREIGN KEY constraint failed: learner_note_prefs.learner_id');
    const acknowledgedAt = p.acknowledgedAt ?? this.notePrefs.get(p.learnerId)?.acknowledgedAt ?? null;
    this.notePrefs.set(p.learnerId, clone({ ...p, acknowledgedAt }));
  }
  async putBlock(b: StoredSenderBlock): Promise<void> {
    if (!this.learners.has(b.learnerId) || !this.spaces.has(b.familySpaceId)) throw new Error('FOREIGN KEY constraint failed: feedback_sender_blocks');
    const k = pairKey(b.learnerId, b.senderAccountId);
    if (!this.senderBlocks.has(k)) this.senderBlocks.set(k, clone(b));
  }
  async deleteBlock(learnerId: string, senderAccountId: string): Promise<boolean> {
    return this.senderBlocks.delete(pairKey(learnerId, senderAccountId));
  }
  async listBlocks(learnerId: string): Promise<StoredSenderBlock[]> {
    const rows = [...this.senderBlocks.values()].filter((b) => b.learnerId === learnerId);
    rows.sort((a, b) => (a.createdAt === b.createdAt ? (a.senderAccountId < b.senderAccountId ? 1 : -1) : a.createdAt < b.createdAt ? 1 : -1));
    return clone(rows);
  }
  async getSendGrant(spaceId: string, accountId: string): Promise<StoredSendGrant | null> {
    return clone(this.sendGrants.get(pairKey(spaceId, accountId)) ?? null);
  }
  async putSendGrant(g: StoredSendGrant): Promise<void> {
    if (!this.spaces.has(g.spaceId)) throw new Error('FOREIGN KEY constraint failed: feedback_send_grants.space_id');
    this.sendGrants.set(pairKey(g.spaceId, g.accountId), clone(g));
  }
  async deleteSendGrant(spaceId: string, accountId: string): Promise<boolean> {
    return this.sendGrants.delete(pairKey(spaceId, accountId));
  }
  async deleteNotesForMembership(learnerId: string, spaceId: string): Promise<number> {
    const doomed = [...this.notes.values()].filter((n) => n.learnerId === learnerId && n.spaceId === spaceId && n.status !== 'reported' && !this.hasReportRow(n.id));
    for (const n of doomed) this.deleteNoteRow(n.id);
    return doomed.length;
  }
  async purgeNotes(before: Date, reportedBefore: Date, liftedBefore: Date, limit: number): Promise<number> {
    const cut = before.toISOString();
    const reportCut = reportedBefore.toISOString();
    const liftCut = liftedBefore.toISOString();
    const old = [...this.notes.values()].filter((n) => n.status !== 'reported' && n.createdAt < cut).sort(oldestNoteFirst).slice(0, limit);
    for (const n of old) this.deleteNoteRow(n.id);
    const stale = [...this.notes.values()]
      .filter((n) => n.status === 'reported' && ![...this.noteReports.values()].some((r) => r.noteId === n.id && r.createdAt >= reportCut))
      .sort(oldestNoteFirst)
      .slice(0, limit);
    for (const n of stale) this.deleteNoteRow(n.id);
    const reports = [...this.noteReports.values()]
      .filter((r) => r.createdAt < reportCut && this.notes.get(r.noteId)?.status !== 'reported')
      .sort((a, b) => (a.createdAt === b.createdAt ? (a.id < b.id ? -1 : 1) : a.createdAt < b.createdAt ? -1 : 1))
      .slice(0, limit);
    for (const r of reports) this.noteReports.delete(r.id);
    const holds = [...this.senderHolds.values()]
      .filter((h) => h.liftedAt !== null && h.liftedAt < liftCut)
      .sort((a, b) => ((a.liftedAt ?? '') === (b.liftedAt ?? '') ? (a.accountId < b.accountId ? -1 : 1) : (a.liftedAt ?? '') < (b.liftedAt ?? '') ? -1 : 1))
      .slice(0, limit);
    for (const h of holds) this.senderHolds.delete(h.accountId);
    return old.length + stale.length + reports.length + holds.length;
  }

  // ---- [TV] class-scope acknowledgements and teacher moves (AMENDMENTS-TEACHER-VISIBILITY-TRANSFER section 4.2) ----

  async getClassScopeAck(learnerId: string): Promise<StoredClassScopeAck | null> {
    return clone(this.classScopeAcks.get(learnerId) ?? null);
  }
  async classScopeAcksOf(learnerIds: readonly string[]): Promise<StoredClassScopeAck[]> {
    return clone([...new Set(learnerIds)].flatMap((id) => {
      const ack = this.classScopeAcks.get(id);
      return ack ? [ack] : [];
    }));
  }
  async putClassScopeAck(ack: StoredClassScopeAck): Promise<void> {
    this.classScopeAcks.set(ack.learnerId, clone(ack));
  }
  async createClassMove(row: StoredClassMove): Promise<'created' | 'already_open'> {
    assertNewClassMove(row);
    if ([...this.classMoves.values()].some((m) => m.learnerId === row.learnerId && m.status === 'requested')) return 'already_open';
    if (this.classMoves.has(row.id)) throw new Error('createClassMove: duplicate id');
    this.classMoves.set(row.id, clone(row));
    return 'created';
  }
  async getClassMove(id: string): Promise<StoredClassMove | null> {
    return clone(this.classMoves.get(id) ?? null);
  }
  async classMovesOfSpace(spaceId: string, role: 'source' | 'destination', limit: number): Promise<StoredClassMove[]> {
    const rows = [...this.classMoves.values()].filter((m) => (role === 'source' ? m.sourceSpaceId : m.destSpaceId) === spaceId);
    return clone(rows.sort(newestMoveFirst).slice(0, limit));
  }
  async openClassMoveOf(learnerId: string): Promise<StoredClassMove | null> {
    return clone([...this.classMoves.values()].find((m) => m.learnerId === learnerId && m.status === 'requested') ?? null);
  }
  async executedClassMovesOf(learnerIds: readonly string[], since: Date): Promise<StoredClassMove[]> {
    const ids = new Set(learnerIds);
    const from = since.toISOString();
    const rows = [...this.classMoves.values()].filter((m) => ids.has(m.learnerId) && m.status === 'executed' && m.executedAt !== null && m.executedAt >= from);
    return clone(rows.sort((a, b) => ((a.executedAt ?? '') === (b.executedAt ?? '') ? (a.id < b.id ? 1 : -1) : (a.executedAt ?? '') < (b.executedAt ?? '') ? 1 : -1)));
  }
  async endClassMove(id: string, status: ClassMoveEndStatus, reason: ClassMoveEndReason, decider: ClassMoveDecider | null, now: Date): Promise<number> {
    const at = now.toISOString();
    const row = this.classMoves.get(id);
    if (!row || row.status !== 'requested' || (status === 'expired' && row.expiresAt > at)) return 0;
    this.classMoves.set(id, { ...row, status, endReason: reason, endedAt: at, updatedAt: at, decidedAccountId: decider?.accountId ?? row.decidedAccountId, decidedVia: decider?.via ?? row.decidedVia });
    return 1;
  }
  async markClassMoveSeen(id: string, now: Date): Promise<number> {
    const row = this.classMoves.get(id);
    if (!row || row.status !== 'executed' || row.familySeenAt !== null) return 0;
    this.classMoves.set(id, { ...row, familySeenAt: now.toISOString() });
    return 1;
  }
  async executeClassMove(input: ExecuteClassMoveInput): Promise<ExecuteClassMoveResult> {
    const at = input.now.toISOString();
    const { id, learnerId, sourceSpaceId: source, destSpaceId: dest } = input;
    const row = this.classMoves.get(id);
    const sourceSpace = this.spaces.get(source);
    const destSpace = this.spaces.get(dest);
    const isMember = (spaceId: string): boolean => this.memberships.has(membershipKey(spaceId, 'learner', learnerId));
    const learnersIn = (spaceId: string): number => [...this.memberships.values()].filter((m) => m.spaceId === spaceId && m.memberKind === 'learner').length;
    const otherLiveClasses = [...this.memberships.values()].filter((m) => {
      const s = this.spaces.get(m.spaceId);
      return m.memberKind === 'learner' && m.memberId === learnerId && s?.kind === 'class' && s.archivedAt === null && m.spaceId !== source;
    }).length;
    // The gate of section 4.2, on the live maps with no await between check and write.
    const gate =
      !!row &&
      row.learnerId === learnerId &&
      row.sourceSpaceId === source &&
      row.destSpaceId === dest &&
      source !== dest &&
      row.status === 'requested' &&
      row.expiresAt > at &&
      this.learners.has(learnerId) &&
      isMember(source) &&
      sourceSpace?.kind === 'class' &&
      destSpace?.kind === 'class' &&
      destSpace.archivedAt === null &&
      (isMember(dest) || (learnersIn(dest) < finiteCap(input.destCap) && otherLiveClasses < finiteCap(input.learnerCap) && this.schoolSeatFree(input.destSchoolId, input.destSchoolCap, learnerId)));
    if (!gate || !row) return { executed: false, devicesRevoked: 0, relinksClosed: 0 };
    this.classMoves.set(id, { ...row, status: 'executed', executedAt: at, updatedAt: at, decidedAccountId: input.decider.accountId, decidedVia: input.decider.via });
    return { executed: true, ...this.swapClassMembership(learnerId, source, dest, at) };
  }
  async purgeClassMoves(endedBefore: Date, executedBefore: Date, limit: number): Promise<number> {
    const ended = endedBefore.toISOString();
    const executed = executedBefore.toISOString();
    let removed = 0;
    for (const [k, m] of this.classMoves) {
      if (removed >= limit) break;
      const old = (m.endedAt !== null && m.endedAt < ended) || (m.status === 'executed' && m.executedAt !== null && m.executedAt < executed) || (m.status === 'requested' && m.expiresAt < ended);
      if (old) {
        this.classMoves.delete(k);
        removed += 1;
      }
    }
    return removed;
  }

  async remoteConfig(): Promise<RemoteConfigRow[]> {
    return clone([...this.remoteConfigRows.values()].sort((a, b) => (a.flag < b.flag ? -1 : a.flag > b.flag ? 1 : 0)));
  }
  async putRemoteConfig(row: RemoteConfigRow): Promise<void> {
    this.remoteConfigRows.set(row.flag, clone(row));
  }
  async addRollups(day: string, keys: readonly RollupKey[], counter?: string): Promise<number> {
    const unique = uniqueRollupKeys(keys);
    if (unique.length === 0) return 0;
    const cells = this.rollups.get(day) ?? new Map<string, RollupRow>();
    const bump = (k: RollupKey, by: number): number => {
      const cell = rollupCellKey(k);
      const events = (cells.get(cell)?.events ?? 0) + by;
      cells.set(cell, { day, ...k, events });
      return events;
    };
    for (const k of unique) bump(k, 1);
    const total = counter === undefined ? 0 : bump({ metric: counter, dim: '', bucket: '' }, unique.length + 1);
    this.rollups.set(day, cells);
    return total;
  }
  async rollupRows(fromDay: string, toDay: string, metric: string | undefined, limit: number): Promise<RollupRow[]> {
    const rows: RollupRow[] = [];
    for (const [day, cells] of this.rollups) {
      if (day < fromDay || day > toDay) continue;
      for (const row of cells.values()) if (metric === undefined || row.metric === metric) rows.push({ ...row });
    }
    // '\n' sorts below every character a code holds, so this is the (day, metric, dim, bucket) order D1 answers in.
    const order = (r: RollupRow): string => `${r.day}\n${rollupCellKey(r)}`;
    return rows.sort((a, b) => (order(a) < order(b) ? -1 : order(a) > order(b) ? 1 : 0)).slice(0, limit);
  }
  async rollupRowsOf(fromDay: string, toDay: string, metrics: readonly string[], limit: number): Promise<RollupRow[]> {
    const wanted = new Set(metrics);
    return (await this.rollupRows(fromDay, toDay, undefined, Number.MAX_SAFE_INTEGER)).filter((r) => wanted.has(r.metric)).slice(0, limit);
  }
  async lowerRemoteConfigPct(flag: string, fromPct: number, fromUpdatedAt: string, toPct: number, updatedAt: string, reason: string): Promise<boolean> {
    const row = this.remoteConfigRows.get(flag);
    if (!row || !row.on || Math.floor(row.pct) !== fromPct || row.updatedAt !== fromUpdatedAt || !(toPct < row.pct)) return false;
    this.remoteConfigRows.set(flag, { ...row, pct: toPct, updatedAt, reason });
    return true;
  }

  async reset(): Promise<void> {
    this.remoteConfigRows.clear();
    for (const m of [this.accounts, this.learners, this.devices, this.snapshots, this.spaces, this.memberships, this.plans, this.relinks, this.entitlements, this.waitlist, this.transfers, this.transferPrefs, this.billingEvents, this.notes, this.noteReports, this.senderHolds, this.notePrefs, this.senderBlocks, this.sendGrants, this.classScopeAcks, this.classMoves, this.spaceEvents, this.adminInvites]) m.clear();
    this.promotedFromTeacher.clear();
    this.rollups.clear();
    this.transferEventRows = [];
    this.rateHits = [];
  }
}

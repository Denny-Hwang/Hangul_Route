import { TRANSFER_COOLING_OFF_MS, type Entitlement, type EntitlementApply, type MemberKind, type Membership, type Plan, type Space, type TransferBlockReason, type TransferEndReason, type TransferSlot } from '@hangul-route/content-schema';
import { id, type Account, type Learner, type LearnerDevice, type SnapshotRecord } from '../store';
import { allSlotsIn, assertNewTransfer, assertTransferChecks, assertTransferPrefKey, assertTransferSlot, finiteCap, isEndedTransfer, isOpenTransfer, teacherSlotsOf } from './transfer-rules';
import {
  learnerRateKeys,
  mergeEntitlement,
  type ConsentResetReason,
  type Db,
  type ExecuteTransferInput,
  type ExecuteTransferResult,
  type NewTransferEvent,
  type StoredRelink,
  type StoredTransfer,
  type TransferEndActor,
  type TransferEvent,
  type TransferPrefKey,
  type TransferPrefs,
  type TransferSlotConsent,
  type WaitlistEntry,
} from './types';

const deviceKey = (learnerId: string, deviceId: string): string => `${learnerId}|${deviceId}`;
const membershipKey = (spaceId: string, kind: MemberKind, memberId: string): string => `${spaceId}|${kind}|${memberId}`;
const entitlementKey = (kind: string, subjectId: string, planKey: string): string => `${kind}|${subjectId}|${planKey}`;

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
  private transfers = new Map<string, StoredTransfer>();
  private transferEventRows: TransferEvent[] = [];
  private transferEventSeq = 0;
  private transferPrefs = new Map<string, TransferPrefs>();
  private rateHits: Array<{ id: number; key: string; at: string }> = [];
  private rateHitSeq = 0;

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
    this.learners.set(learner.id, clone(learner));
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
    const rateKeys = new Set(learnerRateKeys(learnerId));
    this.rateHits = this.rateHits.filter((h) => !rateKeys.has(h.key));
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

  async getSpace(spaceId: string): Promise<Space | null> {
    return clone(this.spaces.get(spaceId) ?? null);
  }
  async putSpace(space: Space): Promise<void> {
    this.spaces.set(space.id, clone(space));
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
    return this.memberships.delete(membershipKey(spaceId, kind, memberId));
  }
  async membershipsOf(kind: MemberKind, memberId: string): Promise<Membership[]> {
    return clone([...this.memberships.values()].filter((m) => m.memberKind === kind && m.memberId === memberId));
  }
  async membersOf(spaceId: string): Promise<Membership[]> {
    return clone([...this.memberships.values()].filter((m) => m.spaceId === spaceId));
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
  async applyEntitlement(input: EntitlementApply, now: Date): Promise<Entitlement> {
    const k = entitlementKey(input.subjectKind, input.subjectId, input.planKey);
    const next = mergeEntitlement(this.entitlements.get(k) ?? null, input, now, () => id('ent'));
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

  async consentSlot(transferId: string, consent: TransferSlotConsent, now: Date): Promise<number> {
    const at = now.toISOString();
    if (consent.kind === 'learner') {
      const executeAfter = new Date(now.getTime() + TRANSFER_COOLING_OFF_MS).toISOString();
      return this.casTransfer(
        transferId,
        (t) => isOpenTransfer(t) && t.learner.state === 'pending',
        (t) => ({ ...t, learner: { state: 'consented', at, ...clone(consent.record) }, introduce: consent.introduce ?? t.introduce, executeAfter, updatedAt: at }),
      );
    }
    const slots = teacherSlotsOf(consent);
    const filled = { state: 'consented' as const, at, accountId: consent.accountId, via: consent.via };
    return this.casTransfer(
      transferId,
      (t) => isOpenTransfer(t) && (!slots.source || t.source.state === 'pending') && (!slots.destination || (t.destination.state === 'pending' && t.learner.state === 'consented')),
      (t) => ({ ...t, source: slots.source ? { ...filled } : t.source, destination: slots.destination ? { ...filled } : t.destination, updatedAt: at }),
    );
  }

  async declineSlot(transferId: string, slot: TransferSlot, endReason: TransferEndReason, endActor: TransferEndActor, now: Date): Promise<number> {
    assertTransferSlot(slot);
    const at = now.toISOString();
    return this.casTransfer(transferId, isOpenTransfer, (t) => {
      const next: StoredTransfer = { ...t, status: 'declined', endReason, endActor, endedAt: at, updatedAt: at };
      if (slot === 'learner') next.learner = { ...t.learner, state: 'declined' };
      else if (slot === 'source') next.source = { ...t.source, state: 'declined' };
      else if (slot === 'destination') next.destination = { ...t.destination, state: 'declined' };
      return next;
    });
  }

  async cancelTransfer(transferId: string, endReason: TransferEndReason, endActor: TransferEndActor, now: Date): Promise<number> {
    const at = now.toISOString();
    return this.casTransfer(transferId, isOpenTransfer, (t) => ({ ...t, status: 'cancelled', endReason, endActor, endedAt: at, updatedAt: at }));
  }

  async expireTransfer(transferId: string, now: Date): Promise<number> {
    const at = now.toISOString();
    return this.casTransfer(
      transferId,
      (t) => isOpenTransfer(t) && t.expiresAt <= at,
      (t) => ({ ...t, status: 'expired', endReason: 'expired', endActor: 'system', endedAt: at, updatedAt: at }),
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
    return this.casTransfer(transferId, (t) => t.status === 'approved', (t) => ({ ...t, blockReason: reason, updatedAt: now.toISOString() }));
  }

  async resetLearnerConsent(transferId: string, why: ConsentResetReason, now: Date): Promise<number> {
    const at = now.toISOString();
    const changed = this.casTransfer(
      transferId,
      (t) => isOpenTransfer(t) && t.learner.state === 'consented',
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
      (isMember(dest) || (learnersIn(dest) < finiteCap(input.destCap) && otherLiveClasses < finiteCap(input.learnerCap)));
    if (!gate || !row) return { executed: false, devicesRevoked: 0, relinksClosed: 0 };

    this.transfers.set(transferId, { ...row, status: 'executed', executedAt: at, blockReason: null, updatedAt: at, rev: row.rev + 1 });
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
    this.pushTransferEvent({ transferId, at, actorKind: 'system', actorRef: null, event: 'executed', slot: null, detail: null });
    return { executed: true, devicesRevoked, relinksClosed };
  }

  async getTransfer(transferId: string): Promise<StoredTransfer | null> {
    return clone(this.transfers.get(transferId) ?? null);
  }
  async transfersOfSpace(spaceId: string, role: 'source' | 'destination', limit: number): Promise<StoredTransfer[]> {
    const rows = [...this.transfers.values()].filter((t) => (role === 'source' ? t.sourceSpaceId : t.destSpaceId) === spaceId);
    return clone(rows.sort(newestFirst).slice(0, limit));
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
  async lastEndedForPair(learnerId: string, destSpaceId: string): Promise<StoredTransfer | null> {
    const rows = [...this.transfers.values()].filter((t) => t.learnerId === learnerId && t.destSpaceId === destSpaceId && isEndedTransfer(t));
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
  async countOpenTransfersTo(spaceId: string): Promise<number> {
    return [...this.transfers.values()].filter((t) => t.destSpaceId === spaceId && isOpenTransfer(t)).length;
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

  async reset(): Promise<void> {
    for (const m of [this.accounts, this.learners, this.devices, this.snapshots, this.spaces, this.memberships, this.plans, this.relinks, this.entitlements, this.waitlist, this.transfers, this.transferPrefs]) m.clear();
    this.transferEventRows = [];
    this.rateHits = [];
  }
}

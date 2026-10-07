import type { Entitlement, EntitlementApply, MemberKind, Membership, Plan, Space } from '@hangul-route/content-schema';
import { id, type Account, type Learner, type LearnerDevice, type SnapshotRecord } from '../store';
import { mergeEntitlement, type Db, type StoredRelink } from './types';

const deviceKey = (learnerId: string, deviceId: string): string => `${learnerId}|${deviceId}`;
const membershipKey = (spaceId: string, kind: MemberKind, memberId: string): string => `${spaceId}|${kind}|${memberId}`;
const entitlementKey = (kind: string, subjectId: string, planKey: string): string => `${kind}|${subjectId}|${planKey}`;

function clone<T>(value: T): T {
  return structuredClone(value);
}

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
    this.learners.set(learner.id, clone(learner));
  }
  async learnerByRecoveryHash(hash: string): Promise<Learner | null> {
    return clone([...this.learners.values()].find((l) => l.recoveryHash === hash) ?? null);
  }
  async deleteLearner(learnerId: string): Promise<boolean> {
    const existed = this.learners.delete(learnerId);
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
  async putSnapshot(record: SnapshotRecord): Promise<void> {
    this.snapshots.set(record.learnerId, clone(record));
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

  async reset(): Promise<void> {
    for (const m of [this.accounts, this.learners, this.devices, this.snapshots, this.spaces, this.memberships, this.plans, this.relinks, this.entitlements]) m.clear();
  }
}

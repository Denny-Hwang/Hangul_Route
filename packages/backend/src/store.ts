import type { MemberKind, Membership, Plan, Space } from '@hangul-route/content-schema';
/**
 * In-memory store. Replaced by D1 + R2 bindings when wrangler.toml binds them.
 * Schema mirrors `db/schema.sql`.
 */

export interface Family {
  id: string;
  email?: string;
  parentPinHash?: string;
  ownerId?: string;
  createdAt: string;
}

export interface Profile {
  id: string;
  familyId: string;
  displayName: string;
  ageGroup: '5-7' | '8-9' | '10-11';
  avatar: string;
  createdAt: string;
  lastActiveAt: string;
}

export interface ProgressRecord {
  profileId: string;
  updatedAt: string;
  payload: unknown;
}

export interface TelemetryEvent {
  id: string;
  profileId?: string;
  name: string;
  payload?: Record<string, unknown>;
  at: string;
}

export interface Subscription {
  familyId: string;
  status: 'none' | 'trial' | 'active' | 'expired' | 'cancelled';
  plan: 'monthly' | 'yearly' | null;
  store: 'apple' | 'google' | null;
  expiresAt: string | null;
  updatedAt: string;
}

// ---- schema v2 (F-SYNC-001, roadmap multi-persona-sync-platform §2) ------

/** A child. PII-minimal by design: nickname, age band, avatar only. */
export interface Learner {
  id: string; // profile:xxxx — the client's local id is kept when free
  displayName: string;
  ageGroup: '5-7' | '8-9' | '10-11';
  avatar: string;
  recoveryHash: string | null;
  createdAt: string;
  lastActiveAt: string;
}

/** The principal for learner traffic: a device bound to a learner. */
export interface LearnerDevice {
  learnerId: string;
  deviceId: string;
  secretHash: string;
  createdAt: string;
  lastSeenAt: string;
}

/** One row per learner: the whole ProgressSnapshot plus its summary. */
export interface SnapshotRecord {
  learnerId: string;
  rev: number;
  schemaVer: number;
  contentVer: string;
  deviceId: string;
  summary: unknown;
  payload: unknown;
  updatedAt: string;
}

/** An adult (Clerk user) — F-SPACE-001 §3.1. Never a child. */
export interface Account {
  id: string; // Clerk user id
  email: string | null;
  displayName: string | null;
  consent: unknown;
  createdAt: string;
}

const deviceKey = (learnerId: string, deviceId: string): string => `${learnerId}|${deviceId}`;
const membershipKey = (spaceId: string, kind: MemberKind, memberId: string): string => `${spaceId}|${kind}|${memberId}`;

class Store {
  families = new Map<string, Family>();
  profiles = new Map<string, Profile>();
  progress = new Map<string, ProgressRecord>();
  subscriptions = new Map<string, Subscription>();
  events: TelemetryEvent[] = [];

  // v2
  learners = new Map<string, Learner>();
  learnerDevices = new Map<string, LearnerDevice>();
  snapshots = new Map<string, SnapshotRecord>();
  // F-SPACE-001
  accounts = new Map<string, Account>();
  spaces = new Map<string, Space>();
  memberships = new Map<string, Membership>();
  plans = new Map<string, Plan>(); // F-PLAN-001

  membership(spaceId: string, kind: MemberKind, memberId: string): Membership | undefined {
    return this.memberships.get(membershipKey(spaceId, kind, memberId));
  }

  addMembership(m: Membership): void {
    this.memberships.set(membershipKey(m.spaceId, m.memberKind, m.memberId), m);
  }

  removeMembership(spaceId: string, kind: MemberKind, memberId: string): boolean {
    return this.memberships.delete(membershipKey(spaceId, kind, memberId));
  }

  membershipsOf(kind: MemberKind, memberId: string): Membership[] {
    return [...this.memberships.values()].filter((m) => m.memberKind === kind && m.memberId === memberId);
  }

  membersOf(spaceId: string): Membership[] {
    return [...this.memberships.values()].filter((m) => m.spaceId === spaceId);
  }

  spaceByCode(code: string): Space | undefined {
    return [...this.spaces.values()].find((s) => s.joinCode === code);
  }

  plansOf(spaceId: string): Plan[] {
    return [...this.plans.values()].filter((p) => p.spaceId === spaceId);
  }

  childSpaces(spaceId: string): Space[] {
    return [...this.spaces.values()].filter((s) => s.parentSpaceId === spaceId);
  }

  device(learnerId: string, deviceId: string): LearnerDevice | undefined {
    return this.learnerDevices.get(deviceKey(learnerId, deviceId));
  }

  bindDevice(binding: LearnerDevice): void {
    this.learnerDevices.set(deviceKey(binding.learnerId, binding.deviceId), binding);
  }

  reset(): void {
    this.families.clear();
    this.profiles.clear();
    this.progress.clear();
    this.subscriptions.clear();
    this.events = [];
    this.learners.clear();
    this.learnerDevices.clear();
    this.snapshots.clear();
    this.accounts.clear();
    this.spaces.clear();
    this.memberships.clear();
    this.plans.clear();
  }
}

export const store = new Store();

export function id(prefix: string): string {
  return `${prefix}:${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36).slice(-4)}`;
}

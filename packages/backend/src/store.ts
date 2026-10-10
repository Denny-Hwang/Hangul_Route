/**
 * Legacy v1 in-memory store (families / profiles / progress / subscriptions /
 * events — routes no client calls). Schema v2 lives in src/db (F-INFRA-003):
 * D1 on the Worker, MemoryDb in tests. The v2 record types stay here.
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
  /** When it happened, per the client (kept for offline-queued events). */
  at: string;
  /** When the API received it. */
  receivedAt?: string;
}

export interface Subscription {
  familyId: string;
  status: 'none' | 'trial' | 'active' | 'expired' | 'cancelled';
  plan: 'monthly' | 'yearly' | null;
  store: 'apple' | 'google' | null;
  expiresAt: string | null;
  updatedAt: string;
}

// ---- schema v2 types (F-SYNC-001) — persisted through src/db (F-INFRA-003) ------

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

/**
 * What a device binding may do (SEC-4). `full`: the learner's own device —
 * registration or a Rescue Code claim. `class`: bound by a teacher's re-link
 * approval — inbox only, never the snapshot or a Rescue Code, because a class
 * role must not reach the learner's full progress (F-SPACE-001 §3.4).
 */
export type DeviceScope = 'full' | 'class';

/** The principal for learner traffic: a device bound to a learner. */
export interface LearnerDevice {
  learnerId: string;
  deviceId: string;
  secretHash: string;
  scope: DeviceScope;
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

class Store {
  families = new Map<string, Family>();
  profiles = new Map<string, Profile>();
  progress = new Map<string, ProgressRecord>();
  subscriptions = new Map<string, Subscription>();
  events: TelemetryEvent[] = [];

  reset(): void {
    this.families.clear();
    this.profiles.clear();
    this.progress.clear();
    this.subscriptions.clear();
    this.events = [];
  }
}

export const store = new Store();

export function id(prefix: string): string {
  return `${prefix}:${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36).slice(-4)}`;
}

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

const deviceKey = (learnerId: string, deviceId: string): string => `${learnerId}|${deviceId}`;

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
  }
}

export const store = new Store();

export function id(prefix: string): string {
  return `${prefix}:${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36).slice(-4)}`;
}

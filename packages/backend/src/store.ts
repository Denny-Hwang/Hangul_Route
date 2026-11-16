/**
 * Legacy v1 in-memory store (families / profiles / progress / subscriptions /
 * events — routes no client calls). Schema v2 lives in src/db (F-INFRA-003):
 * D1 on the Worker, MemoryDb in tests. The v2 record types stay here.
 */

import type { LearnerLevelId } from '@hangul-route/content-schema';

export interface Family {
  id: string;
  email?: string;
  ownerId?: string;
  createdAt: string;
}

export interface Profile {
  id: string;
  familyId: string;
  displayName: string;
  ageGroup: LearnerLevelId;
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
  ageGroup: LearnerLevelId;
  avatar: string;
  recoveryHash: string | null;
  createdAt: string;
  lastActiveAt: string;
  /**
   * When the name, level or picture last changed after registration (the device's `at` of the newest applied
   * edit, migration 0010). Null or absent until the first edit.
   */
  profileUpdatedAt?: string | null;
}

/** The learner columns a device may change after registration (PATCH /api/sync/learners/:id). */
export type LearnerProfileFields = Partial<Pick<Learner, 'displayName' | 'ageGroup' | 'avatar'>>;

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

const ID_ALPHABET = '0123456789abcdefghijklmnopqrstuvwxyz';
const ID_LENGTH = 12;
/** Bytes from here up are thrown away: 252 = 7 x 36, so every character is equally likely. */
const ID_BYTE_LIMIT = 252;

/**
 * A record id, `prefix:` plus 12 characters of 0-9 a-z (about 62 bits) from
 * `crypto.getRandomValues`. [AU] AMENDMENTS-AUDIT-2026-11 AU-6 (audit SEC-8):
 * it was Math.random plus a clock suffix, which can be guessed. Same shape and
 * length as before, so stored ids and every id pattern keep matching.
 */
export function id(prefix: string): string {
  let out = '';
  while (out.length < ID_LENGTH) {
    for (const byte of crypto.getRandomValues(new Uint8Array(ID_LENGTH * 2))) {
      if (byte < ID_BYTE_LIMIT && out.length < ID_LENGTH) out += ID_ALPHABET[byte % ID_ALPHABET.length];
    }
  }
  return `${prefix}:${out}`;
}

/** [SA] A `space_events` id: `sev:<uuid>` (AMENDMENTS-SEATS-ADMINS section 6.2), so a primary-key clash cannot fail a guarded batch. */
export function spaceEventId(): string {
  return `sev:${crypto.randomUUID()}`;
}

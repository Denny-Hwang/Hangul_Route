/**
 * In-memory store. Replaced by D1 + R2 bindings when wrangler.toml binds them.
 * Schema mirrors `db/schema.sql`.
 */

export interface Family {
  id: string;
  email?: string;
  parentPinHash?: string;
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

class Store {
  families = new Map<string, Family>();
  profiles = new Map<string, Profile>();
  progress = new Map<string, ProgressRecord>();
  events: TelemetryEvent[] = [];

  reset(): void {
    this.families.clear();
    this.profiles.clear();
    this.progress.clear();
    this.events = [];
  }
}

export const store = new Store();

export function id(prefix: string): string {
  return `${prefix}:${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36).slice(-4)}`;
}

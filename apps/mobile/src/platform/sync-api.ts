import { SyncInboxSchema, type LearnerMembership, type ProgressSnapshot, type ProgressSummary, type SpaceKind, type SyncInbox } from '@hangul-route/content-schema';
import type { PutResult } from '../logic/sync/engine';

/**
 * Transport for /api/sync (F-SYNC-001 §3.2). Typed results, never throws;
 * the sync store decides what to do with them.
 */
const PLACEHOLDER_ENDPOINT = 'https://api.hangulroute.example';
const CONTENT_VERSION = '2026.09';
const SCHEMA_VERSION = 1;

export function apiBaseUrl(): string | null {
  const raw = process.env.EXPO_PUBLIC_API_BASE_URL?.replace(/\/$/, '');
  return raw && raw !== PLACEHOLDER_ENDPOINT ? raw : null;
}

export interface DeviceCredentials {
  deviceId: string;
  secret: string;
}

export interface SyncApiOptions {
  endpoint: string;
  fetchImpl?: typeof fetch;
}

export type RegisterResult =
  | { status: 'ok'; learnerId: string; secret: string }
  | { status: 'conflict' }
  | { status: 'error'; code: string };

export type IssueResult = { status: 'ok'; code: string } | { status: 'error'; code: string };

export type ClaimResult =
  | {
      status: 'ok';
      learner: { id: string; displayName: string; ageGroup: '5-7' | '8-9' | '10-11'; avatar: string };
      secret: string;
      snapshot: { rev: number; snapshot: ProgressSnapshot; summary: ProgressSummary | null } | null;
    }
  | { status: 'error'; code: 'code_not_found' | 'too_many_attempts' | 'network' | 'invalid' | 'unknown' };

export interface RosterName {
  learnerId: string;
  name: string;
}

export type LookupResult =
  | { status: 'ok'; space: { id: string; kind: SpaceKind; name: string }; full: boolean; roster: RosterName[] }
  | { status: 'error'; code: 'code_not_found' | 'code_expired' | 'too_many_attempts' | 'network' | 'invalid' | 'unknown' };

export type JoinResult =
  | { status: 'ok'; alreadyMember: boolean; membership: LearnerMembership }
  | { status: 'error'; code: 'code_not_found' | 'code_expired' | 'cap_learner' | 'cap_class' | 'not_joinable' | 'too_many_attempts' | 'network' | 'invalid' | 'unknown' };

export type LeaveResult = { status: 'ok'; left: boolean } | { status: 'error'; code: string };

export type RelinkCreateResult =
  | { status: 'ok'; requestId: string; expiresAt: string }
  | { status: 'error'; code: 'code_not_found' | 'code_expired' | 'learner_not_found' | 'already_bound' | 'too_many_attempts' | 'network' | 'invalid' | 'unknown' };

export type RelinkPollResult =
  | { status: 'ok'; state: 'pending' | 'denied' | 'expired'; expiresAt: string }
  | {
      status: 'ok';
      state: 'approved';
      learner: { id: string; displayName: string; ageGroup: '5-7' | '8-9' | '10-11'; avatar: string };
      secret: string;
      snapshot: { rev: number; snapshot: ProgressSnapshot; summary: ProgressSummary | null } | null;
    }
  | { status: 'error'; code: 'network' | 'not_found' | 'unknown' };

export type InboxResult = { status: 'ok'; inbox: SyncInbox } | { status: 'error'; code: string };

export type GetResult =
  | { status: 'ok'; rev: number; snapshot: ProgressSnapshot; summary: ProgressSummary | null }
  | { status: 'none' }
  | { status: 'error'; code: string };

function authHeader(c: DeviceCredentials): Record<string, string> {
  return { 'Content-Type': 'application/json', Authorization: `Device ${c.deviceId}:${c.secret}` };
}

/** The envelope's error code, when the server sent one. */
function errorCode(body: Record<string, unknown>): string | null {
  const err = body.error;
  return err && typeof err === 'object' && typeof (err as { code?: unknown }).code === 'string' ? (err as { code: string }).code : null;
}

async function call(
  fetchImpl: typeof fetch,
  url: string,
  init: RequestInit,
): Promise<{ status: number; body: Record<string, unknown> }> {
  try {
    const res = await fetchImpl(url, init);
    const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    return { status: res.status, body };
  } catch {
    return { status: -1, body: {} }; // network failure; callers check status first
  }
}

export function createSyncApi(opts: SyncApiOptions) {
  const fetchImpl = opts.fetchImpl ?? globalThis.fetch;
  const base = `${opts.endpoint}/api/sync`;
  const recovery = `${opts.endpoint}/api/recovery`;
  const spaces = `${opts.endpoint}/api/spaces`;

  return {
    async register(
      learner: { id: string; displayName: string; ageGroup: string; avatar: string },
      deviceId: string,
    ): Promise<RegisterResult> {
      const r = await call(fetchImpl, `${base}/learners`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deviceId, learner }),
      });
      if (r.status === -1) return { status: 'error', code: 'network' };
      if (r.status === 409) return { status: 'conflict' };
      if (r.status !== 201) return { status: 'error', code: `http_${r.status}` };
      const data = r.body.data as { learner: { id: string }; device: { secret: string } };
      return { status: 'ok', learnerId: data.learner.id, secret: data.device.secret };
    },

    async putSnapshot(
      learnerId: string,
      body: { baseRev: number; snapshot: ProgressSnapshot; summary: ProgressSummary },
      creds: DeviceCredentials,
    ): Promise<PutResult> {
      const r = await call(fetchImpl, `${base}/learners/${encodeURIComponent(learnerId)}/snapshot`, {
        method: 'PUT',
        headers: authHeader(creds),
        body: JSON.stringify({ ...body, schemaVer: SCHEMA_VERSION, contentVer: CONTENT_VERSION }),
      });
      if (r.status === -1) return { status: 'error', code: 'network' };
      if (r.status === 200) return { status: 'ok', rev: (r.body.data as { rev: number }).rev };
      if (r.status === 409) {
        const data = r.body.data as { rev: number; snapshot: ProgressSnapshot | null };
        return { status: 'conflict', rev: data.rev, snapshot: data.snapshot };
      }
      return { status: 'error', code: `http_${r.status}` };
    },

    async issueRescueCode(learnerId: string, creds: DeviceCredentials): Promise<IssueResult> {
      const r = await call(fetchImpl, `${recovery}/issue`, { method: 'POST', headers: authHeader(creds), body: JSON.stringify({ learnerId }) });
      if (r.status === -1) return { status: 'error', code: 'network' };
      if (r.status !== 201) return { status: 'error', code: `http_${r.status}` };
      return { status: 'ok', code: (r.body.data as { code: string }).code };
    },

    async claimRescueCode(code: string, deviceId: string): Promise<ClaimResult> {
      const r = await call(fetchImpl, `${recovery}/claim`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, deviceId }),
      });
      if (r.status === -1) return { status: 'error', code: 'network' };
      if (r.status === 404) return { status: 'error', code: 'code_not_found' };
      if (r.status === 429) return { status: 'error', code: 'too_many_attempts' };
      if (r.status === 422) return { status: 'error', code: 'invalid' };
      if (r.status !== 200) return { status: 'error', code: 'unknown' };
      const data = r.body.data as ClaimResult extends { status: 'ok' } ? never : { learner: { id: string; displayName: string; ageGroup: '5-7' | '8-9' | '10-11'; avatar: string }; device: { secret: string }; snapshot: { rev: number; snapshot: ProgressSnapshot; summary: ProgressSummary | null } | null };
      return { status: 'ok', learner: data.learner, secret: data.device.secret, snapshot: data.snapshot };
    },

    async lookupSpace(code: string): Promise<LookupResult> {
      const r = await call(fetchImpl, `${spaces}/lookup`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code }) });
      if (r.status === -1) return { status: 'error', code: 'network' };
      if (r.status === 200) {
        const data = r.body.data as { space: { id: string; kind: SpaceKind; name: string }; full: boolean; roster?: RosterName[] };
        return { status: 'ok', space: data.space, full: data.full, roster: data.roster ?? [] };
      }
      if (r.status === 404) return { status: 'error', code: errorCode(r.body) === 'code_expired' ? 'code_expired' : 'code_not_found' };
      if (r.status === 429) return { status: 'error', code: 'too_many_attempts' };
      if (r.status === 422) return { status: 'error', code: 'invalid' };
      return { status: 'error', code: 'unknown' };
    },

    async joinSpace(spaceId: string, body: { code: string; learnerId: string; displayName?: string }, creds: DeviceCredentials): Promise<JoinResult> {
      const r = await call(fetchImpl, `${spaces}/${encodeURIComponent(spaceId)}/join`, { method: 'POST', headers: authHeader(creds), body: JSON.stringify(body) });
      if (r.status === -1) return { status: 'error', code: 'network' };
      const code = errorCode(r.body);
      if (r.status === 200 || r.status === 201) {
        const data = r.body.data as { alreadyMember: boolean; membership: { role: LearnerMembership['role']; joinedAt: string }; space: { id: string; kind: SpaceKind; name: string } };
        return {
          status: 'ok',
          alreadyMember: data.alreadyMember,
          membership: { spaceId: data.space.id, kind: data.space.kind, name: data.space.name, role: data.membership.role, joinedAt: data.membership.joinedAt },
        };
      }
      if (r.status === 404) return { status: 'error', code: code === 'code_expired' ? 'code_expired' : 'code_not_found' };
      if (r.status === 409) return { status: 'error', code: code === 'cap_class' ? 'cap_class' : 'cap_learner' };
      if (r.status === 422) return { status: 'error', code: code === 'not_joinable' ? 'not_joinable' : 'invalid' };
      if (r.status === 429) return { status: 'error', code: 'too_many_attempts' };
      return { status: 'error', code: 'unknown' };
    },

    async createRelink(spaceId: string, body: { code: string; learnerId: string; deviceId: string; platform?: string }): Promise<RelinkCreateResult> {
      const r = await call(fetchImpl, `${spaces}/${encodeURIComponent(spaceId)}/relink-requests`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      if (r.status === -1) return { status: 'error', code: 'network' };
      const code = errorCode(r.body);
      if (r.status === 200 || r.status === 201) {
        const data = r.body.data as { request: { id: string; expiresAt: string } };
        return { status: 'ok', requestId: data.request.id, expiresAt: data.request.expiresAt };
      }
      if (r.status === 404) return { status: 'error', code: code === 'code_expired' ? 'code_expired' : code === 'learner_not_found' ? 'learner_not_found' : 'code_not_found' };
      if (r.status === 409) return { status: 'error', code: 'already_bound' };
      if (r.status === 422) return { status: 'error', code: 'invalid' };
      if (r.status === 429) return { status: 'error', code: 'too_many_attempts' };
      return { status: 'error', code: 'unknown' };
    },

    async pollRelink(spaceId: string, requestId: string, deviceId: string): Promise<RelinkPollResult> {
      const r = await call(fetchImpl, `${spaces}/${encodeURIComponent(spaceId)}/relink-requests/${encodeURIComponent(requestId)}?deviceId=${encodeURIComponent(deviceId)}`, { headers: { 'Content-Type': 'application/json' } });
      if (r.status === -1) return { status: 'error', code: 'network' };
      if (r.status === 404) return { status: 'error', code: 'not_found' };
      if (r.status !== 200) return { status: 'error', code: 'unknown' };
      const data = r.body.data as { status: 'pending' | 'approved' | 'denied' | 'expired'; expiresAt: string; learner?: { id: string; displayName: string; ageGroup: '5-7' | '8-9' | '10-11'; avatar: string }; device?: { secret: string }; snapshot?: { rev: number; snapshot: ProgressSnapshot; summary: ProgressSummary | null } | null };
      if (data.status === 'approved' && data.learner && data.device) {
        return { status: 'ok', state: 'approved', learner: data.learner, secret: data.device.secret, snapshot: data.snapshot ?? null };
      }
      if (data.status === 'approved') return { status: 'ok', state: 'pending', expiresAt: data.expiresAt }; // credentials already picked up elsewhere
      return { status: 'ok', state: data.status, expiresAt: data.expiresAt };
    },

    async leaveSpace(spaceId: string, learnerId: string, creds: DeviceCredentials): Promise<LeaveResult> {
      const r = await call(fetchImpl, `${spaces}/${encodeURIComponent(spaceId)}/leave`, { method: 'POST', headers: authHeader(creds), body: JSON.stringify({ learnerId }) });
      if (r.status === -1) return { status: 'error', code: 'network' };
      if (r.status !== 200) return { status: 'error', code: `http_${r.status}` };
      return { status: 'ok', left: (r.body.data as { left: boolean }).left };
    },

    async getInbox(learnerId: string, creds: DeviceCredentials): Promise<InboxResult> {
      const r = await call(fetchImpl, `${base}/learners/${encodeURIComponent(learnerId)}/inbox`, { headers: authHeader(creds) });
      if (r.status === -1) return { status: 'error', code: 'network' };
      if (r.status !== 200) return { status: 'error', code: `http_${r.status}` };
      const parsed = SyncInboxSchema.safeParse(r.body.data);
      return parsed.success ? { status: 'ok', inbox: parsed.data } : { status: 'error', code: 'invalid' };
    },

    async getSnapshot(learnerId: string, creds: DeviceCredentials): Promise<GetResult> {
      const r = await call(fetchImpl, `${base}/learners/${encodeURIComponent(learnerId)}/snapshot`, {
        headers: authHeader(creds),
      });
      if (r.status === -1) return { status: 'error', code: 'network' };
      if (r.status === 404) return { status: 'none' };
      if (r.status !== 200) return { status: 'error', code: `http_${r.status}` };
      const data = r.body.data as { rev: number; snapshot: ProgressSnapshot; summary: ProgressSummary | null };
      return { status: 'ok', rev: data.rev, snapshot: data.snapshot, summary: data.summary ?? null };
    },
  };
}

export type SyncApiClient = ReturnType<typeof createSyncApi>;

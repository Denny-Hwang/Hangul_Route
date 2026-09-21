import type { ProgressSnapshot, ProgressSummary } from '@hangul-route/content-schema';
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

export type GetResult =
  | { status: 'ok'; rev: number; snapshot: ProgressSnapshot; summary: ProgressSummary | null }
  | { status: 'none' }
  | { status: 'error'; code: string };

function authHeader(c: DeviceCredentials): Record<string, string> {
  return { 'Content-Type': 'application/json', Authorization: `Device ${c.deviceId}:${c.secret}` };
}

async function call(
  fetchImpl: typeof fetch,
  url: string,
  init: RequestInit,
): Promise<{ status: number; body: Record<string, unknown> } | { status: -1 }> {
  try {
    const res = await fetchImpl(url, init);
    const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    return { status: res.status, body };
  } catch {
    return { status: -1 };
  }
}

export function createSyncApi(opts: SyncApiOptions) {
  const fetchImpl = opts.fetchImpl ?? globalThis.fetch;
  const base = `${opts.endpoint}/api/sync`;
  const recovery = `${opts.endpoint}/api/recovery`;

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

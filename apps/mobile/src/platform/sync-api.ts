import {
  InboxTransferSchema,
  LookupSeatSchema,
  InboxVisibleSpaceSchema,
  SyncInboxSchema,
  lenientArray,
  type DeviceTransferApproveBody,
  type DeviceTransferCreateBody,
  type DeviceTransferPreviewBody,
  type DeviceTransferPrefsBody,
  type InboxTransfer,
  type InboxVisibleSpace,
  type LearnerLevelId,
  type LearnerMembership,
  type LookupSeat,
  type NoteDevicePrefsPut,
  type NoteReport,
  type NoteStatePut,
  type ProgressSnapshot,
  type ProgressSummary,
  type SpaceKind,
  type SyncInbox,
} from '@hangul-route/content-schema';
import { z } from 'zod';
import type { PutResult } from '../logic/sync/engine';
import { notifyInboxRead } from './inbox-events';

/**
 * Transport for /api/sync (F-SYNC-001 §3.2). Typed results, never throws;
 * the sync store decides what to do with them.
 */
const PLACEHOLDER_ENDPOINT = 'https://api.hangulroute.example';
/** The content version every upload and stored result carries. */
export const CONTENT_VERSION = '2026.09';
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
      learner: { id: string; displayName: string; ageGroup: LearnerLevelId; avatar: string };
      secret: string;
      snapshot: { rev: number; snapshot: ProgressSnapshot; summary: ProgressSummary | null } | null;
    }
  | { status: 'error'; code: 'code_not_found' | 'too_many_attempts' | 'network' | 'invalid' | 'unknown' };

export interface RosterName {
  learnerId: string;
  name: string;
}

/**
 * [SA] `seat` (AMENDMENTS-SEATS-ADMINS section 3.4): whether this learner (the one sent with the device header, else a
 * new one) finds room, and which cap is full; null from a Worker older than SA-1 or a value this app cannot read.
 */
export type LookupResult =
  | { status: 'ok'; space: { id: string; kind: SpaceKind; name: string }; full: boolean; seat: LookupSeat | null; roster: RosterName[] }
  | { status: 'error'; code: 'code_not_found' | 'code_expired' | 'too_many_attempts' | 'network' | 'invalid' | 'unknown' };

/** [SA] A seat refusal carries the Worker's `details.cap` when it sent a readable one. */
export type JoinResult =
  | { status: 'ok'; alreadyMember: boolean; membership: LearnerMembership }
  | { status: 'error'; code: 'cap_family' | 'cap_class' | 'cap_school'; cap?: number }
  | { status: 'error'; code: 'code_not_found' | 'code_expired' | 'cap_learner' | 'not_joinable' | 'too_many_attempts' | 'network' | 'invalid' | 'unknown' | 'forbidden' };

export type LeaveResult = { status: 'ok'; left: boolean } | { status: 'error'; code: string };

export type RelinkCreateResult =
  | { status: 'ok'; requestId: string; expiresAt: string }
  | { status: 'error'; code: 'code_not_found' | 'code_expired' | 'learner_not_found' | 'already_bound' | 'too_many_attempts' | 'network' | 'invalid' | 'unknown' };

export type RelinkPollResult =
  | { status: 'ok'; state: 'pending' | 'denied' | 'expired'; expiresAt: string }
  | {
      status: 'ok';
      state: 'approved';
      learner: { id: string; displayName: string; ageGroup: LearnerLevelId; avatar: string };
      secret: string;
      snapshot: { rev: number; snapshot: ProgressSnapshot; summary: ProgressSummary | null } | null;
    }
  | { status: 'error'; code: 'network' | 'not_found' | 'unknown' };

export type InboxResult = { status: 'ok'; inbox: SyncInbox } | { status: 'error'; code: string };

/** The learner fields a device may change on the server (F-PROF-001): never who is learning, the PIN or consent. */
export interface LearnerProfileFields {
  displayName?: string;
  ageGroup?: LearnerLevelId;
  avatar?: string;
}

/**
 * PATCH /learners/:id. `ok` covers every 2xx: `applied` is false when the server already held a newer edit.
 * `profileUpdatedAt` is the edit time the server stored (its own clock caps a device clock that runs ahead), and
 * `learner` the row as it stands after the request; both are null when a Worker does not send them.
 * `scope_limited` (403, a class tablet) and `invalid` (400/422, a value the Worker refuses) never succeed on a
 * retry; `error` (no network, 5xx, a Worker without the route) may.
 */
export type ProfilePatchResult =
  | { status: 'ok'; applied: boolean; profileUpdatedAt: string | null; learner: { displayName: string; ageGroup: string | null; avatar: string } | null }
  | { status: 'scope_limited' }
  | { status: 'invalid'; code: string }
  | { status: 'error'; code: string };

// Lenient past `applied`: an unreadable stamp or row reads as null and never turns a 2xx into a failure.
const ProfilePatchDataSchema = z.object({
  applied: z.boolean(),
  profileUpdatedAt: z.string().nullable().optional().catch(null),
  learner: z
    .object({ displayName: z.string(), ageGroup: z.string().nullable().catch(null), avatar: z.string().catch('') })
    .nullable()
    .optional()
    .catch(null),
});

export type GetResult =
  | { status: 'ok'; rev: number; snapshot: ProgressSnapshot; summary: ProgressSummary | null }
  | { status: 'none' }
  | { status: 'error'; code: string };

/**
 * A device note route's answer (F-FEEDBACK-001 section 7.6). `http` is the status (-1 = no network),
 * which the notes queue maps to done, drop, retry or limited (`logic/notes/queue.ts` `outcomeOf`).
 */
export type NoteWriteResult = { status: 'ok'; http: number } | { status: 'error'; http: number; code: string };
export type NoteStateResult = { status: 'ok'; http: number; readAt: string | null; reaction: string | null } | { status: 'error'; http: number; code: string };

/**
 * A class-move call that did not land (F-SPACE-002 section 4.4). `http` is the status (-1 = no
 * network); `code` is the Worker's error code, `network`, `invalid` (an answer this app cannot read)
 * or `http_<status>`. `already_open` says who started the open request; a 429 carries the wait.
 */
export interface TransferCallError {
  status: 'error';
  http: number;
  code: string;
  startedBy?: 'class' | 'learner_side';
  retryAfterSeconds?: number;
}

/** The learner-side preview a device gets (section 4.4): what the consent sheet shows. */
export interface DeviceTransferPreview {
  destination: { id: string; name: string; ownerName: string | null; schoolName: string | null; ageBucket: string | null; learnerCount: number | null };
  premiumChange: string;
  destinationConsentMode: string;
  relinkAffected: boolean;
  sourcePlansAffected: boolean;
  visibleToday: InboxVisibleSpace[];
  /** The digest of the sheet shown, sent back with the consent (section 4.11); null when the Worker sent none. */
  termsDigest: string | null;
  blockReason: string | null;
}

export type TransferPreviewResult = { status: 'ok'; preview: DeviceTransferPreview } | TransferCallError;
/** `created` is false when the Worker answered 200 with this device's own open request (a repeated create). */
export type TransferCreateResult = { status: 'ok'; created: boolean; request: InboxTransfer } | TransferCallError;
export type TransferRequestResult = { status: 'ok'; request: InboxTransfer } | TransferCallError;
export type TransferPrefsResult = { status: 'ok'; selfManaged: boolean } | TransferCallError;

/** Lenient where a field only decorates the sheet; strict where the sheet cannot be drawn without it. */
const DeviceTransferPreviewSchema = z.object({
  destination: z.object({
    id: z.string(),
    name: z.string(),
    ownerName: z.string().nullable().catch(null),
    schoolName: z.string().nullable().catch(null),
    ageBucket: z.string().nullable().catch(null),
    learnerCount: z.number().int().nonnegative().nullable().catch(null),
  }),
  premiumChange: z.string(),
  destinationConsentMode: z.string(),
  relinkAffected: z.boolean(),
  sourcePlansAffected: z.boolean(),
  visibleToday: lenientArray(InboxVisibleSpaceSchema),
  termsDigest: z
    .string()
    .regex(/^[0-9a-f]{64}$/)
    .nullable()
    .catch(null),
  blockReason: z.string().nullable().catch(null),
});

const RequestDataSchema = z.object({ request: InboxTransferSchema });
const PrefsDataSchema = z.object({ prefs: z.object({ selfManaged: z.boolean() }) });

function transferError(r: { status: number; body: Record<string, unknown> }): TransferCallError {
  if (r.status === -1) return { status: 'error', http: -1, code: 'network' };
  const code = errorCode(r.body);
  if (code === null) return { status: 'error', http: r.status, code: `http_${r.status}` };
  const err = r.body.error as { details?: unknown };
  const details = err.details && typeof err.details === 'object' ? (err.details as Record<string, unknown>) : {};
  const out: TransferCallError = { status: 'error', http: r.status, code };
  if (code === 'already_open') out.startedBy = details.startedBy === 'class' ? 'class' : 'learner_side';
  if (typeof details.retryAfterSeconds === 'number') out.retryAfterSeconds = details.retryAfterSeconds;
  return out;
}

const unreadable = (http: number): TransferCallError => ({ status: 'error', http, code: 'invalid' });

function authHeader(c: DeviceCredentials): Record<string, string> {
  return { 'Content-Type': 'application/json', Authorization: `Device ${c.deviceId}:${c.secret}` };
}

/** The envelope's error code, when the server sent one. */
function errorCode(body: Record<string, unknown>): string | null {
  const err = body.error;
  return err && typeof err === 'object' && typeof (err as { code?: unknown }).code === 'string' ? (err as { code: string }).code : null;
}

/** The envelope's `error.details`, when it is an object. */
function errorDetails(body: Record<string, unknown>): Record<string, unknown> {
  const err = body.error;
  const details = err && typeof err === 'object' ? (err as { details?: unknown }).details : undefined;
  return details && typeof details === 'object' ? (details as Record<string, unknown>) : {};
}

/**
 * [SA] A `/join` 409 (AMENDMENTS-SEATS-ADMINS section 3.4). `cap_family` is its own code; the Worker answers a school
 * cap as `cap_class` with `details.reason: 'cap_school'` (so shipped apps show the class line), read here as
 * `cap_school`. Any other 409 stays the three-classes code, as before.
 */
function seatRefusal(code: string | null, body: Record<string, unknown>): JoinResult & { status: 'error' } {
  const details = errorDetails(body);
  const seat = code === 'cap_family' ? 'cap_family' : code === 'cap_school' || (code === 'cap_class' && details.reason === 'cap_school') ? 'cap_school' : code === 'cap_class' ? 'cap_class' : null;
  if (seat === null) return { status: 'error', code: 'cap_learner' };
  const cap = details.cap;
  return typeof cap === 'number' && Number.isInteger(cap) && cap >= 0 ? { status: 'error', code: seat, cap } : { status: 'error', code: seat };
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

function noteError(r: { status: number; body: Record<string, unknown> }): { status: 'error'; http: number; code: string } {
  if (r.status === -1) return { status: 'error', http: -1, code: 'network' };
  return { status: 'error', http: r.status, code: errorCode(r.body) ?? `http_${r.status}` };
}

export function createSyncApi(opts: SyncApiOptions) {
  const fetchImpl = opts.fetchImpl ?? globalThis.fetch;
  const base = `${opts.endpoint}/api/sync`;
  const recovery = `${opts.endpoint}/api/recovery`;
  const spaces = `${opts.endpoint}/api/spaces`;

  async function requestCall(learnerId: string, transferId: string, action: 'approve' | 'decline' | 'cancel', body: unknown, creds: DeviceCredentials): Promise<TransferRequestResult> {
    const r = await call(fetchImpl, `${base}/learners/${encodeURIComponent(learnerId)}/transfer-requests/${encodeURIComponent(transferId)}/${action}`, {
      method: 'POST',
      headers: authHeader(creds),
      body: JSON.stringify(body),
    });
    if (r.status !== 200) return transferError(r);
    const parsed = RequestDataSchema.safeParse(r.body.data);
    return parsed.success ? { status: 'ok', request: parsed.data.request } : unreadable(r.status);
  }

  return {
    async register(
      learner: { id: string; displayName: string; ageGroup: LearnerLevelId; avatar: string },
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
      const data = r.body.data as ClaimResult extends { status: 'ok' } ? never : { learner: { id: string; displayName: string; ageGroup: LearnerLevelId; avatar: string }; device: { secret: string }; snapshot: { rev: number; snapshot: ProgressSnapshot; summary: ProgressSummary | null } | null };
      return { status: 'ok', learner: data.learner, secret: data.device.secret, snapshot: data.snapshot };
    },

    /**
     * POST /spaces/lookup. [SA] With `learner` (a device that holds this learner), the learner id goes with the device
     * header, so `seat` says whether this learner already holds its seat; without it, the answer is for a new learner.
     */
    async lookupSpace(code: string, learner?: { learnerId: string; creds: DeviceCredentials }): Promise<LookupResult> {
      const init: RequestInit = learner
        ? { method: 'POST', headers: authHeader(learner.creds), body: JSON.stringify({ code, learnerId: learner.learnerId }) }
        : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code }) };
      const r = await call(fetchImpl, `${spaces}/lookup`, init);
      if (r.status === -1) return { status: 'error', code: 'network' };
      if (r.status === 200) {
        const data = r.body.data as { space: { id: string; kind: SpaceKind; name: string }; full: boolean; seat?: unknown; roster?: RosterName[] };
        const seat = LookupSeatSchema.safeParse(data.seat);
        return { status: 'ok', space: data.space, full: data.full, seat: seat.success ? seat.data : null, roster: data.roster ?? [] };
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
      if (r.status === 409) return seatRefusal(code, r.body);
      if (r.status === 422) return { status: 'error', code: code === 'not_joinable' ? 'not_joinable' : 'invalid' };
      if (r.status === 429) return { status: 'error', code: 'too_many_attempts' };
      // [OA] Row OA-7b: the device check refused this learner (no or a wrong secret, bound elsewhere, class-scoped).
      // Not worth trying again, unlike a `5xx`.
      if (r.status === 401 || r.status === 403) return { status: 'error', code: 'forbidden' };
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
      const data = r.body.data as { status: 'pending' | 'approved' | 'denied' | 'expired'; expiresAt: string; learner?: { id: string; displayName: string; ageGroup: LearnerLevelId; avatar: string }; device?: { secret: string }; snapshot?: { rev: number; snapshot: ProgressSnapshot; summary: ProgressSummary | null } | null };
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
      const r = await call(fetchImpl, `${base}/learners/${encodeURIComponent(learnerId)}/inbox?cap=curriculum`, { headers: authHeader(creds) });
      if (r.status === -1) return { status: 'error', code: 'network' };
      if (r.status !== 200) return { status: 'error', code: `http_${r.status}` };
      const parsed = SyncInboxSchema.safeParse(r.body.data);
      if (!parsed.success) return { status: 'error', code: 'invalid' };
      notifyInboxRead(learnerId, parsed.data);
      return { status: 'ok', inbox: parsed.data };
    },

    /**
     * PATCH /learners/:id: the learner's new name, level or picture, with `at`, when the device made the edit (the
     * server keeps the newest). Only these three fields and `at` are sent, whatever the caller passes.
     */
    async updateLearnerProfile(learnerId: string, secret: string, deviceId: string, patch: LearnerProfileFields & { at: string }): Promise<ProfilePatchResult> {
      const body: LearnerProfileFields & { at: string } = { at: patch.at };
      if (patch.displayName !== undefined) body.displayName = patch.displayName;
      if (patch.ageGroup !== undefined) body.ageGroup = patch.ageGroup;
      if (patch.avatar !== undefined) body.avatar = patch.avatar;
      const r = await call(fetchImpl, `${base}/learners/${encodeURIComponent(learnerId)}`, {
        method: 'PATCH',
        headers: authHeader({ deviceId, secret }),
        body: JSON.stringify(body),
      });
      if (r.status === -1) return { status: 'error', code: 'network' };
      const code = errorCode(r.body);
      if (r.status >= 200 && r.status < 300) {
        const parsed = ProfilePatchDataSchema.safeParse(r.body.data);
        // A 2xx the app cannot read still means the server took the request: there is nothing to send again.
        if (!parsed.success) return { status: 'ok', applied: true, profileUpdatedAt: null, learner: null };
        const { applied, profileUpdatedAt, learner } = parsed.data;
        return { status: 'ok', applied, profileUpdatedAt: profileUpdatedAt ?? null, learner: learner ? { displayName: learner.displayName, ageGroup: learner.ageGroup, avatar: learner.avatar } : null };
      }
      if (r.status === 403 && code === 'scope_limited') return { status: 'scope_limited' };
      if (r.status === 400 || r.status === 422) return { status: 'invalid', code: code ?? `http_${r.status}` };
      return { status: 'error', code: code ?? `http_${r.status}` };
    },

    // Class moves from the learner's own device (F-SPACE-002 section 4.4). Online only: consent is never queued.

    /** POST /learners/:id/transfer-requests/preview: what the consent sheet shows; writes nothing. */
    async previewTransfer(learnerId: string, body: DeviceTransferPreviewBody, creds: DeviceCredentials): Promise<TransferPreviewResult> {
      const r = await call(fetchImpl, `${base}/learners/${encodeURIComponent(learnerId)}/transfer-requests/preview`, { method: 'POST', headers: authHeader(creds), body: JSON.stringify(body) });
      if (r.status !== 200) return transferError(r);
      const parsed = DeviceTransferPreviewSchema.safeParse(r.body.data);
      return parsed.success ? { status: 'ok', preview: parsed.data } : unreadable(r.status);
    },

    /** POST /learners/:id/transfer-requests: start a move with this device's consent claim. */
    async createTransfer(learnerId: string, body: DeviceTransferCreateBody, creds: DeviceCredentials): Promise<TransferCreateResult> {
      const r = await call(fetchImpl, `${base}/learners/${encodeURIComponent(learnerId)}/transfer-requests`, { method: 'POST', headers: authHeader(creds), body: JSON.stringify(body) });
      if (r.status !== 200 && r.status !== 201) return transferError(r);
      const parsed = RequestDataSchema.safeParse(r.body.data);
      return parsed.success ? { status: 'ok', created: r.status === 201, request: parsed.data.request } : unreadable(r.status);
    },

    /** POST …/:tid/approve: a yes again for this device's own request after its consent was reset. */
    async approveTransfer(learnerId: string, transferId: string, body: DeviceTransferApproveBody, creds: DeviceCredentials): Promise<TransferRequestResult> {
      return requestCall(learnerId, transferId, 'approve', body, creds);
    },

    /** POST …/:tid/decline: the learner side says no (the veto, guard 11). */
    async declineTransfer(learnerId: string, transferId: string, creds: DeviceCredentials): Promise<TransferRequestResult> {
      return requestCall(learnerId, transferId, 'decline', {}, creds);
    },

    /** POST …/:tid/cancel: the learner side withdraws any open request (the veto, guard 11). */
    async cancelTransfer(learnerId: string, transferId: string, creds: DeviceCredentials): Promise<TransferRequestResult> {
      return requestCall(learnerId, transferId, 'cancel', {}, creds);
    },

    /** PUT /learners/:id/transfer-prefs: the learner's own switch (`selfManaged`, guard 13). */
    async putTransferPrefs(learnerId: string, body: DeviceTransferPrefsBody, creds: DeviceCredentials): Promise<TransferPrefsResult> {
      const r = await call(fetchImpl, `${base}/learners/${encodeURIComponent(learnerId)}/transfer-prefs`, { method: 'PUT', headers: authHeader(creds), body: JSON.stringify(body) });
      if (r.status !== 200) return transferError(r);
      const parsed = PrefsDataSchema.safeParse(r.body.data);
      return parsed.success ? { status: 'ok', selfManaged: parsed.data.prefs.selfManaged } : unreadable(r.status);
    },

    /**
     * [TV] PUT /learners/:id/class-scope: this full-scope device records that the learner's grown-up read the class
     * update (AMENDMENTS-TEACHER-VISIBILITY-TRANSFER TV-D4). A class tablet answers 403 `scope_limited`; an older text
     * 422 `class_scope_stale`.
     */
    async putClassScopeAck(learnerId: string, version: string, creds: DeviceCredentials): Promise<{ status: 'ok' } | TransferCallError> {
      const r = await call(fetchImpl, `${base}/learners/${encodeURIComponent(learnerId)}/class-scope`, { method: 'PUT', headers: authHeader(creds), body: JSON.stringify({ version }) });
      return r.status === 200 ? { status: 'ok' } : transferError(r);
    },

    /** PUT /learners/:id/notes/:noteId/state: read once, last reaction wins (idempotent). */
    async putNoteState(learnerId: string, noteId: string, body: NoteStatePut, creds: DeviceCredentials): Promise<NoteStateResult> {
      const r = await call(fetchImpl, `${base}/learners/${encodeURIComponent(learnerId)}/notes/${encodeURIComponent(noteId)}/state`, {
        method: 'PUT',
        headers: authHeader(creds),
        body: JSON.stringify(body),
      });
      if (r.status !== 200) return noteError(r);
      const data = (r.body.data ?? {}) as { readAt?: unknown; reaction?: unknown };
      return {
        status: 'ok',
        http: r.status,
        readAt: typeof data.readAt === 'string' ? data.readAt : null,
        reaction: typeof data.reaction === 'string' ? data.reaction : null,
      };
    },

    /** POST /learners/:id/notes/:noteId/report: allowed from a class-scoped device too. */
    async reportNote(learnerId: string, noteId: string, body: NoteReport, creds: DeviceCredentials): Promise<NoteWriteResult> {
      const r = await call(fetchImpl, `${base}/learners/${encodeURIComponent(learnerId)}/notes/${encodeURIComponent(noteId)}/report`, {
        method: 'POST',
        headers: authHeader(creds),
        body: JSON.stringify(body),
      });
      return r.status === 201 || r.status === 200 ? { status: 'ok', http: r.status } : noteError(r);
    },

    /** POST /learners/:id/notes/:noteId/hide: full-scope devices, online only (never queued). */
    async hideNote(learnerId: string, noteId: string, creds: DeviceCredentials): Promise<NoteWriteResult> {
      const r = await call(fetchImpl, `${base}/learners/${encodeURIComponent(learnerId)}/notes/${encodeURIComponent(noteId)}/hide`, {
        method: 'POST',
        headers: authHeader(creds),
      });
      return r.status === 200 ? { status: 'ok', http: r.status } : noteError(r);
    },

    /** PUT /learners/:id/note-prefs: the class-notes mode, full-scope devices only (never queued). */
    async putNotePrefs(learnerId: string, body: NoteDevicePrefsPut, creds: DeviceCredentials): Promise<NoteWriteResult> {
      const r = await call(fetchImpl, `${base}/learners/${encodeURIComponent(learnerId)}/note-prefs`, {
        method: 'PUT',
        headers: authHeader(creds),
        body: JSON.stringify(body),
      });
      return r.status === 200 ? { status: 'ok', http: r.status } : noteError(r);
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

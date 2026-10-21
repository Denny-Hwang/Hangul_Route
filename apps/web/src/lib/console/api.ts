import { ClassReportSchema, ProgressSummarySchema, ReportPeriodSchema, ReportSummarySchema, isDateKey, ReceiptViewSchema, SpaceKindSchema, parseBillingSummary, type BillingSummary, type ReceiptView } from '@hangul-route/content-schema';
import { noteTransferResult } from './transfer-lock';
import {
  readClassScope,
  readDestinations,
  readIncoming,
  readMoveLists,
  readNotices,
  readOutgoing,
  readPreview,
  readReportScope,
  type ClassMoveDestination,
  type ClassMoveLists,
  type ClassMovePreview,
  type ClassScopeState,
  type IncomingMove,
  type MoveNotice,
  type OutgoingMove,
} from './class-moves';
import type {
  ClassReport,
  CurriculumMeta,
  Entitlement,
  InboxVisibleSpace,
  LearnerSlotState,
  NotesMode,
  SpaceSettings,
  TransferApproveBody,
  TransferBlockReason,
  TransferCreateBody,
  TransferDeclineBody,
  TransferEndReason,
  TransferEndedFrom,
  TransferFamilyPrefsBody,
  TransferInitiator,
  TransferLearnerRoute,
  TransferPremiumChange,
  TransferPreviewBody,
  TransferStepState,
  LearnerLevelId,
  LearnerReportResponse,
  PlanItem,
  ProgressSummary,
  Promo,
  PurchasablePlanKey,
  ReportPeriod,
  ReportSummary,
  SpaceKind,
  SpaceRole,
  TeacherVisibleSummaryKey,
  VocabSummary,
} from '@hangul-route/content-schema';

/**
 * Console transport for /api/spaces — F-CONSOLE-001. Bearer = the console
 * session token; typed results, never throws.
 */
export interface SpaceView {
  id: string;
  kind: SpaceKind;
  name: string;
  parentSpaceId: string | null;
  settings: { consentMode: 'parent' | 'school'; anonymizeRoster: boolean };
  archivedAt: string | null;
  createdAt: string;
}

export interface SpaceListItem {
  space: SpaceView;
  role: SpaceRole;
  counts: { learners: number; accounts: number; classes: number };
  joinCode: string | null;
  joinCodeExpiresAt: string | null;
}

/**
 * A roster summary as the Worker sends it: projected to the teacher allow-list,
 * `planProgress` holding this space's plans only (F-SPACE-002 T-1a, section 4.11).
 */
export type RosterSummary = Pick<ProgressSummary, TeacherVisibleSummaryKey> &
  /**
   * A family space also reads the learner's own-route counts (F-PLAN-002 section 3.10) and the goal the
   * learner's Learning Route shows (Learning Route LR-W1, LR-OD-12); a class never receives them.
   */
  Partial<Pick<ProgressSummary, 'selfRoute' | 'routeGoal'>> &
  /**
   * Word counts (F-VOC-005 section 3.8). `vocab` is on `TEACHER_HIDDEN_SUMMARY_KEYS`, so no roster
   * carries it until a consent item covers it (P-4b); the console shows its word lines only when it
   * is here. Never the first-try rate: P-4b's projection drops it for every roster viewer.
   */
  { vocab?: RosterVocab };

/** A roster's `summary.vocab`: the learner's word counts and words to revisit, without the first-try rate. */
export type RosterVocab = Omit<VocabSummary, 'firstTryRate'>;

export interface RosterLearner {
  /** Opaque learner id: keys the row, targets plans, issues Rescue Codes. Never shown. */
  id: string;
  displayName: string;
  ageGroup: LearnerLevelId;
  avatar: string;
  joinedAt: string;
  lastActiveAt: string;
  summary: RosterSummary | null;
  lastSyncedAt: string | null;
  /** [TV] Which projection the row carries (AMENDMENTS-TEACHER-VISIBILITY-TRANSFER section 2); absent from an older Worker. */
  scope?: 'base' | 'full';
}

/**
 * [SA] `GET /:id/roster` `seats` (AMENDMENTS-SEATS-ADMINS section 3.6): the space's learners and its cap, and for a class
 * in a live school the school's distinct students and cap. A cap of `null` is none; the school fields are `null`
 * outside a school.
 */
export interface RosterSeats {
  learners: number;
  cap: number | null;
  schoolLearners: number | null;
  schoolCap: number | null;
}

export interface Roster {
  space: SpaceView;
  learners: RosterLearner[];
  joinCode: string | null;
  joinCodeExpiresAt: string | null;
  /** [SA] Absent from a Worker older than SA-1: the page then counts the roster against the free cap, as before. */
  seats?: RosterSeats;
  /** [SA] section 5.3: this grown-up may rename the space (`space.rename`); absent reads as no. */
  canRename?: boolean;
  /** [SA] section 5.4: an open class move names this space, so a new name asks its grown-ups again. */
  openMoves?: boolean;
}

export interface CreatedSpace {
  space: SpaceView;
  membership: { role: SpaceRole };
  joinCode: string | null;
  joinCodeExpiresAt: string | null;
}

export interface PlanView {
  id: string;
  spaceId: string;
  authorAccountId: string;
  title: string;
  items: PlanItem[];
  targetLearnerIds: string[] | null;
  publishedAt: string | null;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
  /** A route plan's curriculum (F-PLAN-002 section 3.5); null or absent = a classic plan. */
  meta?: CurriculumMeta | null;
}

export interface PlanSave {
  id?: string;
  title: string;
  items: PlanItem[];
  targetLearnerIds?: string[] | null;
  publish: boolean;
  /** Absent keeps the stored meta; the wizard sends a route's meta, a re-pace its new one. */
  meta?: CurriculumMeta | null;
}

export interface MemberView {
  memberKind: 'account' | 'learner';
  memberId: string;
  role: SpaceRole;
  joinedAt: string;
  name: string;
  isOwner: boolean;
  /**
   * [SA] AMENDMENTS-SEATS-ADMINS section 6.4: whether this caller may remove the member, computed by the Worker (a school
   * administrator: teachers only, never the owner or another administrator). Absent from a Worker older than SA-2.
   */
  canRemove?: boolean;
}

/** [SA] section 6.4 `GET /:id/admins`: one administrator of the school. `email` (the verified sign-in email) for the owner only. */
export interface AdminRow {
  accountId: string;
  name: string | null;
  email?: string | null;
  joinedAt: string;
  staysTeacher: boolean;
}

/** [SA] One school event of the owner's history (the last 20, names read at request time; null for a missing account). */
export interface AdminEventRow {
  kind: string;
  at: string;
  actorName: string | null;
  subjectName: string | null;
}

/** [SA] An open invite: no token, no link (the link is shown once, in the create answer). */
export interface AdminInviteRow {
  id: string;
  createdAt: string;
  expiresAt: string;
}

/** [SA] `GET /:id/admins`; `invites` and `events` come to the owner only. */
export interface AdminsView {
  owner: { accountId: string; name: string | null };
  admins: AdminRow[];
  limit: number;
  invites?: AdminInviteRow[];
  events?: AdminEventRow[];
}

/** [SA] `POST /admin-invites/preview`: an open invite, or the account is already an administrator of the school. */
export interface AdminInvitePreview {
  state: 'open' | 'already_admin';
  school: { name: string };
  invitedBy?: string | null;
  expiresAt?: string;
}

/** [SA] `POST /admin-invites/accept`: the school the account now runs, or `already_admin`. */
export interface AdminInviteAccepted {
  state?: 'already_admin';
  school?: { name: string };
  space: { id: string; kind: SpaceKind; name: string };
  role: 'admin';
}

export interface RelinkView {
  id: string;
  learnerId: string;
  learnerName: string;
  deviceId: string;
  platform: string | null;
  requestedAt: string;
  expiresAt: string;
  status: 'pending' | 'approved' | 'denied' | 'expired';
}

export type EntitlementView = Entitlement & { subjectName: string | null };

/** What a promotion / referral code is worth on a plan — F-ENT-002. */
export interface PromoCheckView {
  promo: Promo;
  price: { planKey: PurchasablePlanKey; listUsd: number; discountedUsd: number };
}

export interface SchoolClassRow {
  space: SpaceView;
  teacher: { accountId: string; name: string } | null;
  students: number;
  practiced: number;
  lastActiveAt: string | null;
  hasPublishedPlan: boolean;
  /** [SA] section 5.3: this grown-up may rename the class from the school page; absent reads as no. */
  canRename?: boolean;
  /** [SA] section 5.4: an open class move names this class. */
  openMoves?: boolean;
}

export interface SchoolView {
  school: SpaceView;
  invite: { joinCode: string | null; joinCodeExpiresAt: string | null };
  license: (EntitlementView & { active: boolean }) | null;
  limits: { licensed: boolean; students: number | null; teachers: number | null };
  usage: { students: number; teachers: number };
  thisWeek: { students: number; practiced: number; classes: number; classesWithPlan: number };
  classes: SchoolClassRow[];
  /** [SA] section 5.3: this grown-up may rename the school (its owner and administrators); absent reads as no. */
  canRename?: boolean;
}

/** One space's receipts for its payer — F-BILL-002 section 5.3 (`GET /api/billing/receipts`). */
export interface ReceiptsView {
  spaceName: string;
  receipts: ReceiptView[];
}

/**
 * Clerk's reverification hint (`clerk_error`), which the Worker sends with a
 * 403 `reverify_required` when money moves on a stale sign-in (F-BILL-002 B-5).
 * A failed result carries it as is, so the result itself is what
 * `useReverification` in @clerk/clerk-react recognises.
 */
export interface ClerkErrorHint {
  type?: unknown;
  reason?: unknown;
  metadata?: unknown;
}

export type ApiError = 'unauthorized' | 'forbidden' | 'not_found' | 'invalid' | 'network' | 'unknown';
/** `code` is the server envelope's error code when it sent one (e.g. stripe_not_configured). */
/** `details` is the envelope's `error.details`, kept only by the calls that read it (class moves: `startedBy`, `current`, `retryAfterSeconds`). */
export type ApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: ApiError; status: number; code?: string; clerk_error?: ClerkErrorHint; details?: Record<string, unknown> };

export interface ConsoleApiOptions {
  endpoint: string;
  /** A fixed bearer (dev sign-in) or a provider that fetches a fresh Clerk session token per request (F-AUTH-002). */
  token: string | (() => Promise<string | null>);
  fetchImpl?: typeof fetch;
}

/** The receipt rows this build can read; unknown keys (never a URL or a Stripe id) are stripped. */
function readableReceipts(rows: readonly unknown[]): ReceiptView[] {
  return rows.flatMap((row) => {
    const parsed = ReceiptViewSchema.safeParse(row);
    return parsed.success ? [parsed.data] : [];
  });
}

/** How many rows a raw summary sent, before the lenient read dropped any (an array or nothing). */
function rawRows(raw: unknown, key: 'cards' | 'account'): number {
  const rows = raw && typeof raw === 'object' ? (raw as Record<string, unknown>)[key] : undefined;
  return Array.isArray(rows) ? rows.length : 0;
}

/** Only an https link is ever navigated to: the page opens it in a tab that shares the app origin (section 4.10). */
function isHttpsUrl(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
}

function mapError(status: number): ApiError {
  if (status === 401) return 'unauthorized';
  if (status === 403) return 'forbidden';
  if (status === 404) return 'not_found';
  if (status === 422) return 'invalid';
  return 'unknown';
}

export function createConsoleApi(opts: ConsoleApiOptions) {
  const fetchImpl = opts.fetchImpl ?? globalThis.fetch;
  const base = `${opts.endpoint}/api/spaces`;
  const recovery = `${opts.endpoint}/api/recovery`;
  const entitlements = `${opts.endpoint}/api/entitlements`;
  const billing = `${opts.endpoint}/api/billing`;
  const adminInvites = `${opts.endpoint}/api/admin-invites`;
  const resolveToken = async (): Promise<string | null> => (typeof opts.token === 'string' ? opts.token : opts.token().catch(() => null));

  async function call<T>(url: string, init: RequestInit, okStatus: number[], callOpts: { details?: boolean } = {}): Promise<ApiResult<T>> {
    try {
      const token = await resolveToken();
      if (!token) return { ok: false, error: 'unauthorized', status: 401 }; // signed out mid-flight: no request leaves
      const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
      const res = await fetchImpl(url, { ...init, headers });
      const body = (await res.json().catch(() => ({}))) as { data?: T; error?: { code?: unknown; details?: unknown }; clerk_error?: unknown };
      if (!okStatus.includes(res.status) || body.data === undefined) {
        const code = typeof body.error?.code === 'string' ? body.error.code : undefined;
        const hint = body.clerk_error && typeof body.clerk_error === 'object' ? { clerk_error: body.clerk_error as ClerkErrorHint } : {};
        const details = callOpts.details && isPlainRecord(body.error?.details) ? { details: body.error.details } : {};
        return { ok: false, error: mapError(res.status), status: res.status, ...(code ? { code } : {}), ...hint, ...details };
      }
      return { ok: true, data: body.data };
    } catch {
      return { ok: false, error: 'network', status: -1 };
    }
  }

  return {
    listSpaces: () => call<{ spaces: SpaceListItem[] }>(base, { method: 'GET' }, [200]).then((r) => (r.ok ? { ok: true as const, data: r.data.spaces } : r)),
    createSpace: (input: { kind: SpaceKind; name: string; email?: string; displayName?: string; parentSpaceId?: string }) =>
      call<CreatedSpace>(base, { method: 'POST', body: JSON.stringify(input) }, [201]),
    regenerateCode: (spaceId: string) =>
      call<{ joinCode: string; expiresAt: string }>(`${base}/${encodeURIComponent(spaceId)}/code`, { method: 'POST' }, [200]),
    roster: (spaceId: string) => call<Roster>(`${base}/${encodeURIComponent(spaceId)}/roster`, { method: 'GET' }, [200]),
    listPlans: (spaceId: string) =>
      call<{ plans: PlanView[] }>(`${base}/${encodeURIComponent(spaceId)}/plans`, { method: 'GET' }, [200]).then((r) => (r.ok ? { ok: true as const, data: r.data.plans } : r)),
    savePlan: (spaceId: string, body: PlanSave) =>
      call<{ plan: PlanView }>(`${base}/${encodeURIComponent(spaceId)}/plans`, { method: 'PUT', body: JSON.stringify(body) }, [200, 201]).then((r) => (r.ok ? { ok: true as const, data: r.data.plan } : r)),
    archivePlan: (spaceId: string, planId: string) =>
      call<{ plan: PlanView }>(`${base}/${encodeURIComponent(spaceId)}/plans/${encodeURIComponent(planId)}/archive`, { method: 'POST' }, [200]).then((r) => (r.ok ? { ok: true as const, data: r.data.plan } : r)),
    members: (spaceId: string) =>
      call<{ members: MemberView[] }>(`${base}/${encodeURIComponent(spaceId)}/members`, { method: 'GET' }, [200]).then((r) => (r.ok ? { ok: true as const, data: r.data.members } : r)),
    removeMember: (spaceId: string, kind: 'account' | 'learner', memberId: string) =>
      call<{ removed: boolean }>(`${base}/${encodeURIComponent(spaceId)}/members/${kind}/${encodeURIComponent(memberId)}`, { method: 'DELETE' }, [200]),
    /** [SA] AMENDMENTS-SEATS-ADMINS section 5.2: `PATCH /:id/name`; the answer names the stored name and whether it changed. */
    renameSpace: (spaceId: string, name: string) =>
      call<{ space: SpaceView; changed: boolean }>(`${base}/${encodeURIComponent(spaceId)}/name`, { method: 'PATCH', body: JSON.stringify({ name }) }, [200]),
    patchSettings: (spaceId: string, patch: { anonymizeRoster?: boolean; consentMode?: 'parent' | 'school' }) =>
      call<{ space: SpaceView }>(`${base}/${encodeURIComponent(spaceId)}/settings`, { method: 'PATCH', body: JSON.stringify(patch) }, [200]).then((r) => (r.ok ? { ok: true as const, data: r.data.space } : r)),
    archiveSpace: (spaceId: string, archive: boolean) =>
      call<{ space: SpaceView }>(`${base}/${encodeURIComponent(spaceId)}/${archive ? 'archive' : 'unarchive'}`, { method: 'POST' }, [200]).then((r) => (r.ok ? { ok: true as const, data: r.data.space } : r)),
    deleteLearnerData: (spaceId: string, learnerId: string) =>
      call<{ deleted: boolean }>(`${base}/${encodeURIComponent(spaceId)}/learners/${encodeURIComponent(learnerId)}/data`, { method: 'DELETE' }, [200]),
    relinkRequests: (spaceId: string) =>
      call<{ requests: RelinkView[] }>(`${base}/${encodeURIComponent(spaceId)}/relink-requests`, { method: 'GET' }, [200]).then((r) => (r.ok ? { ok: true as const, data: r.data.requests } : r)),
    decideRelink: (spaceId: string, requestId: string, approve: boolean) =>
      call<{ request: RelinkView }>(`${base}/${encodeURIComponent(spaceId)}/relink-requests/${encodeURIComponent(requestId)}/${approve ? 'approve' : 'deny'}`, { method: 'POST' }, [200]).then((r) => (r.ok ? { ok: true as const, data: r.data.request } : r)),
    issueRescueCode: (learnerId: string) =>
      call<{ code: string; issuedAt: string }>(`${recovery}/issue`, { method: 'POST', body: JSON.stringify({ learnerId }) }, [201]),
    school: (spaceId: string) => call<SchoolView>(`${base}/${encodeURIComponent(spaceId)}/school`, { method: 'GET' }, [200]),
    /** [SA] AMENDMENTS-SEATS-ADMINS section 6.4: the school's owner and administrators (owner: also invites and history). */
    admins: (spaceId: string) => call<AdminsView>(`${base}/${encodeURIComponent(spaceId)}/admins`, { method: 'GET' }, [200]),
    /** [SA] A one-time invite link (step-up: a `403` carries Clerk's reverification hint as is). The link is never kept. */
    createAdminInvite: (spaceId: string) =>
      call<{ invite: AdminInviteRow; url: string | null }>(`${base}/${encodeURIComponent(spaceId)}/admin-invites`, { method: 'POST' }, [201]),
    revokeAdminInvite: (spaceId: string, inviteId: string) =>
      call<{ revoked: boolean }>(`${base}/${encodeURIComponent(spaceId)}/admin-invites/${encodeURIComponent(inviteId)}`, { method: 'DELETE' }, [200]),
    removeAdmin: (spaceId: string, accountId: string) =>
      call<{ removed: boolean; stays: 'teacher' | 'none' }>(`${base}/${encodeURIComponent(spaceId)}/admins/${encodeURIComponent(accountId)}`, { method: 'DELETE' }, [200]),
    leaveAdmin: (spaceId: string) => call<{ left: boolean; stays: 'teacher' | 'none' }>(`${base}/${encodeURIComponent(spaceId)}/admins/leave`, { method: 'POST' }, [200]),
    /** [SA] The token travels only in the JSON body, never in a path or a query (section 6.4). */
    previewAdminInvite: (token: string) => call<AdminInvitePreview>(`${adminInvites}/preview`, { method: 'POST', body: JSON.stringify({ token }) }, [200]),
    acceptAdminInvite: (token: string) => call<AdminInviteAccepted>(`${adminInvites}/accept`, { method: 'POST', body: JSON.stringify({ token }) }, [200]),
    addMember: (spaceId: string, accountId: string) =>
      call<{ alreadyMember: boolean }>(`${base}/${encodeURIComponent(spaceId)}/members`, { method: 'POST', body: JSON.stringify({ accountId, role: 'teacher' }) }, [200, 201]),
    entitlements: () =>
      call<{ entitlements: EntitlementView[] }>(entitlements, { method: 'GET' }, [200]).then((r) => (r.ok ? { ok: true as const, data: r.data.entitlements } : r)),
    checkout: (body: { planKey: PurchasablePlanKey; subjectKind: 'space'; subjectId: string; promoCode?: string }) =>
      call<{ url: string }>(`${entitlements}/stripe/checkout`, { method: 'POST', body: JSON.stringify(body) }, [200]),
    checkPromo: (body: { code: string; planKey: PurchasablePlanKey }) => call<PromoCheckView>(`${entitlements}/stripe/promo`, { method: 'POST', body: JSON.stringify(body) }, [200]),
    portal: (body: { subjectKind: 'account' | 'space'; subjectId: string }) =>
      call<{ url: string }>(`${entitlements}/stripe/portal`, { method: 'POST', body: JSON.stringify(body) }, [200]),
    /**
     * F-BROWSE-001 section 5.4: the account's All lessons scope (`GET /api/entitlements/browse`), read leniently:
     * `full` stays `full`; anything else, a scope a newer Worker adds included, reads as `sampler` (never `full`).
     */
    browseScope: (): Promise<ApiResult<{ scope: 'full' | 'sampler' }>> =>
      call<unknown>(`${entitlements}/browse`, { method: 'GET' }, [200]).then((r) => {
        if (!r.ok) return r;
        const scope = isPlainRecord(r.data) && r.data.scope === 'full' ? 'full' : 'sampler';
        return { ok: true as const, data: { scope } };
      }),
    /**
     * F-BILL-002 B-7: the billing home's summary, read leniently (`parseBillingSummary`), so a
     * newer Worker never blanks an older page. `poll` marks a checkout-return poll (no view event).
     */
    billingSummary: (options: { poll?: boolean } = {}): Promise<ApiResult<BillingSummary>> =>
      call<unknown>(`${billing}/summary${options.poll ? '?poll=1' : ''}`, { method: 'GET' }, [200]).then((r) => {
        if (!r.ok) return r;
        const summary = parseBillingSummary(r.data);
        // Every row dropped (a newer Worker): not the "no spaces yet" empty state, which would
        // send an owner who already pays to set up a second family or class.
        const sent = rawRows(r.data, 'cards') + rawRows(r.data, 'account');
        const allDropped = summary !== null && sent > 0 && summary.cards.length + summary.account.length === 0;
        return summary && !allDropped ? { ok: true as const, data: summary } : { ok: false as const, error: 'unknown' as const, status: 200, code: 'unreadable_summary' };
      }),
    /** One space's receipts (payers only); a row this build cannot read is dropped, its siblings stay. */
    receipts: (spaceId: string): Promise<ApiResult<ReceiptsView>> =>
      call<{ spaceName?: unknown; receipts?: unknown }>(`${billing}/receipts?id=${encodeURIComponent(spaceId)}`, { method: 'GET' }, [200]).then((r) => {
        if (!r.ok) return r;
        const { spaceName, receipts } = r.data;
        if (typeof spaceName !== 'string' || !Array.isArray(receipts)) return { ok: false as const, error: 'unknown' as const, status: 200, code: 'unreadable_receipts' };
        return { ok: true as const, data: { spaceName, receipts: readableReceipts(receipts) } };
      }),
    /** A fresh Stripe receipt or invoice link for one row; step-up and the live guard apply (B-4, B-5). */
    receiptLink: (id: string): Promise<ApiResult<{ url: string }>> =>
      call<{ url?: unknown }>(`${billing}/receipt-link`, { method: 'POST', body: JSON.stringify({ id }) }, [200]).then((r) => {
        if (!r.ok) return r;
        const { url } = r.data;
        return isHttpsUrl(url) ? { ok: true as const, data: { url } } : { ok: false as const, error: 'unknown' as const, status: 200, code: 'unreadable_link' };
      }),
    /**
     * One learner's report (F-REPORT-001 section 3.8): the roster's projection of that learner only, never another
     * learner or a class figure. `period` only labels the Worker's `report.viewed` event. The body is parsed, so the
     * report module reads a known shape: keys it does not read are stripped, a malformed `activity` reads as absent
     * (the legacy state), and a body it cannot read at all (a space kind this bundle does not know) is a failed load.
     * `refresh`: the background read of a report already open (F-LEARN-001 section 3.11), which the Worker does not count
     * as a view.
     */
    getLearnerReport: (spaceId: string, learnerId: string, period: ReportPeriod, options: { refresh?: boolean } = {}): Promise<ApiResult<LearnerReportBody>> =>
      call<unknown>(`${base}/${encodeURIComponent(spaceId)}/learners/${encodeURIComponent(learnerId)}/report?period=${period}${options.refresh ? '&refresh=1' : ''}`, { method: 'GET' }, [200]).then(
        (r): ApiResult<LearnerReportBody> => {
          if (!r.ok) return r;
          const data = parseLearnerReport(r.data);
          return data === null ? { ok: false, error: 'unknown', status: 200, code: 'bad_response' } : { ok: true, data };
        },
      ),
    // Class moves (F-SPACE-002 section 4.4, PR T-6a). `spaceId` is the acting space (the source or destination class,
    // or the family); the learner id travels in the body only and a request by its opaque `transfer:` id (T14). Every
    // answer goes through `noteTransferResult`, so the first `422 transfers_locked` hides the entry points.
    /** Resolves the code; writes nothing (except a failed-code count). A class sees the class name only. */
    previewTransfer: (spaceId: string, body: TransferPreviewBody): Promise<ApiResult<TransferPreview>> =>
      transferCall<TransferPreview>(`${transfers(spaceId)}/preview`, { method: 'POST', body: JSON.stringify(body) }, [200]),
    /** 201 with the new request, or 200 with the caller's own open one (idempotent). */
    createTransfer: (spaceId: string, body: TransferCreateBody): Promise<ApiResult<TransferView>> =>
      transferCall<{ request?: unknown }>(transfers(spaceId), { method: 'POST', body: JSON.stringify(body) }, [200, 201]).then(requestOf),
    /** The space's requests (class: both roles; family: its learners, with `options`; school: `counts`), read leniently. */
    transferRequests: (spaceId: string): Promise<ApiResult<TransferList>> =>
      transferCall<unknown>(transfers(spaceId), { method: 'GET' }, [200]).then((r) => (r.ok ? { ok: true as const, data: readTransferList(r.data) } : r)),
    approveTransfer: (spaceId: string, transferId: string, body: TransferApproveBody): Promise<ApiResult<TransferView>> =>
      transferCall<{ request?: unknown }>(`${transfers(spaceId)}/${encodeURIComponent(transferId)}/approve`, { method: 'POST', body: JSON.stringify(body) }, [200]).then(requestOf),
    declineTransfer: (spaceId: string, transferId: string, body: TransferDeclineBody): Promise<ApiResult<TransferView>> =>
      transferCall<{ request?: unknown }>(`${transfers(spaceId)}/${encodeURIComponent(transferId)}/decline`, { method: 'POST', body: JSON.stringify(body) }, [200]).then(requestOf),
    cancelTransfer: (spaceId: string, transferId: string): Promise<ApiResult<TransferView>> =>
      transferCall<{ request?: unknown }>(`${transfers(spaceId)}/${encodeURIComponent(transferId)}/cancel`, { method: 'POST', body: '{}' }, [200]).then(requestOf),
    retryTransfer: (spaceId: string, transferId: string): Promise<ApiResult<TransferView>> =>
      transferCall<{ request?: unknown }>(`${transfers(spaceId)}/${encodeURIComponent(transferId)}/retry`, { method: 'POST', body: '{}' }, [200]).then(requestOf),
    /** The guardian's switch (`:id` a family): teacher requests on or off for one learner. */
    setTransferPrefs: (spaceId: string, learnerId: string, body: TransferFamilyPrefsBody): Promise<ApiResult<TransferPrefs>> =>
      transferCall<{ prefs?: unknown }>(`${base}/${encodeURIComponent(spaceId)}/learners/${encodeURIComponent(learnerId)}/transfer-prefs`, { method: 'PUT', body: JSON.stringify(body) }, [200]).then(
        (r): ApiResult<TransferPrefs> => {
          if (!r.ok) return r;
          const prefs = r.data.prefs;
          return isPlainRecord(prefs) && typeof prefs.blockTeacherRequests === 'boolean' && typeof prefs.selfManaged === 'boolean'
            ? { ok: true, data: { blockTeacherRequests: prefs.blockTeacherRequests, selfManaged: prefs.selfManaged } }
            : BAD_RESPONSE;
        },
      ),
    /**
     * One class's statistics (F-REPORT-001 section 3.8, RP-8): aggregates only, never a learner id, name or per-learner
     * row. `at` (a day key) selects a past window on the day, week and month tabs; the Worker echoes the window it
     * read (`classAtOf`). The report is parsed with its schema; the envelope keeps only the space fields the page reads.
     */
    getClassReport: (spaceId: string, period: ReportPeriod, at: string | null): Promise<ApiResult<ClassReportBody>> =>
      call<unknown>(
        `${base}/${encodeURIComponent(spaceId)}/class-report?period=${period}${period !== 'all' && at !== null && isDateKey(at) ? `&at=${at}` : ''}`,
        { method: 'GET' },
        [200],
      ).then((r): ApiResult<ClassReportBody> => {
        if (!r.ok) return r;
        const data = parseClassReport(r.data);
        return data === null ? { ok: false, error: 'unknown', status: 200, code: 'bad_response' } : { ok: true, data };
      }),
    // [TV] Teacher moves and the class-scope update (AMENDMENTS-TEACHER-VISIBILITY-TRANSFER section 4.3). The learner id
    // travels in the body or the query only, a move by its opaque `move:` id. Move answers go through
    // `noteTransferResult` (the first `transfers_locked` hides the entry points); the acknowledgement is never locked.
    classMoveDestinations: (spaceId: string, learnerId: string): Promise<ApiResult<ClassMoveDestination[]>> =>
      transferCall<unknown>(`${classMoves(spaceId)}/destinations?learnerId=${encodeURIComponent(learnerId)}`, { method: 'GET' }, [200]).then((r) => (r.ok ? { ok: true as const, data: readDestinations(r.data) } : r)),
    previewClassMove: (spaceId: string, body: { learnerId: string; code: string }): Promise<ApiResult<ClassMovePreview>> =>
      transferCall<unknown>(`${classMoves(spaceId)}/preview`, { method: 'POST', body: JSON.stringify(body) }, [200]).then((r): ApiResult<ClassMovePreview> => {
        if (!r.ok) return r;
        const preview = readPreview(r.data);
        return preview ? { ok: true, data: preview } : { ok: false, error: 'unknown', status: 200, code: 'bad_response' };
      }),
    createClassMove: (spaceId: string, body: { learnerId: string; destinationSpaceId: string; code?: string }): Promise<ApiResult<OutgoingMove>> =>
      transferCall<{ move?: unknown }>(classMoves(spaceId), { method: 'POST', body: JSON.stringify(body) }, [200, 201]).then((r) => moveOf(r, readOutgoing)),
    classMoves: (spaceId: string): Promise<ApiResult<ClassMoveLists>> =>
      transferCall<unknown>(classMoves(spaceId), { method: 'GET' }, [200]).then((r) => (r.ok ? { ok: true as const, data: readMoveLists(r.data) } : r)),
    acceptClassMove: (spaceId: string, moveId: string): Promise<ApiResult<IncomingMove>> =>
      transferCall<{ move?: unknown }>(`${classMoves(spaceId)}/${encodeURIComponent(moveId)}/accept`, { method: 'POST', body: '{}' }, [200]).then((r) => moveOf(r, readIncoming)),
    declineClassMove: (spaceId: string, moveId: string): Promise<ApiResult<IncomingMove>> =>
      transferCall<{ move?: unknown }>(`${classMoves(spaceId)}/${encodeURIComponent(moveId)}/decline`, { method: 'POST', body: '{}' }, [200]).then((r) => moveOf(r, readIncoming)),
    cancelClassMove: (spaceId: string, moveId: string): Promise<ApiResult<OutgoingMove>> =>
      transferCall<{ move?: unknown }>(`${classMoves(spaceId)}/${encodeURIComponent(moveId)}/cancel`, { method: 'POST', body: '{}' }, [200]).then((r) => moveOf(r, readOutgoing)),
    moveNotices: (familyId: string): Promise<ApiResult<MoveNotice[]>> =>
      transferCall<unknown>(classMoves(familyId), { method: 'GET' }, [200]).then((r) => (r.ok ? { ok: true as const, data: readNotices(r.data) } : r)),
    markMoveSeen: (familyId: string, moveId: string): Promise<ApiResult<{ seen: boolean }>> =>
      transferCall<{ seen: boolean }>(`${classMoves(familyId)}/${encodeURIComponent(moveId)}/seen`, { method: 'POST', body: '{}' }, [200]),
    classScope: (familyId: string): Promise<ApiResult<ClassScopeState>> =>
      call<unknown>(`${base}/${encodeURIComponent(familyId)}/class-scope`, { method: 'GET' }, [200]).then((r): ApiResult<ClassScopeState> => {
        if (!r.ok) return r;
        const state = readClassScope(r.data);
        return state ? { ok: true, data: state } : { ok: false, error: 'unknown', status: 200, code: 'bad_response' };
      }),
    acknowledgeClassScope: (familyId: string, learnerId: string, version: string): Promise<ApiResult<{ version: string; ackedAt: string }>> =>
      call<{ version: string; ackedAt: string }>(`${base}/${encodeURIComponent(familyId)}/learners/${encodeURIComponent(learnerId)}/class-scope`, { method: 'POST', body: JSON.stringify({ version }) }, [200], { details: true }),
  };

  function classMoves(spaceId: string): string {
    return `${base}/${encodeURIComponent(spaceId)}/class-moves`;
  }

  function moveOf<T>(r: ApiResult<{ move?: unknown }>, read: (v: Record<string, unknown>) => T | null): ApiResult<T> {
    if (!r.ok) return r;
    const move = isPlainRecord(r.data.move) ? read(r.data.move) : null;
    return move ? { ok: true, data: move } : { ok: false, error: 'unknown', status: 200, code: 'bad_response' };
  }

  function transfers(spaceId: string): string {
    return `${base}/${encodeURIComponent(spaceId)}/transfer-requests`;
  }

  async function transferCall<T>(url: string, init: RequestInit, okStatus: number[]): Promise<ApiResult<T>> {
    const result = await call<T>(url, init, okStatus, { details: true });
    noteTransferResult(result);
    return result;
  }
}

// ---------------------------------------------------------------------------
// Class moves (F-SPACE-002 section 4.2 "Views"; the Worker's `lib/transfer-views.ts`). Each party has its own view;
// an ending reads `ended` for everyone, and only the decider's own view carries `endedByYou` and its reason.

/** `ended` stands for declined, cancelled and expired alike, so the status itself never says who decided. */
export type TransferViewStatus = 'requested' | 'approved' | 'executed' | 'ended';

/** Each side's step; null once the request ended (the steps of an ended request would hint who said no). */
export interface TransferSteps {
  learner: TransferStepState;
  source: TransferStepState;
  destination: TransferStepState;
}

interface TransferClassViewCommon {
  id: string;
  status: TransferViewStatus;
  steps: TransferSteps | null;
  agreedBySchoolAdmin: boolean;
  /** The earliest move date once everyone agreed (`approved`). */
  scheduledFor: string | null;
  /** Why an agreed move waits for room (`approved` only). */
  blockReason: TransferBlockReason | null;
  createdAt: string;
  expiresAt: string;
  executedAt: string | null;
  endedAt: string | null;
  endedByYou: boolean;
  endReason: TransferEndReason | null;
}

export interface TransferSourceView extends TransferClassViewCommon {
  role: 'source';
  initiator: TransferInitiator;
  /** Only on a request this class started, before the move. */
  learnerId: string | null;
  /** While open; null afterwards, so history keeps no name. */
  learner: { name: string; avatar: string } | null;
  /** Only when this class started it or the family chose to introduce it. */
  destination: { spaceId: string; name: string } | null;
}

export interface TransferDestinationView extends TransferClassViewCommon {
  role: 'destination';
  /** Initials (`rosterAlias`) until the move, never the learner id (T8). */
  learner: { name: string; avatar: string; level: string } | null;
  comingFrom: { name: string } | null;
}

/** What the learner side is told about the destination (owner, school, age bucket, size), so a typed name is not the only identity. */
export interface TransferDestinationFacts {
  ownerName: string | null;
  schoolName: string | null;
  ageBucket: string | null;
  learnerCount: number;
}

/** The consent sheet's server flags and `visibleToday` (section 4.11). */
export interface TransferSheetTerms {
  premiumChange: TransferPremiumChange;
  destinationConsentMode: SpaceSettings['consentMode'];
  relinkAffected: boolean;
  sourcePlansAffected: boolean;
  visibleToday: InboxVisibleSpace[];
}

export interface TransferLearnerSideView extends TransferSheetTerms {
  id: string;
  role: 'learner_side';
  status: TransferViewStatus;
  initiator: TransferInitiator;
  learner: { id: string; name: string };
  from: { spaceId: string; name: string };
  to: { spaceId: string; name: string } & TransferDestinationFacts;
  learnerState: LearnerSlotState;
  sourceState: TransferStepState;
  destinationState: TransferStepState;
  introduce: boolean;
  blockReason: TransferBlockReason | null;
  executeAfter: string | null;
  createdAt: string;
  expiresAt: string;
  executedAt: string | null;
  endedAt: string | null;
  learnerRoute: TransferLearnerRoute;
  endedFrom: TransferEndedFrom | null;
  /** The digest of the sheet this view shows while the learner slot is open (sent back on approve); null otherwise. */
  termsDigest: string | null;
}

export type TransferView = TransferSourceView | TransferDestinationView | TransferLearnerSideView;

/** A family's learner and their live classes, for Start a move (`options`). */
export interface TransferOption {
  learnerId: string;
  name: string;
  classes: { spaceId: string; name: string }[];
  selfManaged: boolean;
  blockTeacherRequests: boolean;
}

/** A school's count of waiting moves per child class (`TransferSchoolCountView`). */
export interface TransferSchoolCount {
  spaceId: string;
  waiting: number;
}

export interface TransferList {
  requests: TransferView[];
  options?: TransferOption[];
  counts?: TransferSchoolCount[];
}

/**
 * A preview: a class sees `{ destination: { id, kind, name } }` only; the learner side also gets the destination
 * facts, the sheet's terms and `termsDigest` (section 4.4).
 */
export type TransferPreview =
  | { destination: { id: string; kind: SpaceKind; name: string } }
  | ({ destination: { id: string; kind: SpaceKind; name: string } & TransferDestinationFacts; termsDigest: string } & TransferSheetTerms);

export interface TransferPrefs {
  blockTeacherRequests: boolean;
  selfManaged: boolean;
}

const BAD_RESPONSE = { ok: false as const, error: 'unknown' as const, status: 200, code: 'bad_response' };

const VIEW_ROLES: ReadonlySet<string> = new Set(['source', 'destination', 'learner_side']);
const VIEW_STATUSES: ReadonlySet<string> = new Set(['requested', 'approved', 'executed', 'ended']);

/**
 * A view this build can word: a known role and status and a string id. API answers are cast, not parsed, so a role
 * or status a newer Worker adds (deployed first, an old console bundle cached) is dropped instead of reaching the
 * role-keyed copy.
 */
function readableView(raw: unknown): raw is TransferView {
  return isPlainRecord(raw) && typeof raw.id === 'string' && typeof raw.role === 'string' && VIEW_ROLES.has(raw.role) && typeof raw.status === 'string' && VIEW_STATUSES.has(raw.status);
}

function requestOf(r: ApiResult<{ request?: unknown }>): ApiResult<TransferView> {
  if (!r.ok) return r;
  return readableView(r.data.request) ? { ok: true, data: r.data.request } : BAD_RESPONSE;
}

function readTransferList(raw: unknown): TransferList {
  const data = isPlainRecord(raw) ? raw : {};
  const list: TransferList = { requests: Array.isArray(data.requests) ? data.requests.filter(readableView) : [] };
  if (Array.isArray(data.options)) {
    list.options = data.options.filter(
      (o): o is TransferOption => isPlainRecord(o) && typeof o.learnerId === 'string' && typeof o.name === 'string' && Array.isArray(o.classes) && typeof o.selfManaged === 'boolean' && typeof o.blockTeacherRequests === 'boolean',
    );
  }
  if (Array.isArray(data.counts)) {
    list.counts = data.counts.filter((c): c is TransferSchoolCount => isPlainRecord(c) && typeof c.spaceId === 'string' && typeof c.waiting === 'number');
  }
  return list;
}

/** The part of `ClassReportResponse` the class report page reads (RP-8): the space's id, kind, name and archived time. */
export interface ClassReportBody {
  space: LearnerReportBody['space'];
  period: ReportPeriod;
  /** The window the figures read (null: the current one, or a Worker from before the echo). */
  at: string | null;
  serverTime: string;
  report: ClassReport;
}

function parseClassReport(raw: unknown): ClassReportBody | null {
  if (!isPlainRecord(raw) || !isPlainRecord(raw.space)) return null;
  const { space } = raw;
  const kind = SpaceKindSchema.safeParse(space.kind);
  if (!kind.success || typeof space.id !== 'string' || typeof space.name !== 'string' || !isStringOrNull(space.archivedAt)) return null;
  const period = ReportPeriodSchema.safeParse(raw.period);
  const report = ClassReportSchema.safeParse(raw.report);
  if (!period.success || !report.success || typeof raw.serverTime !== 'string') return null;
  const at = typeof raw.at === 'string' && isDateKey(raw.at) ? raw.at : null;
  return { space: { id: space.id, kind: kind.data, name: space.name, archivedAt: space.archivedAt }, period: period.data, at, serverTime: raw.serverTime, report: report.data };
}

export type ConsoleApi = ReturnType<typeof createConsoleApi>;

const PLAN_ROW = ProgressSummarySchema.shape.planProgress.valueSchema;
const isPlainRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);

/**
 * The part of `LearnerReportResponse` a report reads (F-REPORT-001 section 3.8): the space's id, kind, name and
 * archived time, the learner's id and roster name, the summary and the two times. The Worker's other envelope fields
 * (the space's settings, parent and creation time, the learner's avatar and dates) are not read, so they are not
 * checked or kept: a Worker deployed first that widens one of them cannot fail a report on a cached console bundle.
 */
export interface LearnerReportBody {
  space: Pick<LearnerReportResponse['space'], 'id' | 'kind' | 'name' | 'archivedAt'>;
  /** `avatar` only for the title's decorative chip (RP-7a2); null when the Worker sends a value this bundle cannot read. */
  learner: Pick<LearnerReportResponse['learner'], 'id' | 'displayName'> & { avatar: string | null };
  summary: ReportSummary | null;
  lastSyncedAt: string | null;
  serverTime: string;
  /** [TV] Which projection this viewer read; null from an older Worker. */
  scope?: 'base' | 'full' | null;
  /** [TV] The learner's server-held settings (full scope only); null when not sent. */
  settings?: { classNotes: NotesMode | null } | null;
}

const isStringOrNull = (value: unknown): value is string | null => value === null || typeof value === 'string';

/** The envelope's read fields, each checked on its own type only; null when one is missing or a space kind is unknown. */
function reportEnvelopeOf(raw: Record<string, unknown>): Omit<LearnerReportBody, 'summary'> | null {
  const { space, learner, lastSyncedAt, serverTime } = raw;
  if (!isPlainRecord(space) || !isPlainRecord(learner)) return null;
  const kind = SpaceKindSchema.safeParse(space.kind);
  if (!kind.success || typeof space.id !== 'string' || typeof space.name !== 'string' || !isStringOrNull(space.archivedAt)) return null;
  if (typeof learner.id !== 'string' || typeof learner.displayName !== 'string') return null;
  if (!isStringOrNull(lastSyncedAt) || typeof serverTime !== 'string') return null;
  return {
    space: { id: space.id, kind: kind.data, name: space.name, archivedAt: space.archivedAt },
    learner: { id: learner.id, displayName: learner.displayName, avatar: typeof learner.avatar === 'string' ? learner.avatar : null },
    lastSyncedAt,
    serverTime,
    ...readReportScope(raw),
  };
}

/**
 * The learner report body (F-REPORT-001 section 3.8), read as leniently as the Worker writes it (`reportSummaryOf`):
 * the envelope keeps only the fields the report reads (`LearnerReportBody`), and each summary key, and each plan of
 * `planProgress`, is checked on its own and a key this bundle cannot read is dropped. So a Worker deployed first with
 * a wider schema never turns every report into a failed load while an older console bundle is still cached. Null for
 * a body it cannot read (a missing read field, or a space kind this bundle does not know).
 */
function parseLearnerReport(raw: unknown): LearnerReportBody | null {
  if (!isPlainRecord(raw)) return null;
  const envelope = reportEnvelopeOf(raw);
  if (envelope === null) return null;
  const source = raw.summary;
  if (source === null || source === undefined) return { ...envelope, summary: null };
  if (!isPlainRecord(source)) return null;
  const summary: Record<string, unknown> = {};
  for (const [key, field] of Object.entries(ReportSummarySchema.shape)) {
    const value = source[key];
    if (value === undefined) continue;
    if (key === 'planProgress' && isPlainRecord(value)) {
      summary.planProgress = Object.fromEntries(
        Object.entries(value).flatMap(([planId, row]) => {
          const checked = PLAN_ROW.safeParse(row);
          return checked.success ? [[planId, checked.data]] : [];
        }),
      );
      continue;
    }
    const checked = field.safeParse(value);
    if (checked.success && checked.data !== undefined) summary[key] = checked.data;
  }
  return { ...envelope, summary: summary as ReportSummary };
}
